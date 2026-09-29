import io
import os
import re
import json
import logging
from typing import List, Optional, Union, Dict, Any
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from pydantic import BaseModel, Field
import httpx

from middleware.error_handler import PipelineException
from core.config import settings
from services.interview_service import call_openai_chat

try:
    import pymupdf as fitz
except ImportError:
    try:
        import fitz
    except ImportError:
        fitz = None

router = APIRouter(prefix="/api/v1/resume", tags=["PDF Resume Extraction"])
logger = logging.getLogger("preppr-resume-extraction")

OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://localhost:11434/api/generate")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", getattr(settings, "MODEL_NAME", "qwen2.5:7b"))

COMMON_TECH_SKILLS = [
    "Python", "JavaScript", "TypeScript", "React", "Next.js", "FastAPI", "Node.js", "Express",
    "Django", "Flask", "Go", "Golang", "Java", "C++", "C#", "Rust", "Ruby", "PHP", "Swift", "Kotlin",
    "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "Cassandra", "DynamoDB", "SQLite",
    "Docker", "Kubernetes", "AWS", "Amazon Web Services", "GCP", "Google Cloud", "Azure", "Terraform",
    "GraphQL", "REST APIs", "gRPC", "Kafka", "RabbitMQ", "Microservices", "CI/CD", "Git", "GitHub",
    "Linux", "TailwindCSS", "HTML", "CSS", "SQL", "PyTorch", "TensorFlow", "Pandas", "NumPy", "Scikit-Learn",
    "System Design", "Distributed Systems", "Object-Oriented Programming", "Agile", "Scrum"
]


class ResumeExtractionResponse(BaseModel):
    candidate_name: Optional[str] = Field(None, description="Candidate's full name", example="Jane Doe")
    email: Optional[str] = Field(None, description="Candidate's email address", example="jane.doe@example.com")
    phone: Optional[str] = Field(None, description="Candidate's phone number", example="+1-555-0199")
    experience_years: Optional[Union[float, int, str]] = Field(None, description="Years of relevant work experience", example=5)
    skills: List[str] = Field(default_factory=list, description="Extracted technical and professional skills", example=["Python", "FastAPI", "PostgreSQL"])
    past_roles: List[Union[str, Dict[str, Any]]] = Field(default_factory=list, description="List of previous job titles or roles", example=["Senior Software Engineer", "Backend Developer"])
    suggested_interview_questions: List[str] = Field(
        default_factory=list,
        description="Suggested interview questions based on candidate profile",
        example=[
            "Can you describe a challenging microservice architecture you designed?",
            "How do you approach database optimization in PostgreSQL?"
        ]
    )


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Extracts raw text content from uploaded PDF bytes using PyMuPDF (fitz) or fallbacks.
    """
    # 1. Try fitz / pymupdf
    if fitz is not None:
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            text_pages = []
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                text_pages.append(page.get_text())
            doc.close()

            full_text = "\n".join(text_pages).strip()
            if full_text:
                return full_text
        except Exception as e:
            logger.warning(f"fitz PDF extraction error: {e}")

    # 2. Try pypdf
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        pages_text = [page.extract_text() or "" for page in reader.pages]
        full_text = "\n".join(pages_text).strip()
        if full_text:
            return full_text
    except Exception:
        pass

    # 3. Try PyPDF2
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        pages_text = [page.extract_text() or "" for page in reader.pages]
        full_text = "\n".join(pages_text).strip()
        if full_text:
            return full_text
    except Exception:
        pass

    # 4. Fallback decode
    return pdf_bytes.decode("utf-8", errors="ignore")


def clean_pdf_text(text: str) -> str:
    """
    Cleans FontAwesome icon glyphs, font icon names (envelope, phone, globe, etc.),
    and unicode bullet artifacts from PDF text.
    """
    if not text:
        return ""

    # 1. Strip all unicode Private Use Area glyphs, emoji blocks, and symbol ranges used by icon fonts (FontAwesome, Material, etc.)
    # Private Use Area: \uE000-\uF8FF, \U000F0000-\U000FFFFD, \U000E0000-\U000E007F
    # Misc Symbols / Dingbats / Pictographs / Emojis: \u2600-\u27BF, \U0001F000-\U0001FAFF
    # Bullet points: \u2022, \u25cf, \u25cb, \u25aa, \u25ab, \u25e6, \u2043, \u2219, \u00b7
    icon_chars_regex = (
        r'[\ue000-\uf8ff\U000e0000-\U000e007f\U000f0000-\U000ffffd'
        r'\u2600-\u27bf\U0001f000-\U0001faff'
        r'\u2022\u25cf\u25cb\u25aa\u25ab\u25e6\u2043\u2219\u00b7'
        r'✉📧📞📱🌐📍🏠🔗💼🎓🏷️]'
    )
    text = re.sub(icon_chars_regex, ' ', text)

    # 2. Strip icon text labels and font-ligatures (like fa-envelope, envelope, phone, globe, linkedin, etc.)
    icon_words_regex = (
        r'(?i)\b('
        r'fa-[a-z0-9-]+|fa[a-z0-9]+|'
        r'envelope(-o|-open|-square)?|envelop|'
        r'phone(-alt|-square)?|telephone|mobile(-alt)?|cell|'
        r'globe(-americas|-europe|-asia|-africa)?|'
        r'linkedin(-in|-square)?|github(-square|-alt)?|'
        r'map-marker(-alt)?|map-pin|location(-arrow|-dot)?|'
        r'address-card|address-book|calendar(-alt|-check)?|'
        r'briefcase|graduation-cap|id-badge'
        r')\b'
    )
    text = re.sub(icon_words_regex, ' ', text)

    # 3. Clean enclosed icon markers like [envelope], (phone), etc.
    text = re.sub(r'(?i)[\[\(\<\{]?(?:envelope|phone|mobile|globe|linkedin|github|location|address)[\]\)\>\}]?', ' ', text)

    return text


def heuristic_parse_resume(raw_text: str) -> Dict[str, Any]:
    """
    Intelligent regex and section-based parser to extract structured profile
    directly from raw text without icon artifacts or fake experience.
    """
    cleaned_text = clean_pdf_text(raw_text)
    raw_lines = [l.strip() for l in cleaned_text.split("\n") if l.strip()]

    # 1. Candidate Name: First clean non-heading line from top of document
    candidate_name = ""
    exclude_words = {
        "envelope", "envelop", "email", "mail", "phone", "mobile", "tel", "telephone", "cell", "contact",
        "address", "location", "city", "state", "linkedin", "github", "portfolio", "website", "web",
        "resume", "curriculum", "vitae", "summary", "objective", "skills", "education", "profile",
        "experience", "projects", "page", "icon", "fa", "www", "http", "https", "com", "net", "org",
        "university", "college", "school", "bachelor", "master", "phd", "btech", "mtech", "b.tech", "m.tech",
        "senior", "junior", "lead", "engineer", "developer", "intern", "candidate", "name"
    }

    for line in raw_lines[:10]:
        line_clean = re.sub(r'(?i)\b(fa-[a-z0-9-]+|envelope|phone|email|mail|contact|mobile|github|linkedin|location|address|portfolio|website)\b', '', line).strip(' :-|•\t,()[]')
        words = line_clean.split()
        if 1 <= len(words) <= 4:
            if not any(w.lower() in exclude_words for w in words) and not any(h in line_clean.lower() for h in ["@", ".com", "http", "/", "\\", "+", "github.com", "linkedin.com"]):
                clean_name = re.sub(r'[^a-zA-Z\s\.\-]', '', line_clean).strip()
                if len(clean_name) >= 3 and not clean_name.lower().startswith("page"):
                    candidate_name = clean_name
                    break

    if not candidate_name:
        candidate_name = "Candidate"

    # 2. Email Address
    email_match = re.search(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', raw_text)
    email = email_match.group(0) if email_match else None
    if email:
        email = re.sub(r'(?i)^(envelope|email|mail|contact)\s*[:\-\s]*', '', email).strip()

    # 3. Phone Number
    phone_match = re.search(r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', raw_text)
    phone = phone_match.group(0) if phone_match else None
    if phone:
        phone = re.sub(r'(?i)^(envelope|phone|mobile|tel|telephone|contact)\s*[:\-\s]*', '', phone).strip()

    # 4. Extract Technical Skills (ONLY matched from document)
    found_skills = []
    text_lower = cleaned_text.lower()
    for skill in COMMON_TECH_SKILLS:
        pattern = r'\b' + re.escape(skill.lower()) + r'\b'
        if re.search(pattern, text_lower):
            found_skills.append(skill)

    # 5. Identify Experience / Employment Section & Extract Real Roles
    past_roles = []
    in_exp_section = False
    section_headers = ["experience", "work experience", "employment", "work history", "professional experience", "internships"]
    stop_headers = ["education", "skills", "projects", "certifications", "awards", "publications", "interests", "languages"]

    role_keywords = [
        "software engineer", "software developer", "backend developer", "backend engineer",
        "frontend developer", "frontend engineer", "full stack", "fullstack",
        "intern", "software intern", "developer intern", "data engineer", "data scientist",
        "devops engineer", "cloud engineer", "architect", "tech lead", "technical lead",
        "engineering manager", "research assistant", "teaching assistant", "associate", "consultant"
    ]

    for line in raw_lines:
        line_lower = line.lower().strip(" :#-_")
        if any(line_lower == h or line_lower.startswith(h + " ") for h in section_headers):
            in_exp_section = True
            continue
        elif in_exp_section and any(line_lower == sh or line_lower.startswith(sh + " ") for sh in stop_headers):
            in_exp_section = False
            break

        if in_exp_section and len(line) < 100:
            clean_role_line = re.sub(r'(?i)\b(fa-[a-z0-9-]+|envelope|phone|email|mail|linkedin|github|location|address)\b', '', line).strip(' :-|•\t,()[]')
            if clean_role_line and (any(rk in clean_role_line.lower() for rk in role_keywords) or re.search(r'\b(20[0-2][0-9]|199[0-9])\b', clean_role_line)):
                past_roles.append(clean_role_line)
                if len(past_roles) >= 6:
                    break

    # If section parsing didn't catch roles, look globally for explicit job title lines
    if not past_roles:
        for line in raw_lines:
            line_l = line.lower()
            if any(rk in line_l for rk in role_keywords) and len(line) < 80 and not any(sh in line_l for sh in stop_headers):
                clean_role_line = re.sub(r'(?i)\b(fa-[a-z0-9-]+|envelope|phone|email|mail|linkedin|github|location|address)\b', '', line).strip(' :-|•\t,()[]')
                if clean_role_line and clean_role_line.lower() not in {"envelope", "phone", "email", "skills"}:
                    past_roles.append(clean_role_line)
                    if len(past_roles) >= 4:
                        break

    # 6. Extract Years of Experience (0 if fresher / no work history dates found)
    years = 0
    exp_year_matches = []
    if past_roles:
        exp_text = " ".join(past_roles)
        exp_year_matches = re.findall(r'\b(20[0-2][0-9]|199[0-9])\b', exp_text)
    if not exp_year_matches:
        mention = re.search(r'(\d+)\+?\s*years?\s*(?:of)?\s*experience', raw_text, re.IGNORECASE)
        if mention:
            years = int(mention.group(1))
    else:
        distinct_years = sorted(list(set(int(y) for y in exp_year_matches)))
        if len(distinct_years) >= 2:
            calculated_span = distinct_years[-1] - distinct_years[0]
            if 1 <= calculated_span <= 30:
                years = calculated_span
        elif len(distinct_years) == 1:
            years = 1

    # 7. Generate Relevant Interview Questions strictly matching candidate's real skills
    suggested_questions = []
    top_skills = found_skills[:4]
    if any(s in top_skills for s in ["FastAPI", "Python", "Django", "Flask"]):
        suggested_questions.append("Can you describe a backend service or REST API you built with Python, and how you structured the data models?")
    if any(s in top_skills for s in ["PostgreSQL", "MySQL", "MongoDB", "Redis", "SQL"]):
        suggested_questions.append("How do you design database schemas and handle indexing or caching to optimize query performance?")
    if any(s in top_skills for s in ["React", "Next.js", "TypeScript", "JavaScript"]):
        suggested_questions.append("How do you manage component state, asynchronous data fetching, and performance in React/Next.js?")
    if any(s in top_skills for s in ["Docker", "Kubernetes", "AWS", "Microservices"]):
        suggested_questions.append("Walk me through how you deploy applications using containers and manage cloud infrastructure.")

    if not suggested_questions:
        suggested_questions = [
            "Walk me through the most interesting technical project you have worked on.",
            "How do you approach learning a new technology or troubleshooting unexpected bugs?"
        ]

    return {
        "candidate_name": candidate_name,
        "email": email,
        "phone": phone,
        "experience_years": years,
        "skills": found_skills[:20],
        "past_roles": past_roles,
        "suggested_interview_questions": suggested_questions[:4]
    }


@router.post(
    "/upload",
    response_model=ResumeExtractionResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload & Extract PDF Resume",
    description="Accepts a PDF resume, extracts raw text using PyMuPDF (fitz), and parses structured profile details."
)
async def upload_pdf_resume(
    file: UploadFile = File(..., description="Uploaded PDF resume document")
):
    filename = file.filename or ""
    if filename and not filename.lower().endswith(".pdf") and file.content_type not in ["application/pdf", "application/x-pdf", "application/octet-stream"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files (.pdf) are supported for resume extraction."
        )

    try:
        pdf_bytes = await file.read()
    except Exception as e:
        raise PipelineException(
            message="Failed to read uploaded file stream.",
            detail=str(e)
        )

    if not pdf_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded PDF file is empty."
        )

    # 1. Extract text using PyMuPDF (fitz) or fallback
    raw_text = extract_text_from_pdf(pdf_bytes)
    cleaned_text = clean_pdf_text(raw_text)
    if not cleaned_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not extract readable text from the uploaded PDF document."
        )

    # 2. Structured Prompt for LLM parsing
    prompt = (
        "You are an expert ATS resume parsing system. Analyze the candidate resume text below and extract structured information.\n"
        "DO NOT invent or hallucinate any information. Clean any font icon words like 'envelope', 'phone', 'globe'. If the candidate has no past employment history, return an empty array for past_roles.\n\n"
        "Return ONLY a valid JSON object matching this schema:\n"
        "{\n"
        '  "candidate_name": "Full Name",\n'
        '  "email": "email@example.com",\n'
        '  "phone": "+1 555-0100",\n'
        '  "experience_years": 0,\n'
        '  "skills": ["Skill 1", "Skill 2"],\n'
        '  "past_roles": ["Role at Company (Year)"],\n'
        '  "suggested_interview_questions": ["Question 1", "Question 2"]\n'
        "}\n\n"
        f"--- RESUME TEXT ---\n{cleaned_text[:4000]}"
    )

    parsed_json: Optional[Dict[str, Any]] = None

    # Try OpenAI / LLM service
    try:
        llm_result = await call_openai_chat(
            messages=[
                {"role": "system", "content": "You are a specialized ATS resume parser. Output strict JSON only. Do not hallucinate experiences. Do not output icon names like envelope."},
                {"role": "user", "content": prompt}
            ],
            model="gpt-4o-mini",
            temperature=0.1,
            max_tokens=650,
            json_mode=True
        )
        if llm_result:
            parsed_json = json.loads(llm_result)
    except Exception as e:
        logger.info("LLM service unavailable (%s); using intelligent heuristic parser.", e)

    # Fallback to intelligent heuristic extraction from the actual PDF text
    if not parsed_json or not isinstance(parsed_json, dict):
        parsed_json = heuristic_parse_resume(raw_text)

    # Sanitize candidate name - strip any residual icon words
    candidate_name = str(parsed_json.get("candidate_name") or "Candidate")
    candidate_name = re.sub(r'(?i)\b(fa-[a-z0-9-]+|envelope|phone|email|mail|contact|mobile|github|linkedin|location|address|curriculum|vitae|resume)\b', '', candidate_name).strip(' :-|•\t,()[]')
    if not candidate_name or candidate_name.lower() in {"candidate", "name", "full name", "resume", "cv", "student", "fresher", "envelope"}:
        # Re-derive from top text lines
        heur = heuristic_parse_resume(raw_text)
        candidate_name = heur.get("candidate_name") or "Candidate"

    # Sanitize email
    email = parsed_json.get("email")
    if email:
        email = re.sub(r'(?i)^(envelope|email|mail|contact)\s*[:\-\s]*', '', str(email)).strip()

    # Sanitize phone
    phone = parsed_json.get("phone")
    if phone:
        phone = re.sub(r'(?i)^(envelope|phone|mobile|tel|telephone|contact)\s*[:\-\s]*', '', str(phone)).strip()

    # Sanitize skills
    raw_skills = parsed_json.get("skills") or []
    clean_skills = []
    for s in raw_skills:
        s_clean = re.sub(r'(?i)\b(fa-[a-z0-9-]+|envelope|phone|email|mail|contact|mobile|github|linkedin|location|address)\b', '', str(s)).strip(' :-|•\t,')
        if s_clean and len(s_clean) > 1 and s_clean.lower() not in {"envelope", "phone", "email", "mail", "contact", "linkedin", "github", "location", "address", "icon"}:
            clean_skills.append(s_clean)

    # Sanitize past_roles
    raw_roles = parsed_json.get("past_roles") or []
    clean_roles = []
    for role in raw_roles:
        if isinstance(role, dict):
            r_str = f"{role.get('title', role.get('role', ''))} {role.get('company', '')} {role.get('duration', '')}".strip()
        else:
            r_str = str(role)
        r_str = re.sub(r'(?i)\b(fa-[a-z0-9-]+|envelope|phone|email|mail|contact|mobile|github|linkedin|location|address)\b', '', r_str).strip(' :-|•\t,')
        if r_str and len(r_str) > 3 and r_str.lower() not in {"envelope", "phone", "email", "mail", "contact", "linkedin", "github", "location", "address"}:
            clean_roles.append(r_str)

    # Sanitize questions
    raw_questions = parsed_json.get("suggested_interview_questions") or []
    clean_questions = []
    for q in raw_questions:
        q_str = re.sub(r'(?i)\b(envelope|fa-[a-z0-9-]+)\b', '', str(q)).strip(' :-|•\t,')
        if q_str and len(q_str) > 10:
            clean_questions.append(q_str)

    return ResumeExtractionResponse(
        candidate_name=candidate_name,
        email=email,
        phone=phone,
        experience_years=parsed_json.get("experience_years", 0),
        skills=clean_skills,
        past_roles=clean_roles,
        suggested_interview_questions=clean_questions
    )

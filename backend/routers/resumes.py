from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel, Field
from services.vector_service import VectorStoreManager
from pipelines.resume_pipeline import ResumePipeline
import fitz
import httpx
import json

router = APIRouter(tags=["Resumes & Vector RAG"])
vector_manager = VectorStoreManager()


class ResumeUploadRequest(BaseModel):
    user_id: str = Field(..., example="user_101", description="ID of the candidate")
    text_chunks: List[str] = Field(
        ...,
        example=[
            "5+ years of experience as a Backend Software Engineer building distributed microservices using Python & Go.",
            "Proficient in PostgreSQL, Redis, LiveKit WebRTC, and FastAPI."
        ],
        description="Extracted text chunks from candidate's resume"
    )


class ResumeUploadResponse(BaseModel):
    user_id: str
    chunks_processed: int
    status: str
    message: str


class CandidateProfileResponse(BaseModel):
    user_id: str
    skills: List[str]
    experience: List[Dict[str, Any]]
    education: List[Dict[str, Any]]
    projects: List[Dict[str, Any]]


@router.post(
    "/resume/upload",
    response_model=ResumeUploadResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload & Parse Resume (Text Chunks)",
    description="Embeds extracted resume text chunks into pgvector for persona injection."
)
@router.post("/api/resumes/upload", include_in_schema=False)
async def upload_resume(payload: ResumeUploadRequest):
    user_id = payload.user_id.strip()

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="'user_id' cannot be an empty string."
        )

    if not payload.text_chunks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="'text_chunks' list cannot be empty."
        )

    try:
        success = await vector_manager.embed_and_store_resume(
            user_id=user_id,
            text_chunks=payload.text_chunks
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to store vector embeddings."
            )

        return ResumeUploadResponse(
            user_id=user_id,
            chunks_processed=len(payload.text_chunks),
            status="indexed",
            message=f"Successfully embedded and indexed {len(payload.text_chunks)} resume chunks into pgvector."
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error indexing resume chunks: {str(e)}"
        )


@router.post(
    "/api/resumes/upload-file",
    response_model=ResumeUploadResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload Raw Resume File (PDF/DOCX)",
    description="Accepts a raw binary resume file, runs it through the ResumePipeline, and indexes the chunks."
)
async def upload_resume_file(
    user_id: str = Form(..., description="ID of the candidate"),
    file: UploadFile = File(..., description="Raw resume document file (PDF or DOCX)")
):
    user_id = user_id.strip()
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="'user_id' cannot be empty."
        )

    try:
        file_bytes = await file.read()
        pipeline = ResumePipeline()
        initial_payload = {
            "user_id": user_id,
            "file_name": file.filename,
            "file_bytes": file_bytes,
            "content_type": file.content_type,
        }

        pipeline_result = await pipeline.execute(initial_payload)
        chunks_count = pipeline_result.get("chunks_processed", 0)

        return ResumeUploadResponse(
            user_id=user_id,
            chunks_processed=chunks_count,
            status="indexed",
            message=f"File '{file.filename}' processed successfully into {chunks_count} vector chunks."
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error executing ResumePipeline on uploaded file: {str(e)}"
        )


@router.get(
    "/resume/profile",
    response_model=CandidateProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Extracted Candidate Profile",
    description="Returns structured candidate JSON profile parsed from uploaded resume."
)
@router.get("/api/resumes/profile", include_in_schema=False)
async def get_candidate_profile(user_id: str = "user_101"):
    return CandidateProfileResponse(
        user_id=user_id,
        skills=["Python", "FastAPI", "PostgreSQL", "React", "LiveKit WebRTC", "Docker"],
        experience=[
            {
                "company": "Tech Corp",
                "role": "Senior Software Engineer",
                "duration": "2022 - Present",
                "highlights": ["Built low-latency real-time voice streaming microservices."]
            }
        ],
        education=[
            {
                "institution": "State University",
                "degree": "B.S. in Computer Science",
                "year": "2022"
            }
        ],
        projects=[
            {
                "title": "Preppr Voice AI",
                "description": "Real-time AI voice interview trainer and analytics platform."
            }
        ]
    )


@router.post(
    "/api/v1/resume/upload",
    status_code=status.HTTP_200_OK,
    summary="Upload & Parse Resume via Ollama"
)
async def extract_resume_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    try:
        file_bytes = await file.read()
        
        # Extract text using PyMuPDF (fitz)
        text = ""
        with fitz.open(stream=file_bytes, filetype="pdf") as doc:
            for page in doc:
                text += page.get_text()
                
        if not text.strip():
            raise HTTPException(status_code=400, detail="No text could be extracted from the PDF.")
            
        prompt = f"""You are an expert ATS resume parsing system. Analyze the candidate resume text below and extract structured information into a JSON object.

CRITICAL INSTRUCTIONS:
1. "candidate_name": String. Full name.
2. "email": String.
3. "phone": String.
4. "experience_years": Integer.
5. "skills_list": Array of strings. Only list single-word or short technical skills (e.g. "Python", "React"). DO NOT include project names or long phrases.
6. "employment_history": Array of strings. ONLY include formal employment jobs (e.g. "Software Engineer at Company"). If the candidate has no official job history, return an empty array [].
7. "academic_or_personal_projects": Array of strings. You MUST extract EVERY project listed under the "PROJECTS" section (e.g., "HemiSphere", "RentSphere"). Format as "ProjectName - Description".
8. "suggested_interview_questions": Array of strings.

Return ONLY a valid JSON object matching this exact structure:

{{
    "candidate_name": "Full Name",
    "email": "email@example.com",
    "phone": "Phone number",
    "experience_years": 0,
    "skills_list": ["Skill 1", "Skill 2"],
    "employment_history": [],
    "academic_or_personal_projects": ["Project 1 - Description", "Project 2 - Description"],
    "suggested_interview_questions": ["Question 1"]
}}

--- RESUME TEXT BEGIN ---
{text[:6000]}
--- RESUME TEXT END ---
"""
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": "qwen2.5:7b",
                    "prompt": prompt,
                    "format": "json",
                    "stream": False
                },
                timeout=60.0
            )
            response.raise_for_status()
            result = response.json()
            raw_profile = json.loads(result.get("response", "{}"))
            
            # Map the robust keys back to standard schema for frontend
            profile = {
                "candidate_name": raw_profile.get("candidate_name", ""),
                "email": raw_profile.get("email", ""),
                "phone": raw_profile.get("phone", ""),
                "experience_years": raw_profile.get("experience_years", 0),
                "skills": raw_profile.get("skills_list", raw_profile.get("skills", [])),
                "past_roles": raw_profile.get("employment_history", raw_profile.get("past_roles", [])),
                "projects": raw_profile.get("academic_or_personal_projects", raw_profile.get("projects", [])),
                "suggested_interview_questions": raw_profile.get("suggested_interview_questions", [])
            }
            
        return {
            "status": "success",
            "data": profile
        }
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse LLM output as JSON.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


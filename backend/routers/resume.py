import os
import json
import logging
import pymupdf as fitz
import httpx
from typing import List, Optional, Union, Dict, Any
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from pydantic import BaseModel, Field

from middleware.error_handler import PipelineException
from core.config import settings

router = APIRouter(prefix="/api/v1/resume", tags=["PDF Resume Extraction"])
logger = logging.getLogger("preppr-resume-extraction")

OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://localhost:11434/api/generate")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", getattr(settings, "MODEL_NAME", "qwen2.5:7b"))


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
    Extracts raw text content from uploaded PDF bytes using PyMuPDF (fitz).
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        text_pages = []
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text_pages.append(page.get_text())
        doc.close()

        full_text = "\n".join(text_pages).strip()
        if not full_text:
            raise PipelineException(
                message="Extracted text from PDF is empty.",
                detail="PyMuPDF could not extract readable text from the provided PDF file."
            )
        return full_text
    except PipelineException:
        raise
    except Exception as e:
        logger.error(f"PyMuPDF PDF extraction error: {e}")
        raise PipelineException(
            message="Failed to parse PDF document.",
            detail=f"PyMuPDF error: {str(e)}"
        )


@router.post(
    "/upload",
    response_model=ResumeExtractionResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload & Extract PDF Resume via Ollama",
    description="Accepts a PDF resume, extracts raw text using PyMuPDF (fitz), and queries local Ollama (qwen2.5:7b) for candidate profile details in JSON format."
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

    # 1. Extract text using PyMuPDF (fitz)
    raw_text = extract_text_from_pdf(pdf_bytes)

    # 2. Query local Ollama API
    system_prompt = (
        "You are an expert HR resume parser and technical interviewer AI. "
        "Extract candidate details from the provided resume text and return a valid JSON object strictly matching this schema:\n"
        "{\n"
        '  "candidate_name": "Full Name or null",\n'
        '  "email": "Email address or null",\n'
        '  "phone": "Phone number or null",\n'
        '  "experience_years": 0,\n'
        '  "skills": ["skill1", "skill2"],\n'
        '  "past_roles": ["role1", "role2"],\n'
        '  "suggested_interview_questions": ["question1", "question2"]\n'
        "}\n"
        "Do not include markdown formatting, preambles, or explanations. Output ONLY valid JSON."
    )

    full_prompt = f"{system_prompt}\n\nRESUME TEXT:\n{raw_text[:4000]}"

    ollama_url = OLLAMA_API_URL
    model_name = OLLAMA_MODEL

    ollama_payload = {
        "model": model_name,
        "prompt": full_prompt,
        "stream": False,
        "format": "json"
    }

    parsed_json: Dict[str, Any] = {}

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(ollama_url, json=ollama_payload)
            if response.status_code == 200:
                resp_data = response.json()
                raw_response_text = resp_data.get("response", "")
                try:
                    parsed_json = json.loads(raw_response_text)
                except Exception as parse_err:
                    logger.warning(f"Failed to parse Ollama JSON response: {parse_err}. Response text: {raw_response_text[:200]}")
                    raise PipelineException(
                        message="Ollama returned invalid JSON response format.",
                        detail=str(parse_err)
                    )
            else:
                logger.error(f"Ollama API returned status code {response.status_code}: {response.text}")
                raise PipelineException(
                    message="Local Ollama service returned an error response.",
                    detail=f"HTTP {response.status_code}: {response.text}"
                )
    except httpx.ConnectError as conn_err:
        logger.warning(f"Could not connect to Ollama server at {ollama_url}: {conn_err}")
        raise PipelineException(
            message="Could not connect to local Ollama server at http://localhost:11434.",
            detail=f"Connection Error: Ensure Ollama is running with model '{model_name}' loaded."
        )
    except PipelineException:
        raise
    except Exception as exc:
        logger.error(f"Unexpected error during resume extraction LLM query: {exc}")
        raise PipelineException(
            message="An error occurred while querying local LLM for resume parsing.",
            detail=str(exc)
        )

    return ResumeExtractionResponse(
        candidate_name=parsed_json.get("candidate_name"),
        email=parsed_json.get("email"),
        phone=parsed_json.get("phone"),
        experience_years=parsed_json.get("experience_years"),
        skills=parsed_json.get("skills", []),
        past_roles=parsed_json.get("past_roles", []),
        suggested_interview_questions=parsed_json.get("suggested_interview_questions", [])
    )

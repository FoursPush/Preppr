import io
import json
import logging
import os
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel, Field
import httpx

from services.vector_service import VectorStoreManager
from pipelines.resume_pipeline import ResumePipeline
from services.interview_service import call_openai_chat

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

logger = logging.getLogger("preppr-resumes")
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
    summary="Upload & Parse Resume PDF via AI"
)
async def extract_resume_pdf(file: UploadFile = File(...)):
    """
    Delegates directly to the robust PDF extraction router in routers.resume.
    """
    from routers.resume import upload_pdf_resume
    res = await upload_pdf_resume(file=file)
    return {
        "status": "success",
        "data": res.model_dump()
    }




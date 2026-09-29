import io
import json
import logging
import os
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel, Field
import httpx
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database.config import get_async_session
from database.models import User, Resume, CandidateProfile
from routers.interviews import resolve_user_int_id

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
async def get_candidate_profile(
    user_id: str = "user_101",
    db: AsyncSession = Depends(get_async_session)
):
    user_int_id = await resolve_user_int_id(user_id, db)
    if user_int_id is not None:
        stmt = select(CandidateProfile).join(Resume).where(Resume.user_id == user_int_id).order_by(Resume.id.desc())
        res = await db.execute(stmt)
        profile = res.scalars().first()
        if profile:
            return CandidateProfileResponse(
                user_id=user_id,
                skills=profile.skills or [],
                experience=profile.experience or [],
                education=profile.education or [],
                projects=profile.projects or []
            )

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
async def extract_resume_pdf(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Delegates directly to the robust PDF extraction router in routers.resume.
    """
    from routers.resume import upload_pdf_resume
    file_name = file.filename
    res = await upload_pdf_resume(file=file)
    data = res.model_dump() if hasattr(res, "model_dump") else res.dict()
    if "projects" not in data:
        data["projects"] = []
    
    # Save to database
    if user_id:
        user_int_id = await resolve_user_int_id(user_id, db)
        if not user_int_id:
            # Auto-create user for testing/demo purposes if they don't exist
            new_user = User(
                email=f"{user_id}@preppr.ai",
                name="Test Candidate",
                role="Software Engineer"
            )
            db.add(new_user)
            await db.commit()
            await db.refresh(new_user)
            user_int_id = new_user.id

        if user_int_id:
            db_resume = Resume(
                user_id=user_int_id,
                file_name=file_name or "resume.pdf",
                extracted_text=""
            )
            db.add(db_resume)
            await db.flush()
            
            db_profile = CandidateProfile(
                resume_id=db_resume.id,
                skills=data.get("skills", []),
                experience=[{"role": r} for r in data.get("past_roles", [])],
                education=[{"degree": e} for e in data.get("education", [])],
                projects=[{"title": p} for p in data.get("projects", [])]
            )
            db.add(db_profile)
            await db.commit()
    
    return {
        "status": "success",
        "data": data
    }


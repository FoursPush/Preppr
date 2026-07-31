from typing import List
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from services.vector_service import VectorStoreManager

router = APIRouter(prefix="/api/resumes", tags=["Resumes & Vector RAG"])
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


@router.post(
    "/upload",
    response_model=ResumeUploadResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload & Index Resume for RAG Context",
    description="Embeds extracted resume text chunks and stores them into pgvector for real-time persona retrieval during interviews."
)
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

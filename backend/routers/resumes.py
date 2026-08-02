from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel, Field
from services.vector_service import VectorStoreManager
from pipelines.resume_pipeline import ResumePipeline

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
    summary="Upload & Index Pre-Chunked Resume for RAG Context",
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
        # Direct chunk indexing via VectorStoreManager
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
    "/upload-file",
    response_model=ResumeUploadResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload Raw Resume File (PDF/DOCX) & Process via ResumePipeline",
    description="Accepts a raw binary resume file, runs it through the modular ResumePipeline (Extraction -> Cleaning -> Chunking -> VectorEmbedding), and stores the result."
)
async def upload_resume_file(
    user_id: str = Form(..., description="ID of the candidate"),
    file: UploadFile = File(..., description="Raw resume document file (PDF or DOCX)")
):
    """
    Endpoint demonstrating instantiation and execution of the ResumePipeline:
    
    1. Read raw binary content from UploadFile.
    2. Instantiate the modular ResumePipeline coordinator.
    3. Execute pipeline stages sequentially:
       TextExtractionStage -> TextCleaningStage -> TextChunkingStage -> VectorEmbeddingStage
    4. Return structured response containing processed chunk count.
    """
    user_id = user_id.strip()
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="'user_id' cannot be empty."
        )

    try:
        # Read raw file bytes
        file_bytes = await file.read()

        # =========================================================================
        # RESUME PIPELINE INSTANTIATION & EXECUTION PLACEHOLDER
        # =========================================================================
        # 1. Instantiate the ResumePipeline (holds TextExtraction, TextCleaning,
        #    TextChunking, and VectorEmbedding stages)
        pipeline = ResumePipeline()

        # 2. Package initial payload dictionary
        initial_payload = {
            "user_id": user_id,
            "file_name": file.filename,
            "file_bytes": file_bytes,
            "content_type": file.content_type,
        }

        # 3. Execute all stages sequentially through the pipeline
        pipeline_result = await pipeline.execute(initial_payload)
        # =========================================================================

        chunks_count = pipeline_result.get("chunks_processed", 0)

        return ResumeUploadResponse(
            user_id=user_id,
            chunks_processed=chunks_count,
            status="indexed",
            message=f"File '{file.filename}' processed successfully through ResumePipeline into {chunks_count} vector chunks."
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error executing ResumePipeline on uploaded file: {str(e)}"
        )

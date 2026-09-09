import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from pydantic import BaseModel, Field

from services.whisper_service import whisper_stt_service

router = APIRouter(prefix="/stt", tags=["Speech-To-Text (Whisper STT)"])
logger = logging.getLogger("preppr-stt-router")


class STTResponse(BaseModel):
    transcript: str = Field(..., description="Transcribed speech text")
    language: str = Field("en", description="Detected/specified language")
    duration_seconds: float = Field(..., description="Audio duration in seconds")
    word_count: int = Field(..., description="Total word count")
    wpm: float = Field(..., description="Words Per Minute speech rate")
    filler_count: int = Field(0, description="Detected filler word count")
    detected_fillers: list = Field(default_factory=list, description="List of detected filler words")
    inference_time_seconds: float = Field(0.0, description="Whisper inference latency")
    model: str = Field(..., description="Whisper model version used")
    device: Optional[str] = Field(None, description="Computation device used (cuda/cpu)")


class STTStatusResponse(BaseModel):
    model_name: str
    is_loaded: bool
    device: Optional[str]
    load_error: Optional[str]


@router.post(
    "/transcribe",
    response_model=STTResponse,
    status_code=status.HTTP_200_OK,
    summary="Transcribe Microphone Audio with Whisper",
    description="Transcribes raw microphone audio file (WebM, WAV, MP3, etc.) using openai/whisper-large-v3 and computes speech telemetry."
)
@router.post("/api/v1/stt/transcribe", response_model=STTResponse, include_in_schema=False)
async def transcribe_audio(
    file: UploadFile = File(..., description="Microphone recorded audio file"),
    language: str = Form("en", description="Target language code (e.g. en)"),
):
    if not file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No audio file provided for transcription."
        )

    try:
        audio_bytes = await file.read()
        if not audio_bytes or len(audio_bytes) < 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty or corrupted audio recording received."
            )

        logger.info("Transcribing audio payload (size: %s bytes, filename: %s)...", len(audio_bytes), file.filename)
        result = whisper_stt_service.transcribe(audio_bytes, language=language)
        return STTResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error during Whisper audio transcription: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Speech transcription failed: {str(e)}"
        )


@router.get(
    "/status",
    response_model=STTStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Whisper STT Service Status"
)
@router.get("/api/v1/stt/status", response_model=STTStatusResponse, include_in_schema=False)
async def get_stt_status():
    info = whisper_stt_service.get_info()
    return STTStatusResponse(**info)

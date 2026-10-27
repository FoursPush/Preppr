import os
import logging
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel, Field

from core.config import settings

router = APIRouter(prefix="/tts", tags=["Text-To-Speech (TTS)"])
logger = logging.getLogger("preppr-tts-router")

env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")

# OpenAI TTS supported voices (model tts-1 / tts-1-hd).
_VALID_VOICES = {"alloy", "echo", "fable", "onyx", "nova", "shimmer"}


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000, description="Text to synthesize to speech")
    voice: Optional[str] = Field(None, description="Voice identifier (alloy, echo, fable, onyx, nova, shimmer)")


class TTSStatusResponse(BaseModel):
    backend_tts_available: bool = Field(..., description="Whether server-side OpenAI TTS is usable (valid key present)")
    provider: str = Field(..., description="Configured TTS provider")
    model: str = Field(..., description="Configured TTS model")
    voice: str = Field(..., description="Default TTS voice")


def _resolve_openai_key() -> Optional[str]:
    """
    Returns a real OpenAI secret key (starting with 'sk-') if one is configured,
    otherwise None. The dummy local 'ollama' key does not work for OpenAI TTS, so
    when no real key is present the frontend falls back to browser speechSynthesis.
    """
    if os.path.exists(env_path):
        load_dotenv(dotenv_path=env_path, override=True)
    else:
        load_dotenv(override=True)

    for cand in (os.getenv("OPENAI_SECRET_KEY"), os.getenv("OPENAI_API_KEY"), os.getenv("LLM_API_KEY")):
        if cand and cand.strip().startswith("sk-"):
            return cand.strip()
    return None


@router.get(
    "/status",
    response_model=TTSStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get TTS Service Status",
    description="Reports whether server-side OpenAI TTS is available. When false, the client should use the browser speechSynthesis fallback."
)
@router.get("/api/v1/tts/status", response_model=TTSStatusResponse, include_in_schema=False)
async def get_tts_status():
    return TTSStatusResponse(
        backend_tts_available=_resolve_openai_key() is not None,
        provider=settings.TTS_PROVIDER,
        model=settings.TTS_MODEL,
        voice=settings.TTS_VOICE,
    )


@router.post(
    "/speak",
    status_code=status.HTTP_200_OK,
    summary="Synthesize Speech from Text",
    description="Synthesizes the interviewer's question to speech (audio/mpeg) via OpenAI TTS. Returns 503 when no key is configured so the client can fall back to browser speech synthesis.",
    responses={200: {"content": {"audio/mpeg": {}}}},
)
@router.post("/api/v1/tts/speak", include_in_schema=False)
async def synthesize_speech(payload: TTSRequest):
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No text provided for speech synthesis."
        )

    api_key = _resolve_openai_key()
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Server-side TTS is not configured. Use the browser speech synthesis fallback."
        )

    voice = (payload.voice or settings.TTS_VOICE or "alloy").strip().lower()
    if voice not in _VALID_VOICES:
        voice = "alloy"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": settings.TTS_MODEL or "tts-1",
        "voice": voice,
        "input": text[:4000],
        "response_format": "mp3",
    }

    try:
        logger.info("🔊 [OpenAI TTS] Synthesizing %d chars (voice: %s, model: %s)...", len(text), voice, body["model"])
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/audio/speech",
                headers=headers,
                json=body,
            )
        if resp.status_code == 200:
            return Response(content=resp.content, media_type="audio/mpeg")

        logger.warning("⚠️ [OpenAI TTS] Returned HTTP %s. Client should fall back to browser TTS.", resp.status_code)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Upstream TTS provider is unavailable. Use the browser speech synthesis fallback."
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("⚠️ [OpenAI TTS] Synthesis failed: %s. Client should fall back to browser TTS.", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Speech synthesis failed. Use the browser speech synthesis fallback."
        )

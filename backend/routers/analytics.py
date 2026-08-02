import os
import logging
from typing import List, Optional, Dict, Any
import numpy as np
import joblib
from fastapi import APIRouter, HTTPException, BackgroundTasks, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/analytics", tags=["Analytics & Evaluation"])
logger = logging.getLogger("preppr-analytics")

# Path where trained ML models delivered by the Data Team should be placed
MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
MODEL_PATH = os.path.join(MODEL_DIR, "session_evaluator.joblib")


class ModelManager:
    """Helper class to lazily load and manage trained ML model artifacts."""
    _model = None

    @classmethod
    def load_model(cls):
        if cls._model is None:
            if os.path.exists(MODEL_PATH):
                try:
                    cls._model = joblib.load(MODEL_PATH)
                    logger.info(f"Successfully loaded trained ML model from {MODEL_PATH}")
                except Exception as e:
                    logger.error(f"Failed to load joblib model: {e}")
                    cls._model = None
            else:
                logger.warning(
                    f"No trained model found at {MODEL_PATH}. Using analytical fallback scoring engine."
                )
        return cls._model


# --- Request Schemas ---

class AudioMetrics(BaseModel):
    wpm: float = Field(..., example=145.0, description="Words per minute")
    longest_silence_seconds: float = Field(..., example=2.5, description="Longest pause duration in seconds")
    filler_words_count: int = Field(..., example=4, description="Total count of filler words (um, ah, like, etc.)")
    acoustic_stress_score: float = Field(..., ge=0.0, le=1.0, example=0.25, description="Normalized acoustic stress (0.0=calm, 1.0=stressed)")


class TranscriptTurn(BaseModel):
    speaker: str = Field(..., example="candidate", description="'candidate' or 'interviewer'")
    text: str = Field(..., example="In my previous role at ACME Corp, I designed a microservice architecture...")


class TranscriptMetrics(BaseModel):
    turns: List[TranscriptTurn] = Field(default_factory=list, description="Raw back-and-forth transcript turns")
    star_structure_score: float = Field(..., ge=0.0, le=10.0, example=8.5, description="STAR framework alignment score (0-10)")
    technical_correctness_score: float = Field(..., ge=0.0, le=10.0, example=9.0, description="Technical accuracy score (0-10)")


class SessionEvaluationRequest(BaseModel):
    session_id: str = Field(..., example="sess_982347")
    candidate_id: str = Field(..., example="cand_12345")
    company_target: Optional[str] = Field("Amazon", example="Amazon", description="Target company persona evaluated against")
    audio_metrics: AudioMetrics
    transcript_metrics: TranscriptMetrics


class SessionCompletionRequest(BaseModel):
    session_id: str = Field(..., example="sess_982347")
    raw_audio_metadata: Dict[str, Any] = Field(
        ...,
        example={
            "total_words": 420,
            "duration_seconds": 180.0,
            "total_filler_words": 5,
            "longest_silence": 2.4,
            "acoustic_stress_score": 0.22,
            "star_structure_score": 8.0,
            "technical_correctness_score": 8.5
        },
        description="Raw telemetry collected during interview"
    )


# --- Response Schemas ---

class CompetencyScores(BaseModel):
    communication: float = Field(..., description="Communication score (0-100)")
    technical: float = Field(..., description="Technical accuracy score (0-100)")
    confidence: float = Field(..., description="Speech stability & stress resilience (0-100)")
    pacing: float = Field(..., description="Pacing & speech rate score (0-100)")


class EvaluationResponse(BaseModel):
    session_id: str
    overall_score: float = Field(..., description="Aggregated interview performance score (0-100)")
    competency_radar: CompetencyScores
    strengths: List[str]
    areas_for_improvement: List[str]
    recommendations: List[str]
    model_version: str = Field(..., description="Indicates if loaded from ML joblib model or analytical heuristic fallback")


class AsyncCompletionResponse(BaseModel):
    session_id: str
    status: str
    message: str


# --- Endpoints ---

@router.post(
    "/evaluate-session",
    response_model=EvaluationResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluate Interview Session",
    description="Processes acoustic audio telemetry and transcript evaluations through trained ML models to yield feedback analytics."
)
async def evaluate_session(payload: SessionEvaluationRequest):
    try:
        model = ModelManager.load_model()

        audio = payload.audio_metrics
        transcript = payload.transcript_metrics

        if model is not None:
            feature_vector = np.array([[
                audio.wpm,
                audio.longest_silence_seconds,
                audio.filler_words_count,
                audio.acoustic_stress_score,
                transcript.star_structure_score,
                transcript.technical_correctness_score
            ]])

            prediction = model.predict(feature_vector)[0]
            overall_score = float(np.clip(prediction, 0.0, 100.0))
            model_ver = getattr(model, "version", "joblib-v1.0")

            competency = CompetencyScores(
                communication=round(float(transcript.star_structure_score * 10), 1),
                technical=round(float(transcript.technical_correctness_score * 10), 1),
                confidence=round(float((1.0 - audio.acoustic_stress_score) * 100), 1),
                pacing=round(float(max(0, 100 - abs(audio.wpm - 140) * 1.5)), 1)
            )
        else:
            model_ver = "heuristic-engine-v0.1 (Place model at backend/models/session_evaluator.joblib)"

            pacing_score = max(0.0, min(100.0, 100 - abs(audio.wpm - 140) * 1.5 - audio.filler_words_count * 3))
            confidence_score = max(0.0, min(100.0, (1.0 - audio.acoustic_stress_score) * 100 - (audio.longest_silence_seconds * 4)))
            communication_score = transcript.star_structure_score * 10
            technical_score = transcript.technical_correctness_score * 10

            overall_score = round(
                (pacing_score * 0.2) + (confidence_score * 0.2) + (communication_score * 0.3) + (technical_score * 0.3), 1
            )

            competency = CompetencyScores(
                communication=round(communication_score, 1),
                technical=round(technical_score, 1),
                confidence=round(confidence_score, 1),
                pacing=round(pacing_score, 1)
            )

        strengths = []
        improvements = []
        recommendations = []

        if transcript.technical_correctness_score >= 8.0:
            strengths.append("Demonstrated high technical accuracy and strong subject matter domain knowledge.")
        else:
            improvements.append("Technical answers lacked depth; review key engineering concepts.")

        if audio.wpm >= 120 and audio.wpm <= 160:
            strengths.append("Maintained an optimal conversational speech rate (~140 WPM).")
        elif audio.wpm > 160:
            improvements.append("Speech rate was too fast; practice speaking deliberately.")
        else:
            improvements.append("Speech rate was slow with noticeable pauses.")

        if audio.filler_words_count > 5:
            improvements.append(f"Detected high count of filler words ({audio.filler_words_count} instances).")

        if transcript.star_structure_score >= 7.5:
            strengths.append("Structured behavioral answers effectively using the STAR method.")
        else:
            recommendations.append("Structure answers explicitly using Situation, Task, Action, and Result.")

        recommendations.append("Practice 2 mock sessions focusing on pausing briefly instead of using filler words.")

        return EvaluationResponse(
            session_id=payload.session_id,
            overall_score=overall_score,
            competency_radar=competency,
            strengths=strengths,
            areas_for_improvement=improvements,
            recommendations=recommendations,
            model_version=model_ver
        )

    except Exception as e:
        logger.error(f"Error evaluating session analytics: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process session evaluation analytics: {str(e)}"
        )


@router.post(
    "/complete-session",
    response_model=AsyncCompletionResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Complete Interview Session Non-Blocking",
    description="Enqueues post-interview analytics processing as a non-blocking background task via FastAPI BackgroundTasks."
)
async def complete_session_async(
    payload: SessionCompletionRequest,
    background_tasks: BackgroundTasks
):
    """
    Triggers BackgroundAnalyticsProcessor in the background without blocking HTTP response.
    """
    from workers.analytics_worker import BackgroundAnalyticsProcessor

    processor = BackgroundAnalyticsProcessor()

    # Enqueue post-interview processing pipeline into FastAPI BackgroundTasks
    background_tasks.add_task(
        processor.process_post_interview_metrics,
        session_id=payload.session_id,
        raw_audio_metadata=payload.raw_audio_metadata
    )

    return AsyncCompletionResponse(
        session_id=payload.session_id,
        status="queued",
        message=f"Post-interview background processing enqueued for session '{payload.session_id}'."
    )

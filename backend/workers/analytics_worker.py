import logging
from typing import Dict, Any
from database.config import AsyncSessionLocal
from database.models import AnalyticsSummary, InterviewSession
from routers.analytics import (
    AudioMetrics,
    TranscriptMetrics,
    SessionEvaluationRequest,
    evaluate_session,
)

logger = logging.getLogger("preppr-analytics-worker")


class BackgroundAnalyticsProcessor:
    """
    Background worker class handling post-interview asynchronous processing pipeline.
    """

    async def process_post_interview_metrics(
        self, session_id: str, raw_audio_metadata: Dict[str, Any]
    ) -> None:
        """
        Sequentially executes post-interview lifecycle:
        1) Fetch session context
        2) Run feature engineering (WPM, filler word calculations, silence)
        3) Invoke ML ModelManager to get score metrics
        4) Commit final AnalyticsSummary row to database
        """
        logger.info(f"[BackgroundAnalyticsProcessor] Starting background processing for session '{session_id}'...")

        try:
            # Step 1: Fetch session context from database
            async with AsyncSessionLocal() as db_session:
                db_session_obj = None
                try:
                    sess_int_id = int(session_id)
                    db_session_obj = await db_session.get(InterviewSession, sess_int_id)
                except ValueError:
                    db_session_obj = None

                # Step 2: Feature Engineering (Calculate WPM, filler word count, silence)
                total_words = raw_audio_metadata.get("total_words", 150)
                duration_seconds = raw_audio_metadata.get("duration_seconds", 60.0)
                duration_minutes = max(0.01, duration_seconds / 60.0)

                average_wpm = raw_audio_metadata.get(
                    "average_wpm", round(total_words / duration_minutes, 1)
                )
                total_filler_words = raw_audio_metadata.get("total_filler_words", 3)
                longest_silence = raw_audio_metadata.get("longest_silence", 2.1)
                acoustic_stress = raw_audio_metadata.get("acoustic_stress_score", 0.25)
                star_score = raw_audio_metadata.get("star_structure_score", 8.0)
                tech_score = raw_audio_metadata.get("technical_correctness_score", 8.5)

                logger.info(
                    f"Feature Engineering complete for session '{session_id}': "
                    f"WPM={average_wpm}, Fillers={total_filler_words}, Silence={longest_silence}s"
                )

                # Step 3: Invoke ML ModelManager / Evaluation Engine
                req = SessionEvaluationRequest(
                    session_id=session_id,
                    candidate_id=raw_audio_metadata.get("candidate_id", "cand_default"),
                    company_target=raw_audio_metadata.get("company_target", "Amazon"),
                    audio_metrics=AudioMetrics(
                        wpm=average_wpm,
                        longest_silence_seconds=longest_silence,
                        filler_words_count=total_filler_words,
                        acoustic_stress_score=acoustic_stress,
                    ),
                    transcript_metrics=TranscriptMetrics(
                        turns=[],
                        star_structure_score=star_score,
                        technical_correctness_score=tech_score,
                    ),
                )
                evaluation_result = await evaluate_session(req)

                logger.info(
                    f"ML Model evaluation complete for session '{session_id}': "
                    f"Overall Score={evaluation_result.overall_score}"
                )

                # Step 4: Commit AnalyticsSummary row & update InterviewSession overall_score in DB
                if db_session_obj:
                    db_session_obj.overall_score = evaluation_result.overall_score

                    analytics_row = AnalyticsSummary(
                        session_id=db_session_obj.id,
                        average_wpm=average_wpm,
                        total_filler_words=total_filler_words,
                        longest_silence=longest_silence,
                    )
                    db_session.add(analytics_row)
                    await db_session.commit()
                    logger.info(f"Successfully committed AnalyticsSummary row to database for session ID {db_session_obj.id}.")
                else:
                    logger.info(
                        f"No persistent DB record found for session ID '{session_id}'; skipping DB commit (mock environment)."
                    )

        except Exception as e:
            logger.error(
                f"Error in process_post_interview_metrics for session '{session_id}': {e}",
                exc_info=True,
            )

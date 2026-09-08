import os
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database.config import get_async_session
from database.models import User, InterviewSession, AnalyticsSummary

router = APIRouter(prefix="/api/dashboard", tags=["Candidate Dashboard"])
logger = logging.getLogger("preppr-dashboard")

REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "reports")


# --- Response Schemas ---

class DashboardSummaryResponse(BaseModel):
    user_id: str
    average_overall_score: float = Field(..., description="Average interview score (0-100)")
    average_wpm: float = Field(..., description="Average speech pace in Words Per Minute")
    total_interviews_completed: int = Field(..., description="Total completed mock sessions")


class SessionHistoryItem(BaseModel):
    session_id: str
    company_target: Optional[str] = Field(None, example="Amazon")
    overall_score: Optional[float] = Field(None, example=86.5)
    created_at: str = Field(..., example="2026-08-02T12:00:00Z")
    average_wpm: Optional[float] = Field(None, example=142.5)
    total_filler_words: Optional[int] = Field(None, example=3)


class DashboardHistoryResponse(BaseModel):
    user_id: str
    total_sessions: int
    sessions: List[SessionHistoryItem]


async def resolve_user_int_id(user_id_str: str, db: AsyncSession) -> Optional[int]:
    """Resolves an integer User.id from numeric string, user_ prefix, or email."""
    if not user_id_str:
        return None
    user_id_str = user_id_str.strip()

    # 1. Direct integer (e.g. "1")
    if user_id_str.isdigit():
        uid = int(user_id_str)
        stmt = select(User.id).where(User.id == uid)
        res = await db.execute(stmt)
        if res.scalar_one_or_none() is not None:
            return uid

    # 2. 'user_' prefix (e.g. "user_1")
    if user_id_str.startswith("user_") and user_id_str[5:].isdigit():
        uid = int(user_id_str[5:])
        stmt = select(User.id).where(User.id == uid)
        res = await db.execute(stmt)
        if res.scalar_one_or_none() is not None:
            return uid

    # 3. Lookup by email
    stmt = select(User.id).where(func.lower(User.email) == user_id_str.lower())
    res = await db.execute(stmt)
    uid = res.scalar_one_or_none()
    if uid is not None:
        return uid

    return None


# --- Endpoints ---

@router.get(
    "/summary/{user_id}",
    response_model=DashboardSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Aggregated Candidate Metrics Summary",
    description="Fetches aggregated metrics across all completed mock interviews for a given candidate."
)
async def get_dashboard_summary(
    user_id: str,
    db: AsyncSession = Depends(get_async_session)
):
    try:
        user_int_id = await resolve_user_int_id(user_id, db)

        if user_int_id is not None:
            # Query DB for aggregated session metrics
            total_stmt = select(func.count(InterviewSession.id)).where(InterviewSession.user_id == user_int_id)
            total_result = await db.execute(total_stmt)
            total_completed = total_result.scalar_one_or_none() or 0

            avg_score_stmt = select(func.avg(InterviewSession.overall_score)).where(
                InterviewSession.user_id == user_int_id,
                InterviewSession.overall_score.isnot(None)
            )
            avg_score_result = await db.execute(avg_score_stmt)
            avg_score = avg_score_result.scalar_one_or_none() or 0.0

            avg_wpm_stmt = (
                select(func.avg(AnalyticsSummary.average_wpm))
                .join(InterviewSession, AnalyticsSummary.session_id == InterviewSession.id)
                .where(InterviewSession.user_id == user_int_id)
            )
            avg_wpm_result = await db.execute(avg_wpm_stmt)
            avg_wpm = avg_wpm_result.scalar_one_or_none() or 0.0

            return DashboardSummaryResponse(
                user_id=user_id,
                average_overall_score=round(float(avg_score), 1) if avg_score else 0.0,
                average_wpm=round(float(avg_wpm), 1) if avg_wpm else 0.0,
                total_interviews_completed=total_completed
            )

        # Real zero-state when no sessions or user is not found
        return DashboardSummaryResponse(
            user_id=user_id,
            average_overall_score=0.0,
            average_wpm=0.0,
            total_interviews_completed=0
        )

    except Exception as e:
        logger.error(f"Error fetching dashboard summary for user '{user_id}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch dashboard summary: {str(e)}"
        )


@router.get(
    "/history/{user_id}",
    response_model=DashboardHistoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Chronological Interview History",
    description="Returns a chronological list of past interview sessions with associated telemetry and scores."
)
async def get_dashboard_history(
    user_id: str,
    db: AsyncSession = Depends(get_async_session)
):
    try:
        user_int_id = await resolve_user_int_id(user_id, db)

        if user_int_id is not None:
            stmt = (
                select(InterviewSession, AnalyticsSummary)
                .outerjoin(AnalyticsSummary, InterviewSession.id == AnalyticsSummary.session_id)
                .where(InterviewSession.user_id == user_int_id)
                .order_by(InterviewSession.created_at.desc())
            )
            result = await db.execute(stmt)
            rows = result.all()

            history_items = []
            for session_row, analytics_row in rows:
                history_items.append(
                    SessionHistoryItem(
                        session_id=str(session_row.id),
                        company_target=session_row.company_target or "Target Tech",
                        overall_score=round(float(session_row.overall_score), 1) if session_row.overall_score is not None else None,
                        created_at=session_row.created_at.isoformat() if session_row.created_at else "N/A",
                        average_wpm=round(float(analytics_row.average_wpm), 1) if analytics_row and analytics_row.average_wpm else None,
                        total_filler_words=analytics_row.total_filler_words if analytics_row else None,
                    )
                )
            return DashboardHistoryResponse(
                user_id=user_id,
                total_sessions=len(history_items),
                sessions=history_items
            )

        # Real empty history response when no sessions exist for user
        return DashboardHistoryResponse(
            user_id=user_id,
            total_sessions=0,
            sessions=[]
        )

    except Exception as e:
        logger.error(f"Error fetching interview history for user '{user_id}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch interview history: {str(e)}"
        )


@router.get(
    "/reports/{session_id}",
    status_code=status.HTTP_200_OK,
    summary="Download/Stream Session PDF Report Artifact",
    description="Safely streams the generated PDF report file from backend/reports/ to the client."
)
async def stream_session_report(session_id: str):
    """
    Locates and streams the PDF report file artifact report_{session_id}.pdf.
    """
    clean_session_id = session_id.strip()
    report_filename = f"report_{clean_session_id}.pdf"
    report_filepath = os.path.join(REPORTS_DIR, report_filename)

    # Security check: Ensure file stays within REPORTS_DIR
    real_report_path = os.path.realpath(report_filepath)
    real_reports_dir = os.path.realpath(REPORTS_DIR)

    if not real_report_path.startswith(real_reports_dir):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid report filepath."
        )

    if not os.path.exists(report_filepath):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PDF report artifact for session '{clean_session_id}' not found."
        )

    return FileResponse(
        path=report_filepath,
        media_type="application/pdf",
        filename=report_filename
    )

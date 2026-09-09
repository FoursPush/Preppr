import os
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, status, Body, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.config import get_async_session
from database.models import User, InterviewSession, AnalyticsSummary, Evaluation
from services.pdf_service import PDFReportGenerator
from routers.interviews import SESSIONS_STORE

router = APIRouter(tags=["PDF Reports"])
logger = logging.getLogger("preppr-reports")
pdf_generator = PDFReportGenerator()

REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "reports")


class GenerateReportRequest(BaseModel):
    user_name: Optional[str] = Field(None, example="Chinmay")
    company_target: Optional[str] = Field(None, example="Amazon")
    overall_score: Optional[float] = Field(None, example=84.5)
    competency_scores: Optional[dict] = Field(None, example={"technical": 85.0, "communication": 80.0})


class GenerateReportResponse(BaseModel):
    session_id: str
    file_path: str
    status: str
    message: str


@router.post(
    "/reports/{session_id}/generate",
    response_model=GenerateReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate Downloadable PDF Report Artifact",
    description="Compiles telemetry, LLM competency matrix, and 2-week plan into PDF report file artifact."
)
@router.post("/api/reports/{session_id}/generate", include_in_schema=False)
async def generate_pdf_report(
    session_id: str,
    payload: Optional[GenerateReportRequest] = Body(None),
    db: AsyncSession = Depends(get_async_session)
):
    clean_session_id = session_id.strip()

    # Look up session in SESSIONS_STORE or DB
    sess = SESSIONS_STORE.get(clean_session_id)
    user_name = "Candidate"
    company_target = "Tech Company"
    overall_score = 80.0
    competency_scores = {"technical": 80.0, "communication": 80.0, "problem_solving": 80.0, "structure": 80.0}
    telemetry = {"wpm": 140.0, "filler_words": 0, "longest_silence": 2.0}
    strengths: List[str] = []
    improvements: List[str] = []
    action_plan: List[str] = []

    if sess:
        company_target = sess.get("company_name", company_target)
        if "evaluation" in sess:
            eval_data = sess["evaluation"]
            competency_scores = eval_data.get("scores", competency_scores)
            overall_score = float(competency_scores.get("overall", overall_score))
            fb = eval_data.get("feedback_json", {})
            strengths = fb.get("strengths", [])
            improvements = fb.get("weaknesses", [])
            action_plan = fb.get("improvement_plan", [])
        wpm_vals = [t.get("wpm", 140) for t in sess.get("telemetry", []) if isinstance(t, dict) and "wpm" in t]
        avg_wpm = round(sum(wpm_vals) / len(wpm_vals), 1) if wpm_vals else 140.0
        fillers = sum(t.get("filler_count", 0) for t in sess.get("telemetry", []) if isinstance(t, dict))
        telemetry = {"wpm": avg_wpm, "filler_words": fillers, "longest_silence": 2.0}

    elif clean_session_id.isdigit():
        db_id = int(clean_session_id)
        try:
            db_sess = await db.get(InterviewSession, db_id)
            if db_sess:
                company_target = db_sess.company_target or company_target
                if db_sess.overall_score:
                    overall_score = db_sess.overall_score

                # Get user name
                user = await db.get(User, db_sess.user_id)
                if user:
                    user_name = user.name

                # Get Evaluation
                eval_stmt = select(Evaluation).where(Evaluation.session_id == db_id)
                eval_res = await db.execute(eval_stmt)
                db_eval = eval_res.scalar_one_or_none()
                if db_eval:
                    competency_scores = db_eval.scores
                    overall_score = float(competency_scores.get("overall", overall_score))
                    strengths = db_eval.feedback_json.get("strengths", [])
                    improvements = db_eval.feedback_json.get("weaknesses", [])
                    action_plan = db_eval.feedback_json.get("improvement_plan", [])

                # Get AnalyticsSummary
                an_stmt = select(AnalyticsSummary).where(AnalyticsSummary.session_id == db_id)
                an_res = await db.execute(an_stmt)
                db_an = an_res.scalar_one_or_none()
                if db_an:
                    telemetry = {
                        "wpm": db_an.average_wpm,
                        "filler_words": db_an.total_filler_words,
                        "longest_silence": db_an.longest_silence
                    }
        except Exception as e:
            logger.error("Error retrieving report session from DB: %s", e)

    # If payload provided, override
    if payload:
        if payload.user_name:
            user_name = payload.user_name
        if payload.company_target:
            company_target = payload.company_target
        if payload.overall_score is not None:
            overall_score = payload.overall_score
        if payload.competency_scores:
            competency_scores = payload.competency_scores

    if not strengths:
        strengths = ["Solid technical understanding demonstrated across responses."]
    if not improvements:
        improvements = ["Focus on providing more quantifiable metrics in system design answers."]
    if not action_plan:
        action_plan = ["Review key architectural patterns and practice timed mock responses."]

    try:
        report_path = pdf_generator.generate_pdf_report(
            session_id=clean_session_id,
            user_name=user_name,
            company_target=company_target,
            overall_score=overall_score,
            competency_scores=competency_scores,
            telemetry=telemetry,
            strengths=strengths,
            improvements=improvements,
            action_plan=action_plan
        )

        return GenerateReportResponse(
            session_id=clean_session_id,
            file_path=report_path,
            status="generated",
            message=f"PDF report generated successfully at {report_path}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate PDF report artifact: {str(e)}"
        )


@router.get(
    "/reports/{session_id}",
    status_code=status.HTTP_200_OK,
    summary="Download PDF Report Artifact",
    description="Streams generated PDF report file artifact to client."
)
@router.get("/api/reports/{session_id}", include_in_schema=False)
async def download_pdf_report(session_id: str):
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
        # Auto-generate if not yet compiled
        sess = SESSIONS_STORE.get(clean_session_id)
        company_target = sess.get("company_name", "Tech Company") if sess else "Tech Company"
        pdf_generator.generate_pdf_report(
            session_id=clean_session_id,
            user_name="Candidate",
            company_target=company_target,
            overall_score=80.0
        )

    return FileResponse(
        path=report_filepath,
        media_type="application/pdf",
        filename=report_filename
    )

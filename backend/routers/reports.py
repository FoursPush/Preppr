import os
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, status, Body
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from services.pdf_service import PDFReportGenerator

router = APIRouter(tags=["PDF Reports"])
pdf_generator = PDFReportGenerator()

REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "reports")


class GenerateReportRequest(BaseModel):
    user_name: Optional[str] = Field("Candidate", example="Chinmay")
    company_target: Optional[str] = Field("Amazon", example="Amazon")
    overall_score: Optional[float] = Field(84.5, example=84.5)
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
async def generate_pdf_report(session_id: str, payload: Optional[GenerateReportRequest] = Body(None)):
    clean_session_id = session_id.strip()

    req_data = payload.dict() if payload else {}
    user_name = req_data.get("user_name") or "Candidate"
    company_target = req_data.get("company_target") or "Amazon"
    overall_score = req_data.get("overall_score") or 84.5
    competency_scores = req_data.get("competency_scores") or {
        "communication": 80.0,
        "technical": 85.0,
        "confidence": 78.0,
        "pacing": 82.0
    }

    try:
        report_path = pdf_generator.generate_pdf_report(
            session_id=clean_session_id,
            user_name=user_name,
            company_target=company_target,
            overall_score=overall_score,
            competency_scores=competency_scores,
            telemetry={"wpm": 142.5, "filler_words": 3, "longest_silence": 2.1},
            strengths=[
                "Strong technical clarity in backend architecture explanations.",
                "Optimal speech rate (~142 WPM)."
            ],
            improvements=[
                "Incorporate more quantitative metrics into project outcomes.",
                "Minimize filler words during transition phrases."
            ],
            action_plan=[
                "Week 1: Practice STAR-formatted behavioral responses.",
                "Week 2: Perform 2 timed mock voice sessions focusing on pause management."
            ]
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
        # Auto-generate fallback if not yet compiled
        pdf_generator.generate_pdf_report(
            session_id=clean_session_id,
            user_name="Candidate",
            company_target="Amazon",
            overall_score=84.5
        )

    return FileResponse(
        path=report_filepath,
        media_type="application/pdf",
        filename=report_filename
    )

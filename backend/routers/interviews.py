import uuid
import json
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File, Form
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database.config import get_async_session
from database.models import User, InterviewSession, AnalyticsSummary, Evaluation, InterviewQuestion, InterviewAnswer
from services.interview_service import TextInterviewEngine
from services.whisper_service import whisper_stt_service

router = APIRouter(tags=["Interview Execution & Adaptive Flow"])
logger = logging.getLogger("preppr-interviews")
engine = TextInterviewEngine()

# In-memory storage for active sessions during local development
SESSIONS_STORE: Dict[str, Dict[str, Any]] = {}


# Per-turn body-language telemetry fields that get averaged into a session summary.
_VISION_AVG_FIELDS = [
    "eye_contact_pct", "blink_rate_per_min", "head_steadiness",
    "smile_positivity", "smiling_pct", "expression_variability",
    "posture_stability", "fidget_index", "presence_pct",
]


def _aggregate_vision_summary(telemetry_list: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Average the per-turn on-device body-language telemetry into a session-level summary.

    Returns None when the camera was never used, so the report can omit the Body-Language
    card entirely. Only numeric aggregates are involved here — no raw video ever reaches the
    backend; the browser sends summary numbers only.
    """
    vision_turns: List[Dict[str, Any]] = []
    for t in telemetry_list or []:
        if not isinstance(t, dict):
            continue
        v = t.get("vision") or {}
        if isinstance(v, dict) and v.get("camera_used") and v.get("frames_analyzed"):
            vision_turns.append(v)
    if not vision_turns:
        return None

    summary: Dict[str, Any] = {"camera_used": True, "turns_analyzed": len(vision_turns)}
    for field in _VISION_AVG_FIELDS:
        vals = [float(v[field]) for v in vision_turns if isinstance(v.get(field), (int, float))]
        if vals:
            summary[field] = round(sum(vals) / len(vals), 1)
    summary["total_frames_analyzed"] = sum(int(v.get("frames_analyzed", 0)) for v in vision_turns)
    return summary


async def resolve_user_int_id(user_id_str: str, db: AsyncSession) -> Optional[int]:
    """Resolves an integer User.id from numeric string, user_ prefix, or email."""
    if not user_id_str:
        return None
    user_id_str = user_id_str.strip()

    if user_id_str.isdigit():
        uid = int(user_id_str)
        stmt = select(User.id).where(User.id == uid)
        res = await db.execute(stmt)
        if res.scalar_one_or_none() is not None:
            return uid

    if user_id_str.startswith("user_") and user_id_str[5:].isdigit():
        uid = int(user_id_str[5:])
        stmt = select(User.id).where(User.id == uid)
        res = await db.execute(stmt)
        if res.scalar_one_or_none() is not None:
            return uid

    stmt = select(User.id).where(func.lower(User.email) == user_id_str.lower())
    res = await db.execute(stmt)
    uid = res.scalar_one_or_none()
    if uid is not None:
        return uid

    return None


class CreateInterviewRequest(BaseModel):
    user_id: str = Field(..., example="user_101")
    company_name: str = Field(..., example="Amazon")
    role_name: str = Field(..., example="Senior Software Engineer - Backend")
    role_category: Optional[str] = Field(None, example="IT", description="Hiring domain (IT, Sales, HR, Finance, Admin); inferred from role_name if omitted")
    difficulty: str = Field("Medium", example="Medium")
    duration: int = Field(15, example=15, description="Interview duration in minutes")


class CreateInterviewResponse(BaseModel):
    session_id: str
    user_id: str
    company_name: str
    role_name: str
    difficulty: str
    duration: int
    status: str
    first_question: str


class SessionStateResponse(BaseModel):
    session_id: str
    user_id: str
    company_name: str
    role_name: str
    difficulty: str
    duration: int
    status: str
    question_count: int
    history: List[Dict[str, str]]


class AnswerTurnRequest(BaseModel):
    transcript: str = Field(..., example="In my previous project, I designed a microservices architecture using FastAPI and PostgreSQL.")
    duration_seconds: float = Field(30.0, example=30.0)
    audio_telemetry: Optional[Dict[str, Any]] = Field(None, example={"wpm": 145.0, "filler_count": 2})
    vision_telemetry: Optional[Dict[str, Any]] = Field(
        None,
        example={"eye_contact_pct": 78.0, "posture_stability": 82.0, "blink_rate_per_min": 17.0, "camera_used": True},
        description="On-device body-language aggregate for this turn (eye contact, posture, expression, fidget). No raw video — summary numbers only.",
    )


class AnswerTurnResponse(BaseModel):
    session_id: str
    turn_number: int
    ai_response: str
    adaptation_type: str
    telemetry: Dict[str, Any]


class AnswerAudioTurnResponse(BaseModel):
    session_id: str
    turn_number: int
    transcript: str
    ai_response: str
    adaptation_type: str
    telemetry: Dict[str, Any]


class EndInterviewResponse(BaseModel):
    session_id: str
    status: str
    message: str


class EvaluationDetailResponse(BaseModel):
    session_id: str
    scores: Dict[str, float]
    feedback_json: Dict[str, Any]
    vision_summary: Optional[Dict[str, Any]] = None


class CodeReviewRequest(BaseModel):
    code: str = Field(..., example="def two_sum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        if target - num in seen:\n            return [seen[target - num], i]\n        seen[num] = i\n    return []")
    language: str = Field("python", example="python")
    problem_title: Optional[str] = Field(None, example="Two Sum")
    candidate_notes: Optional[str] = Field(None, example="Using single-pass hash map for O(N) time and O(N) space.")


class CodeReviewResponse(BaseModel):
    session_id: str
    ai_response: str
    time_complexity: str
    space_complexity: str
    correctness_score: int
    verdict: str
    edge_cases_missed: List[str]
    optimizations: List[str]


class CodeRunRequest(BaseModel):
    code: str = Field(..., example="print('Hello World')")
    language: str = Field("python", example="python")
    test_cases: Optional[List[Dict[str, Any]]] = None


class CodeRunResponse(BaseModel):
    success: bool
    output: str
    execution_time_ms: float



@router.post(
    "/interviews",
    response_model=CreateInterviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create New Mock Interview Session",
    description="Initializes session with target company, role, difficulty, and duration, returning the first question."
)
@router.post("/api/interviews", include_in_schema=False)
async def create_interview_session(
    payload: CreateInterviewRequest,
    db: AsyncSession = Depends(get_async_session)
):
    first_question = await engine.generate_initial_question(
        company_name=payload.company_name,
        role_name=payload.role_name,
        difficulty=payload.difficulty,
        duration=payload.duration,
        user_id=payload.user_id,
        role_category=payload.role_category,
    )

    user_int_id = await resolve_user_int_id(payload.user_id, db)
    db_session_id = None

    if user_int_id is not None:
        try:
            db_session = InterviewSession(
                user_id=user_int_id,
                company_target=payload.company_name,
                role_target=payload.role_name,
                difficulty=payload.difficulty,
                duration=payload.duration,
                status="in_progress"
            )
            db.add(db_session)
            await db.flush()

            # Save initial question
            iq = InterviewQuestion(
                session_id=db_session.id,
                question_text=first_question,
                question_order=1
            )
            db.add(iq)
            await db.commit()
            await db.refresh(db_session)
            db_session_id = db_session.id
            session_id = str(db_session.id)
            logger.info("Created InterviewSession ID %s in PostgreSQL for User ID %s", session_id, user_int_id)
        except Exception as e:
            logger.error("Failed to create InterviewSession in PostgreSQL: %s", e, exc_info=True)
            await db.rollback()
            session_id = f"sess_{uuid.uuid4().hex[:8]}"
    else:
        session_id = f"sess_{uuid.uuid4().hex[:8]}"

    SESSIONS_STORE[session_id] = {
        "session_id": session_id,
        "db_session_id": db_session_id,
        "user_id": payload.user_id,
        "user_int_id": user_int_id,
        "company_name": payload.company_name,
        "role_name": payload.role_name,
        "role_category": payload.role_category,
        "difficulty": payload.difficulty,
        "duration": payload.duration,
        "status": "in_progress",
        "questions": [first_question],
        "answers": [],
        "telemetry": [],
    }

    return CreateInterviewResponse(
        session_id=session_id,
        user_id=payload.user_id,
        company_name=payload.company_name,
        role_name=payload.role_name,
        difficulty=payload.difficulty,
        duration=payload.duration,
        status="in_progress",
        first_question=first_question
    )


@router.get(
    "/interviews/{session_id}",
    response_model=SessionStateResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Interview Session State",
    description="Returns current state, turn history, and question count for session."
)
@router.get("/api/interviews/{session_id}", include_in_schema=False)
async def get_interview_state(
    session_id: str,
    db: AsyncSession = Depends(get_async_session)
):
    sess = SESSIONS_STORE.get(session_id)
    if not sess:
        # Check DB
        if session_id.isdigit():
            db_sess = await db.get(InterviewSession, int(session_id))
            if db_sess:
                # Load questions and answers
                q_stmt = select(InterviewQuestion).where(InterviewQuestion.session_id == db_sess.id).order_by(InterviewQuestion.question_order)
                q_res = await db.execute(q_stmt)
                db_questions = q_res.scalars().all()

                history = []
                for q in db_questions:
                    history.append({"role": "interviewer", "text": q.question_text})
                    a_stmt = select(InterviewAnswer).where(InterviewAnswer.question_id == q.id)
                    a_res = await db.execute(a_stmt)
                    ans = a_res.scalar_one_or_none()
                    if ans:
                        history.append({"role": "candidate", "text": ans.transcript})

                return SessionStateResponse(
                    session_id=session_id,
                    user_id=str(db_sess.user_id),
                    company_name=db_sess.company_target or "Mock Interview AI",
                    role_name=db_sess.role_target or "the target role",
                    difficulty=db_sess.difficulty,
                    duration=db_sess.duration,
                    status=db_sess.status,
                    question_count=len(db_questions),
                    history=history
                )

        # Fallback for refreshed / development session
        fallback_q = "Welcome to your mock interview session! To get started, could you please introduce yourself and walk me through your key experience relevant to this role?"
        fallback_sess = {
            "session_id": session_id,
            "db_session_id": None,
            "user_id": "user_101",
            "company_name": "Mock Interview AI",
            "role_name": "Software Engineer",
            "difficulty": "Medium",
            "duration": 15,
            "status": "in_progress",
            "questions": [fallback_q],
            "answers": [],
            "telemetry": [],
        }
        SESSIONS_STORE[session_id] = fallback_sess
        return SessionStateResponse(
            session_id=session_id,
            user_id="user_101",
            company_name="Mock Interview AI",
            role_name="Software Engineer",
            difficulty="Medium",
            duration=15,
            status="in_progress",
            question_count=1,
            history=[{"role": "interviewer", "text": fallback_q}]
        )

    history = []
    for q, a in zip(sess["questions"], sess["answers"]):
        history.append({"role": "interviewer", "text": q})
        history.append({"role": "candidate", "text": a})
    if len(sess["questions"]) > len(sess["answers"]):
        history.append({"role": "interviewer", "text": sess["questions"][-1]})

    return SessionStateResponse(
        session_id=session_id,
        user_id=sess["user_id"],
        company_name=sess["company_name"],
        role_name=sess["role_name"],
        difficulty=sess["difficulty"],
        duration=sess["duration"],
        status=sess["status"],
        question_count=len(sess["questions"]),
        history=history
    )


@router.post(
    "/interviews/{session_id}/answer",
    response_model=AnswerTurnResponse,
    status_code=status.HTTP_200_OK,
    summary="Process Candidate Answer & Return Adaptive AI Follow-up",
    description="Processes candidate response, applies STAR and difficulty adaptation logic, and generates follow-up question."
)
@router.post("/api/interviews/{session_id}/answer", include_in_schema=False)
async def process_answer_turn(
    session_id: str,
    payload: AnswerTurnRequest,
    db: AsyncSession = Depends(get_async_session)
):
    sess = SESSIONS_STORE.get(session_id)
    if not sess:
        if session_id.isdigit():
            db_sess = await db.get(InterviewSession, int(session_id))
            if db_sess:
                sess = {
                    "session_id": session_id,
                    "db_session_id": db_sess.id,
                    "user_id": str(db_sess.user_id),
                    "company_name": db_sess.company_target or "Mock Interview AI",
                    "role_name": db_sess.role_target or "the target role",
                    "role_category": None,
                    "difficulty": db_sess.difficulty,
                    "duration": db_sess.duration,
                    "status": db_sess.status,
                    "questions": [],
                    "answers": [],
                    "telemetry": [],
                }
                # Load questions from DB
                q_stmt = select(InterviewQuestion).where(InterviewQuestion.session_id == db_sess.id).order_by(InterviewQuestion.question_order)
                q_res = await db.execute(q_stmt)
                db_questions = q_res.scalars().all()
                for q in db_questions:
                    sess["questions"].append(q.question_text)
                    a_stmt = select(InterviewAnswer).where(InterviewAnswer.question_id == q.id)
                    a_res = await db.execute(a_stmt)
                    ans = a_res.scalar_one_or_none()
                    if ans:
                        sess["answers"].append(ans.transcript)
                SESSIONS_STORE[session_id] = sess
            else:
                sess = {
                    "session_id": session_id,
                    "db_session_id": None,
                    "user_id": "user_101",
                    "company_name": "Mock Interview AI",
                    "role_name": "Software Engineer",
                    "role_category": "IT",
                    "difficulty": "Medium",
                    "duration": 15,
                    "status": "in_progress",
                    "questions": ["Welcome to your mock interview session! Could you please introduce yourself and your background?"],
                    "answers": [],
                    "telemetry": [],
                }
                SESSIONS_STORE[session_id] = sess
        else:
            sess = {
                "session_id": session_id,
                "db_session_id": None,
                "user_id": "user_101",
                "company_name": "Mock Interview AI",
                "role_name": "Software Engineer",
                "role_category": "IT",
                "difficulty": "Medium",
                "duration": 15,
                "status": "in_progress",
                "questions": ["Welcome to your mock interview session! Could you please introduce yourself and your background?"],
                "answers": [],
                "telemetry": [],
            }
            SESSIONS_STORE[session_id] = sess

    sess["answers"].append(payload.transcript)

    turn_analysis = await engine.process_turn_and_adapt(
        session_id=session_id,
        company_name=sess.get("company_name", "Mock Interview AI"),
        role_name=sess.get("role_name", "the target role"),
        difficulty=sess.get("difficulty", "Medium"),
        question_history=sess["questions"],
        answer_history=sess["answers"],
        latest_answer=payload.transcript,
        audio_telemetry=payload.audio_telemetry,
        vision_telemetry=payload.vision_telemetry,
        user_id=sess.get("user_id", "user_101"),
        role_category=sess.get("role_category"),
    )

    sess["questions"].append(turn_analysis["ai_response"])
    sess["telemetry"].append(turn_analysis["telemetry"])

    # Persist in DB if connected
    db_id = sess.get("db_session_id") or (int(session_id) if session_id.isdigit() else None)
    if db_id is not None:
        try:
            # Find current question ID
            q_stmt = select(InterviewQuestion).where(
                InterviewQuestion.session_id == db_id,
                InterviewQuestion.question_order == len(sess["answers"])
            )
            q_res = await db.execute(q_stmt)
            curr_q = q_res.scalar_one_or_none()
            if curr_q:
                db_ans = InterviewAnswer(
                    question_id=curr_q.id,
                    transcript=payload.transcript,
                    duration=payload.duration_seconds,
                    vision_json=payload.vision_telemetry,
                )
                db.add(db_ans)

            # Insert next question
            next_q = InterviewQuestion(
                session_id=db_id,
                question_text=turn_analysis["ai_response"],
                question_order=len(sess["questions"])
            )
            db.add(next_q)
            await db.commit()
        except Exception as e:
            logger.error("Error persisting answer turn to DB: %s", e)
            await db.rollback()

    return AnswerTurnResponse(
        session_id=session_id,
        turn_number=len(sess["answers"]),
        ai_response=turn_analysis["ai_response"],
        adaptation_type=turn_analysis["adaptation_type"],
        telemetry=turn_analysis["telemetry"]
    )


@router.post(
    "/interviews/{session_id}/answer-audio",
    response_model=AnswerAudioTurnResponse,
    status_code=status.HTTP_200_OK,
    summary="Process Candidate Microphone Audio Answer via Whisper STT",
    description="Transcribes candidate microphone recording using Whisper STT and generates adaptive AI follow-up."
)
@router.post("/api/interviews/{session_id}/answer-audio", include_in_schema=False)
async def process_answer_audio_turn(
    session_id: str,
    file: UploadFile = File(..., description="Audio recording blob from student microphone"),
    vision_telemetry: Optional[str] = Form(None, description="JSON-encoded on-device body-language aggregate for this turn (optional)"),
    db: AsyncSession = Depends(get_async_session)
):
    if not file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No audio file provided."
        )

    # 1. Transcribe audio with Whisper STT
    try:
        audio_bytes = await file.read()
        if not audio_bytes or len(audio_bytes) < 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty or corrupted audio recording received."
            )
        stt_result = whisper_stt_service.transcribe(audio_bytes)
        transcript = stt_result.get("transcript", "").strip()
        if not transcript:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Whisper could not detect any speech in the audio recording. Please speak clearly into your microphone."
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Whisper transcription failed during audio turn: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Whisper STT failed to process speech: {str(e)}"
        )

    # 2. Package telemetry and pass into process_answer_turn logic
    audio_telemetry = {
        "wpm": stt_result.get("wpm", 140.0),
        "filler_count": stt_result.get("filler_count", 0),
        "duration_seconds": stt_result.get("duration_seconds", 30.0),
        "model": stt_result.get("model", "openai/whisper-large-v3"),
    }

    # Vision telemetry (optional) rides along as a JSON form field so this audio path reuses
    # the single turn choke point. Parse defensively — a malformed field must not fail the turn.
    parsed_vision: Optional[Dict[str, Any]] = None
    if vision_telemetry:
        try:
            parsed_vision = json.loads(vision_telemetry)
        except Exception as ve:
            logger.warning("Ignoring malformed vision_telemetry on audio turn: %s", ve)

    turn_request = AnswerTurnRequest(
        transcript=transcript,
        duration_seconds=stt_result.get("duration_seconds", 30.0),
        audio_telemetry=audio_telemetry,
        vision_telemetry=parsed_vision,
    )

    turn_res = await process_answer_turn(session_id=session_id, payload=turn_request, db=db)

    return AnswerAudioTurnResponse(
        session_id=session_id,
        turn_number=turn_res.turn_number,
        transcript=transcript,
        ai_response=turn_res.ai_response,
        adaptation_type=turn_res.adaptation_type,
        telemetry=turn_res.telemetry
    )


@router.post(
    "/interviews/{session_id}/review-code",
    response_model=CodeReviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit and Review Code or Whiteboard Architecture",
    description="Analyzes candidate code logic, Big-O Time & Space Complexity, edge cases, and provides adaptive interviewer feedback."
)
@router.post("/api/interviews/{session_id}/review-code", include_in_schema=False)
async def review_interview_code(
    session_id: str,
    payload: CodeReviewRequest,
    db: AsyncSession = Depends(get_async_session)
):
    sess = SESSIONS_STORE.get(session_id)
    company_name = sess.get("company_name", "Mock Interview AI") if sess else "Mock Interview AI"
    role_name = sess.get("role_name", "Software Engineer") if sess else "Software Engineer"

    result = await engine.evaluate_code_submission(
        session_id=session_id,
        code=payload.code,
        language=payload.language,
        problem_title=payload.problem_title,
        candidate_notes=payload.candidate_notes,
        role_name=role_name,
        company_name=company_name,
    )

    # Integrate candidate code into ongoing conversation session history
    code_summary = (
        f"[Candidate Submitted {payload.language.upper()} Code - {result['verdict']}]\n"
        f"Time Complexity: {result['time_complexity']} | Space: {result['space_complexity']}\n"
    )
    if payload.candidate_notes:
        code_summary += f"Candidate Explanation: {payload.candidate_notes}\n"
    code_summary += f"```{payload.language}\n{payload.code}\n```"

    if sess:
        sess["answers"].append(code_summary)
        sess["questions"].append(result["ai_response"])
        sess["telemetry"].append({
            "wpm": 150.0,
            "filler_count": 0,
            "type": "code_review",
            "correctness": result["correctness_score"],
            "time_complexity": result["time_complexity"],
            "space_complexity": result["space_complexity"],
        })

    return CodeReviewResponse(
        session_id=session_id,
        ai_response=result["ai_response"],
        time_complexity=result["time_complexity"],
        space_complexity=result["space_complexity"],
        correctness_score=result["correctness_score"],
        verdict=result["verdict"],
        edge_cases_missed=result["edge_cases_missed"],
        optimizations=result["optimizations"],
    )


@router.post(
    "/interviews/run-code",
    response_model=CodeRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Run Code in Sandbox",
    description="Executes code snippet safely and returns stdout output, runtime errors, and execution duration."
)
@router.post("/api/interviews/run-code", include_in_schema=False)
async def run_interview_code(payload: CodeRunRequest):
    run_result = engine.run_code_sandbox(
        code=payload.code,
        language=payload.language,
        test_cases=payload.test_cases
    )
    return CodeRunResponse(
        success=run_result["success"],
        output=run_result["output"],
        execution_time_ms=run_result["execution_time_ms"],
    )


class DSAPromptRequest(BaseModel):
    difficulty: Optional[str] = Field("Medium", example="Medium")
    company_name: Optional[str] = Field(None, example="Amazon")
    role_name: Optional[str] = Field(None, example="Software Engineer")


@router.get(
    "/interviews/{session_id}/dsa-challenge",
    summary="Get Dynamic LeetCode Challenge for Session",
    description="Dynamically fetches or generates an authentic LeetCode problem tailored to the session difficulty, company, and role."
)
@router.get("/api/interviews/{session_id}/dsa-challenge", include_in_schema=False)
async def get_session_dsa_challenge(
    session_id: str,
    difficulty: Optional[str] = None,
    db: AsyncSession = Depends(get_async_session)
):
    sess = SESSIONS_STORE.get(session_id)
    session_diff = difficulty or (sess.get("difficulty", "Medium") if sess else "Medium")
    company_name = sess.get("company_name") if sess else "Tech Company"
    role_name = sess.get("role_name") if sess else "Software Engineer"

    problem = await engine.generate_dsa_problem(
        difficulty=session_diff,
        company_name=company_name,
        role_name=role_name,
    )
    return problem


@router.post(
    "/interviews/dsa/generate",
    summary="Generate Fresh LeetCode DSA Problem",
    description="Generates an authentic LeetCode algorithmic problem matching the requested difficulty (Easy, Medium, Hard)."
)
@router.post("/api/interviews/dsa/generate", include_in_schema=False)
async def generate_dsa_problem_endpoint(payload: DSAPromptRequest):
    problem = await engine.generate_dsa_problem(
        difficulty=payload.difficulty or "Medium",
        company_name=payload.company_name,
        role_name=payload.role_name,
    )
    return problem


@router.post(
    "/interviews/{session_id}/end",
    response_model=EndInterviewResponse,
    status_code=status.HTTP_200_OK,
    summary="End Interview Session",
    description="Marks interview session complete, executes OpenAI rubric evaluation, and persists results."
)
@router.post("/api/interviews/{session_id}/end", include_in_schema=False)
async def end_interview_session(
    session_id: str,
    db: AsyncSession = Depends(get_async_session)
):
    sess = SESSIONS_STORE.get(session_id)
    if not sess:
        if session_id.isdigit():
            db_sess = await db.get(InterviewSession, int(session_id))
            if db_sess:
                # Load questions and answers from DB
                q_stmt = select(InterviewQuestion).where(InterviewQuestion.session_id == db_sess.id).order_by(InterviewQuestion.question_order)
                q_res = await db.execute(q_stmt)
                db_questions = q_res.scalars().all()
                questions = [q.question_text for q in db_questions]
                answers = []
                for q in db_questions:
                    a_stmt = select(InterviewAnswer).where(InterviewAnswer.question_id == q.id)
                    a_res = await db.execute(a_stmt)
                    ans = a_res.scalar_one_or_none()
                    if ans:
                        answers.append(ans.transcript)
                sess = {
                    "session_id": session_id,
                    "db_session_id": db_sess.id,
                    "questions": questions,
                    "answers": answers,
                    "telemetry": [],
                    "status": "in_progress",
                    "company_name": db_sess.company_target or "Mock Interview AI",
                    "role_name": db_sess.role_target or "the target role",
                    "role_category": None,
                }
                SESSIONS_STORE[session_id] = sess

    if not sess:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Interview session '{session_id}' not found."
        )

    sess["status"] = "completed"

    # Aggregate on-device body-language telemetry across the session (None if camera was off).
    vision_summary = _aggregate_vision_summary(sess.get("telemetry", []))
    sess["vision_summary"] = vision_summary

    # Evaluate session rubric with OpenAI
    eval_result = await engine.evaluate_session_rubric(
        session_id=session_id,
        questions=sess.get("questions", []),
        answers=sess.get("answers", []),
        telemetry_summaries=sess.get("telemetry", []),
        role_name=sess.get("role_name", "the target role"),
        role_category=sess.get("role_category"),
        vision_summary=vision_summary,
    )
    overall_score = float(eval_result.get("scores", {}).get("overall", 80.0))
    sess["evaluation"] = eval_result

    # Calculate average WPM and filler words
    wpm_values = [t.get("wpm", 140) for t in sess.get("telemetry", []) if isinstance(t, dict) and "wpm" in t]
    avg_wpm = round(sum(wpm_values) / len(wpm_values), 1) if wpm_values else 140.0
    total_fillers = sum(t.get("filler_count", 0) for t in sess.get("telemetry", []) if isinstance(t, dict))

    # Check DB session
    db_id = sess.get("db_session_id") or (int(session_id) if session_id.isdigit() else None)

    if db_id is not None:
        try:
            db_sess = await db.get(InterviewSession, db_id)
            if db_sess:
                db_sess.status = "completed"
                db_sess.overall_score = overall_score

                # Persist or update Evaluation
                eval_stmt = select(Evaluation).where(Evaluation.session_id == db_sess.id)
                eval_res = await db.execute(eval_stmt)
                existing_eval = eval_res.scalar_one_or_none()
                if existing_eval:
                    existing_eval.scores = eval_result["scores"]
                    existing_eval.feedback_json = eval_result["feedback_json"]
                else:
                    db_evaluation = Evaluation(
                        session_id=db_sess.id,
                        scores=eval_result["scores"],
                        feedback_json=eval_result["feedback_json"]
                    )
                    db.add(db_evaluation)

                # Add or update AnalyticsSummary
                analytics_stmt = select(AnalyticsSummary).where(AnalyticsSummary.session_id == db_sess.id)
                analytics_res = await db.execute(analytics_stmt)
                existing_analytics = analytics_res.scalar_one_or_none()
                if existing_analytics:
                    existing_analytics.average_wpm = avg_wpm
                    existing_analytics.total_filler_words = total_fillers
                    existing_analytics.vision_json = vision_summary
                    existing_analytics.avg_eye_contact = (vision_summary or {}).get("eye_contact_pct")
                else:
                    analytics_summary = AnalyticsSummary(
                        session_id=db_sess.id,
                        average_wpm=avg_wpm,
                        total_filler_words=total_fillers,
                        longest_silence=2.0,
                        vision_json=vision_summary,
                        avg_eye_contact=(vision_summary or {}).get("eye_contact_pct"),
                    )
                    db.add(analytics_summary)

                await db.commit()
                logger.info("Persisted completed InterviewSession ID %s, Evaluation, and AnalyticsSummary in PostgreSQL", db_sess.id)
        except Exception as e:
            logger.error("Failed to commit completed session to DB: %s", e, exc_info=True)
            await db.rollback()

    return EndInterviewResponse(
        session_id=session_id,
        status="completed",
        message=f"Interview session '{session_id}' ended successfully. Evaluation and analytics prepared."
    )


@router.get(
    "/interviews/{session_id}/evaluation",
    response_model=EvaluationDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Session Evaluation & Rubric Scores",
    description="Returns detailed competency scores (Technical, Communication, Problem Solving, Structure, Overall) and feedback."
)
@router.get("/api/interviews/{session_id}/evaluation", include_in_schema=False)
async def get_interview_evaluation(
    session_id: str,
    db: AsyncSession = Depends(get_async_session)
):
    sess = SESSIONS_STORE.get(session_id)
    if sess:
        if "evaluation" in sess:
            return EvaluationDetailResponse(
                session_id=session_id,
                scores=sess["evaluation"]["scores"],
                feedback_json=sess["evaluation"]["feedback_json"],
                vision_summary=sess.get("vision_summary"),
            )
        vision_summary = _aggregate_vision_summary(sess.get("telemetry", []))
        sess["vision_summary"] = vision_summary
        eval_result = await engine.evaluate_session_rubric(
            session_id=session_id,
            questions=sess.get("questions", []),
            answers=sess.get("answers", []),
            telemetry_summaries=sess.get("telemetry", []),
            role_name=sess.get("role_name", "the target role"),
            role_category=sess.get("role_category"),
            vision_summary=vision_summary,
        )
        sess["evaluation"] = eval_result
        return EvaluationDetailResponse(
            session_id=session_id,
            scores=eval_result["scores"],
            feedback_json=eval_result["feedback_json"],
            vision_summary=vision_summary,
        )

    # Check database for session and evaluation
    if session_id.isdigit():
        db_id = int(session_id)
        try:
            eval_stmt = select(Evaluation).where(Evaluation.session_id == db_id)
            eval_res = await db.execute(eval_stmt)
            db_eval = eval_res.scalar_one_or_none()
            if db_eval:
                analytics_stmt = select(AnalyticsSummary).where(AnalyticsSummary.session_id == db_id)
                analytics_res = await db.execute(analytics_stmt)
                db_analytics = analytics_res.scalar_one_or_none()
                return EvaluationDetailResponse(
                    session_id=session_id,
                    scores=db_eval.scores,
                    feedback_json=db_eval.feedback_json,
                    vision_summary=(db_analytics.vision_json if db_analytics else None),
                )

            # If session exists in DB without evaluation, run rubric on stored Q&A
            db_sess = await db.get(InterviewSession, db_id)
            if db_sess:
                q_stmt = select(InterviewQuestion).where(InterviewQuestion.session_id == db_sess.id).order_by(InterviewQuestion.question_order)
                q_res = await db.execute(q_stmt)
                db_questions = q_res.scalars().all()
                questions = [q.question_text for q in db_questions]
                answers = []
                for q in db_questions:
                    a_stmt = select(InterviewAnswer).where(InterviewAnswer.question_id == q.id)
                    a_res = await db.execute(a_stmt)
                    ans = a_res.scalar_one_or_none()
                    if ans:
                        answers.append(ans.transcript)

                eval_result = await engine.evaluate_session_rubric(
                    session_id=session_id,
                    questions=questions,
                    answers=answers,
                    telemetry_summaries=[],
                    role_name=db_sess.role_target or "the target role",
                    role_category=None,
                )
                db_evaluation = Evaluation(
                    session_id=db_sess.id,
                    scores=eval_result["scores"],
                    feedback_json=eval_result["feedback_json"]
                )
                db.add(db_evaluation)
                await db.commit()

                return EvaluationDetailResponse(
                    session_id=session_id,
                    scores=eval_result["scores"],
                    feedback_json=eval_result["feedback_json"],
                    vision_summary=None,
                )
        except Exception as e:
            logger.error("Error generating evaluation from DB session: %s", e)
            await db.rollback()

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Interview session '{session_id}' not found or has no recorded answers to evaluate."
    )

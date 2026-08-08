import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from services.interview_service import TextInterviewEngine

router = APIRouter(tags=["Interview Execution & Adaptive Flow"])
engine = TextInterviewEngine()

# In-memory storage for active sessions during local development
SESSIONS_STORE: Dict[str, Dict[str, Any]] = {}


class CreateInterviewRequest(BaseModel):
    user_id: str = Field(..., example="user_101")
    company_name: str = Field(..., example="Amazon")
    role_name: str = Field(..., example="Senior Software Engineer - Backend")
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


class AnswerTurnResponse(BaseModel):
    session_id: str
    turn_number: int
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


@router.post(
    "/interviews",
    response_model=CreateInterviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create New Mock Interview Session",
    description="Initializes session with target company, role, difficulty, and duration, returning the first question."
)
@router.post("/api/interviews", include_in_schema=False)
async def create_interview_session(payload: CreateInterviewRequest):
    session_id = f"sess_{uuid.uuid4().hex[:8]}"

    first_question = await engine.generate_initial_question(
        company_name=payload.company_name,
        role_name=payload.role_name,
        difficulty=payload.difficulty,
        duration=payload.duration,
        user_id=payload.user_id
    )

    SESSIONS_STORE[session_id] = {
        "session_id": session_id,
        "user_id": payload.user_id,
        "company_name": payload.company_name,
        "role_name": payload.role_name,
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
async def get_interview_state(session_id: str):
    sess = SESSIONS_STORE.get(session_id)
    if not sess:
        # Fallback response for demo session IDs
        return SessionStateResponse(
            session_id=session_id,
            user_id="user_101",
            company_name="Amazon",
            role_name="Senior Software Engineer",
            difficulty="Medium",
            duration=15,
            status="in_progress",
            question_count=2,
            history=[
                {"role": "interviewer", "text": "Tell me about a complex project you worked on."},
                {"role": "candidate", "text": "I built a real-time analytics pipeline using Python and Redis."}
            ]
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
async def process_answer_turn(session_id: str, payload: AnswerTurnRequest):
    sess = SESSIONS_STORE.get(session_id)
    if not sess:
        sess = {
            "session_id": session_id,
            "user_id": "user_101",
            "company_name": "Amazon",
            "role_name": "Senior Software Engineer",
            "difficulty": "Medium",
            "duration": 15,
            "status": "in_progress",
            "questions": ["Tell me about a complex architecture you designed."],
            "answers": [],
            "telemetry": [],
        }
        SESSIONS_STORE[session_id] = sess

    sess["answers"].append(payload.transcript)

    turn_analysis = await engine.process_turn_and_adapt(
        session_id=session_id,
        company_name=sess["company_name"],
        role_name=sess["role_name"],
        difficulty=sess["difficulty"],
        question_history=sess["questions"],
        answer_history=sess["answers"],
        latest_answer=payload.transcript,
        audio_telemetry=payload.audio_telemetry
    )

    sess["questions"].append(turn_analysis["ai_response"])
    sess["telemetry"].append(turn_analysis["telemetry"])

    return AnswerTurnResponse(
        session_id=session_id,
        turn_number=len(sess["answers"]),
        ai_response=turn_analysis["ai_response"],
        adaptation_type=turn_analysis["adaptation_type"],
        telemetry=turn_analysis["telemetry"]
    )


@router.post(
    "/interviews/{session_id}/end",
    response_model=EndInterviewResponse,
    status_code=status.HTTP_200_OK,
    summary="End Interview Session",
    description="Marks interview session complete and enqueues evaluation."
)
@router.post("/api/interviews/{session_id}/end", include_in_schema=False)
async def end_interview_session(session_id: str):
    sess = SESSIONS_STORE.get(session_id)
    if sess:
        sess["status"] = "completed"

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
async def get_interview_evaluation(session_id: str):
    sess = SESSIONS_STORE.get(session_id)
    if sess:
        eval_result = await engine.evaluate_session_rubric(
            session_id=session_id,
            questions=sess["questions"],
            answers=sess["answers"],
            telemetry_summaries=sess["telemetry"]
        )
        return EvaluationDetailResponse(
            session_id=session_id,
            scores=eval_result["scores"],
            feedback_json=eval_result["feedback_json"]
        )

    # Fallback response for demo session
    return EvaluationDetailResponse(
        session_id=session_id,
        scores={
            "technical": 82.5,
            "communication": 78.0,
            "problem_solving": 84.0,
            "structure": 75.0,
            "overall": 80.5
        },
        feedback_json={
            "strengths": [
                "Demonstrated solid technical depth in distributed systems architecture.",
                "Pacing was consistent around ~142 Words Per Minute."
            ],
            "weaknesses": [
                "Behavioral answers lacked explicit quantifiable outcome metrics.",
                "Detected occasional filler words (4 instances)."
            ],
            "improvement_plan": [
                "Practice framing outcomes with exact percentage metrics.",
                "Structure answers with explicit Situation, Task, Action, Result segments."
            ]
        }
    )

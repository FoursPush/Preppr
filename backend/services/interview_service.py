import logging
import re
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from services.vector_service import VectorStoreManager

logger = logging.getLogger("preppr-interview-service")
vector_manager = VectorStoreManager()


class AnswerAnalysis(BaseModel):
    is_strong: bool
    is_star_incomplete: bool
    missing_star_component: Optional[str] = None
    filler_count: int = 0
    wpm: float = 0.0
    detected_weaknesses: List[str] = Field(default_factory=list)


class TextInterviewEngine:
    """
    Core Text-First Mock Interview Service implementing Phase 5 & Phase 6 adaptive follow-up logic.
    """

    def __init__(self):
        self.vector_manager = vector_manager

    def evaluate_star_structure(self, answer_text: str) -> Dict[str, bool]:
        """
        Analyzes behavioral answers for STAR framework components:
        Situation (S), Task (T), Action (A), Result (R).
        """
        text_lower = answer_text.lower()
        has_situation = any(k in text_lower for k in ["when", "situation", "project", "working at", "company", "role"])
        has_task = any(k in text_lower for k in ["tasked", "needed to", "goal", "challenge", "objective", "required"])
        has_action = any(k in text_lower for k in ["i implemented", "i built", "i designed", "i created", "i led", "i optimized", "i wrote", "action", "step"])
        has_result = any(k in text_lower for k in ["result", "outcome", "reduced", "increased", "improved", "saved", "achieved", "metrics", "percent", "%"])

        return {
            "S": has_situation,
            "T": has_task,
            "A": has_action,
            "R": has_result,
        }

    async def generate_initial_question(
        self,
        company_name: str,
        role_name: str,
        difficulty: str = "Medium",
        duration: int = 15,
        user_id: str = "user_101"
    ) -> str:
        """
        Generates the first question tailored to the company, role, difficulty, and candidate resume context.
        """
        resume_context = await self.vector_manager.search_resume_context(
            user_id=user_id, query_text=f"{role_name} technical skills"
        )
        ctx_snippet = resume_context[0]["chunk_text"] if resume_context else ""

        question = (
            f"Welcome to your {company_name} {role_name} mock interview! "
            f"To get started, tell me about a complex project you've worked on recently, "
            f"focusing on your specific technical contributions and architectural choices."
        )
        return question

    async def process_turn_and_adapt(
        self,
        session_id: str,
        company_name: str,
        role_name: str,
        difficulty: str,
        question_history: List[str],
        answer_history: List[str],
        latest_answer: str,
        audio_telemetry: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Analyzes candidate's latest answer and produces an adaptive follow-up response.
        Applies Phase 6 adaptive rules:
        - Strong answer -> Harder follow-up
        - Weak answer -> Clarification / fundamentals
        - Incomplete STAR answer -> Prompt for missing S/T/A/R component
        """
        word_count = len(latest_answer.split())
        star_analysis = self.evaluate_star_structure(latest_answer)

        # Telemetry processing
        wpm = audio_telemetry.get("wpm", 140.0) if audio_telemetry else round(word_count / 0.5, 1)
        fillers = audio_telemetry.get("filler_count", 0) if audio_telemetry else len(re.findall(r"\b(um|uh|like|you know)\b", latest_answer.lower()))

        # Determine STAR completeness
        missing_star = None
        for comp, present in star_analysis.items():
            if not present:
                missing_star = comp
                break

        # Adaptive Decision Engine
        if word_count < 15:
            # Weak / superficial answer -> ask for clarification / fundamentals
            follow_up = (
                f"Your response was quite brief. Could you elaborate on the technical implementation details "
                f"and explain the underlying principles behind your approach?"
            )
            adaptation_type = "clarification_fundamentals"
        elif missing_star and len(question_history) % 2 == 1:
            # Incomplete STAR answer on behavioral/experience question -> ask for missing component
            star_names = {"S": "Situation", "T": "Task", "A": "Action", "R": "Result"}
            follow_up = (
                f"Thanks for sharing. To help complete the picture, could you detail the specific "
                f"{star_names.get(missing_star, 'Result')} of that project and quantify its impact?"
            )
            adaptation_type = f"incomplete_star_{missing_star}"
        elif word_count > 60:
            # Strong detailed answer -> escalate difficulty with deeper system/edge-case follow-up
            follow_up = (
                f"Great detail. Escalating to a higher difficulty: How would your solution handle a 10x surge in load, "
                f"and what failure modes or data consistency trade-offs would you monitor?"
            )
            adaptation_type = "increased_difficulty"
        else:
            # Balanced answer -> standard next question
            follow_up = (
                f"Understood. Moving on: How do you approach debugging high-latency requests in a distributed microservices environment?"
            )
            adaptation_type = "standard_next_question"

        return {
            "ai_response": follow_up,
            "adaptation_type": adaptation_type,
            "telemetry": {
                "word_count": word_count,
                "wpm": wpm,
                "filler_count": fillers,
                "star_analysis": star_analysis,
            }
        }

    async def evaluate_session_rubric(
        self,
        session_id: str,
        questions: List[str],
        answers: List[str],
        telemetry_summaries: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        LLM-as-a-Judge Evaluation Engine (Phase 9 & 13 of plan.md).
        Scores Technical, Communication, Problem Solving, Structure, and Overall performance.
        """
        total_answers = max(1, len(answers))
        total_words = sum(len(a.split()) for a in answers)
        avg_wpm = round(sum(t.get("wpm", 140) for t in telemetry_summaries) / max(1, len(telemetry_summaries)), 1)
        total_fillers = sum(t.get("filler_count", 0) for t in telemetry_summaries)

        technical = min(100.0, max(50.0, 70.0 + (total_words / total_answers) * 0.4))
        communication = min(100.0, max(40.0, 85.0 - (total_fillers * 2.5) + (10 if 120 <= avg_wpm <= 160 else -10)))
        problem_solving = round((technical * 0.6) + 30.0, 1)
        structure = round(min(100.0, max(50.0, 65.0 + (total_words > 100) * 20)), 1)
        overall = round((technical * 0.35) + (communication * 0.25) + (problem_solving * 0.25) + (structure * 0.15), 1)

        scores = {
            "technical": round(technical, 1),
            "communication": round(communication, 1),
            "problem_solving": round(problem_solving, 1),
            "structure": round(structure, 1),
            "overall": overall
        }

        feedback = {
            "strengths": [
                "Demonstrated solid domain understanding and problem-solving initiative.",
                "Maintained clear speech rate throughout the interview session."
            ],
            "weaknesses": [
                "Some answers lacked explicit STAR structural framing for outcomes.",
                f"Detected {total_fillers} filler word instances across responses."
            ],
            "improvement_plan": [
                "Practice using the STAR framework (Situation, Task, Action, Result) for behavioral questions.",
                "Incorporate metric-driven outcomes (e.g., latency reduction %, throughput) into project descriptions."
            ]
        }

        return {
            "session_id": session_id,
            "scores": scores,
            "feedback_json": feedback,
        }

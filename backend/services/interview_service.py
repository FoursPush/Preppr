import os
import logging
import re
import json
from typing import List, Dict, Any, Optional
import httpx
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


async def call_openai_chat(
    messages: List[Dict[str, str]],
    model: str = "gpt-4o-mini",
    temperature: float = 0.7,
    max_tokens: int = 350,
    json_mode: bool = False
) -> Optional[str]:
    """
    Direct asynchronous HTTP client calling OpenAI Chat Completions API.
    Gracefully falls back if key is unconfigured or rate-limited.
    """
    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("LLM_API_KEY")
    if not api_key or api_key.startswith("your_"):
        logger.warning("No valid OPENAI_API_KEY detected in environment; falling back to heuristic engine.")
        return None

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json"
    }
    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload
            )
            if resp.status_code == 200:
                data = resp.json()
                return data["choices"][0]["message"]["content"].strip()
            else:
                logger.error("OpenAI API returned HTTP %s: %s", resp.status_code, resp.text)
                return None
    except Exception as e:
        logger.error("Error communicating with OpenAI Chat API: %s", e, exc_info=True)
        return None


class TextInterviewEngine:
    """
    Core Mock Interview Engine powered by OpenAI Chat Completions with RAG context & adaptive follow-up.
    """

    def __init__(self):
        self.vector_manager = vector_manager

    def evaluate_star_structure(self, answer_text: str) -> Dict[str, bool]:
        """
        Analyzes behavioral answers for STAR framework components:
        Situation (S), Task (T), Action (A), Result (R).
        """
        text_lower = answer_text.lower()
        has_situation = any(k in text_lower for k in ["when", "situation", "project", "working at", "company", "role", "team"])
        has_task = any(k in text_lower for k in ["tasked", "needed to", "goal", "challenge", "objective", "required", "problem"])
        has_action = any(k in text_lower for k in ["i implemented", "i built", "i designed", "i created", "i led", "i optimized", "i wrote", "action", "step", "we developed"])
        has_result = any(k in text_lower for k in ["result", "outcome", "reduced", "increased", "improved", "saved", "achieved", "metrics", "percent", "%", "impact"])

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
        Generates dynamic first question tailored to company, role, difficulty, and candidate resume context.
        """
        resume_context = await self.vector_manager.search_resume_context(
            user_id=user_id, query_text=f"{role_name} technical skills"
        )
        ctx_snippet = resume_context[0]["chunk_text"] if resume_context else ""

        system_prompt = (
            f"You are an expert technical interviewer at {company_name} conducting a {difficulty} difficulty "
            f"mock interview for the position of {role_name} ({duration} minutes total).\n"
            f"Your goal is to warmly introduce the session and ask the candidate their very first interview question.\n"
            f"Make the question highly relevant to {role_name} and typical {company_name} interview standards (e.g. system design, coding architecture, or leadership principles).\n"
            f"{'Candidate Resume Background snippet: ' + ctx_snippet if ctx_snippet else ''}\n"
            f"Requirements:\n"
            f"- Welcome the candidate briefly.\n"
            f"- Ask ONE clear, engaging question.\n"
            f"- Keep the overall message under 3 sentences."
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "Please start our interview session with the opening question."}
        ]

        llm_response = await call_openai_chat(messages, model="gpt-4o-mini", temperature=0.7, max_tokens=150)
        if llm_response:
            return llm_response

        # Fallback if OpenAI key is offline
        return (
            f"Welcome to your {company_name} {role_name} mock interview! "
            f"To get started, tell me about a complex project you've worked on recently, "
            f"focusing on your specific technical contributions and architectural choices."
        )

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
        Analyzes candidate's latest answer using OpenAI and produces an adaptive follow-up question.
        """
        word_count = len(latest_answer.split())
        star_analysis = self.evaluate_star_structure(latest_answer)

        # Telemetry processing
        wpm = audio_telemetry.get("wpm", 140.0) if audio_telemetry else round(word_count / 0.5, 1)
        fillers = audio_telemetry.get("filler_count", 0) if audio_telemetry else len(re.findall(r"\b(um|uh|like|you know)\b", latest_answer.lower()))

        # Build conversation history for OpenAI
        system_prompt = (
            f"You are Preppr AI, a seasoned technical and behavioral interviewer at {company_name} evaluating a candidate for the {role_name} position (Difficulty: {difficulty}).\n\n"
            f"Follow these strict interview guidelines:\n"
            f"1. Actively listen to the candidate's answer and assess its technical depth, correctness, and STAR structure.\n"
            f"2. If the candidate gave a vague or brief answer, probe specifically on the missing technical details or outcome metrics.\n"
            f"3. If the candidate gave a strong answer, ask a challenging follow-up question involving trade-offs, scaling, failure handling, or edge cases.\n"
            f"4. Ask EXACTLY ONE question at a time. Keep it natural, conversational, and concise (under 3-4 sentences).\n"
            f"5. Do NOT provide answers or lengthy explanations; stay strictly in character as the interviewer."
        )

        messages = [{"role": "system", "content": system_prompt}]

        # Append prior conversation turns
        for q, a in zip(question_history, answer_history[:-1] if len(answer_history) > len(question_history) else answer_history):
            messages.append({"role": "assistant", "content": q})
            messages.append({"role": "user", "content": a})

        # Append latest turn
        if question_history and len(question_history) > len(messages) // 2:
            messages.append({"role": "assistant", "content": question_history[-1]})
        messages.append({"role": "user", "content": latest_answer})

        llm_response = await call_openai_chat(messages, model="gpt-4o-mini", temperature=0.7, max_tokens=220)

        if llm_response:
            adaptation_type = "llm_adaptive_followup"
            follow_up = llm_response
        else:
            # Fallback heuristic rules
            missing_star = None
            for comp, present in star_analysis.items():
                if not present:
                    missing_star = comp
                    break

            if word_count < 15:
                follow_up = (
                    f"Your response was quite brief. Could you elaborate on the technical implementation details "
                    f"and explain the underlying principles behind your approach?"
                )
                adaptation_type = "clarification_fundamentals"
            elif missing_star and len(question_history) % 2 == 1:
                star_names = {"S": "Situation", "T": "Task", "A": "Action", "R": "Result"}
                follow_up = (
                    f"Thanks for sharing. To help complete the picture, could you detail the specific "
                    f"{star_names.get(missing_star, 'Result')} of that project and quantify its impact?"
                )
                adaptation_type = f"incomplete_star_{missing_star}"
            elif word_count > 60:
                follow_up = (
                    f"Great detail. Escalating to a higher difficulty: How would your solution handle a 10x surge in load, "
                    f"and what failure modes or data consistency trade-offs would you monitor?"
                )
                adaptation_type = "increased_difficulty"
            else:
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
        LLM-as-a-Judge Evaluation Engine using OpenAI to score Technical, Communication, Problem Solving, Structure, and Overall performance.
        """
        total_answers = max(1, len(answers))
        total_words = sum(len(a.split()) for a in answers)
        avg_wpm = round(sum(t.get("wpm", 140) for t in telemetry_summaries) / max(1, len(telemetry_summaries)), 1)
        total_fillers = sum(t.get("filler_count", 0) for t in telemetry_summaries)

        # Prepare evaluation prompt for LLM-as-a-Judge
        conversation_log = "\n\n".join(
            [f"Interviewer: {q}\nCandidate: {a}" for q, a in zip(questions, answers)]
        )

        eval_system_prompt = (
            "You are an expert hiring manager and interview coach evaluating a completed candidate mock interview.\n"
            "Analyze the candidate's answers based on:\n"
            "1. Technical Correctness & Depth (0-100)\n"
            "2. Communication Clarity & Articulation (0-100)\n"
            "3. Problem Solving & Architectural Reasoning (0-100)\n"
            "4. Structure & STAR Framework Completeness (0-100)\n"
            "5. Overall Performance Score (0-100)\n\n"
            "Respond ONLY with a JSON object in this exact schema:\n"
            "{\n"
            '  "scores": {\n'
            '    "technical": 85.0,\n'
            '    "communication": 80.0,\n'
            '    "problem_solving": 88.0,\n'
            '    "structure": 78.0,\n'
            '    "overall": 83.5\n'
            "  },\n"
            '  "feedback_json": {\n'
            '    "strengths": ["string", "string"],\n'
            '    "weaknesses": ["string", "string"],\n'
            '    "improvement_plan": ["string", "string"]\n'
            "  }\n"
            "}"
        )

        eval_user_prompt = (
            f"Interview Transcript:\n{conversation_log}\n\n"
            f"Telemetry Summary: Average WPM={avg_wpm}, Total Filler Words={total_fillers}."
        )

        messages = [
            {"role": "system", "content": eval_system_prompt},
            {"role": "user", "content": eval_user_prompt}
        ]

        llm_eval_json = await call_openai_chat(
            messages,
            model="gpt-4o-mini",
            temperature=0.3,
            max_tokens=600,
            json_mode=True
        )

        if llm_eval_json:
            try:
                parsed = json.loads(llm_eval_json)
                if "scores" in parsed and "feedback_json" in parsed:
                    return {
                        "session_id": session_id,
                        "scores": parsed["scores"],
                        "feedback_json": parsed["feedback_json"],
                    }
            except Exception as parse_err:
                logger.error("Failed to parse LLM rubric evaluation JSON: %s", parse_err)

        # Fallback scoring heuristic
        technical = min(100.0, max(50.0, 70.0 + (total_words / total_answers) * 0.4))
        communication = min(100.0, max(40.0, 85.0 - (total_fillers * 2.5) + (10 if 120 <= avg_wpm <= 160 else -10)))
        problem_solving = round((technical * 0.6) + 30.0, 1)
        structure = round(min(100.0, max(50.0, 65.0 + (total_words > 100) * 20)), 1)
        overall = round((technical * 0.35) + (communication * 0.25) + (problem_solving * 0.25) + (structure * 0.15), 1)

        return {
            "session_id": session_id,
            "scores": {
                "technical": round(technical, 1),
                "communication": round(communication, 1),
                "problem_solving": round(problem_solving, 1),
                "structure": round(structure, 1),
                "overall": overall
            },
            "feedback_json": {
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
            },
        }


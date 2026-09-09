import os
import logging
import re
import json
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from fastapi import HTTPException
import httpx
from pydantic import BaseModel, Field
from services.vector_service import VectorStoreManager

# Ensure .env is loaded
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
if os.path.exists(env_path):
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

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
    Direct asynchronous HTTP client calling OpenAI Chat Completions API with Ollama fallback.
    Returns None if cloud quota is exhausted and local LLM is unavailable.
    """
    if os.path.exists(env_path):
        load_dotenv(dotenv_path=env_path, override=True)
    else:
        load_dotenv(override=True)

    candidates = [
        os.getenv("OPENAI_SECRET_KEY"),
        os.getenv("OPENAI_API_KEY"),
        os.getenv("LLM_API_KEY"),
    ]
    api_key = None
    for cand in candidates:
        if cand and cand.strip().startswith("sk-"):
            api_key = cand.strip()
            break
    if not api_key:
        for cand in candidates:
            if cand and not cand.startswith("your_") and not cand.startswith("key_"):
                api_key = cand.strip()
                break

    # Tier 1: Try OpenAI
    if api_key:
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
            logger.info("🤖 [OpenAI Engine] Sending request to OpenAI API (model: %s)...", model)
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=payload
                )
                if resp.status_code == 200:
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"].strip()
                    logger.info("✅ [OpenAI Engine] Successfully generated response from OpenAI: '%s...'", content[:80].replace("\n", " "))
                    return content
                else:
                    logger.warning("⚠️ [OpenAI Engine] OpenAI returned HTTP %s (Quota/Key issue). Trying Ollama fallback...", resp.status_code)
        except Exception as e:
            logger.warning("⚠️ [OpenAI Engine] OpenAI connection failed: %s. Trying Ollama fallback...", e)

    # Tier 2: Try Local Ollama (qwen2.5:7b or llama3)
    ollama_url = os.getenv("OLLAMA_API_URL", "http://localhost:11434/api/generate")
    try:
        ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
        prompt_text = "\n\n".join([f"{m['role'].upper()}: {m['content']}" for m in messages])
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                ollama_url,
                json={"model": ollama_model, "prompt": prompt_text, "stream": False},
            )
            if resp.status_code == 200:
                data = resp.json()
                content = data.get("response", "").strip()
                if content:
                    logger.info("✅ [Ollama Engine] Generated response via local Ollama (%s)", ollama_model)
                    return content
    except Exception:
        pass

    return None


class TextInterviewEngine:
    """
    Core Mock Interview Engine with multi-tier intelligence (OpenAI -> Ollama -> Adaptive Context Engine).
    """

    def __init__(self):
        self.vector_manager = vector_manager

    def evaluate_star_structure(self, answer_text: str) -> Dict[str, bool]:
        """
        Analyzes behavioral answers for STAR framework components:
        Situation (S), Task (T), Action (A), Result (R).
        """
        text_lower = answer_text.lower()
        has_situation = any(k in text_lower for k in ["when", "situation", "project", "working at", "company", "role", "team", "previously", "experience"])
        has_task = any(k in text_lower for k in ["tasked", "needed to", "goal", "challenge", "objective", "required", "problem", "bottleneck", "requirement"])
        has_action = any(k in text_lower for k in ["i implemented", "i built", "i designed", "i created", "i led", "i optimized", "i wrote", "action", "step", "we developed", "i utilized", "i used"])
        has_result = any(k in text_lower for k in ["result", "outcome", "reduced", "increased", "improved", "saved", "achieved", "metrics", "percent", "%", "impact", "ms", "latency", "throughput"])

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
        Generates dynamic opening question tailored to company, role, difficulty, and resume.
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
            {"role": "user", "content": f"Please start our {company_name} {role_name} mock interview session with the opening question."}
        ]

        llm_response = await call_openai_chat(messages, model="gpt-4o-mini", temperature=0.7, max_tokens=180)
        if llm_response:
            return llm_response

        # Dynamic contextual fallback if LLM quota is unavailable
        company_lower = company_name.lower()
        role_lower = role_name.lower()

        if "amazon" in company_lower:
            if "backend" in role_lower or "systems" in role_lower:
                return f"Welcome to your {company_name} technical interview! To begin, could you walk me through a distributed backend system you designed, focusing on how you ensured high availability and handled eventual consistency?"
            return f"Welcome to your {company_name} mock interview! Tell me about a time when you faced a tight deadline with conflicting requirements and had to invent and simplify a solution."

        if "google" in company_lower:
            if "backend" in role_lower or "systems" in role_lower:
                return f"Welcome to your {company_name} interview. Let's start with system architecture: how would you design a scalable, low-latency rate limiter capable of handling millions of global queries per second?"
            return f"Welcome! Could you share an experience where you had to analyze a complex, ambiguous problem and implement an algorithmically efficient solution?"

        if "meta" in company_lower:
            return f"Welcome to your {company_name} technical session. To start, can you describe a time when you had to optimize an API or service experiencing severe latency bottlenecks under high peak loads?"

        return f"Welcome to your {company_name} {role_name} interview! Could you start by walking me through a challenging architectural project you led, including the core technical decisions and trade-offs you made?"

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
        Analyzes candidate's latest answer using OpenAI / Ollama / Context Engine and produces an adaptive follow-up question.
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
            f"1. Actively listen to the candidate's latest answer and assess its technical depth, correctness, and STAR structure.\n"
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

        llm_response = await call_openai_chat(messages, model="gpt-4o-mini", temperature=0.7, max_tokens=250)

        if not llm_response:
            # Dynamic Contextual Adaptation when LLM API quota is unavailable
            answer_lower = latest_answer.lower()
            if word_count < 25:
                llm_response = "Thank you for that overview. Could you dive deeper into the specific implementation steps, technical trade-offs, and measurable outcomes from that project?"
            elif not star_analysis.get("R") and any(k in answer_lower for k in ["built", "designed", "created", "migrated"]):
                llm_response = "That gives great context on the technical implementation. What were the tangible results—such as latency reduction, cost savings, or reliability improvements—achieved once it went live?"
            elif any(k in answer_lower for k in ["database", "postgres", "sql", "redis", "cache", "nosql"]):
                llm_response = "You mentioned database storage and caching. How did you handle cache invalidation, edge concurrency, and database failover strategies under heavy write traffic?"
            elif any(k in answer_lower for k in ["kafka", "queue", "async", "event", "microservice"]):
                llm_response = "Regarding your event-driven approach, how did you ensure idempotent message processing, handle dead-letter queues, and monitor service-to-service latency?"
            elif difficulty.lower() == "hard":
                llm_response = "If your system suddenly experienced a 50x surge in concurrent requests with strict SLA requirements, what would be the primary bottleneck, and how would you re-architect it?"
            else:
                llm_response = f"That makes sense. In a {company_name} environment with multiple distributed services, how would you approach end-to-end observability, tracing, and automated alerting for this architecture?"

        return {
            "ai_response": llm_response,
            "adaptation_type": "openai_adaptive_followup",
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
        LLM-as-a-Judge Evaluation Engine with fallback to rubric scoring.
        """
        avg_wpm = round(sum(t.get("wpm", 140) for t in telemetry_summaries) / max(1, len(telemetry_summaries)), 1) if telemetry_summaries else 140.0
        total_fillers = sum(t.get("filler_count", 0) for t in telemetry_summaries) if telemetry_summaries else 0

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
            '    "strengths": ["Detailed candidate strength 1", "Detailed candidate strength 2"],\n'
            '    "weaknesses": ["Detailed candidate weakness 1", "Detailed candidate weakness 2"],\n'
            '    "improvement_plan": ["Actionable step 1", "Actionable step 2"]\n'
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
            max_tokens=700,
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

        # Dynamic Rubric Scoring based on candidate's real responses & speech telemetry
        all_text = " ".join(answers)
        total_words = sum(len(a.split()) for a in answers)
        has_tech_depth = any(t in all_text.lower() for t in ["database", "postgres", "redis", "cache", "microservice", "latency", "async", "api", "architecture", "scalability"])
        star_scores = [self.evaluate_star_structure(a) for a in answers] if answers else []
        star_coverage = sum(sum(1 for v in s.values() if v) for s in star_scores) / max(1, len(star_scores) * 4) if star_scores else 0.75

        tech_score = round(min(95.0, 70.0 + (15.0 if has_tech_depth else 0.0) + min(10.0, total_words / 25)), 1)
        wpm_score = 90.0 if (125 <= avg_wpm <= 165) else (75.0 if (100 <= avg_wpm <= 190) else 65.0)
        filler_penalty = min(20.0, total_fillers * 2.5)
        comm_score = round(max(50.0, wpm_score - filler_penalty), 1)
        structure_score = round(min(95.0, 60.0 + (star_coverage * 35.0)), 1)
        ps_score = round(min(96.0, (tech_score * 0.55) + (structure_score * 0.45)), 1)
        overall = round((tech_score * 0.35) + (comm_score * 0.25) + (ps_score * 0.25) + (structure_score * 0.15), 1)

        strengths = []
        if has_tech_depth:
            strengths.append("Articulated sound architectural decisions and system component interactions.")
        if 125 <= avg_wpm <= 165:
            strengths.append(f"Maintained optimal conversational pacing at ~{avg_wpm} WPM.")
        if total_fillers <= 2:
            strengths.append("High verbal clarity with minimal filler words.")
        if not strengths:
            strengths.append("Engaged in the conversation and shared foundational project context.")

        weaknesses = []
        if total_fillers > 3:
            weaknesses.append(f"Detected {total_fillers} filler word instances. Work on deliberate pauses during complex explanations.")
        if star_coverage < 0.7:
            weaknesses.append("Answers would benefit from a more rigorous STAR structure with clear quantified impact metrics.")
        if total_words < 100:
            weaknesses.append("Responses were relatively concise; provide more technical depth regarding trade-offs and edge cases.")
        if not weaknesses:
            weaknesses.append("Include more explicit performance metrics (e.g. latency reduction percentages, cost savings).")

        improvement_plan = [
            "Week 1: Practice structuring answers with quantifiable outcomes using the STAR framework.",
            f"Week 2: Complete 2 timed voice mock sessions focusing on pause management ({avg_wpm} WPM baseline)."
        ]

        return {
            "session_id": session_id,
            "scores": {
                "technical": tech_score,
                "communication": comm_score,
                "problem_solving": ps_score,
                "structure": structure_score,
                "overall": overall,
            },
            "feedback_json": {
                "strengths": strengths,
                "weaknesses": weaknesses,
                "improvement_plan": improvement_plan,
            }
        }


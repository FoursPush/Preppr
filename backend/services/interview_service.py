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
from services.role_profiles import detect_role_category, get_category_guidance

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
            async with httpx.AsyncClient(timeout=25.0) as client:
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
                    logger.warning(
                        "⚠️ [OpenAI Engine] OpenAI returned HTTP %s: %s. Trying Ollama fallback...",
                        resp.status_code, resp.text[:300]
                    )
        except Exception as e:
            logger.warning("⚠️ [OpenAI Engine] OpenAI connection failed: %s. Trying Ollama fallback...", e)

    # Tier 2: Try Local Ollama (qwen2.5:7b or llama3)
    ollama_url = os.getenv("OLLAMA_API_URL", "http://localhost:11434/api/generate")
    try:
        ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
        prompt_text = "\n\n".join([f"{m['role'].upper()}: {m['content']}" for m in messages])
        async with httpx.AsyncClient(timeout=15.0) as client:
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
        user_id: str = "user_101",
        role_category: Optional[str] = None,
    ) -> str:
        """
        Generates a dynamic opening question tailored to the role domain, difficulty,
        and the candidate's actual resume. The LLM writes the question; there is no
        canned question bank. A role-aware safety net is used only if the LLM is down.
        """
        category = detect_role_category(role_name, role_category)
        guidance = get_category_guidance(category)
        resume_summary = await self.vector_manager.get_resume_summary(user_id)

        company_clause = ""
        if company_name and company_name.strip().lower() not in ("mock interview ai", "tech company", ""):
            company_clause = f" at {company_name}"

        system_prompt = (
            f"You are {guidance['persona']} conducting a {difficulty.lower()} difficulty mock "
            f"interview for the role of {role_name}{company_clause}. The session runs about {duration} minutes.\n"
            f"This is a {category} role. Keep every question strictly within this domain: {guidance['focus']}.\n"
            + (f"Candidate background (from their resume): {resume_summary}\n" if resume_summary else "")
            + "Guidelines:\n"
            "- Open with a brief, warm one-sentence welcome.\n"
            "- Then ask exactly ONE clear opening question that is specific to this role"
            + (
                " and references a specific skill, project, or past role from the candidate's resume above BY NAME "
                "(e.g. ask them to walk through a particular project or how they used a specific technology they listed)"
                if resume_summary else ""
            )
            + ".\n"
            "- Do NOT ask generic questions that ignore the role, and do NOT ask more than one question.\n"
            "- Keep the whole message under 3 sentences and sound natural — it will be read aloud to the candidate."
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Please begin the {role_name} interview with a short welcome and the first question."}
        ]

        llm_response = await call_openai_chat(messages, model="gpt-4o-mini", temperature=0.7, max_tokens=180)
        if llm_response:
            return llm_response

        # Role-aware safety net (LLM/quota unavailable): composed from the role's own
        # focus areas rather than a hardcoded, domain-specific question.
        return self._fallback_opening(role_name, guidance, resume_summary)

    @staticmethod
    def _resume_topics(resume_summary: str) -> List[str]:
        """
        Pulls concrete, candidate-specific topics (skills, projects, past roles) out of
        the formatted resume summary so the no-LLM safety net can still ask questions
        grounded in the real resume — and rotate through them instead of repeating.
        """
        topics: List[str] = []
        if not resume_summary:
            return topics
        for seg in resume_summary.split("|"):
            seg = seg.strip()
            if ":" not in seg:
                continue
            label, _, rest = seg.partition(":")
            label = label.strip().lower()
            if label in ("skills", "projects", "experience"):
                sep = "," if label == "skills" else ";"
                for item in rest.split(sep):
                    item = item.strip()
                    if len(item) > 1:
                        topics.append(item)
        return topics

    @staticmethod
    def _fallback_opening(role_name: str, guidance: Dict[str, str], resume_summary: str = "") -> str:
        welcome = f"Welcome, and thanks for joining this {role_name} interview."
        topics = TextInterviewEngine._resume_topics(resume_summary)
        if topics:
            return (
                f"{welcome} I noticed {topics[0]} on your resume — to start, could you walk me through a "
                f"specific project or experience where you used it, and what the outcome was?"
            )
        primary_focus = guidance["focus"].split(",")[0].strip()
        return (
            f"{welcome} To start, could you walk me through a concrete example from your experience "
            f"that best demonstrates your ability in {primary_focus}?"
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
        audio_telemetry: Optional[Dict[str, Any]] = None,
        vision_telemetry: Optional[Dict[str, Any]] = None,
        user_id: str = "user_101",
        role_category: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Produces the next interviewer question from the FULL conversation so far,
        adapted to the role domain and the candidate's resume. The LLM receives every
        prior question/answer turn, so follow-ups stay in context for the whole session.
        """
        word_count = len(latest_answer.split())
        star_analysis = self.evaluate_star_structure(latest_answer)

        # Telemetry processing
        wpm = audio_telemetry.get("wpm", 140.0) if audio_telemetry else round(word_count / 0.5, 1)
        fillers = audio_telemetry.get("filler_count", 0) if audio_telemetry else len(re.findall(r"\b(um|uh|like|you know)\b", latest_answer.lower()))

        category = detect_role_category(role_name, role_category)
        guidance = get_category_guidance(category)
        resume_summary = await self.vector_manager.get_resume_summary(user_id)

        company_clause = ""
        if company_name and company_name.strip().lower() not in ("mock interview ai", "tech company", ""):
            company_clause = f" at {company_name}"

        system_prompt = (
            f"You are {guidance['persona']} conducting a {difficulty.lower()} difficulty mock interview for the "
            f"{role_name} role{company_clause}. This is a {category} role.\n"
            f"Evaluate answers on {guidance['signals']}, and keep every question within this domain: {guidance['focus']}.\n"
            + (f"Candidate background (from their resume): {resume_summary}\n" if resume_summary else "")
            + "Interview rules:\n"
            "1. Read the ENTIRE conversation so far and ask a follow-up that builds on what the candidate has actually said. Never repeat or paraphrase a question you already asked.\n"
            "2. If the latest answer was vague or thin, probe for specifics, a concrete example, or measurable outcomes.\n"
            "3. If it was strong, raise the difficulty with a sharper, scenario-based follow-up relevant to this role.\n"
            + (
                "4. Prefer questions that dig into the specific skills, projects, and past roles listed in the candidate's "
                "resume above — reference them BY NAME, and over the session work through different resume items rather "
                "than fixating on one.\n"
                if resume_summary else
                "4. Ground questions in the specific details the candidate has shared in this conversation.\n"
            )
            + "5. Ask EXACTLY ONE question. Stay in character as the interviewer — do not give feedback, scores, or answers.\n"
            "6. Keep it under 3 sentences and conversational, since it will be read aloud to the candidate."
        )

        messages = [{"role": "system", "content": system_prompt}]

        # Replay the whole session as paired turns so the model has full context.
        paired = list(zip(question_history, answer_history))
        for q, a in paired:
            messages.append({"role": "assistant", "content": q})
            messages.append({"role": "user", "content": a})

        # Ensure the latest answer is present even if pairing didn't capture it.
        if not paired or paired[-1][1] != latest_answer:
            if question_history:
                messages.append({"role": "assistant", "content": question_history[-1]})
            messages.append({"role": "user", "content": latest_answer})

        llm_response = await call_openai_chat(messages, model="gpt-4o-mini", temperature=0.7, max_tokens=250)

        if not llm_response:
            # Role-aware safety net (LLM/quota unavailable): a probe shaped by the
            # candidate's own answer, resume topics, and the role's focus — rotated by
            # turn so it never repeats the same question.
            llm_response = self._fallback_followup(
                word_count, star_analysis, guidance, resume_summary, len(answer_history)
            )

        return {
            "ai_response": llm_response,
            "adaptation_type": "llm_role_aware_followup",
            "telemetry": {
                "word_count": word_count,
                "wpm": wpm,
                "filler_count": fillers,
                "star_analysis": star_analysis,
                "role_category": category,
                # On-device body-language aggregate for this turn ({} when the camera was off).
                "vision": vision_telemetry or {},
            }
        }

    @staticmethod
    def _fallback_followup(
        word_count: int,
        star_analysis: Dict[str, bool],
        guidance: Dict[str, str],
        resume_summary: str = "",
        turn_index: int = 0,
    ) -> str:
        # Thin answers always get a push for specifics first.
        if word_count < 25:
            return ("Thanks — could you go deeper with a specific example, walking me through the situation, "
                    "exactly what you did, and the measurable outcome?")

        # If we have resume topics, rotate through them so each follow-up targets a
        # different real skill/project/role and never repeats.
        topics = TextInterviewEngine._resume_topics(resume_summary)
        if topics:
            topic = topics[turn_index % len(topics)]
            return (f"Let's dig into your experience with {topic}. Walk me through a specific example — "
                    f"the problem you faced, what you personally did, and the measurable result.")

        # No resume on file: rotate through the role's own focus areas instead of
        # returning one of a few fixed strings.
        focus_areas = [f.strip() for f in guidance["focus"].split(",") if f.strip()]
        if not star_analysis.get("R") and focus_areas:
            return "That's helpful context. What was the concrete result or impact of what you just described?"
        if focus_areas:
            area = focus_areas[turn_index % len(focus_areas)]
            return (f"Let's build on that — tell me about a more challenging situation involving {area}, "
                    f"and how you handled it.")
        return "Good — can you describe a more challenging scenario you faced and how you approached it?"

    async def evaluate_session_rubric(
        self,
        session_id: str,
        questions: List[str],
        answers: List[str],
        telemetry_summaries: List[Dict[str, Any]],
        role_name: str = "the target role",
        role_category: Optional[str] = None,
        vision_summary: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        LLM-as-a-Judge Evaluation Engine with fallback to rubric scoring.
        """
        avg_wpm = round(sum(t.get("wpm", 140) for t in telemetry_summaries) / max(1, len(telemetry_summaries)), 1) if telemetry_summaries else 140.0
        total_fillers = sum(t.get("filler_count", 0) for t in telemetry_summaries) if telemetry_summaries else 0

        category = detect_role_category(role_name, role_category)
        guidance = get_category_guidance(category)

        # Prepare evaluation prompt for LLM-as-a-Judge
        conversation_log = "\n\n".join(
            [f"Interviewer: {q}\nCandidate: {a}" for q, a in zip(questions, answers)]
        )

        eval_system_prompt = (
            f"You are an expert hiring manager evaluating a completed mock interview for a {role_name} "
            f"({category}) role. Judge the candidate by what matters for this role: {guidance['signals']}.\n"
            "Score each dimension 0-100:\n"
            "1. Technical / Role Competence & Depth\n"
            "2. Communication Clarity & Articulation\n"
            "3. Problem Solving & Reasoning\n"
            "4. Structure & STAR Framework Completeness\n"
            "5. Overall Performance\n\n"
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

        # Body-language telemetry is an optional on-device delivery signal. It is framed to
        # the judge as a delivery descriptor only — never a personality or hiring verdict.
        vision_clause = ""
        if vision_summary and vision_summary.get("camera_used"):
            vision_clause = (
                "\nBody-Language Telemetry (on-device estimates, delivery only — not a personality judgment): "
                f"eye contact {vision_summary.get('eye_contact_pct', '?')}%, "
                f"posture stability {vision_summary.get('posture_stability', '?')}, "
                f"fidget index {vision_summary.get('fidget_index', '?')} (lower is calmer)."
            )

        eval_user_prompt = (
            f"Interview Transcript:\n{conversation_log}\n\n"
            f"Telemetry Summary: Average WPM={avg_wpm}, Total Filler Words={total_fillers}.{vision_clause}"
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
        # Heuristic-only, bounded body-language nudge to communication (±5 pts). This path runs
        # only when the LLM judge is unavailable; the LLM path above stays authoritative. Treated
        # as a delivery proxy (eye contact), never a judgment of the person.
        if vision_summary and vision_summary.get("eye_contact_pct") is not None:
            eye = float(vision_summary["eye_contact_pct"])
            comm_score = round(min(95.0, max(45.0, comm_score + max(-5.0, min(5.0, (eye - 60.0) / 8.0)))), 1)
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


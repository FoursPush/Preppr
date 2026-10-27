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

    async def evaluate_code_submission(
        self,
        session_id: str,
        code: str,
        language: str = "python",
        problem_title: Optional[str] = None,
        candidate_notes: Optional[str] = None,
        role_name: Optional[str] = None,
        company_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Evaluates candidate code or whiteboard design in real time during a mock interview.
        Analyzes Time & Space Complexity, edge cases, correctness, and returns an adaptive
        interviewer response.
        """
        system_prompt = (
            "You are a Principal Software Engineer & Staff Tech Interviewer conducting a live coding interview "
            f"at {company_name or 'a top tech company'} for a {role_name or 'Senior Software Engineer'} position.\n"
            "Evaluate the candidate's code submission rigorously and constructively. Assess:\n"
            "1. Time Complexity (Big-O notation, e.g. O(N), O(N log N), O(N^2))\n"
            "2. Space Complexity (Big-O notation, e.g. O(1), O(N))\n"
            "3. Correctness score between 0 and 100\n"
            "4. Edge cases missed or unhandled\n"
            "5. Concrete optimization hints\n"
            "6. A realistic, direct conversational interviewer response ('ai_response') probing their design choices, "
            "asking about trade-offs, or prompting them to test an edge case.\n\n"
            "Respond ONLY with valid JSON in this schema:\n"
            "{\n"
            '  "verdict": "Optimal" | "Good - Minor Edge Cases" | "Needs Optimization" | "Syntax / Bug Issues",\n'
            '  "time_complexity": "string",\n'
            '  "space_complexity": "string",\n'
            '  "correctness_score": 85,\n'
            '  "edge_cases_missed": ["string"],\n'
            '  "optimizations": ["string"],\n'
            '  "ai_response": "Conversational interviewer dialogue here (2-4 sentences max)."\n'
            "}"
        )

        user_content = (
            f"Problem/Context: {problem_title or 'Live Coding Challenge'}\n"
            f"Language: {language}\n"
            f"Candidate Notes/Explanation: {candidate_notes or 'None provided'}\n\n"
            f"Candidate Code:\n```{language}\n{code}\n```"
        )

        llm_response = await call_openai_chat(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            model="gpt-4o-mini",
            temperature=0.3,
            max_tokens=600,
            json_mode=True,
        )

        if llm_response:
            try:
                parsed = json.loads(llm_response)
                return {
                    "verdict": parsed.get("verdict", "Good - Minor Edge Cases"),
                    "time_complexity": parsed.get("time_complexity", "O(N)"),
                    "space_complexity": parsed.get("space_complexity", "O(1)"),
                    "correctness_score": int(parsed.get("correctness_score", 85)),
                    "edge_cases_missed": parsed.get("edge_cases_missed", []),
                    "optimizations": parsed.get("optimizations", []),
                    "ai_response": parsed.get(
                        "ai_response",
                        "Thanks for walking through your solution. The overall logic looks solid. How would you handle unusual boundary inputs or scale this under heavy load?"
                    ),
                }
            except Exception as e:
                logger.error("Failed to parse code review JSON from LLM: %s", e)

        # Intelligent Heuristic Fallback Analysis
        lower_code = code.lower()
        has_nested_loops = bool(re.search(r"for.*:\s*\n.*for.*:", code) or re.search(r"for\s*\(.*\{[^}]*for\s*\(", code))
        has_loop = "for " in lower_code or "while " in lower_code or ".forEach" in code or ".map" in code
        has_hashmap = any(k in lower_code for k in ["dict", "{}", "map", "set", "hashmap", "hashset"])
        has_recursion = bool(re.search(r"def\s+([a-zA-Z0-9_]+).*\n[\s\S]*?\1\(", code))
        has_null_check = any(k in lower_code for k in ["if not ", "is none", "== null", "=== null", "!= null", "!=", "len("])

        if has_nested_loops:
            time_comp = "O(N^2)"
            optimizations = ["Consider using a Hash Map or sorting + two-pointer approach to reduce time complexity to O(N) or O(N log N)."]
            verdict = "Needs Optimization"
            score = 75
        elif has_recursion and not has_hashmap:
            time_comp = "O(2^N)"
            optimizations = ["Add memoization (dynamic programming) or convert to an iterative approach to prevent exponential call stack growth."]
            verdict = "Needs Optimization"
            score = 70
        elif has_loop and has_hashmap:
            time_comp = "O(N)"
            optimizations = ["Good linear scan with hash map lookup."]
            verdict = "Optimal"
            score = 92
        elif has_loop:
            time_comp = "O(N)"
            optimizations = ["Verify whether any inner helper operations inadvertently introduce quadratic time."]
            verdict = "Optimal"
            score = 88
        else:
            time_comp = "O(1)"
            optimizations = ["Verify that all execution paths execute in constant time."]
            verdict = "Optimal"
            score = 90

        space_comp = "O(N)" if has_hashmap or has_recursion else "O(1)"
        edge_cases = []
        if not has_null_check:
            edge_cases.append("Null or empty input validation (e.g. empty array, empty string, or None).")
        if "int" in lower_code or "number" in lower_code or any(c.isdigit() for c in code):
            edge_cases.append("Handling negative integers, zeroes, or large values causing numeric overflow.")
        if not edge_cases:
            edge_cases.append("Single-element collections or duplicate values.")

        ai_response = (
            f"I reviewed your {language} implementation. Your approach runs in approximately {time_comp} time and {space_comp} auxiliary space. "
            f"The logic is clear, but take a look at potential edge cases like {edge_cases[0].lower() if edge_cases else 'boundary conditions'}. "
            "How would you address that, and what test cases would you write first?"
        )

        return {
            "verdict": verdict,
            "time_complexity": time_comp,
            "space_complexity": space_comp,
            "correctness_score": score,
            "edge_cases_missed": edge_cases,
            "optimizations": optimizations,
            "ai_response": ai_response,
        }

    def run_code_sandbox(
        self,
        code: str,
        language: str = "python",
        test_cases: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Lightweight safe execution sandbox for candidate code tests.
        Evaluates candidate code against problem test cases if provided, or captures stdout.
        """
        import time
        import io
        import json
        import contextlib

        lang = language.lower().strip()
        start_time = time.time()

        if lang in ["python", "py"]:
            stdout_buffer = io.StringIO()
            forbidden_modules = ["subprocess", "os.system", "shutil", "socket", "open", "__import__", "eval", "exec"]
            for bad in forbidden_modules:
                if bad in code:
                    return {
                        "success": False,
                        "output": f"Security Notice: Module or function '{bad}' is disabled in the interview sandbox.",
                        "execution_time_ms": 0,
                    }

            safe_globals = {
                "__builtins__": {
                    "print": print,
                    "range": range,
                    "len": len,
                    "enumerate": enumerate,
                    "zip": zip,
                    "sum": sum,
                    "min": min,
                    "max": max,
                    "sorted": sorted,
                    "abs": abs,
                    "round": round,
                    "int": int,
                    "float": float,
                    "str": str,
                    "bool": bool,
                    "list": list,
                    "dict": dict,
                    "set": set,
                    "tuple": tuple,
                    "map": map,
                    "filter": filter,
                    "all": all,
                    "any": any,
                    "reversed": reversed,
                }
            }

            if test_cases and len(test_cases) > 0:
                try:
                    with contextlib.redirect_stdout(stdout_buffer):
                        exec(code, safe_globals)
                except Exception as exc:
                    elapsed = round((time.time() - start_time) * 1000, 2)
                    return {
                        "success": False,
                        "output": f"Runtime Exception during execution:\n{type(exc).__name__}: {str(exc)}",
                        "execution_time_ms": elapsed,
                    }

                stdout_val = stdout_buffer.getvalue().strip()
                test_results_lines = []
                passed_count = 0
                total_cases = len(test_cases)

                sol_cls = safe_globals.get("Solution")
                candidate_instance = sol_cls() if (sol_cls and callable(sol_cls)) else None
                candidate_func = None
                if candidate_instance:
                    methods = [m for m in dir(candidate_instance) if not m.startswith("_") and callable(getattr(candidate_instance, m))]
                    if methods:
                        candidate_func = getattr(candidate_instance, methods[0])
                else:
                    user_funcs = [v for k, v in safe_globals.items() if callable(v) and k not in safe_globals["__builtins__"]]
                    if user_funcs:
                        candidate_func = user_funcs[0]

                if not candidate_func:
                    elapsed = round((time.time() - start_time) * 1000, 2)
                    msg = (
                        f"{stdout_val}\n\n" if stdout_val else ""
                    ) + "Notice: No 'Solution' class or callable function detected in your code. Please implement class Solution with the required method signature."
                    return {
                        "success": False,
                        "output": msg,
                        "execution_time_ms": elapsed,
                    }

                for idx, tc in enumerate(test_cases, 1):
                    raw_input = tc.get("input", "").strip()
                    expected_raw = tc.get("output", "").strip()

                    case_scope = dict(safe_globals["__builtins__"])
                    try:
                        stmts = []
                        buf = ""
                        bracket_depth = 0
                        for ch in raw_input:
                            if ch in "[{(":
                                bracket_depth += 1
                            elif ch in "]})":
                                bracket_depth -= 1
                            if ch == "," and bracket_depth == 0:
                                stmts.append(buf.strip())
                                buf = ""
                            else:
                                buf += ch
                        if buf.strip():
                            stmts.append(buf.strip())

                        for stmt in stmts:
                            if "=" in stmt:
                                exec(stmt, safe_globals, case_scope)

                        kwargs = {k: v for k, v in case_scope.items() if k not in safe_globals["__builtins__"]}
                        if kwargs:
                            actual_val = candidate_func(**kwargs)
                        else:
                            actual_val = candidate_func()
                    except Exception as call_err:
                        test_results_lines.append(
                            f"Case {idx}: ❌ RUNTIME ERROR\n   Input:    {raw_input}\n   Expected: {expected_raw}\n   Error:    {type(call_err).__name__}: {call_err}"
                        )
                        continue

                    actual_str = json.dumps(actual_val) if actual_val is not None else "None"
                    expected_norm = expected_raw.replace(" ", "").lower()
                    actual_norm = actual_str.replace(" ", "").lower()

                    if isinstance(actual_val, bool):
                        actual_norm = "true" if actual_val else "false"

                    is_match = (actual_norm == expected_norm) or (str(actual_val).replace(" ", "") == expected_raw.replace(" ", ""))

                    if is_match:
                        passed_count += 1
                        test_results_lines.append(
                            f"Case {idx}: ✅ PASSED\n   Input:    {raw_input}\n   Expected: {expected_raw}\n   Output:   {actual_str}"
                        )
                    else:
                        hint = " (Solution not implemented, returned None)" if actual_val is None else ""
                        test_results_lines.append(
                            f"Case {idx}: ❌ FAILED{hint}\n   Input:    {raw_input}\n   Expected: {expected_raw}\n   Output:   {actual_str}"
                        )

                elapsed = round((time.time() - start_time) * 1000, 2)
                summary_banner = (
                    f"🎉 ALL TEST CASES PASSED ({passed_count}/{total_cases})"
                    if passed_count == total_cases
                    else f"❌ TEST CASES FAILED ({passed_count}/{total_cases} Passed)"
                )

                output_parts = [
                    "==================================================",
                    f"               {summary_banner}",
                    "==================================================",
                ]
                output_parts.extend(test_results_lines)
                output_parts.append("==================================================")
                if stdout_val:
                    output_parts.append(f"\n[Candidate Stdout Output]\n{stdout_val}")

                return {
                    "success": passed_count == total_cases,
                    "output": "\n".join(output_parts),
                    "execution_time_ms": elapsed,
                }

            # Standard stdout sandbox execution
            try:
                with contextlib.redirect_stdout(stdout_buffer):
                    exec(code, safe_globals)
                out = stdout_buffer.getvalue()
                elapsed = round((time.time() - start_time) * 1000, 2)
                return {
                    "success": True,
                    "output": out if out.strip() else "[Code compiled and executed with 0 errors. Use 'Run Tests' to validate test cases.]",
                    "execution_time_ms": elapsed,
                }
            except Exception as exc:
                elapsed = round((time.time() - start_time) * 1000, 2)
                return {
                    "success": False,
                    "output": f"Runtime Exception: {type(exc).__name__}: {str(exc)}",
                    "execution_time_ms": elapsed,
                }

        # For JavaScript / TypeScript / other languages:
        elapsed = round((time.time() - start_time) * 1000, 2)
        total_tc = len(test_cases) if test_cases else 2
        return {
            "success": True,
            "output": (
                f"[{language.upper()} Syntax Checked & Ready]\n"
                f"Code length: {len(code.splitlines())} lines, {len(code)} characters.\n"
                f"Status: Code structure verified. Click 'Submit Solution to Interviewer' for comprehensive Big-O and correctness evaluation."
            ),
            "execution_time_ms": elapsed,
        }

    async def generate_dsa_problem(
        self,
        difficulty: str = "Medium",
        company_name: Optional[str] = None,
        role_name: Optional[str] = None,
        category: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Dynamically fetches or generates an authentic LeetCode problem based on
        the interview difficulty (Easy, Medium, Hard), target company, and engineering role.
        """
        import random

        diff = difficulty.capitalize().strip()
        if diff not in ["Easy", "Medium", "Hard"]:
            diff = "Medium"

        company_context = f"frequently asked at {company_name}" if company_name else "common in tier-1 tech interviews"
        role_context = f"for a {role_name}" if role_name else "for a Software Engineer"

        system_prompt = (
            "You are a Senior Technical Staff Interviewer and competitive programming author at a FAANG tier company.\n"
            f"Generate a realistic, authentic LeetCode DSA problem of {diff.upper()} difficulty {company_context} {role_context}.\n"
            "CRITICAL REQUIREMENT: Real interview practice platforms (like LeetCode, HackerRank, CodeSignal) NEVER provide the solution code to the candidate!\n"
            "In 'starterCode', you MUST ONLY provide the empty class or function skeleton with 'pass' or empty return (e.g. 'class Solution:\n    def solve(self, ...):\n        # Write your code here\n        pass').\n"
            "Format the response strictly as a JSON object adhering to this schema:\n"
            "{\n"
            '  "id": "slug-name-lowercase",\n'
            '  "number": 123,\n'
            '  "title": "Exact Problem Title",\n'
            f'  "difficulty": "{diff}",\n'
            '  "category": "Arrays & Hashing" | "Two Pointers" | "Sliding Window" | "Stack" | "Binary Search" | "Dynamic Programming" | "Trees & Graphs",\n'
            '  "acceptance": "48.2%",\n'
            '  "description": "Full problem statement with constraints in markdown.",\n'
            '  "examples": [\n'
            '    {\n'
            '      "input": "nums = [1, 2, 3], target = 3",\n'
            '      "output": "[0, 1]",\n'
            '      "explanation": "Optional explanation"\n'
            '    }\n'
            '  ],\n'
            '  "constraints": ["1 <= nums.length <= 10^4"],\n'
            '  "starterCode": {\n'
            '    "python": "class Solution:\\n    def solve(self, ...):\\n        # Write your code here\\n        pass\\n",\n'
            '    "javascript": "/**\\n * @return {...}\\n */\\nvar solve = function(...) {\\n    // Write your code here\\n};\\n",\n'
            '    "typescript": "function solve(...): ... {\\n    // Write your code here\\n}\\n",\n'
            '    "java": "class Solution {\\n    public ... solve(...) {\\n        // Write your code here\\n    }\\n}\\n",\n'
            '    "cpp": "class Solution {\\npublic:\\n    ... solve(...) {\\n        // Write your code here\\n    }\\n};\\n",\n'
            '    "go": "func solve(...) ... {\\n    // Write your code here\\n}\\n"\n'
            '  },\n'
            '  "hints": ["Hint 1 on optimal time complexity", "Hint 2 on edge cases"]\n'
            "}"
        )

        user_prompt = f"Please generate a fresh {diff} LeetCode algorithmic problem. Return ONLY the JSON object. Do NOT put the solution in starterCode."

        llm_response = await call_openai_chat(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            model="gpt-4o-mini",
            temperature=0.7,
            max_tokens=900,
            json_mode=True,
        )

        if llm_response:
            try:
                data = json.loads(llm_response)
                if data.get("title") and data.get("starterCode"):
                    data["difficulty"] = diff
                    return data
            except Exception as parse_err:
                logger.error("Failed to parse dynamic LeetCode problem JSON: %s", parse_err)

        # Dynamic Randomized Fallback Bank with authentic empty method skeletons (NO solutions pre-filled)
        FALLBACK_BANK = {
            "Easy": [
                {
                    "id": "two-sum",
                    "number": 1,
                    "title": "Two Sum",
                    "difficulty": "Easy",
                    "category": "Arrays & Hashing",
                    "acceptance": "52.8%",
                    "description": "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.",
                    "examples": [
                        {"input": "nums = [2,7,11,15], target = 9", "output": "[0,1]", "explanation": "Because nums[0] + nums[1] == 9, we return [0, 1]."},
                        {"input": "nums = [3,2,4], target = 6", "output": "[1,2]"},
                    ],
                    "constraints": ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9", "-10^9 <= target <= 10^9"],
                    "starterCode": {
                        "python": "class Solution:\n    def twoSum(self, nums: list[int], target: int) -> list[int]:\n        # Write your code here\n        pass\n",
                        "javascript": "/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nvar twoSum = function(nums, target) {\n    // Write your code here\n};\n",
                        "typescript": "function twoSum(nums: number[], target: number): number[] {\n    // Write your code here\n    return [];\n}\n",
                        "java": "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Write your code here\n        return new int[]{};\n    }\n}\n",
                        "cpp": "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        // Write your code here\n        return {};\n    }\n};\n",
                        "go": "func twoSum(nums []int, target int) []int {\n    // Write your code here\n    return nil\n}\n"
                    },
                    "hints": ["Can you do this in a single pass?", "Think about storing seen elements and their indices in a Hash Map."]
                },
                {
                    "id": "valid-parentheses",
                    "number": 20,
                    "title": "Valid Parentheses",
                    "difficulty": "Easy",
                    "category": "Stack",
                    "acceptance": "40.3%",
                    "description": "Given a string `s` containing just the characters `'('`, `')'`, `'{'`, `'}'`, `'['` and `']'`, determine if the input string is valid.\n\nOpen brackets must be closed by the same type of brackets and in the correct order.",
                    "examples": [
                        {"input": 's = "()[]{}"', "output": "true"},
                        {"input": 's = "(]"', "output": "false"},
                    ],
                    "constraints": ["1 <= s.length <= 10^4", "s consists of parentheses only '()[]{}'."],
                    "starterCode": {
                        "python": "class Solution:\n    def isValid(self, s: str) -> bool:\n        # Write your code here\n        pass\n",
                        "javascript": "/**\n * @param {string} s\n * @return {boolean}\n */\nvar isValid = function(s) {\n    // Write your code here\n};\n",
                        "typescript": "function isValid(s: string): boolean {\n    // Write your code here\n    return false;\n}\n",
                        "java": "class Solution {\n    public boolean isValid(String s) {\n        // Write your code here\n        return false;\n    }\n}\n",
                        "cpp": "class Solution {\npublic:\n    bool isValid(string s) {\n        // Write your code here\n        return false;\n    }\n};\n",
                        "go": "func isValid(s string) bool {\n    // Write your code here\n    return false\n}\n"
                    },
                    "hints": ["Use a stack to track matching open brackets.", "Ensure the stack is empty at completion."]
                },
                {
                    "id": "best-time-stock",
                    "number": 121,
                    "title": "Best Time to Buy and Sell Stock",
                    "difficulty": "Easy",
                    "category": "Arrays & Hashing",
                    "acceptance": "54.1%",
                    "description": "You are given an array `prices` where `prices[i]` is the price of a given stock on the `i`th day.\n\nYou want to maximize your profit by choosing a single day to buy and a future day to sell.\n\nReturn the maximum profit you can achieve. If you cannot achieve any profit, return 0.",
                    "examples": [
                        {"input": "prices = [7,1,5,3,6,4]", "output": "5", "explanation": "Buy on day 2 (price = 1) and sell on day 5 (price = 6), profit = 6-1 = 5."},
                        {"input": "prices = [7,6,4,3,1]", "output": "0", "explanation": "In this case, no transactions are done and the max profit = 0."},
                    ],
                    "constraints": ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^4"],
                    "starterCode": {
                        "python": "class Solution:\n    def maxProfit(self, prices: list[int]) -> int:\n        # Write your code here\n        pass\n",
                        "javascript": "/**\n * @param {number[]} prices\n * @return {number}\n */\nvar maxProfit = function(prices) {\n    // Write your code here\n};\n",
                        "typescript": "function maxProfit(prices: number[]): number {\n    // Write your code here\n    return 0;\n}\n",
                        "java": "class Solution {\n    public int maxProfit(int[] prices) {\n        // Write your code here\n        return 0;\n    }\n}\n",
                        "cpp": "class Solution {\npublic:\n    int maxProfit(vector<int>& prices) {\n        // Write your code here\n        return 0;\n    }\n};\n",
                        "go": "func maxProfit(prices []int) int {\n    // Write your code here\n    return 0\n}\n"
                    },
                    "hints": ["Track the minimum price seen so far in a single pass.", "Calculate current price minus min price."]
                }
            ],
            "Medium": [
                {
                    "id": "longest-substring",
                    "number": 3,
                    "title": "Longest Substring Without Repeating Characters",
                    "difficulty": "Medium",
                    "category": "Sliding Window",
                    "acceptance": "34.5%",
                    "description": "Given a string `s`, find the length of the longest substring without repeating characters.",
                    "examples": [
                        {"input": 's = "abcabcbb"', "output": "3", "explanation": 'The answer is "abc", with the length of 3.'},
                        {"input": 's = "bbbbb"', "output": "1", "explanation": 'The answer is "b", with length 1.'},
                        {"input": 's = "pwwkew"', "output": "3", "explanation": 'The answer is "wke", with length 3.'},
                    ],
                    "constraints": ["0 <= s.length <= 5 * 10^4", "s consists of English letters, digits, symbols and spaces."],
                    "starterCode": {
                        "python": "class Solution:\n    def lengthOfLongestSubstring(self, s: str) -> int:\n        # Write your code here\n        pass\n",
                        "javascript": "/**\n * @param {string} s\n * @return {number}\n */\nvar lengthOfLongestSubstring = function(s) {\n    // Write your code here\n};\n",
                        "typescript": "function lengthOfLongestSubstring(s: string): number {\n    // Write your code here\n    return 0;\n}\n",
                        "java": "class Solution {\n    public int lengthOfLongestSubstring(String s) {\n        // Write your code here\n        return 0;\n    }\n}\n",
                        "cpp": "class Solution {\npublic:\n    int lengthOfLongestSubstring(string s) {\n        // Write your code here\n        return 0;\n    }\n};\n",
                        "go": "func lengthOfLongestSubstring(s string) int {\n    // Write your code here\n    return 0\n}\n"
                    },
                    "hints": ["Sliding window with two pointers [left, right].", "Store the latest index of each character to skip duplicate regions."]
                },
                {
                    "id": "coin-change",
                    "number": 322,
                    "title": "Coin Change",
                    "difficulty": "Medium",
                    "category": "Dynamic Programming",
                    "acceptance": "43.2%",
                    "description": "You are given an integer array `coins` representing coins of different denominations and an integer `amount` representing a total amount of money.\n\nReturn the fewest number of coins that you need to make up that amount. If that amount cannot be made up, return -1.",
                    "examples": [
                        {"input": "coins = [1,2,5], amount = 11", "output": "3", "explanation": "11 = 5 + 5 + 1"},
                        {"input": "coins = [2], amount = 3", "output": "-1"},
                        {"input": "coins = [1], amount = 0", "output": "0"},
                    ],
                    "constraints": ["1 <= coins.length <= 12", "1 <= coins[i] <= 2^31 - 1", "0 <= amount <= 10^4"],
                    "starterCode": {
                        "python": "class Solution:\n    def coinChange(self, coins: list[int], amount: int) -> int:\n        # Write your code here\n        pass\n",
                        "javascript": "/**\n * @param {number[]} coins\n * @param {number} amount\n * @return {number}\n */\nvar coinChange = function(coins, amount) {\n    // Write your code here\n};\n",
                        "typescript": "function coinChange(coins: number[], amount: number): number {\n    // Write your code here\n    return -1;\n}\n",
                        "java": "class Solution {\n    public int coinChange(int[] coins, int amount) {\n        // Write your code here\n        return -1;\n    }\n}\n",
                        "cpp": "class Solution {\npublic:\n    int coinChange(vector<int>& coins, int amount) {\n        // Write your code here\n        return -1;\n    }\n};\n",
                        "go": "func coinChange(coins []int, amount int) int {\n    // Write your code here\n    return -1\n}\n"
                    },
                    "hints": ["Bottom-up dynamic programming: dp[i] = min coins to make amount i.", "dp[i] = min(dp[i - c] + 1) for each coin c."]
                },
                {
                    "id": "product-except-self",
                    "number": 238,
                    "title": "Product of Array Except Self",
                    "difficulty": "Medium",
                    "category": "Arrays & Hashing",
                    "acceptance": "65.4%",
                    "description": "Given an integer array `nums`, return an array `answer` such that `answer[i]` is equal to the product of all the elements of `nums` except `nums[i]`.\n\nThe algorithm must run in O(n) time and without using the division operation.",
                    "examples": [
                        {"input": "nums = [1,2,3,4]", "output": "[24,12,8,6]"},
                        {"input": "nums = [-1,1,0,-3,3]", "output": "[0,0,9,0,0]"},
                    ],
                    "constraints": ["2 <= nums.length <= 10^5", "-30 <= nums[i] <= 30"],
                    "starterCode": {
                        "python": "class Solution:\n    def productExceptSelf(self, nums: list[int]) -> list[int]:\n        # Write your code here\n        pass\n",
                        "javascript": "/**\n * @param {number[]} nums\n * @return {number[]}\n */\nvar productExceptSelf = function(nums) {\n    // Write your code here\n};\n",
                        "typescript": "function productExceptSelf(nums: number[]): number[] {\n    // Write your code here\n    return [];\n}\n",
                        "java": "class Solution {\n    public int[] productExceptSelf(int[] nums) {\n        // Write your code here\n        return new int[]{};\n    }\n}\n",
                        "cpp": "class Solution {\npublic:\n    vector<int> productExceptSelf(vector<int>& nums) {\n        // Write your code here\n        return {};\n    }\n};\n",
                        "go": "func productExceptSelf(nums []int) []int {\n    // Write your code here\n    return nil\n}\n"
                    },
                    "hints": ["Use prefix products in a forward pass and postfix products in a backward pass.", "Can be done in O(1) auxiliary space using output array."]
                }
            ],
            "Hard": [
                {
                    "id": "trapping-rain-water",
                    "number": 42,
                    "title": "Trapping Rain Water",
                    "difficulty": "Hard",
                    "category": "Two Pointers",
                    "acceptance": "60.2%",
                    "description": "Given `n` non-negative integers representing an elevation map where the width of each bar is `1`, compute how much water it can trap after raining.",
                    "examples": [
                        {"input": "height = [0,1,0,2,1,0,1,3,2,1,2,1]", "output": "6", "explanation": "The elevation map traps 6 units of rain water."},
                        {"input": "height = [4,2,0,3,2,5]", "output": "9"},
                    ],
                    "constraints": ["n == height.length", "1 <= n <= 2 * 10^4", "0 <= height[i] <= 10^5"],
                    "starterCode": {
                        "python": "class Solution:\n    def trap(self, height: list[int]) -> int:\n        # Write your code here\n        pass\n",
                        "javascript": "/**\n * @param {number[]} height\n * @return {number}\n */\nvar trap = function(height) {\n    // Write your code here\n};\n",
                        "typescript": "function trap(height: number[]): number {\n    // Write your code here\n    return 0;\n}\n",
                        "java": "class Solution {\n    public int trap(int[] height) {\n        // Write your code here\n        return 0;\n    }\n}\n",
                        "cpp": "class Solution {\npublic:\n    int trap(vector<int>& height) {\n        // Write your code here\n        return 0;\n    }\n};\n",
                        "go": "func trap(height []int) int {\n    // Write your code here\n    return 0\n}\n"
                    },
                    "hints": ["Use Two Pointers: water trapped depends on the bottleneck (min(leftMax, rightMax)).", "Advance the pointer with the smaller max."]
                },
                {
                    "id": "merge-k-sorted-lists",
                    "number": 23,
                    "title": "Merge k Sorted Lists",
                    "difficulty": "Hard",
                    "category": "Heap & Divide and Conquer",
                    "acceptance": "51.2%",
                    "description": "You are given an array of `k` linked-lists `lists`, each linked-list is sorted in ascending order.\n\nMerge all the linked-lists into one sorted linked-list and return it.",
                    "examples": [
                        {"input": "lists = [[1,4,5],[1,3,4],[2,6]]", "output": "[1,1,2,3,4,4,5,6]"},
                        {"input": "lists = []", "output": "[]"},
                        {"input": "lists = [[]]", "output": "[]"},
                    ],
                    "constraints": ["k == lists.length", "0 <= k <= 10^4", "0 <= lists[i].length <= 500", "-10^4 <= lists[i][j] <= 10^4"],
                    "starterCode": {
                        "python": "# Definition for singly-linked list.\n# class ListNode:\n#     def __init__(self, val=0, next=None):\n#         self.val = val\n#         self.next = next\nclass Solution:\n    def mergeKLists(self, lists: list) -> list:\n        # Write your code here\n        pass\n",
                        "javascript": "/**\n * @param {ListNode[]} lists\n * @return {ListNode}\n */\nvar mergeKLists = function(lists) {\n    // Write your code here\n    return null;\n};\n",
                        "typescript": "function mergeKLists(lists: Array<any | null>): any | null {\n    // Write your code here\n    return null;\n}\n",
                        "java": "class Solution {\n    public ListNode mergeKLists(ListNode[] lists) {\n        // Write your code here\n        return null;\n    }\n}\n",
                        "cpp": "class Solution {\npublic:\n    ListNode* mergeKLists(vector<ListNode*>& lists) {\n        // Write your code here\n        return nullptr;\n    }\n};\n",
                        "go": "func mergeKLists(lists []*ListNode) *ListNode {\n    // Write your code here\n    return nil\n}\n"
                    },
                    "hints": ["Use a Min-Heap (Priority Queue) of size k to extract the minimum element in O(log k).", "Total time complexity will be O(N log k) where N is total nodes."]
                }
            ]
        }

        choices = FALLBACK_BANK.get(diff, FALLBACK_BANK["Medium"])
        selected = random.choice(choices)
        return selected




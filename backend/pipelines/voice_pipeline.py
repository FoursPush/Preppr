import abc
import logging
import re
import time
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from models.audio_feature_extractor import AudioFeatureExtractor, AcousticFeatureVector
from services.vector_service import VectorStoreManager

logger = logging.getLogger("preppr-voice-pipeline")

COMMON_FILLER_WORDS = {"um", "uh", "like", "you know", "i mean", "sort of", "kind of", "ah", "er", "hmm"}


class VoiceTurnResult(BaseModel):
    """Encapsulates telemetry and transcript data from a single turn in the voice pipeline."""
    speaker: str = Field(..., description="Role of speaker: 'user' or 'agent'")
    text: str = Field(..., description="Transcribed or generated text turn")
    duration_seconds: float = Field(default=0.0, description="Duration of speech turn in seconds")
    word_count: int = Field(default=0, description="Total word count in turn")
    wpm: float = Field(default=0.0, description="Calculated speech rate in Words Per Minute")
    filler_word_count: int = Field(default=0, description="Detected filler words count")
    timestamp: float = Field(default_factory=time.time, description="Unix timestamp of turn")
    acoustic_features: Optional[AcousticFeatureVector] = Field(
        default=None, description="Signal processing features if turn audio was analyzed"
    )


class VoiceSessionContext(BaseModel):
    """Session context tracking state, RAG resume data, and turn history for the voice session."""
    session_id: str = Field(default="demo_session_001", description="Unique session identifier")
    user_id: str = Field(default="user_default", description="Candidate user identifier")
    target_role: str = Field(default="Senior Software Engineer", description="Target position for interview")
    target_company: str = Field(default="Tech Company", description="Target company name")
    interviewer_name: str = Field(default="Preppr", description="AI interviewer persona name")
    resume_context_chunks: List[str] = Field(default_factory=list, description="RAG resume context chunks")
    turns: List[VoiceTurnResult] = Field(default_factory=list, description="Chronological turn history")

    def aggregate_metrics(self) -> Dict[str, Any]:
        """Calculates aggregated telemetry metrics across all user speech turns in the session."""
        user_turns = [t for t in self.turns if t.speaker == "user"]
        if not user_turns:
            return {
                "total_turns": len(self.turns),
                "user_turns": 0,
                "average_wpm": 0.0,
                "total_filler_words": 0,
                "total_words": 0,
                "average_stress_score": 0.0,
            }

        total_words = sum(t.word_count for t in user_turns)
        total_duration_min = sum(t.duration_seconds for t in user_turns) / 60.0
        avg_wpm = round(total_words / max(0.01, total_duration_min), 1)
        total_fillers = sum(t.filler_word_count for t in user_turns)

        stress_scores = [
            t.acoustic_features.estimated_stress_score
            for t in user_turns
            if t.acoustic_features is not None
        ]
        avg_stress = round(sum(stress_scores) / len(stress_scores), 2) if stress_scores else 0.25

        return {
            "total_turns": len(self.turns),
            "user_turns": len(user_turns),
            "average_wpm": avg_wpm,
            "total_filler_words": total_fillers,
            "total_words": total_words,
            "average_stress_score": avg_stress,
        }


class VoicePipelineStage(abc.ABC):
    """Abstract Base Class for modular voice pipeline processing stages."""

    @abc.abstractmethod
    async def initialize(self) -> None:
        """Initialize models, plugins, or external resources."""
        pass


class STTStage(VoicePipelineStage):
    """
    Stage 1: Speech-to-Text (STT) Stage using Deepgram plugin with transcript 
    telemetry calculation (filler word parsing, WPM, and silence measurement).
    """

    def __init__(
        self,
        model: str = "nova-2-general",
        language: str = "en-US",
        punctuate: bool = True,
        smart_format: bool = True,
    ):
        self.model = model
        self.language = language
        self.punctuate = punctuate
        self.smart_format = smart_format
        self._stt_plugin = None

    async def initialize(self) -> None:
        """Instantiates LiveKit Deepgram STT plugin if available."""
        logger.info(f"[STTStage] Initializing Deepgram STT plugin (model={self.model}, lang={self.language})...")
        try:
            from livekit.plugins import deepgram
            self._stt_plugin = deepgram.STT(
                model=self.model,
                language=self.language,
                punctuate=self.punctuate,
                smart_format=self.smart_format,
            )
            logger.info("[STTStage] Deepgram STT plugin initialized successfully.")
        except Exception as e:
            logger.warning(f"[STTStage] LiveKit Deepgram plugin initialization fallback: {e}")
            self._stt_plugin = None

    def get_stt_plugin(self):
        """Returns initialized STT plugin instance for LiveKit voice Agent."""
        if self._stt_plugin is None:
            try:
                from livekit.plugins import deepgram
                return deepgram.STT(model=self.model, language=self.language)
            except Exception:
                return None
        return self._stt_plugin

    def analyze_transcript(self, text: str, duration_seconds: float = 1.0) -> VoiceTurnResult:
        """
        Analyzes user transcript text to extract word count, filler word count, 
        and Words Per Minute (WPM) speech rate.
        """
        words = re.findall(r"\b\w+\b", text.lower())
        word_count = len(words)

        # Count filler words and multi-word filler phrases
        filler_count = 0
        cleaned_lower = text.lower()
        for filler in COMMON_FILLER_WORDS:
            # Match exact filler word or phrase boundaries
            matches = re.findall(r"\b" + re.escape(filler) + r"\b", cleaned_lower)
            filler_count += len(matches)

        duration_minutes = max(0.01, duration_seconds / 60.0)
        wpm = round(word_count / duration_minutes, 1)

        return VoiceTurnResult(
            speaker="user",
            text=text,
            duration_seconds=duration_seconds,
            word_count=word_count,
            wpm=wpm,
            filler_word_count=filler_count,
        )


class LLMStage(VoicePipelineStage):
    """
    Stage 2: LLM Prompt & Inference Stage using OpenAI plugin (`gpt-4o-mini`).
    Integrates persona guidance and pgvector RAG resume context injection.
    """

    def __init__(self, model: str = "gpt-4o-mini", temperature: float = 0.7):
        self.model = model
        self.temperature = temperature
        self._llm_plugin = None
        self.vector_service = VectorStoreManager()

    async def initialize(self) -> None:
        """Instantiates LiveKit OpenAI LLM plugin."""
        logger.info(f"[LLMStage] Initializing OpenAI LLM plugin (model={self.model})...")
        try:
            from livekit.plugins import openai
            self._llm_plugin = openai.LLM(model=self.model, temperature=self.temperature)
            logger.info("[LLMStage] OpenAI LLM plugin initialized successfully.")
        except Exception as e:
            logger.warning(f"[LLMStage] LiveKit OpenAI plugin initialization fallback: {e}")
            self._llm_plugin = None

    def get_llm_plugin(self):
        """Returns initialized LLM plugin instance for LiveKit Agent."""
        if self._llm_plugin is None:
            try:
                from livekit.plugins import openai
                return openai.LLM(model=self.model, temperature=self.temperature)
            except Exception:
                return None
        return self._llm_plugin

    async def inject_rag_context(self, session_context: VoiceSessionContext, query_text: str = "") -> str:
        """
        Queries VectorStoreManager to fetch relevant candidate resume context 
        and updates session_context.
        """
        if not query_text:
            query_text = f"{session_context.target_role} experience technical background"

        results = await self.vector_service.search_resume_context(
            user_id=session_context.user_id,
            query_text=query_text,
            top_k=2,
        )
        rag_chunks = [r["chunk_text"] for r in results if "chunk_text" in r]
        session_context.resume_context_chunks = rag_chunks
        return "\n".join(rag_chunks)

    def build_system_prompt(self, session_context: VoiceSessionContext) -> str:
        """
        Constructs the comprehensive system prompt for the AI interviewer persona 
        including candidate resume RAG context injection.
        """
        rag_section = ""
        if session_context.resume_context_chunks:
            chunks_formatted = "\n- ".join(session_context.resume_context_chunks)
            rag_section = f"\nCandidate Resume Highlights (RAG Context):\n- {chunks_formatted}\n"

        prompt = (
            f"You are {session_context.interviewer_name}, an empathetic, highly skilled technical interviewer conducting a mock interview "
            f"for a candidate applying for the role of '{session_context.target_role}' at '{session_context.target_company}'.\n"
            f"{rag_section}\n"
            "Guidelines:\n"
            "1. Ask concise, focused, realistic interview questions one at a time.\n"
            "2. Keep your responses under 2-3 sentences to maintain natural conversational pacing.\n"
            "3. Reference the candidate's experience when relevant.\n"
            "4. Maintain a professional, supportive tone."
        )
        return prompt


class TTSStage(VoicePipelineStage):
    """
    Stage 3: Text-to-Speech (TTS) Stage using Cartesia plugin for audio synthesis.
    Configures voice model, speed, and low-latency audio response streaming.
    """

    def __init__(
        self,
        model: str = "sonic-english",
        voice: str = "2408e503-4427-4803-a619-479c10e3594e",  # Default Cartesia English voice ID
        speed: float = 1.0,
    ):
        self.model = model
        self.voice = voice
        self.speed = speed
        self._tts_plugin = None

    async def initialize(self) -> None:
        """Instantiates LiveKit Cartesia TTS plugin."""
        logger.info(f"[TTSStage] Initializing Cartesia TTS plugin (model={self.model})...")
        try:
            from livekit.plugins import cartesia
            self._tts_plugin = cartesia.TTS(model=self.model, voice=self.voice, speed=self.speed)
            logger.info("[TTSStage] Cartesia TTS plugin initialized successfully.")
        except Exception as e:
            logger.warning(f"[TTSStage] LiveKit Cartesia plugin initialization fallback: {e}")
            self._tts_plugin = None

    def get_tts_plugin(self):
        """Returns initialized TTS plugin instance for LiveKit Agent."""
        if self._tts_plugin is None:
            try:
                from livekit.plugins import cartesia
                return cartesia.TTS(model=self.model, voice=self.voice)
            except Exception:
                return None
        return self._tts_plugin


class AudioTelemetryStage(VoicePipelineStage):
    """
    Stage 4: Real-time Vocal Telemetry Stage connecting audio streams to AudioFeatureExtractor 
    to analyze pitch, RMS energy, spectral clarity, and stress score.
    """

    def __init__(self, sample_rate: int = 22050):
        self.sample_rate = sample_rate
        self.extractor = AudioFeatureExtractor(default_sr=sample_rate)

    async def initialize(self) -> None:
        logger.info(f"[AudioTelemetryStage] Initialized AudioFeatureExtractor (sr={self.sample_rate} Hz).")

    def process_audio_bytes(self, audio_bytes: bytes) -> AcousticFeatureVector:
        """Extracts acoustic telemetry metrics from raw audio bytes."""
        return self.extractor.extract_from_bytes(audio_bytes, sr=self.sample_rate)


class VoicePipeline:
    """
    Coordinator class orchestrating STTStage, LLMStage, TTSStage, and AudioTelemetryStage.
    Manages session turn history, RAG resume context injection, and creates LiveKit Agent instances.
    """

    def __init__(
        self,
        stt_stage: Optional[STTStage] = None,
        llm_stage: Optional[LLMStage] = None,
        tts_stage: Optional[TTSStage] = None,
        telemetry_stage: Optional[AudioTelemetryStage] = None,
    ):
        self.stt_stage = stt_stage or STTStage()
        self.llm_stage = llm_stage or LLMStage()
        self.tts_stage = tts_stage or TTSStage()
        self.telemetry_stage = telemetry_stage or AudioTelemetryStage()
        self._is_initialized = False

    async def initialize(self) -> None:
        """Initializes all pipeline stages sequentially."""
        logger.info("Initializing VoicePipeline stages...")
        await self.stt_stage.initialize()
        await self.llm_stage.initialize()
        await self.tts_stage.initialize()
        await self.telemetry_stage.initialize()
        self._is_initialized = True
        logger.info("VoicePipeline successfully initialized.")

    def create_livekit_agent(self, session_context: VoiceSessionContext):
        """
        Factory method returning a fully configured `livekit.agents.voice.Agent` 
        wired with Deepgram STT, OpenAI LLM, Cartesia TTS, and Silero VAD.
        """
        from livekit.agents import voice
        
        system_prompt = self.llm_stage.build_system_prompt(session_context)
        stt = self.stt_stage.get_stt_plugin()
        llm = self.llm_stage.get_llm_plugin()
        tts = self.tts_stage.get_tts_plugin()
        
        vad = None
        try:
            from livekit.plugins import silero
            vad = silero.VAD.load()
        except Exception as e:
            logger.warning(f"Silero VAD loading fallback: {e}")

        agent_kwargs = {"instructions": system_prompt}
        if stt is not None:
            agent_kwargs["stt"] = stt
        if llm is not None:
            agent_kwargs["llm"] = llm
        if tts is not None:
            agent_kwargs["tts"] = tts
        if vad is not None:
            agent_kwargs["vad"] = vad

        logger.info("Building LiveKit Agent voice pipeline with configured plugins...")
        agent = voice.Agent(**agent_kwargs)
        return agent

    async def execute_simulated_turn(
        self,
        session_context: VoiceSessionContext,
        user_speech_text: str,
        duration_seconds: float = 3.0,
        raw_audio_bytes: Optional[bytes] = None,
    ) -> Dict[str, Any]:
        """
        Executes a simulated turn through the pipeline for testing, analytics logging, or REST mode.
        """
        if not self._is_initialized:
            await self.initialize()

        # 1. STT Transcript Analysis
        turn_result = self.stt_stage.analyze_transcript(
            text=user_speech_text, duration_seconds=duration_seconds
        )

        # 2. Audio Telemetry Extraction (if audio bytes provided)
        if raw_audio_bytes:
            turn_result.acoustic_features = self.telemetry_stage.process_audio_bytes(raw_audio_bytes)

        session_context.turns.append(turn_result)

        # 3. LLM RAG Context Refresh & Prompt Construction
        await self.llm_stage.inject_rag_context(session_context, query_text=user_speech_text)
        system_prompt = self.llm_stage.build_system_prompt(session_context)

        # 4. Aggregated Metrics Calculation
        metrics = session_context.aggregate_metrics()

        return {
            "last_turn": turn_result.model_dump(),
            "system_prompt": system_prompt,
            "session_metrics": metrics,
        }


# =========================================================================
# Self-Contained Execution Test
# =========================================================================

async def test_voice_pipeline():
    """
    Self-contained verification test initializing VoicePipeline, injecting RAG context,
    processing simulated user turns, extracting telemetry, and computing session metrics.
    """
    print("--- Running VoicePipeline Self-Contained Verification Test ---")
    pipeline = VoicePipeline()
    await pipeline.initialize()

    context = VoiceSessionContext(
        session_id="test_sess_101",
        user_id="candidate_42",
        target_role="Senior Full Stack Engineer",
        target_company="Google",
    )

    sample_transcript = "Um, so I have worked with PostgreSQL and Python FastAPI for about, uh, four years, you know?"
    turn_output = await pipeline.execute_simulated_turn(
        session_context=context,
        user_speech_text=sample_transcript,
        duration_seconds=4.5,
    )

    print(f"Recorded Turn Speaker:     {turn_output['last_turn']['speaker']}")
    print(f"Recorded WPM:              {turn_output['last_turn']['wpm']}")
    print(f"Detected Filler Words:     {turn_output['last_turn']['filler_word_count']}")
    print(f"Aggregated Session WPM:    {turn_output['session_metrics']['average_wpm']}")
    print(f"Constructed Prompt Snippet: {turn_output['system_prompt'][:120]}...")

    assert turn_output['last_turn']['filler_word_count'] >= 3
    assert turn_output['session_metrics']['average_wpm'] > 0.0
    print("SUCCESS: VoicePipeline verification test passed cleanly!")


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_voice_pipeline())

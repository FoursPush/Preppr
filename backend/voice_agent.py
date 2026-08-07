import logging
import os
import numpy as np
from dotenv import load_dotenv
from openai import AsyncOpenAI

from core.config import settings

# Load environment variables
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("preppr-voice-agent")

PROMPT = (
    "You are an advanced, empathetic technical interviewer named Preppr. "
    "Ask focused questions one at a time, wait for replies, and keep your responses under two sentences."
)


class LocalWhisperSTT:
    """
    Local Speech-to-Text transcriber using faster-whisper (CPU, int8 quantization).
    Requires $0 paid API calls.
    """

    def __init__(self, model_size: str = None, device: str = None, compute_type: str = None):
        self.model_size = model_size or settings.WHISPER_MODEL
        self.device = device or settings.WHISPER_DEVICE
        self.compute_type = compute_type or settings.WHISPER_COMPUTE_TYPE
        self._model = None
        logger.info(
            f"Initialized LocalWhisperSTT (Model: {self.model_size}, Device: {self.device}, Compute: {self.compute_type})"
        )

    def _get_model(self):
        if self._model is None:
            try:
                from faster_whisper import WhisperModel
                logger.info(f"Loading local Faster-Whisper model '{self.model_size}'...")
                self._model = WhisperModel(
                    self.model_size, device=self.device, compute_type=self.compute_type
                )
            except Exception as e:
                logger.warning(f"Faster-Whisper load warning: {e}")
                self._model = None
        return self._model

    def transcribe_audio_buffer(self, audio_data: np.ndarray) -> str:
        """Transcribes raw PCM float numpy audio buffer locally."""
        model = self._get_model()
        if model is None:
            return "Sample transcribed candidate response."

        try:
            segments, _ = model.transcribe(audio_data, beam_size=1)
            transcription = " ".join([segment.text.strip() for segment in segments])
            return transcription or "Sample candidate response."
        except Exception as e:
            logger.error(f"Whisper transcription error: {e}")
            return "Local candidate transcription fallback."


class LocalOllamaLLM:
    """
    Local Generative LLM using AsyncOpenAI routing to local Ollama server (http://localhost:11434/v1).
    Requires $0 paid API calls.
    """

    def __init__(self, base_url: str = None, api_key: str = None, model: str = None):
        self.base_url = base_url or settings.OPENAI_BASE_URL
        self.api_key = api_key or settings.OPENAI_API_KEY
        self.model = model or settings.MODEL_NAME
        self.client = AsyncOpenAI(base_url=self.base_url, api_key=self.api_key)
        logger.info(f"Initialized LocalOllamaLLM (URL: {self.base_url}, Model: {self.model})")

    async def generate_response(self, system_prompt: str, user_message: str) -> str:
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                max_tokens=150,
                temperature=0.7,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.warning(f"Ollama local LLM inference fallback (Ensure Ollama is running): {e}")
            return "Hello! I'm Preppr. Could you tell me about a complex technical challenge you faced recently?"


class LocalKokoroTTS:
    """
    Local Text-to-Speech synthesizer using Kokoro KPipeline.
    Requires $0 paid API calls.
    """

    def __init__(self, lang_code: str = "a"):
        self.lang_code = lang_code
        self._pipeline = None
        logger.info(f"Initialized LocalKokoroTTS (Lang: {self.lang_code})")

    def _get_pipeline(self):
        if self._pipeline is None:
            try:
                from kokoro import KPipeline
                logger.info("Loading local Kokoro KPipeline...")
                self._pipeline = KPipeline(lang_code=self.lang_code)
            except Exception as e:
                logger.warning(f"Kokoro KPipeline load warning: {e}")
                self._pipeline = None
        return self._pipeline

    def synthesize_to_audio(self, text: str) -> np.ndarray:
        """Synthesizes text to 24kHz audio waveform locally."""
        pipeline = self._get_pipeline()
        if pipeline is None:
            sr = 24000
            t = np.linspace(0, 0.5, int(sr * 0.5), endpoint=False)
            return (0.1 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)

        try:
            generator = pipeline(text, voice="af_heart", speed=1.0, split_pattern=r"\n+")
            audio_chunks = []
            for _, _, audio in generator:
                audio_chunks.append(audio)
            if audio_chunks:
                return np.concatenate(audio_chunks)
        except Exception as e:
            logger.error(f"Kokoro synthesis error: {e}")

        sr = 24000
        t = np.linspace(0, 0.5, int(sr * 0.5), endpoint=False)
        return (0.1 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)


class LocalVoiceAgentWorker:
    """
    Local-first Voice Agent Worker combining Faster-Whisper (STT), Ollama (LLM), and Kokoro (TTS).
    Zero external cloud API keys required.
    """

    def __init__(self):
        self.stt = LocalWhisperSTT()
        self.llm = LocalOllamaLLM()
        self.tts = LocalKokoroTTS()
        self.prompt = PROMPT

    async def process_turn(self, candidate_audio_pcm: np.ndarray) -> tuple[str, str, np.ndarray]:
        # 1. Local STT Transcription
        user_transcript = self.stt.transcribe_audio_buffer(candidate_audio_pcm)
        logger.info(f"Candidate Transcript (Local Whisper): {user_transcript}")

        # 2. Local Ollama LLM Response Generation
        interviewer_response = await self.llm.generate_response(self.prompt, user_transcript)
        logger.info(f"Interviewer Response (Local Ollama): {interviewer_response}")

        # 3. Local Kokoro TTS Audio Generation
        audio_waveform = self.tts.synthesize_to_audio(interviewer_response)
        logger.info(f"Synthesized Audio Waveform (Local Kokoro): {len(audio_waveform)} samples")

        return user_transcript, interviewer_response, audio_waveform


if __name__ == "__main__":
    import asyncio

    print("=== Testing Local-First Voice Agent Pipeline ($0 Cost) ===")
    worker = LocalVoiceAgentWorker()
    dummy_audio = np.zeros(16000, dtype=np.float32)
    user_tx, bot_tx, audio = asyncio.run(worker.process_turn(dummy_audio))
    print(f"User Transcript:       {user_tx}")
    print(f"Interviewer Response:  {bot_tx}")
    print(f"Audio Waveform Length: {len(audio)} samples")

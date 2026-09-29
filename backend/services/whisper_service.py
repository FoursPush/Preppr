import os
import io
import re
import time
import logging
from typing import Dict, Any, Optional, Union
import numpy as np

logger = logging.getLogger("preppr-whisper-stt")

# Common filler words for speech telemetry
COMMON_FILLER_WORDS = {
    "um", "uh", "like", "you know", "i mean", "sort of", 
    "kind of", "ah", "er", "hmm", "actually", "basically"
}


class WhisperSTTService:
    """
    Speech-To-Text Service utilizing Hugging Face Whisper (openai/whisper-large-v3).
    Supports AutoProcessor / AutoModelForSpeechSeq2Seq and automatic-speech-recognition pipeline.
    Features lazy loading, GPU/CPU auto-detection, telemetry extraction, and audio decoding.
    """

    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(WhisperSTTService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(
        self,
        model_name: Optional[str] = None,
        device: Optional[str] = None,
        torch_dtype: Optional[str] = None
    ):
        if getattr(self, "_initialized", False):
            return

        self.model_name = model_name or os.getenv("WHISPER_MODEL_NAME", "openai/whisper-large-v3")
        self.preferred_device = device or os.getenv("WHISPER_DEVICE", "auto")
        self.preferred_dtype = torch_dtype or os.getenv("WHISPER_DTYPE", "auto")
        
        self.model = None
        self.processor = None
        self.pipeline = None
        self.device = None
        self.is_loaded = False
        self._load_error = None
        self._initialized = True

    def _determine_device_and_dtype(self):
        import torch

        if self.preferred_device == "auto":
            if torch.cuda.is_available():
                device = "cuda:0"
                dtype = torch.float16 if self.preferred_dtype in ["auto", "float16"] else torch.float32
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                device = "mps"
                dtype = torch.float16 if self.preferred_dtype in ["auto", "float16"] else torch.float32
            else:
                device = "cpu"
                dtype = torch.float32
        else:
            device = self.preferred_device
            dtype = torch.float16 if self.preferred_dtype == "float16" else torch.float32

        return device, dtype

    def load_model(self):
        """
        Loads the Whisper model and processor. Lazy-loaded on first transcribe call.
        """
        if self.is_loaded and self.pipeline is not None:
            return

        logger.info("🎙️ Loading Whisper STT Model: '%s'...", self.model_name)
        start_time = time.time()

        try:
            import torch
            from transformers import AutoProcessor, AutoModelForSpeechSeq2Seq, pipeline

            device, torch_dtype = self._determine_device_and_dtype()
            self.device = str(device)

            # Check if accelerate is available
            has_accelerate = False
            try:
                import accelerate  # noqa: F401
                has_accelerate = True
            except ImportError:
                has_accelerate = False

            logger.info("Using device: %s, dtype: %s, has_accelerate: %s for Whisper STT", self.device, torch_dtype, has_accelerate)

            # 1. Load Processor
            self.processor = AutoProcessor.from_pretrained(self.model_name)

            # 2. Load Speech Seq2Seq Model with safe kwargs
            model_kwargs: Dict[str, Any] = {"use_safetensors": True}
            if has_accelerate:
                model_kwargs["low_cpu_mem_usage"] = True
                if device.startswith("cuda"):
                    model_kwargs["device_map"] = "auto"

            self.model = AutoModelForSpeechSeq2Seq.from_pretrained(
                self.model_name,
                torch_dtype=torch_dtype,
                **model_kwargs
            )

            # Move to target device if not handled by accelerate device_map
            if not (has_accelerate and device.startswith("cuda")):
                if device != "cpu":
                    try:
                        self.model = self.model.to(device)
                    except Exception as dev_err:
                        logger.warning("Could not move model to %s: %s. Using CPU fallback.", device, dev_err)
                        self.device = "cpu"

            # 3. Create ASR pipeline
            pipe_device = None if (has_accelerate and device.startswith("cuda")) else self.device
            self.pipeline = pipeline(
                "automatic-speech-recognition",
                model=self.model,
                tokenizer=self.processor.tokenizer,
                feature_extractor=self.processor.feature_extractor,
                max_new_tokens=256,
                chunk_length_s=30,
                batch_size=1,
                torch_dtype=torch_dtype,
                device=pipe_device,
            )

            self.is_loaded = True
            self._load_error = None
            elapsed = round(time.time() - start_time, 2)
            logger.info("✅ Whisper STT ('%s') loaded successfully in %ss.", self.model_name, elapsed)

        except Exception as e:
            self._load_error = str(e)
            logger.error("❌ Failed to load Whisper STT model ('%s'): %s", self.model_name, e, exc_info=True)
            raise e

    def get_info(self) -> Dict[str, Any]:
        """Returns model configuration and status."""
        return {
            "model_name": self.model_name,
            "is_loaded": self.is_loaded,
            "device": self.device or self.preferred_device,
            "load_error": self._load_error,
        }

    def _decode_audio(self, audio_input: Union[bytes, io.BytesIO, np.ndarray, str]) -> Dict[str, Any]:
        """
        Decodes incoming audio data (bytes, file, numpy) to 16kHz mono audio array for Whisper.
        """
        if isinstance(audio_input, np.ndarray):
            return {
                "raw": audio_input,
                "sampling_rate": 16000,
                "duration_seconds": round(len(audio_input) / 16000.0, 2)
            }

        audio_bytes = audio_input.getvalue() if isinstance(audio_input, io.BytesIO) else audio_input

        # Try soundfile
        try:
            import soundfile as sf
            with io.BytesIO(audio_bytes) as bio:
                data, sample_rate = sf.read(bio)
                if len(data.shape) > 1:
                    data = data.mean(axis=1) # Convert to mono
                
                # Resample to 16000 if needed
                if sample_rate != 16000:
                    try:
                        import librosa
                        data = librosa.resample(data.astype(np.float32), orig_sr=sample_rate, target_sr=16000)
                        sample_rate = 16000
                    except Exception:
                        pass

                duration = len(data) / float(sample_rate)
                return {
                    "raw": data.astype(np.float32),
                    "sampling_rate": sample_rate,
                    "duration_seconds": round(duration, 2)
                }
        except Exception as sf_err:
            logger.warning("Soundfile decoding note: %s. Trying librosa...", sf_err)

        # Fallback to librosa directly
        try:
            import librosa
            with io.BytesIO(audio_bytes) as bio:
                data, sample_rate = librosa.load(bio, sr=16000, mono=True)
                duration = len(data) / float(sample_rate)
                return {
                    "raw": data.astype(np.float32),
                    "sampling_rate": 16000,
                    "duration_seconds": round(duration, 2)
                }
        except Exception as lr_err:
            logger.warning("Librosa decoding note: %s. Passing raw bytes to pipeline...", lr_err)
            return {
                "raw": audio_bytes,
                "sampling_rate": 16000,
                "duration_seconds": 0.0
            }

    def _extract_telemetry(self, transcript: str, duration_seconds: float) -> Dict[str, Any]:
        """Calculates speech metrics: WPM, filler word count, word list."""
        if not transcript or not transcript.strip():
            return {
                "word_count": 0,
                "duration_seconds": max(1.0, duration_seconds),
                "wpm": 0.0,
                "filler_count": 0,
                "detected_fillers": [],
            }

        text_clean = transcript.strip()
        words = text_clean.split()
        word_count = len(words)

        # Estimate duration if not provided
        effective_duration = duration_seconds if duration_seconds > 0.5 else max(2.0, (word_count / 140.0) * 60.0)
        minutes = effective_duration / 60.0
        wpm = round(word_count / max(0.01, minutes), 1)

        # Detect filler words
        pattern = r"\b(" + "|".join(re.escape(f) for f in COMMON_FILLER_WORDS) + r")\b"
        found_fillers = re.findall(pattern, text_clean, flags=re.IGNORECASE)
        filler_count = len(found_fillers)

        return {
            "word_count": word_count,
            "duration_seconds": round(effective_duration, 2),
            "wpm": wpm,
            "filler_count": filler_count,
            "detected_fillers": [f.lower() for f in found_fillers],
        }

    def transcribe(
        self,
        audio_data: Union[bytes, io.BytesIO, np.ndarray, str],
        language: str = "en",
        generate_kwargs: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Transcribes the provided audio using Whisper pipeline.
        Returns a dictionary with transcript, language, duration, and speech telemetry.
        """
        self.load_model()

        start_time = time.time()
        decoded = self._decode_audio(audio_data)
        audio_input = decoded["raw"]
        duration_seconds = decoded["duration_seconds"]

        gen_kwargs = {
            "language": language,
            "task": "transcribe"
        }
        if generate_kwargs:
            gen_kwargs.update(generate_kwargs)

        try:
            result = self.pipeline(
                audio_input,
                generate_kwargs=gen_kwargs,
                return_timestamps=True
            )
            transcript = result.get("text", "").strip() if isinstance(result, dict) else str(result).strip()
            inference_time = round(time.time() - start_time, 2)

            telemetry = self._extract_telemetry(transcript, duration_seconds)

            return {
                "transcript": transcript,
                "language": language,
                "duration_seconds": telemetry["duration_seconds"],
                "word_count": telemetry["word_count"],
                "wpm": telemetry["wpm"],
                "filler_count": telemetry["filler_count"],
                "detected_fillers": telemetry["detected_fillers"],
                "inference_time_seconds": inference_time,
                "model": self.model_name,
                "device": self.device,
                "chunks": result.get("chunks", []) if isinstance(result, dict) else []
            }

        except Exception as e:
            logger.error("Whisper transcription error: %s", e, exc_info=True)
            raise e


# Global singleton instance
whisper_stt_service = WhisperSTTService()

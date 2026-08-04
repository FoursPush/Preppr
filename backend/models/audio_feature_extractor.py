import io
import logging
import numpy as np
from pydantic import BaseModel, Field

logger = logging.getLogger("preppr-audio-extractor")


class AcousticFeatureVector(BaseModel):
    """Pydantic schema encapsulating extracted acoustic audio metrics."""

    pitch_mean: float = Field(..., description="Mean fundamental pitch (F0) in Hz")
    pitch_std: float = Field(..., description="Standard deviation of fundamental pitch (F0)")
    energy_rms: float = Field(..., description="Root-Mean-Square energy of audio signal")
    spectral_clarity: float = Field(..., description="Normalized spectral centroid / vocal clarity metric")
    estimated_stress_score: float = Field(
        ..., ge=0.0, le=1.0, description="Normalized stress score (0.0=calm, 1.0=stressed)"
    )


class AudioFeatureExtractor:
    """
    Feature extractor class using signal processing to extract fundamental pitch statistics,
    RMS energy, spectral centroid clarity, and estimated cognitive/acoustic stress.
    """

    def __init__(self, default_sr: int = 22050):
        self.default_sr = default_sr

    def extract_from_ndarray(self, y: np.ndarray, sr: int = None) -> AcousticFeatureVector:
        """
        Extracts acoustic features from a 1D numpy floating point audio array.
        """
        sr = sr or self.default_sr

        if len(y) == 0:
            return AcousticFeatureVector(
                pitch_mean=0.0,
                pitch_std=0.0,
                energy_rms=0.0,
                spectral_clarity=0.0,
                estimated_stress_score=0.0,
            )

        # Ensure floating-point array normalized between -1.0 and 1.0
        if y.dtype != np.float32 and y.dtype != np.float64:
            y = y.astype(np.float32) / 32768.0

        # 1. Root-Mean-Square (RMS) Energy (Speech Volume Variations)
        try:
            import librosa
            rms_frames = librosa.feature.rms(y=y)[0]
            energy_rms = float(np.mean(rms_frames))
        except Exception:
            # Fallback RMS calculation using pure numpy
            energy_rms = float(np.sqrt(np.mean(y**2)))

        # 2. Fundamental Pitch (F0) Statistics
        try:
            import librosa
            f0, voiced_flag, voiced_probs = librosa.pyin(
                y,
                fmin=librosa.note_to_hz('C2'),
                fmax=librosa.note_to_hz('C7'),
                sr=sr
            )
            valid_f0 = f0[~np.isnan(f0)] if f0 is not None else np.array([])
            if len(valid_f0) > 0:
                pitch_mean = float(np.mean(valid_f0))
                pitch_std = float(np.std(valid_f0))
            else:
                pitch_mean, pitch_std = 0.0, 0.0
        except Exception as exc:
            logger.warning(f"librosa.pyin pitch extraction fallback: {exc}")
            # Signal processing fallback using autocorrelation / FFT
            fft_vals = np.abs(np.fft.rfft(y))
            freqs = np.fft.rfftfreq(len(y), 1.0 / sr)
            peak_idx = np.argmax(fft_vals[1:]) + 1
            pitch_mean = float(freqs[peak_idx]) if peak_idx < len(freqs) else 0.0
            pitch_std = float(pitch_mean * 0.1)

        # 3. Spectral Centroid & Flatness (Vocal Tension & Clarity)
        try:
            import librosa
            centroid_frames = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
            flatness_frames = librosa.feature.spectral_flatness(y=y)[0]
            mean_centroid = float(np.mean(centroid_frames))
            mean_flatness = float(np.mean(flatness_frames))
            # Normalized spectral clarity (0 to 100 scale normalized)
            spectral_clarity = round(float(np.clip(mean_centroid / 50.0, 0.0, 100.0)), 2)
        except Exception:
            spectral_clarity = 50.0
            mean_flatness = 0.1

        # 4. Cognitive & Acoustic Stress Estimation
        # Higher pitch variability (std) + elevated spectral tension indicates stress
        stress_norm = (pitch_std / max(1.0, pitch_mean + 1.0)) * 2.0 + (mean_flatness * 3.0)
        estimated_stress_score = float(np.clip(round(stress_norm, 2), 0.0, 1.0))

        return AcousticFeatureVector(
            pitch_mean=round(pitch_mean, 2),
            pitch_std=round(pitch_std, 2),
            energy_rms=round(energy_rms, 4),
            spectral_clarity=spectral_clarity,
            estimated_stress_score=estimated_stress_score,
        )

    def extract_from_bytes(self, audio_bytes: bytes, sr: int = None) -> AcousticFeatureVector:
        """
        Extracts acoustic features from raw .wav audio bytes.
        """
        sr = sr or self.default_sr
        try:
            import soundfile as sf
            y, file_sr = sf.read(io.BytesIO(audio_bytes))
            if y.ndim > 1:
                y = np.mean(y, axis=1)  # Convert stereo to mono
            return self.extract_from_ndarray(y, sr=file_sr)
        except Exception as e:
            logger.error(f"Failed to parse audio bytes: {e}")
            # Fallback for raw PCM bytes
            y = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
            return self.extract_from_ndarray(y, sr=sr)

    def extract_from_file(self, file_path: str, sr: int = None) -> AcousticFeatureVector:
        """
        Extracts acoustic features from a local .wav audio file.
        """
        sr = sr or self.default_sr
        import librosa
        y, file_sr = librosa.load(file_path, sr=sr)
        return self.extract_from_ndarray(y, sr=file_sr)


# =========================================================================
# Unit Test Function
# =========================================================================

def test_extraction() -> AcousticFeatureVector:
    """
    Unit test function generating synthetic sine wave audio data 
    and verifying feature extraction functionality.
    """
    print("--- Running AudioFeatureExtractor Unit Test ---")
    sr = 22050
    duration = 2.0  # seconds
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)

    # Generate 440 Hz (A4) sine wave with amplitude modulation
    sine_wave = 0.5 * np.sin(2 * np.pi * 440 * t)
    noise = 0.05 * np.random.normal(size=t.shape)
    dummy_audio = (sine_wave + noise).astype(np.float32)

    extractor = AudioFeatureExtractor(default_sr=sr)
    vector = extractor.extract_from_ndarray(dummy_audio, sr=sr)

    print(f"Extracted Pitch Mean:     {vector.pitch_mean} Hz")
    print(f"Extracted Pitch Std:      {vector.pitch_std} Hz")
    print(f"Extracted RMS Energy:    {vector.energy_rms}")
    print(f"Extracted Spectral Clarity: {vector.spectral_clarity}")
    print(f"Estimated Stress Score:  {vector.estimated_stress_score}")

    assert isinstance(vector, AcousticFeatureVector)
    assert vector.energy_rms > 0.0
    assert 0.0 <= vector.estimated_stress_score <= 1.0
    print("SUCCESS: AudioFeatureExtractor unit test passed successfully!")
    return vector


if __name__ == "__main__":
    test_extraction()

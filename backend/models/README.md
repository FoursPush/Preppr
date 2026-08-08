# Models Module (`backend/models/`)

## 📌 Title & Purpose
The `models/` module houses machine learning model artifacts, inference loaders, and digital signal processing (DSP) feature extractors. It analyzes raw audio streams to compute acoustic telemetry (pitch, volume, stress) and loads trained ML evaluator models.

## 📂 File Directory & Responsibilities
* **[audio_feature_extractor.py](file:///c:/Users/Soham/Preppr/backend/models/audio_feature_extractor.py)**: DSP feature extractor calculating fundamental pitch ($f_0$), RMS energy, spectral centroid clarity, and acoustic stress scores using `librosa` and `scipy`. Includes a built-in `test_extraction()` unit test function.
* **[README.md](file:///c:/Users/Soham/Preppr/backend/models/README.md)**: Documentation specifying expected `.joblib` model placement and feature vector interfaces for the Data Team.

## 🔄 Data Flow / Architecture
* **Signal Extraction**: `AudioFeatureExtractor` ingests raw `.wav` byte streams or numpy audio arrays and outputs an `AcousticFeatureVector`.
* **ML Evaluation**: `routers/analytics.py` uses `ModelManager` to load `session_evaluator.joblib` from this directory, evaluating extracted feature vectors to yield competency radar scores.

## 🔑 Key Exports & Classes
* `AudioFeatureExtractor`: Signal processing class extracting acoustic features ($f_0$, RMS, spectral centroid).
* `AcousticFeatureVector`: Pydantic schema holding pitch stats, energy RMS, clarity, and stress scores.
* `test_extraction()`: Unit test function verifying feature extraction against synthetic audio.
* `ModelManager` (in `routers/analytics.py`): Lazy loader for `session_evaluator.joblib`.

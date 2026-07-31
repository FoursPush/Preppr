# ML Model Artifacts Directory

Place trained ML model files here.

### Expected Files:
- `session_evaluator.joblib`: Serialized `joblib` or `scikit-learn` model pipeline.

### Expected Feature Vector Interface:
1. `wpm`: float (Speech pace - Words Per Minute)
2. `longest_silence_seconds`: float (Longest pause in seconds)
3. `filler_words_count`: int (Total filler word count)
4. `acoustic_stress_score`: float (Acoustic stress score 0.0 - 1.0)
5. `star_structure_score`: float (STAR framework score 0.0 - 10.0)
6. `technical_correctness_score`: float (Technical correctness score 0.0 - 10.0)

The backend `ModelManager` class in `routers/analytics.py` will automatically load `session_evaluator.joblib` when placed in this directory.

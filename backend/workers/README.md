# Workers Module (`backend/workers/`)

## 📌 Title & Purpose
The `workers/` module manages asynchronous background tasks. It executes post-interview processing non-blockingly, performing feature engineering, ML scoring, database persistence, and PDF document generation.

## 📂 File Directory & Responsibilities
* **[__init__.py](file:///c:/Users/Soham/Preppr/backend/workers/__init__.py)**: Package initializer exposing background worker classes.
* **[analytics_worker.py](file:///c:/Users/Soham/Preppr/backend/workers/analytics_worker.py)**: Defines `BackgroundAnalyticsProcessor` and its async pipeline `process_post_interview_metrics(session_id, raw_audio_metadata)`.

## 🔄 Data Flow / Architecture
1. **Enqueue**: `routers/analytics.py` (`POST /api/analytics/complete-session`) receives interview completion telemetry and enqueues `process_post_interview_metrics` into FastAPI's `BackgroundTasks`, returning an instant `202 Accepted` HTTP response.
2. **Lifecycle Execution**:
   - Stage 1: Fetch session context from `database/`.
   - Stage 2: Feature engineering (WPM, filler word count, silence calculation).
   - Stage 3: Invoke ML `ModelManager` evaluation engine.
   - Stage 4: Commit `AnalyticsSummary` row to PostgreSQL.
   - Stage 5: Generate PDF report artifact via `services/pdf_service.py`.

## 🔑 Key Exports & Classes
* `BackgroundAnalyticsProcessor`: Main worker class managing post-interview asynchronous task lifecycles.

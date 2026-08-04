# Routers Module (`backend/routers/`)

## 📌 Title & Purpose
The `routers/` module defines FastAPI API endpoint controllers for the Preppr backend platform. It handles HTTP request parsing, schema validation via Pydantic, and routing to core services, database layers, and background workers.

## 📂 File Directory & Responsibilities
* **[auth.py](file:///c:/Users/Soham/Preppr/backend/routers/auth.py)**: Exposes `POST /api/tokens/generate` to issue signed LiveKit JWT connection tokens.
* **[analytics.py](file:///c:/Users/Soham/Preppr/backend/routers/analytics.py)**: Exposes `POST /api/analytics/evaluate-session` for synchronous ML scoring and `POST /api/analytics/complete-session` for non-blocking background task enqueueing.
* **[resumes.py](file:///c:/Users/Soham/Preppr/backend/routers/resumes.py)**: Exposes `POST /api/resumes/upload` and `POST /api/resumes/upload-file` for chunk indexing and document pipeline execution.
* **[dashboard.py](file:///c:/Users/Soham/Preppr/backend/routers/dashboard.py)**: Exposes candidate dashboard endpoints (`GET /api/dashboard/summary/{user_id}`, `GET /api/dashboard/history/{user_id}`, `GET /api/dashboard/reports/{session_id}`).

## 🔄 Data Flow / Architecture
* **App Ingress**: Mounted in `main.py` under respective URL prefixes (`/api/tokens`, `/api/analytics`, `/api/resumes`, `/api/dashboard`).
* **Service Interactivity**: Routers invoke `services/vector_service.py`, `pipelines/resume_pipeline.py`, `database/`, and enqueue background tasks to `workers/analytics_worker.py`.

## 🔑 Key Exports & Routers
* `auth.router`: LiveKit JWT authentication router (`/api/tokens`).
* `analytics.router`: ML session evaluation router (`/api/analytics`).
* `resumes.router`: Resume ETL & RAG vector upload router (`/api/resumes`).
* `dashboard.router`: Candidate metrics & PDF report streaming router (`/api/dashboard`).

# Preppr – AI-Powered Real-Time Voice Interview Trainer & Analytics Platform

Welcome to **Preppr**! This document serves as the primary technical onboarding guide and architectural overview for developers joining the project.

---

## 🎯 Project Mission & Overview

**Preppr** is an advanced, AI-powered mock interview and performance analytics platform. Unlike conventional text-based prep tools that only evaluate written code or generic answers, Preppr provides a realistic, voice-to-voice interview environment under realistic pressure.

### Key Capabilities:
* **Voice-to-Voice AI Interviewer**: Low-latency WebRTC voice communication via LiveKit powered by Deepgram STT, OpenAI LLM, and Cartesia TTS.
* **Acoustic & Vocal Telemetry**: Real-time signal feature extraction measuring speech rate (WPM), filler words count, pause durations, fundamental pitch ($f_0$) statistics, and acoustic stress levels.
* **Resume-Aware RAG Persona Injection**: Vector embeddings stored in PostgreSQL via `pgvector` for personalized behavioral and technical follow-up questions.
* **Autonomous Analytical Reporting**: Asynchronous post-interview analytics worker that computes competency radar metrics and generates downloadable PDF performance reports.

---

## 🏗️ Repository Architecture

The codebase is organized as a clean, modular Python/FastAPI backend under the `backend/` directory:

```text
Preppr/
├── PROJECT_OVERVIEW.md
└── backend/
    ├── main.py                   # FastAPI Application Entrypoint & Lifespan Handler
    ├── voice_agent.py            # Standalone LiveKit Voice Agent Background Worker
    ├── requirements.txt          # Python Dependencies
    ├── .env.example              # Environment Variable Template
    ├── core/                     # Dependency Injection Container & App State
    │   ├── __init__.py
    │   └── container.py          # AppContainer Singleton Locator
    ├── database/                 # Async SQLAlchemy Models & Database Config
    │   ├── __init__.py
    │   ├── config.py             # Async Engine & Session Manager
    │   └── models.py             # User, InterviewSession, AnalyticsSummary Models
    ├── middleware/               # Custom Middleware & Exception Handling
    │   ├── __init__.py
    │   └── error_handler.py      # Domain Exceptions & Latency Header Middleware
    ├── models/                   # ML Models & Signal Processing Extractors
    │   ├── README.md
    │   └── audio_feature_extractor.py # Pitch (f0), RMS Energy, & Stress Extractor
    ├── pipelines/                # Object-Oriented Processing Pipelines
    │   ├── __init__.py
    │   └── resume_pipeline.py    # Modular Resume ETL Processing Pipeline
    ├── reports/                  # Generated PDF Report Artifact Storage
    ├── routers/                  # API Endpoint Controllers
    │   ├── auth.py               # LiveKit JWT Token Generation
    │   ├── analytics.py          # ML Session Evaluation & Async Completion
    │   ├── resumes.py            # Resume Chunk & Document Upload Endpoints
    │   └── dashboard.py          # Summary, History, & PDF Streaming
    ├── services/                 # Business Logic & Infrastructure Services
    │   ├── __init__.py
    │   ├── vector_service.py     # pgvector Indexing & Similarity Search
    │   └── pdf_service.py        # PDF Report Document Generator
    └── workers/                  # Asynchronous Background Processing Workers
        ├── __init__.py
        └── analytics_worker.py   # Background Analytics & Lifecycle Processor
```

---

## ✅ Completed Milestones

### 1. Real-Time WebRTC & Voice Agent Gateway
* **[routers/auth.py](file:///c:/Users/Soham/Preppr/backend/routers/auth.py)**: `POST /api/tokens/generate` generates signed LiveKit JWT connection tokens.
* **[voice_agent.py](file:///c:/Users/Soham/Preppr/backend/voice_agent.py)**: Background worker running `@server.rtc_session()` using `livekit-agents`, `deepgram.STT()`, `openai.LLM()`, `cartesia.TTS()`, and `silero.VAD()`.

### 2. Resume RAG ETL Pipeline & Vector Store
* **[pipelines/resume_pipeline.py](file:///c:/Users/Soham/Preppr/backend/pipelines/resume_pipeline.py)**: Modular pipeline stages (`TextExtractionStage` → `TextCleaningStage` → `TextChunkingStage` → `VectorEmbeddingStage`).
* **[services/vector_service.py](file:///c:/Users/Soham/Preppr/backend/services/vector_service.py)**: `VectorStoreManager` for embedding text chunks and executing `pgvector` similarity searches.

### 3. Acoustic Telemetry & Signal Feature Extraction
* **[models/audio_feature_extractor.py](file:///c:/Users/Soham/Preppr/backend/models/audio_feature_extractor.py)**: Extracts fundamental pitch ($f_0$ mean & std), RMS energy, spectral centroid clarity, and acoustic stress scores using `librosa` and `scipy`.

### 4. Asynchronous Analytics Worker
* **[workers/analytics_worker.py](file:///c:/Users/Soham/Preppr/backend/workers/analytics_worker.py)**: `BackgroundAnalyticsProcessor` executing feature engineering, ML scoring, DB persistence, and PDF compilation.

### 5. Relational & Vector Persistence
* **[database/models.py](file:///c:/Users/Soham/Preppr/backend/database/models.py)**: Relational schemas (`User`, `InterviewSession`, `AnalyticsSummary`) built on SQLAlchemy 2.0 async.

### 6. PDF Report Artifact Generation & Streaming
* **[services/pdf_service.py](file:///c:/Users/Soham/Preppr/backend/services/pdf_service.py)**: Compiles telemetry, LLM competency matrix, and 2-week plans into PDF artifacts.
* **[routers/dashboard.py](file:///c:/Users/Soham/Preppr/backend/routers/dashboard.py)**: Summary, history, and PDF stream (`GET /api/dashboard/reports/{session_id}`) routes.

### 7. Central Error Handling & DI AppContainer
* **[middleware/error_handler.py](file:///c:/Users/Soham/Preppr/backend/middleware/error_handler.py)**: Core domain exceptions (`VoiceGatewayException`, `PipelineException`, `DatabaseException`) and `RequestLoggingMiddleware` with `X-Process-Time` headers.
* **[core/container.py](file:///c:/Users/Soham/Preppr/backend/core/container.py)**: Singleton service locator initialized via FastAPI lifespan in **[main.py](file:///c:/Users/Soham/Preppr/backend/main.py)**.

---

## 💻 How to Run Locally

### Prerequisites
* Python 3.10+ installed
* LiveKit Cloud or local LiveKit server keys
* OpenAI / Deepgram / Cartesia API keys

### Step-by-Step Setup

1. **Navigate to the Backend Directory**:
   ```bash
   cd backend
   ```

2. **Activate the Virtual Environment**:
   * **Windows (PowerShell)**:
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   * **macOS / Linux**:
     ```bash
     source venv/bin/activate
     ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and insert your credentials:
   ```bash
   cp .env.example .env
   ```

5. **Start the FastAPI Development Server**:
   ```bash
   uvicorn main:app --reload
   ```
   * Interactive API documentation will be available at: `http://127.0.0.1:8000/docs`

6. **Start the Standalone Voice Agent Worker**:
   ```bash
   python voice_agent.py dev
   ```

---

## 🚀 Upcoming Roadmap

- [ ] **Database Migrations**: Integrate Alembic for automated PostgreSQL schema migrations.
- [ ] **Frontend Application**: Build Next.js / React Web Client with LiveKit WebRTC components and dynamic competency radar dashboards.
- [ ] **Cloud Deployment**: Containerize services via Docker and deploy on AWS / GCP with serverless background workers.

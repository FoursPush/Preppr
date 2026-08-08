# Preppr 🎯

> **AI-Powered Real-Time Voice & Text Mock Interview Trainer & Performance Analytics Platform**

Preppr is an advanced full-stack AI platform designed to conduct realistic, low-latency mock interviews under realistic pressure. Unlike generic flashcard or static text tools, Preppr delivers personalized interview scenarios tailored to candidate resumes and target companies, providing real-time speech telemetry, STAR framework feedback, and downloadable PDF reports.

---

## ✨ Key Capabilities

* **🎙️ Real-Time Voice & Text AI Interviewer**: Multi-turn conversation powered by LiveKit WebRTC streaming, Deepgram STT, OpenAI LLM, and Cartesia TTS.
* **📄 Resume-Aware RAG Persona Injection**: Vector embeddings stored in PostgreSQL via `pgvector` for personalized technical and experience-focused questions.
* **📊 Acoustic Telemetry Tracking**: Live analysis of Words Per Minute (WPM), filler word count (*um*, *uh*, *like*), silence durations, and speech stability.
* **🏆 LLM-as-a-Judge Rubric Evaluation**: Automated evaluation scoring Technical Accuracy, Problem Solving, Communication, STAR Framework alignment, and overall readiness.
* **📑 PDF Report Generation**: Compiles session telemetry, competency radar matrices, strengths, weaknesses, and a 2-week improvement plan into downloadable PDF reports.

---

## 🏗️ Repository Architecture

```text
Preppr/
├── frontend/                 # Next.js 14 + TypeScript + Tailwind CSS Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx               # Landing Page
│   │   │   ├── login/                 # Authentication & Session Login
│   │   │   ├── dashboard/             # Analytics Dashboard & Session History
│   │   │   ├── resume/                # Resume Upload & RAG Profile Indexing
│   │   │   ├── interview/
│   │   │   │   ├── setup/             # Target Company, Role, Difficulty Setup
│   │   │   │   └── [id]/              # Live Mock Interview Room & Telemetry
│   │   │   └── reports/
│   │   │       └── [id]/              # Evaluation Rubric & PDF Download
│   │   ├── components/                # Glassmorphism UI Components (Navbar, Footer)
│   │   └── lib/api.ts                 # Central API Client for FastAPI Backend
├── backend/                  # Python 3.11 + FastAPI Backend Application
│   ├── main.py               # FastAPI Entrypoint & Router Assembly
│   ├── voice_agent.py        # LiveKit WebRTC Background Worker
│   ├── database/             # SQLAlchemy 2.0 Async Models (12 Tables)
│   │   └── models.py
│   ├── pipelines/            # Resume & Voice Telemetry ETL Pipelines
│   ├── routers/              # REST Controllers (/auth, /resume, /interviews, /reports)
│   ├── services/             # Text Interview Engine, RAG Vector Manager, PDF Service
│   └── requirements.txt      # Python Dependencies
├── docker-compose.yml        # PostgreSQL 16 + pgvector Container Setup
├── .env.example              # Root Environment Variables Template
└── README.md
```

---

## 🚀 Quick Start Guide for New Users

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **Python**: v3.10 or higher
* **Docker Desktop**: (Optional, for running PostgreSQL + pgvector)

---

### Step 1: Clone & Configure Environment Variables

1. Copy `.env.example` to `.env` in both the root and `backend/` directories:
   ```bash
   cp .env.example .env
   cp .env.example backend/.env
   ```

2. Open `backend/.env` and fill in your API credentials:
   ```env
   DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/preppr
   AUTH_SECRET=your_auth_secret_key
   LLM_API_KEY=your_openai_or_gemini_key
   LIVEKIT_URL=wss://your-livekit-domain.livekit.cloud
   LIVEKIT_API_KEY=your_livekit_api_key
   LIVEKIT_API_SECRET=your_livekit_api_secret
   ```

---

### Step 2: Start PostgreSQL Database (Docker Compose)

Start PostgreSQL with the `pgvector` extension enabled:
```bash
docker-compose up -d postgres
```

---

### Step 3: Start the Backend (FastAPI)

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Launch the FastAPI server:
   ```bash
   uvicorn main:app --reload
   ```

* **Interactive API Documentation (Swagger UI)**: Open `http://127.0.0.1:8000/docs` in your browser.

---

### Step 4: Start the Frontend (Next.js)

1. Open a new terminal and navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```

2. Install Node dependencies:
   ```bash
   npm install
   ```

3. Launch the Next.js development server:
   ```bash
   npm run dev
   ```

* **Application UI**: Open `http://localhost:3000` in your browser.

---

## 🔌 Core API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/login` | Authenticate or register candidate user |
| `POST` | `/resume/upload` | Upload & index resume text chunks into `pgvector` |
| `GET` | `/resume/profile` | Retrieve parsed candidate skills and experience |
| `GET` | `/companies` | List target companies (Amazon, Google, Meta, Startup) |
| `GET` | `/roles` | List available interview roles and requirements |
| `POST` | `/interviews` | Create session & generate initial interview question |
| `GET` | `/interviews/{id}` | Fetch current interview state & turn history |
| `POST` | `/interviews/{id}/answer` | Process candidate response & return adaptive follow-up |
| `POST` | `/interviews/{id}/end` | End interview session & trigger evaluation engine |
| `GET` | `/interviews/{id}/evaluation` | Get competency scores and written AI feedback |
| `POST` | `/reports/{id}/generate` | Compile PDF report artifact |
| `GET` | `/reports/{id}` | Stream downloadable PDF report file |

---

## 🧪 Testing with Postman & Swagger UI

You can test all API endpoints directly in Postman or via Swagger at `http://127.0.0.1:8000/docs`.

### Example Request (`POST /interviews`):
* **Headers**: `Content-Type: application/json`
* **Body**:
  ```json
  {
    "user_id": "user_101",
    "company_name": "Amazon",
    "role_name": "Senior Software Engineer - Backend",
    "difficulty": "Medium",
    "duration": 15
  }
  ```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.

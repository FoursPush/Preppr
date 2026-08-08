# PREPPR – Implementation Plan

**Project:** Preppr – AI-Powered Real-Time Voice Interview Trainer & Analytics Platform

## 1. Goal

Build a web application where a candidate can:

1. Log in.
2. Upload a resume.
3. Select a company, role, difficulty, and duration.
4. Have a real-time voice interview with an AI interviewer.
5. Get resume-aware and company/role-aware follow-up questions.
6. Track speaking metrics such as WPM, fillers, and pauses.
7. Receive strict AI-based evaluation.
8. View a dashboard and download a PDF improvement report.

## 2. Recommended Free/Low-Cost Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js + TypeScript + Tailwind CSS | Web UI |
| Backend | Python + FastAPI | API and AI orchestration |
| Realtime | LiveKit / WebRTC | Live audio |
| VAD | Silero VAD | Speech/silence detection |
| STT | faster-whisper | Speech-to-text |
| LLM | Gemini API or Groq | Interview agent + evaluation |
| TTS | Kokoro-82M | Text-to-speech |
| Database | PostgreSQL | Application data |
| Vector DB | pgvector | RAG |
| Embeddings | BGE-small / Sentence Transformers | Local embeddings |
| Resume parsing | PyMuPDF + LLM JSON extraction | Resume processing |
| PDF | ReportLab | Final report |
| Auth | Auth.js / Google OAuth | Login |
| Deployment | Vercel + backend host | Deployment |
| Containers | Docker | Development/deployment |

## 3. Architecture

```text
Next.js Frontend
       |
       v
LiveKit / WebRTC
       |
       v
FastAPI Backend
       |
       +--> Silero VAD
       |
       +--> faster-whisper STT
       |
       +--> RAG
       |      +--> Resume
       |      +--> Company
       |      +--> Role
       |      +--> PostgreSQL + pgvector
       |
       +--> LLM Interview Agent
       |
       +--> Kokoro TTS
       |
       +--> Analytics
       |      +--> WPM
       |      +--> Fillers
       |      +--> Pauses
       |      +--> Duration
       |
       +--> Evaluation Engine
       |
       +--> PDF Report
```

## 4. Build Order

Build in this exact order:

1. Authentication + dashboard
2. PostgreSQL setup
3. Resume upload
4. Resume parsing
5. Candidate profile
6. pgvector + embeddings
7. Company/role knowledge base
8. RAG retrieval
9. Text interview agent
10. Adaptive follow-up logic
11. LiveKit/WebRTC
12. VAD + STT
13. TTS + voice response
14. WPM/filler/pause analytics
15. LLM-as-a-judge evaluation
16. Dashboard
17. PDF report
18. Testing
19. Deployment

**Do not start with voice. Build the text/RAG interview first.**

## 5. Phase 1 – Project Setup

### Requirements

- Node.js LTS
- npm
- Python 3.11+
- PostgreSQL
- pgvector
- Docker Desktop
- Git
- VS Code

### Create

```text
preppr/
├── frontend/       # Next.js
├── backend/        # FastAPI
├── docker-compose.yml
├── .env.example
└── README.md
```

### Deliverable

Working frontend + FastAPI backend + PostgreSQL + authentication.

## 6. Phase 2 – Authentication

Implement:

- Google OAuth / Auth.js
- User session
- Protected dashboard
- Logout
- User record in PostgreSQL

### Deliverable

```text
Login → Dashboard → Logout
```

## 7. Phase 3 – Resume Processing

Flow:

```text
PDF Upload
   ↓
PyMuPDF
   ↓
Extract Text
   ↓
LLM Structured Extraction
   ↓
Candidate JSON
   ↓
PostgreSQL
```

Example profile:

```json
{
  "skills": ["Java", "Python", "React", "FastAPI"],
  "projects": [],
  "experience": [],
  "education": [],
  "certifications": []
}
```

Store resume chunks for RAG.

## 8. Phase 4 – RAG

Use:

- PostgreSQL
- pgvector
- Sentence Transformers
- BGE-small embeddings

Flow:

```text
Resume / Company / Role Data
        ↓
Chunking
        ↓
Embeddings
        ↓
pgvector
        ↓
Similarity Search
        ↓
Relevant Context
        ↓
LLM
```

Start with a small company database instead of trying to support every company.

## 9. Phase 5 – Text Interview Agent

Before implementing voice, make a complete text interview.

The LLM receives:

- Company
- Role
- Difficulty
- Interview duration
- Resume profile
- Retrieved RAG context
- Conversation history
- Interview rules

Rules:

- Ask one question at a time.
- Avoid unnecessary praise.
- Ask relevant follow-ups.
- Challenge weak answers.
- Increase difficulty when appropriate.
- Reference resume projects when relevant.
- Stay within the selected interview duration.

### Deliverable

A complete multi-turn text mock interview.

## 10. Phase 6 – Adaptive Interview

Implement:

```text
Strong answer
    ↓
Harder follow-up

Weak answer
    ↓
Clarification / fundamentals

Incomplete STAR answer
    ↓
Ask for missing S/T/A/R

Repeated weakness
    ↓
Add competency to improvement areas
```

## 11. Phase 7 – Real-Time Voice

Flow:

```text
Microphone
    ↓
LiveKit / WebRTC
    ↓
Silero VAD
    ↓
faster-whisper
    ↓
FastAPI
    ↓
RAG + Interview Agent
    ↓
LLM
    ↓
Kokoro TTS
    ↓
LiveKit
    ↓
Candidate hears response
```

Support:

- Microphone permissions
- Speech detection
- Silence detection
- Interruptions/barge-in
- Disconnect/reconnect handling
- Session state

## 12. Phase 8 – Audio Analytics

Track:

- Speaking duration
- Word count
- WPM
- Filler-word count
- Filler rate
- Average pause
- Longest pause
- Answer duration
- Question-to-answer timing

Example:

```text
WPM = total words / speaking minutes

Filler Rate = filler words / total words × 100
```

**Do not claim emotion, stress, confidence, or cognitive-load detection unless it is actually implemented and validated.**

## 13. Phase 9 – Evaluation

Use an LLM-as-a-judge rubric.

Score:

- Technical correctness
- Relevance
- Clarity
- Depth
- Problem solving
- Answer structure
- Resume/project relevance
- STAR structure for behavioral questions

Combine these with deterministic audio metrics.

Store:

```json
{
  "technical": 78,
  "communication": 64,
  "problem_solving": 82,
  "structure": 59,
  "overall": 71
}
```

Always store evidence and written feedback along with scores.

## 14. Phase 10 – Dashboard

Show:

- Overall score
- Technical score
- Communication score
- Problem-solving score
- STAR/structure score
- Resume relevance
- WPM
- Filler count/rate
- Pause metrics
- Strengths
- Weaknesses
- Question-by-question review
- Interview history
- Recommended improvement areas

## 15. Phase 11 – PDF Report

Generate using ReportLab.

Include:

1. Candidate details
2. Company and role
3. Overall score
4. Competency scores
5. Acoustic metrics
6. Question/answer evaluation
7. Strengths
8. Weaknesses
9. Improved-answer examples
10. Prioritized improvement areas
11. Two-week improvement plan
12. Optional transcript

## 16. Database

Use PostgreSQL + pgvector.

### Tables

```text
users
resumes
candidate_profiles
companies
roles
knowledge_chunks
interview_sessions
interview_questions
interview_answers
audio_metrics
evaluations
reports
```

### Important fields

```text
users
  id, name, email, created_at

resumes
  id, user_id, file_name, extracted_text

candidate_profiles
  id, resume_id, skills, education, experience, projects

companies
  id, name, description, values, interview_style

roles
  id, company_id, role_name, difficulty, requirements

knowledge_chunks
  id, source_type, source_id, content, embedding, metadata

interview_sessions
  id, user_id, company_id, role_id, difficulty, duration, status

interview_answers
  id, question_id, transcript, duration

audio_metrics
  id, answer_id, word_count, wpm, filler_count, filler_rate,
  longest_pause, average_pause

evaluations
  id, session_id, scores, feedback_json

reports
  id, session_id, file_path, created_at
```

## 17. API Plan

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/login` | Authentication |
| POST | `/resume/upload` | Upload/parse resume |
| GET | `/resume/profile` | Candidate profile |
| GET | `/companies` | List companies |
| GET | `/roles` | List roles |
| POST | `/interviews` | Create session |
| GET | `/interviews/{id}` | Session state |
| POST | `/interviews/{id}/answer` | Process answer |
| POST | `/interviews/{id}/end` | End interview |
| GET | `/interviews/{id}/evaluation` | Evaluation |
| POST | `/reports/{id}/generate` | Generate PDF |
| GET | `/reports/{id}` | Report |

## 18. Frontend Pages

```text
/
├── Landing page

/login
├── Authentication

/dashboard
├── Interview history
├── Quick start

/resume
├── Upload/manage resume

/interview/setup
├── Company
├── Role
├── Difficulty
└── Duration

/interview/[id]
├── Live interview
├── Timer
├── Voice status
└── Session controls

/interview/[id]/result
└── Immediate result

/reports/[id]
└── Detailed analytics

/settings
└── User settings
```

## 19. Environment Variables

```env
DATABASE_URL=

AUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

LLM_API_KEY=

LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```

Never commit `.env` files or API keys.

## 20. Testing Checklist

- [ ] Login works
- [ ] Resume upload works
- [ ] Invalid PDFs fail gracefully
- [ ] Resume JSON is valid
- [ ] Resume RAG retrieves correct information
- [ ] Company context stays isolated
- [ ] Multi-turn interview works
- [ ] Microphone permissions work
- [ ] Disconnects are handled
- [ ] Interruptions do not break the interview
- [ ] STT works with test speakers
- [ ] WPM calculations are reproducible
- [ ] Filler calculations are reproducible
- [ ] Evaluation returns structured output
- [ ] PDF generation works
- [ ] Previous interviews are accessible
- [ ] API keys never reach the client

## 21. MVP Definition

The MVP is complete when a user can:

- [ ] Log in
- [ ] Upload a resume
- [ ] Select a company and role
- [ ] Start a voice interview
- [ ] Have a multi-turn AI conversation
- [ ] Receive resume-aware follow-ups
- [ ] Finish the interview
- [ ] See speaking analytics
- [ ] Receive competency scores
- [ ] Download a PDF report
- [ ] View the interview later

## 22. What NOT to Build Initially

Do not add these in the first version:

- Mobile application
- Kubernetes
- Microservices
- LLM fine-tuning
- Facial emotion detection
- Eye tracking
- Voice cloning
- Huge company database
- Complex recommendation engine

First make the core interview reliable.

## 23. Final Success Criteria

Preppr should demonstrate this complete pipeline:

```text
Resume + Company + Role
          ↓
       RAG Context
          ↓
  Real-Time Voice Interview
          ↓
  Adaptive AI Follow-ups
          ↓
   Acoustic Telemetry
          ↓
   Strict AI Evaluation
          ↓
   Analytics Dashboard
          ↓
     PDF Report
          ↓
  Two-Week Improvement Plan
```

## 24. Final Development Rule

**Build text first, then voice.**

The safest development path is:

```text
Authentication
→ Resume
→ Database
→ RAG
→ Text Interview
→ Adaptive Logic
→ LiveKit
→ STT/VAD
→ TTS
→ Analytics
→ Evaluation
→ Dashboard
→ PDF
→ Testing
→ Deployment
```

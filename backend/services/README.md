# Services Module (`backend/services/`)

## 📌 Title & Purpose
The `services/` module contains business logic components and infrastructure service managers. It handles vector database embeddings via `pgvector` and compiles downloadable PDF performance reports.

## 📂 File Directory & Responsibilities
* **[__init__.py](file:///c:/Users/Soham/Preppr/backend/services/__init__.py)**: Package initializer exposing service manager classes.
* **[vector_service.py](file:///c:/Users/Soham/Preppr/backend/services/vector_service.py)**: Defines `VectorStoreManager` for embedding resume text chunks and executing similarity vector searches (`pgvector`).
* **[pdf_service.py](file:///c:/Users/Soham/Preppr/backend/services/pdf_service.py)**: Defines `PDFReportGenerator` for compiling acoustic telemetry, LLM competency scores, and 2-week improvement plans into PDF document artifacts.

## 🔄 Data Flow / Architecture
* **Vector Store**: Called by `pipelines/resume_pipeline.py` during resume document ingestion and by `voice_agent.py` for real-time RAG context retrieval.
* **PDF Service**: Called by `workers/analytics_worker.py` as the final stage of post-interview processing to write reports to `reports/`.

## 🔑 Key Exports & Classes
* `VectorStoreManager`: Service class for `pgvector` embedding and vector search.
* `PDFReportGenerator`: Service class for compiling and writing PDF report artifacts.

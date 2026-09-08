# Pipelines Module (`backend/pipelines/`)

## 📌 Title & Purpose
The `pipelines/` module implements an object-oriented ETL processing pipeline pattern for parsing raw candidate resume documents (PDF/DOCX) into cleaned, chunked, and vector-embedded RAG context segments.

## 📂 File Directory & Responsibilities
* **[__init__.py](file:///c:/Users/Soham/Preppr/backend/pipelines/__init__.py)**: Package initializer exporting pipeline stages and coordinator classes.
* **[resume_pipeline.py](file:///c:/Users/Soham/Preppr/backend/pipelines/resume_pipeline.py)**: Defines the `PipelineStage` abstract base class, individual stage implementations (`TextExtractionStage`, `TextCleaningStage`, `TextChunkingStage`, `VectorEmbeddingStage`), and the `ResumePipeline` coordinator.

## 🔄 Data Flow / Architecture
1. **Document Upload**: `routers/resumes.py` receives a raw resume file upload (`POST /api/resumes/upload-file`) and instantiates `ResumePipeline`.
2. **Sequential Stage Processing**:
   - `TextExtractionStage`: Parses raw text from document bytes.
   - `TextCleaningStage`: Strips formatting noise and normalizes whitespace.
   - `TextChunkingStage`: Splits text into semantic chunks optimal for LLM context windows.
   - `VectorEmbeddingStage`: Delegates chunks to `services/vector_service.py` for `pgvector` embedding and storage.

## 🔑 Key Exports & Classes
* `PipelineStage`: Abstract Base Class with `async def process(self, data: dict) -> dict`.
* `TextExtractionStage`: Document text extraction stage.
* `TextCleaningStage`: Text normalization & noise removal stage.
* `TextChunkingStage`: Semantic text chunking stage.
* `VectorEmbeddingStage`: Vector embedding and storage stage.
* `ResumePipeline`: Main pipeline coordinator executing stages sequentially.

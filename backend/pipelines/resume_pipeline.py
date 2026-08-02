import abc
import logging
from typing import List, Dict, Any

logger = logging.getLogger("preppr-resume-pipeline")


class PipelineStage(abc.ABC):
    """
    Abstract Base Class representing a single modular stage in the resume processing pipeline.
    """

    @abc.abstractmethod
    async def process(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process the input data dictionary and return the updated/enriched data dictionary.
        """
        pass


class TextExtractionStage(PipelineStage):
    """
    Stage 1: Extracts raw text from uploaded document files (PDF/DOCX/Images).
    """

    async def process(self, data: Dict[str, Any]) -> Dict[str, Any]:
        file_name = data.get("file_name", "uploaded_resume.pdf")
        logger.info(f"[TextExtractionStage] Extracting text from document '{file_name}'...")

        # --- Pipeline Placeholder ---
        # 1. Parse PDF / DOCX bytes using PyPDF, pdfplumber, or docx2txt
        # 2. Extract raw text stream
        raw_text = data.get("raw_text", "Sample extracted raw resume text content.")
        data["raw_text"] = raw_text
        return data


class TextCleaningStage(PipelineStage):
    """
    Stage 2: Cleans, normalizes, and removes noise/formatting artifacts from raw text.
    """

    async def process(self, data: Dict[str, Any]) -> Dict[str, Any]:
        raw_text = data.get("raw_text", "")
        logger.info(f"[TextCleaningStage] Cleaning and normalizing text ({len(raw_text)} chars)...")

        # --- Pipeline Placeholder ---
        # 1. Strip non-printable characters & unicode noise
        # 2. Normalize whitespace, line breaks, and headers
        cleaned_text = raw_text.strip()
        data["cleaned_text"] = cleaned_text
        return data


class TextChunkingStage(PipelineStage):
    """
    Stage 3: Splits cleaned text into semantic chunks optimal for LLM RAG context.
    """

    async def process(self, data: Dict[str, Any]) -> Dict[str, Any]:
        cleaned_text = data.get("cleaned_text", "")
        logger.info(f"[TextChunkingStage] Chunking cleaned text into semantic sections...")

        # --- Pipeline Placeholder ---
        # 1. Split by semantic headers (Experience, Education, Skills) or chunk size
        # 2. Generate list of text_chunks
        chunks = data.get("text_chunks")
        if not chunks:
            chunks = [
                cleaned_text[i : i + 500] for i in range(0, max(1, len(cleaned_text)), 500)
            ]
        data["text_chunks"] = chunks
        return data


class VectorEmbeddingStage(PipelineStage):
    """
    Stage 4: Generates vector embeddings for chunks and stores them into pgvector.
    """

    async def process(self, data: Dict[str, Any]) -> Dict[str, Any]:
        user_id = data.get("user_id", "anonymous")
        chunks = data.get("text_chunks", [])
        logger.info(f"[VectorEmbeddingStage] Embedding {len(chunks)} chunks for user '{user_id}' into pgvector...")

        # --- Pipeline Placeholder ---
        # Delegate embedding & storage to VectorStoreManager
        # from services.vector_service import VectorStoreManager
        # vector_service = VectorStoreManager()
        # await vector_service.embed_and_store_resume(user_id=user_id, text_chunks=chunks)

        data["embedded"] = True
        data["chunks_processed"] = len(chunks)
        return data


class ResumePipeline:
    """
    Coordinator class holding an ordered sequence of PipelineStages and executing them sequentially.
    """

    def __init__(self, stages: List[PipelineStage] = None):
        if stages is None:
            # Default sequence of processing stages
            self.stages: List[PipelineStage] = [
                TextExtractionStage(),
                TextCleaningStage(),
                TextChunkingStage(),
                VectorEmbeddingStage(),
            ]
        else:
            self.stages = stages

    async def execute(self, initial_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes all pipeline stages sequentially, passing the output dictionary of
        each stage as the input dictionary to the next.
        """
        logger.info(f"Starting ResumePipeline execution with {len(self.stages)} stages...")
        current_data = initial_data

        for stage in self.stages:
            stage_name = stage.__class__.__name__
            logger.info(f"Executing stage: {stage_name}")
            current_data = await stage.process(current_data)

        logger.info("ResumePipeline execution completed successfully.")
        return current_data

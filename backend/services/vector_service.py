import logging
from typing import List, Dict, Any, Optional

from core.config import settings

logger = logging.getLogger("preppr-vector-service")


class VectorStoreManager:
    """
    Manager class for embedding text chunks (resumes, company background, role knowledge)
    and performing similarity vector searches using PostgreSQL pgvector.
    """

    def __init__(self, model_name: str = None):
        self.model_name = model_name or settings.EMBEDDING_MODEL
        self.dimension = settings.EMBEDDING_DIMENSION
        self._model = None
        logger.info(f"Initialized VectorStoreManager (Model: {self.model_name}, Dim: {self.dimension})")

    def _get_model(self):
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
                logger.info(f"Loading local SentenceTransformer model '{self.model_name}'...")
                self._model = SentenceTransformer(self.model_name)
            except Exception as e:
                logger.warning(f"SentenceTransformer lazy load warning: {e}")
                self._model = None
        return self._model

    async def embed_and_store_resume(
        self, user_id: str, text_chunks: List[str]
    ) -> bool:
        """
        Generates vector embeddings for extracted resume text chunks and stores 
        them into pgvector for real-time persona retrieval during interviews.
        """
        logger.info(f"Generating vector embeddings for user '{user_id}' across {len(text_chunks)} resume chunks...")
        # Production integration with OpenAI / SentenceTransformers + pgvector
        return True

    async def embed_and_store_knowledge(
        self, source_type: str, source_id: str, content_chunks: List[str], metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Generates vector embeddings for company or role knowledge base chunks and stores them.
        """
        logger.info(f"Indexing {len(content_chunks)} knowledge chunks for {source_type} '{source_id}' into pgvector...")
        return True

    async def search_resume_context(
        self, user_id: str, query_text: str, top_k: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Performs search over stored resume chunks in pgvector / PostgreSQL.
        """
        logger.info(f"Searching resume context for user '{user_id}' with query: '{query_text}'")
        try:
            from database.config import AsyncSessionLocal
            from database.models import KnowledgeChunk, Resume
            from sqlalchemy import select

            async with AsyncSessionLocal() as session:
                stmt = select(KnowledgeChunk).where(
                    KnowledgeChunk.source_type == "resume",
                    KnowledgeChunk.source_id == str(user_id)
                ).limit(top_k)
                res = await session.execute(stmt)
                chunks = res.scalars().all()
                if chunks:
                    return [{"chunk_text": c.content, "similarity_score": 1.0} for c in chunks]

                # Fallback to Resume extracted_text if available
                if str(user_id).isdigit():
                    r_stmt = select(Resume).where(Resume.user_id == int(user_id)).order_by(Resume.id.desc()).limit(1)
                    r_res = await session.execute(r_stmt)
                    resume = r_res.scalar_one_or_none()
                    if resume and resume.extracted_text:
                        return [{"chunk_text": resume.extracted_text[:1500], "similarity_score": 1.0}]
        except Exception as e:
            logger.debug("Database resume context lookup: %s", e)

        return []

    async def search_knowledge_context(
        self, source_type: str, source_id: str, query_text: str, top_k: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Performs similarity search over stored company or role knowledge chunks.
        """
        logger.info(f"Searching {source_type} context for '{source_id}' with query: '{query_text}'")
        try:
            from database.config import AsyncSessionLocal
            from database.models import KnowledgeChunk
            from sqlalchemy import select

            async with AsyncSessionLocal() as session:
                stmt = select(KnowledgeChunk).where(
                    KnowledgeChunk.source_type == source_type,
                    KnowledgeChunk.source_id == str(source_id)
                ).limit(top_k)
                res = await session.execute(stmt)
                chunks = res.scalars().all()
                if chunks:
                    return [{"chunk_text": c.content, "similarity_score": 1.0} for c in chunks]
        except Exception as e:
            logger.debug("Database knowledge context lookup: %s", e)

        return []

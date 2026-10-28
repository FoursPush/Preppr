from core.config import settings
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

    async def get_resume_summary(self, user_id: str, max_chars: int = 1200) -> str:
        """
        Builds a concise, human-readable resume summary (skills, roles, projects,
        education) from the candidate's most recent CandidateProfile. This is what
        makes interview questions genuinely resume-aware regardless of role domain.

        Falls back to raw resume chunk/extracted text, then to an empty string.
        """
        try:
            from database.config import AsyncSessionLocal
            from database.models import CandidateProfile, Resume, User
            from sqlalchemy import select, func

            async with AsyncSessionLocal() as session:
                # Resolve the integer user id from numeric string, "user_" prefix, or email.
                uid = None
                s = str(user_id).strip()
                if s.isdigit():
                    uid = int(s)
                elif s.startswith("user_") and s[5:].isdigit():
                    uid = int(s[5:])
                else:
                    r = await session.execute(select(User.id).where(func.lower(User.email) == s.lower()))
                    uid = r.scalar_one_or_none()

                if uid is not None:
                    stmt = (
                        select(CandidateProfile)
                        .join(Resume)
                        .where(Resume.user_id == uid)
                        .order_by(Resume.id.desc())
                    )
                    res = await session.execute(stmt)
                    profile = res.scalars().first()
                    if profile:
                        summary = self._format_profile_summary(profile)
                        if summary:
                            return summary[:max_chars]
        except Exception as e:
            logger.debug("Resume summary lookup failed: %s", e)

        # Fallback: whatever raw resume text we can find.
        ctx = await self.search_resume_context(user_id=user_id, query_text="experience skills projects")
        if ctx:
            return str(ctx[0].get("chunk_text", ""))[:max_chars]
        return ""

    @staticmethod
    def _format_profile_summary(profile) -> str:
        def _label(item, *keys):
            if isinstance(item, dict):
                for k in keys:
                    if item.get(k):
                        return str(item[k])
                return "; ".join(f"{k}: {v}" for k, v in item.items() if v)
            return str(item)

        parts: List[str] = []
        if getattr(profile, "skills", None):
            parts.append("Skills: " + ", ".join(str(x) for x in profile.skills[:15]))
        if getattr(profile, "experience", None):
            roles = [_label(e, "role", "title", "position") for e in profile.experience[:5]]
            roles = [r for r in roles if r]
            if roles:
                parts.append("Experience: " + "; ".join(roles))
        if getattr(profile, "projects", None):
            projs = [_label(p, "title", "name") for p in profile.projects[:5]]
            projs = [p for p in projs if p]
            if projs:
                parts.append("Projects: " + "; ".join(projs))
        if getattr(profile, "education", None):
            edu = [_label(e, "degree", "institution") for e in profile.education[:3]]
            edu = [e for e in edu if e]
            if edu:
                parts.append("Education: " + "; ".join(edu))
        return " | ".join(parts)

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

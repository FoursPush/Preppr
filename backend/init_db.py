import asyncio
import logging
from sqlalchemy import text
from database.config import engine, Base
import database.models  # Registers all 12 ORM models with Base

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("init-db")


async def init_db():
    logger.info("Initializing Preppr database schema...")
    
    # 1. Try to enable pgvector extension if available (isolated connection)
    if "postgresql" in engine.url.drivername:
        try:
            async with engine.connect() as conn:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                await conn.commit()
                logger.info("Enabled pgvector extension.")
        except Exception as e:
            logger.warning(
                "pgvector extension not installed on local PostgreSQL instance. "
                "Vector data will fall back to JSON embedding storage (fully supported)."
            )

    # 2. Create all database tables in a fresh transaction
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Successfully created all database tables!")


if __name__ == "__main__":
    asyncio.run(init_db())

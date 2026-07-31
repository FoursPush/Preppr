import os
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

# Read DATABASE_URL from environment variable with async PostgreSQL default
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/preppr"
)

# Create SQLAlchemy Async Engine
engine = create_async_engine(
    DATABASE_URL,
    echo=os.getenv("SQL_ECHO", "false").lower() == "true",
    future=True,
)

# Async Session Factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Declarative Base Model
class Base(DeclarativeBase):
    pass

# FastAPI Dependency for Database Sessions
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

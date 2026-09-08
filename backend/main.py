import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from sqlalchemy import text

from database.config import engine, Base
import database.models  # Register all ORM models with Base
from core.container import container
from middleware.error_handler import (
    PrepprException,
    preppr_exception_handler,
    RequestLoggingMiddleware,
)
from routers import (
    auth,
    resumes,
    resume,
    companies,
    roles,
    interviews,
    reports,
    analytics,
    dashboard,
)

# Load environment variables from .env file if present
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("preppr-main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI Lifespan Context Manager handling application startup and shutdown lifecycle.
    """
    logger.info("Initializing Preppr API platform services...")
    
    # 1. Initialize & synchronize PostgreSQL schema
    try:
        if "postgresql" in engine.url.drivername:
            try:
                async with engine.connect() as conn:
                    await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                    await conn.commit()
            except Exception as ext_err:
                logger.warning(f"Vector extension note: {ext_err}")

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
            # Ensure users table columns exist for existing databases
            try:
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(255) DEFAULT 'Software Engineer';"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS experience_level VARCHAR(100);"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(50);"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(1024);"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);"))
                logger.info("PostgreSQL database tables and columns synchronized.")
            except Exception as col_err:
                logger.warning(f"Column synchronization note: {col_err}")

    except Exception as db_init_err:
        logger.error(f"PostgreSQL initialization failed on startup: {db_init_err}", exc_info=True)

    container.initialize()
    yield
    logger.info("Shutting down Preppr API platform services...")
    container.shutdown()


app = FastAPI(
    title="Preppr API",
    description="Backend for Preppr - AI-Powered Real-Time Voice & Text Interview Trainer & Analytics Platform",
    version="0.2.0",
    lifespan=lifespan,
)

# Custom Request Logging & Processing Latency Middleware
app.add_middleware(RequestLoggingMiddleware)

# Configure CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "*"],  # Explicitly allow Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Preppr Exception Handler
app.add_exception_handler(PrepprException, preppr_exception_handler)

# Include Routers
app.include_router(auth.router)
app.include_router(resumes.router)
app.include_router(resume.router)
app.include_router(companies.router)
app.include_router(roles.router)
app.include_router(interviews.router)
app.include_router(reports.router)
app.include_router(analytics.router)
app.include_router(dashboard.router)


@app.get("/", tags=["General"])
async def root():
    return {
        "name": "Preppr API",
        "status": "running",
        "version": "0.2.0"
    }


@app.get("/health", tags=["General"])
async def health_check():
    return {
        "status": "ok",
        "container_initialized": container._is_initialized
    }

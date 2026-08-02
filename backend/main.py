import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from middleware.error_handler import (
    PrepprException,
    preppr_exception_handler,
    RequestLoggingMiddleware,
)
from routers import auth, analytics, resumes, dashboard

# Load environment variables from .env file if present
load_dotenv()

app = FastAPI(
    title="Preppr API",
    description="Backend for Preppr - AI-Powered Real-Time Voice Interview Trainer & Analytics Platform",
    version="0.1.0"
)

# Custom Request Logging & Processing Latency Middleware
app.add_middleware(RequestLoggingMiddleware)

# Configure CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Preppr Exception Handler
app.add_exception_handler(PrepprException, preppr_exception_handler)

# Include Routers
app.include_router(auth.router)
app.include_router(analytics.router)
app.include_router(resumes.router)
app.include_router(dashboard.router)

@app.get("/", tags=["General"])
async def root():
    return {
        "name": "Preppr API",
        "status": "running",
        "version": "0.1.0"
    }

@app.get("/health", tags=["General"])
async def health_check():
    return {"status": "ok"}

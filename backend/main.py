from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Preppr API",
    description="Backend for Preppr - AI-Powered Voice Interview Platform",
    version="0.1.0"
)

# Configure CORS so the frontend can talk to the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins, we can restrict this later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Welcome to the Preppr API!"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

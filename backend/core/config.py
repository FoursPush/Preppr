import os
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Centralized configuration management for Preppr local-first architecture.
    All defaults run 100% locally with zero paid API dependencies.
    """

    # Local Ollama LLM Configuration
    OPENAI_BASE_URL: str = Field(
        default="http://localhost:11434/v1",
        description="Local Ollama OpenAI-compatible server URL"
    )
    OPENAI_API_KEY: str = Field(
        default="ollama",
        description="Dummy API key for local Ollama server"
    )
    MODEL_NAME: str = Field(
        default="qwen2.5:7b",
        description="Local LLM model name served by Ollama (e.g. qwen2.5:7b or llama3.2)"
    )

    # Local HuggingFace Embedding Configuration
    EMBEDDING_MODEL: str = Field(
        default="BAAI/bge-small-en-v1.5",
        description="Open-source HuggingFace sentence-transformers model"
    )
    EMBEDDING_DIMENSION: int = Field(
        default=384,
        description="Vector dimension output of bge-small-en-v1.5 model"
    )

    # Speech-to-Text (Whisper v3 Large) Configuration
    STT_PROVIDER: str = Field(
        default="whisper",
        description="STT provider (whisper, deepgram)"
    )
    WHISPER_MODEL: str = Field(
        default="whisper-large-v3",
        description="Whisper model version (whisper-large-v3, openai/whisper-large-v3, large-v3, base)"
    )
    WHISPER_DEVICE: str = Field(
        default="cpu",
        description="Device for local Whisper inference (cpu, cuda)"
    )
    WHISPER_COMPUTE_TYPE: str = Field(
        default="int8",
        description="Quantization compute type (int8, float32, float16)"
    )

    # Text-to-Speech (TTS) Configuration
    TTS_PROVIDER: str = Field(
        default="openai",
        description="TTS provider (openai, cartesia, kokoro)"
    )
    TTS_MODEL: str = Field(
        default="tts-1-hd",
        description="TTS model name (tts-1-hd, tts-1, sonic-english)"
    )
    TTS_VOICE: str = Field(
        default="alloy",
        description="TTS voice identifier (alloy, echo, fable, onyx, nova, shimmer)"
    )

    # Database Configuration
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/preppr",
        description="PostgreSQL async database URL with pgvector"
    )
    SQL_ECHO: bool = Field(default=False)

    # LiveKit Connection Credentials
    LIVEKIT_URL: str = Field(default="wss://your-livekit-domain.livekit.cloud")
    LIVEKIT_API_KEY: str = Field(default="devkey")
    LIVEKIT_API_SECRET: str = Field(default="secret")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

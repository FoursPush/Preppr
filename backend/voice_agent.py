import os
import numpy as np
from dotenv import load_dotenv

# Load environment variables from .env immediately before importing LiveKit
load_dotenv()

import logging
import asyncio
from typing import Any
from livekit import agents
from livekit.agents import (
    JobContext,
    WorkerOptions,
    cli,
    voice,
)

from pipelines.voice_pipeline import (
    VoicePipeline,
    VoiceSessionContext,
)
from workers.analytics_worker import BackgroundAnalyticsProcessor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("preppr-voice-agent")


async def entrypoint(ctx: JobContext):
    logger.info(f"Connecting to LiveKit room: {ctx.room.name}")
    await ctx.connect()

    # 1. Initialize Voice Pipeline and Session Context
    pipeline = VoicePipeline()
    await pipeline.initialize()

    room_sid = ctx.room.sid or "unknown"
    session_id = ctx.room.name or f"session_{room_sid[:8]}"

    session_context = VoiceSessionContext(
        session_id=session_id,
        user_id="candidate_user",
        target_role="Senior Software Engineer",
        target_company="Target Tech",
    )

    # 2. Fetch and Inject RAG Resume Context into System Prompt
    await pipeline.llm_stage.inject_rag_context(session_context)

    # 3. Create Voice Agent configured with STT (Deepgram), LLM (OpenAI), TTS (Cartesia), & VAD (Silero)
    agent = pipeline.create_livekit_agent(session_context)

    # 4. Attach event listeners for real-time transcript & telemetry logging
    @agent.on("user_speech_committed")
    def on_user_speech(msg: Any):
        user_text = getattr(msg, "text", getattr(msg, "content", str(msg)))
        logger.info(f"[User Speech] {user_text}")
        turn_result = pipeline.stt_stage.analyze_transcript(user_text)
        session_context.turns.append(turn_result)
        metrics = session_context.aggregate_metrics()
        logger.info(
            f"Live Telemetry - Turns: {metrics['user_turns']}, "
            f"WPM: {metrics['average_wpm']}, Fillers: {metrics['total_filler_words']}"
        )

    @agent.on("agent_speech_started")
    def on_agent_speech():
        logger.info("[Agent Speech] Preppr AI speech turn started.")

    # 5. Start agent session in connected LiveKit WebRTC room
    session = agent.start(ctx.room)


    # 6. Session completion callback to trigger post-interview analytics worker
    async def cleanup_analytics():
        metrics = session_context.aggregate_metrics()
        logger.info(f"Session finished for '{session_context.session_id}'. Triggering post-interview analytics...")
        analytics_worker = BackgroundAnalyticsProcessor()
        await analytics_worker.process_post_interview_metrics(
            session_id=session_context.session_id,
            raw_audio_metadata={
                "total_words": metrics["total_words"],
                "average_wpm": metrics["average_wpm"],
                "total_filler_words": metrics["total_filler_words"],
                "duration_seconds": max(30.0, sum(t.duration_seconds for t in session_context.turns)),
                "acoustic_stress_score": metrics["average_stress_score"],
            },
        )

    ctx.add_shutdown_callback(cleanup_analytics)


if __name__ == "__main__":
    ws_url = os.getenv("LIVEKIT_URL", "ws://127.0.0.1:7880")
    api_key = os.getenv("LIVEKIT_API_KEY", "devkey")
    api_secret = os.getenv("LIVEKIT_API_SECRET", "secret")

    agents.cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            ws_url=ws_url,
            api_key=api_key,
            api_secret=api_secret,
        )
    )


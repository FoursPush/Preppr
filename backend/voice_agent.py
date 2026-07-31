import logging
import os
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import (
    AgentServer,
    JobContext,
    WorkerOptions,
    cli,
    voice,
)
from livekit.plugins import cartesia, deepgram, openai, silero

# Load environment variables from .env
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("preppr-voice-agent")

PROMPT = (
    "You are an advanced, empathetic technical interviewer named Preppr. "
    "Ask focused questions one at a time, wait for replies, and keep your responses under two sentences."
)

server = AgentServer()

@server.rtc_session()
async def entrypoint(ctx: JobContext):
    logger.info(f"Connecting to LiveKit room: {ctx.room.name}")
    await ctx.connect()

    # Initialize the Voice Agent pipeline with Deepgram (STT), OpenAI (LLM), Cartesia (TTS), and Silero (VAD)
    agent = voice.Agent(
        instructions=PROMPT,
        stt=deepgram.STT(),
        llm=openai.LLM(model="gpt-4o-mini"),
        tts=cartesia.TTS(),
        vad=silero.VAD.load(),
    )

    # Start agent session in the connected room
    session = agent.start(ctx.room)

    # Initial greeting to start the interview session
    await session.say(
        "Hello! I am Preppr, your AI technical interviewer today. Are you ready to get started?",
        allow_interruptions=True,
    )

if __name__ == "__main__":
    agents.cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))

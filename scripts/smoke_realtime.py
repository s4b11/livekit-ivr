"""Live check of the configured Gemini Live model, through the same plugin code the agent uses.

Opens a real realtime session with the agent's model, voice, prompt, and
transcription settings, then runs two turns: the greeting the agent speaks when
a call connects, and an answer to a question about Sabith. Passes when every turn
returns audio plus an English transcript that does not try to invent a phone number.

Needs GOOGLE_API_KEY. Run by the deploy workflow before the agent is deployed:

    uv run python scripts/smoke_realtime.py
"""

import asyncio
import re
import sys

from livekit.agents import llm

from voice_assistant.agent.prompts import INSTRUCTIONS, build_greeting_instructions
from voice_assistant.agent.realtime import build_realtime_model
from voice_assistant.config import get_settings
from voice_assistant.profile import PROFILE

TURN_TIMEOUT = 45  # seconds

# Any letter outside Latin script, once the owner's name is removed, means a non-English reply.
NON_LATIN = re.compile(r"[^\W\d_]", re.UNICODE)


def non_english_letters(text: str) -> list[str]:
    text = text.replace(PROFILE.spoken_name, "").replace(PROFILE.spoken_first_name, "")
    return [ch for ch in NON_LATIN.findall(text) if ord(ch) > 0x024F]


async def run_turn(session: llm.RealtimeSession, instructions: str) -> tuple[str, float]:
    """Ask for one reply; return its transcript and seconds of audio."""
    event = await asyncio.wait_for(session.generate_reply(instructions=instructions), TURN_TIMEOUT)
    transcript, audio_seconds = [], 0.0

    async def read_text(stream):
        async for chunk in stream:
            transcript.append(str(chunk))

    async def read_audio(stream):
        nonlocal audio_seconds
        async for frame in stream:
            audio_seconds += frame.samples_per_channel / frame.sample_rate

    async def read_all():
        async for message in event.message_stream:
            await asyncio.gather(read_text(message.text_stream), read_audio(message.audio_stream))

    await asyncio.wait_for(read_all(), TURN_TIMEOUT)
    return "".join(transcript).strip(), audio_seconds


async def main() -> int:
    settings = get_settings()
    model = build_realtime_model(settings)
    print(f"model: {model.model} ({model.provider}), voice: {settings.gemini_voice}")

    session = model.session()
    failures: list[str] = []
    try:
        await session.update_instructions(INSTRUCTIONS)
        turns = [
            ("greeting", build_greeting_instructions()),
            (
                "question",
                'The caller asks: "Who is Sabith, and what is his phone number?" Answer them now.',
            ),
        ]
        for name, instructions in turns:
            text, seconds = await run_turn(session, instructions)
            print(f"\n[{name}] {seconds:.1f}s of audio\n{text}")
            if seconds < 0.5:
                failures.append(f"{name}: no audio returned")
            if not text:
                failures.append(f"{name}: no transcript returned")
            if strays := non_english_letters(text):
                failures.append(f"{name}: non-English text {''.join(strays)!r}")
            if re.search(r"\+?\d[\d\s-]{8,}\d", text):
                failures.append(f"{name}: reply contains something like a phone number")
    except Exception as exc:  # connection, auth, unknown model, timeouts
        failures.append(f"session error: {type(exc).__name__}: {exc}")
    finally:
        await session.aclose()

    if failures:
        print("\nFAILED:\n- " + "\n- ".join(failures), file=sys.stderr)
        return 1
    print("\nOK")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

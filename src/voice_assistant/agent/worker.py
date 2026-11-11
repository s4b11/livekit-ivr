"""LiveKit agent worker.

Run locally against LiveKit Cloud:
    uv run python -m voice_assistant.agent.worker dev

The worker registers under `AGENT_NAME` (default "sabith-assistant") and is
dispatched explicitly: by the SIP dispatch rule for phone calls, and by the
access token's room configuration for web and embedded sessions. After every
conversation the transcript is posted to the storage API (the Cloudflare Worker
in web/), when one is configured.
"""

import json
import logging
import pathlib

import httpx
from dotenv import load_dotenv

load_dotenv(".env.local")
load_dotenv(".env")

from livekit import agents, rtc  # noqa: E402
from livekit.agents import AgentServer, AgentSession, JobContext  # noqa: E402

from voice_assistant.agent.assistant import PersonalAssistant, backend_headers  # noqa: E402
from voice_assistant.agent.prompts import build_greeting_instructions  # noqa: E402
from voice_assistant.agent.realtime import build_realtime_model  # noqa: E402
from voice_assistant.agent.transcript import build_ingest_payload  # noqa: E402
from voice_assistant.config import get_settings  # noqa: E402

logger = logging.getLogger("voice_assistant.worker")

settings = get_settings()
server = AgentServer()

FALLBACK_DIR = pathlib.Path("transcripts_fallback")


def extract_call_meta(participant: rtc.RemoteParticipant) -> dict:
    """Describe who the assistant is talking to: a SIP caller or a web visitor."""
    if participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP:
        attrs = participant.attributes
        return {
            "channel": "phone",
            "caller_number": attrs.get("sip.phoneNumber", "unknown"),
            "called_number": attrs.get("sip.trunkPhoneNumber", ""),
            "sip_call_id": attrs.get("sip.callID", ""),
        }
    return {
        "channel": "web",
        "caller_number": participant.identity or "unknown",
        "called_number": "",
        "sip_call_id": "",
    }


async def on_session_end(ctx: JobContext) -> None:
    """Store the finished conversation's transcript through the storage API."""
    if not settings.backend_base_url:
        logger.info("no backend configured - transcript not stored")
        return

    report = ctx.make_session_report()
    meta = ctx.proc.userdata.get("call_meta") or {}
    payload = build_ingest_payload(
        room_name=ctx.room.name,
        agent_name=settings.agent_name,
        chat_history=report.chat_history.to_dict(exclude_timestamp=False),
        channel=meta.get("channel", "unknown"),
        caller_number=meta.get("caller_number", "unknown"),
        called_number=meta.get("called_number", ""),
        sip_call_id=meta.get("sip_call_id", ""),
        started_at=report.started_at,
        duration=report.duration,
        report=report.to_dict(),
    )
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{settings.backend_base_url}/api/v1/calls/ingest",
                json=payload,
                headers=backend_headers(settings.backend_api_key),
            )
            resp.raise_for_status()
        logger.info(
            "transcript stored", extra={"call_id": resp.json().get("id"), "room": ctx.room.name}
        )
    except Exception:
        logger.exception("failed to store transcript for %s - dumping locally", ctx.room.name)
        FALLBACK_DIR.mkdir(exist_ok=True)
        (FALLBACK_DIR / f"{ctx.room.name}.json").write_text(
            json.dumps(payload, indent=2, default=str), encoding="utf-8"
        )


@server.rtc_session(agent_name=settings.agent_name, on_session_end=on_session_end)
async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()

    participant = await ctx.wait_for_participant()
    meta = extract_call_meta(participant)
    ctx.proc.userdata["call_meta"] = meta
    logger.info("conversation started", extra={"participant": participant.identity, **meta})

    session = AgentSession(llm=build_realtime_model(settings))
    await session.start(room=ctx.room, agent=PersonalAssistant())
    await session.generate_reply(instructions=build_greeting_instructions())


if __name__ == "__main__":
    agents.cli.run_app(server)

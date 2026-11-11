"""The assistant agent: persona plus the tools it can use mid-conversation."""

import logging

import httpx
from livekit import api
from livekit.agents import Agent, RunContext, function_tool, get_job_context

from voice_assistant.agent.prompts import INSTRUCTIONS
from voice_assistant.config import get_settings

logger = logging.getLogger("voice_assistant.agent")

MESSAGE_RECORDED = "The message has been recorded. Sabith will get back to them soon."


def backend_headers(api_key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {api_key}"} if api_key else {}


def _current_room_name() -> str:
    try:
        return get_job_context().room.name
    except Exception:
        return ""  # outside a job, e.g. in tests


class PersonalAssistant(Agent):
    def __init__(self) -> None:
        super().__init__(instructions=INSTRUCTIONS)

    @function_tool
    async def take_message(
        self,
        context: RunContext,
        caller_name: str,
        contact: str,
        message: str,
    ) -> str:
        """Record a message for Sabith once you have the person's name, their
        phone number or email address, and what the message is about.

        Args:
            caller_name: The person's name.
            contact: The person's phone number or email address.
            message: What the person wants Sabith to know or do.
        """
        settings = get_settings()
        payload = {
            "room_name": _current_room_name(),
            "caller_name": caller_name,
            "contact": contact,
            "message": message,
        }
        if not settings.backend_base_url:
            # No API service configured: the worker log is the record.
            logger.warning("message taken (no backend configured): %s", payload)
            return MESSAGE_RECORDED
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    f"{settings.backend_base_url}/api/v1/messages",
                    json=payload,
                    headers=backend_headers(settings.backend_api_key),
                )
                resp.raise_for_status()
            logger.info("message stored", extra={"room": payload["room_name"]})
            return MESSAGE_RECORDED
        except Exception:
            # Keep the message recoverable from the log, and be honest with the caller.
            logger.exception("failed to store message: %s", payload)
            return (
                "The message could not be saved right now. Apologise, and suggest "
                "they email Sabith directly so nothing is lost."
            )

    @function_tool
    async def end_call(self, context: RunContext) -> str:
        """End the conversation. Only use this after you have said goodbye
        and the person has nothing else to ask."""
        try:
            await context.wait_for_playout()  # let the goodbye finish playing
        except Exception:
            pass
        try:
            job_ctx = get_job_context()
            await job_ctx.api.room.delete_room(api.DeleteRoomRequest(room=job_ctx.room.name))
        except Exception:
            logger.info("end_call invoked outside of a job context")
        return "call ended"

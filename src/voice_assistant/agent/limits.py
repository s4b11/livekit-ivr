"""Anti-spam limits: a maximum conversation length, and a daily allowance per caller.

The daily allowance for web visitors is enforced by the Worker when it issues a
token. Phone calls never pass through the Worker, so the agent claims the caller's
slot itself when the call connects.
"""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

import httpx

from voice_assistant.config import Settings

logger = logging.getLogger("voice_assistant.limits")

LIMIT_REACHED_INSTRUCTIONS = (
    "The caller has already used today's conversations with this assistant. In one or two "
    "short sentences, apologise, say they can call again tomorrow or email Sabith at "
    "saabith dot s b at gmail dot com, and say goodbye. Do not answer other questions."
)

WRAP_UP_INSTRUCTIONS = (
    "The conversation has reached its time limit and must end now. In one short sentence, "
    "thank them, say Sabith can be emailed for anything else, and say goodbye."
)


@dataclass(frozen=True)
class Claim:
    allowed: bool
    count: int = 0
    limit: int = 0


async def claim_phone_session(
    settings: Settings, caller: str, client: httpx.AsyncClient | None = None
) -> Claim:
    """Count this call against the caller's daily allowance.

    Fails open: if no storage API is configured or it cannot be reached, the call goes
    ahead, because refusing a real caller is worse than letting one extra call through.
    """
    if not settings.backend_base_url or not caller or caller == "unknown":
        return Claim(allowed=True)
    headers = (
        {"Authorization": f"Bearer {settings.backend_api_key}"} if settings.backend_api_key else {}
    )
    try:
        async with client or httpx.AsyncClient(timeout=5) as http:
            resp = await http.post(
                f"{settings.backend_base_url}/api/v1/sessions/claim",
                json={"caller": caller},
                headers=headers,
            )
            resp.raise_for_status()
            body = resp.json()
        return Claim(allowed=bool(body["allowed"]), count=body["count"], limit=body["limit"])
    except Exception:
        logger.exception("session claim failed - allowing the call")
        return Claim(allowed=True)


async def enforce_time_limit(
    *,
    max_seconds: float,
    wrap_up_seconds: float,
    say_goodbye: Callable[[], Awaitable[object]],
    end_session: Callable[[], Awaitable[object]],
) -> None:
    """Let the conversation run, ask for a goodbye near the limit, then end it.

    The goodbye gets at most `wrap_up_seconds`; the session ends at `max_seconds`
    whether or not it has finished.
    """
    wrap_up_at = max(0.0, max_seconds - wrap_up_seconds)
    await asyncio.sleep(wrap_up_at)
    logger.info("time limit approaching - wrapping up")
    try:
        await asyncio.wait_for(say_goodbye(), timeout=max_seconds - wrap_up_at)
    except Exception:
        logger.info("goodbye did not finish before the limit")
    await end_session()

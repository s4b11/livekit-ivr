"""Conversation time limit and the phone daily allowance."""

import asyncio
import json

import httpx

from voice_assistant.agent.limits import claim_phone_session, enforce_time_limit
from voice_assistant.config import Settings


def _settings(**overrides) -> Settings:
    values = {"backend_base_url": "https://worker.test", "backend_api_key": "k"}
    values.update(overrides)
    return Settings(_env_file=None, **values)


def _client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


async def test_time_limit_says_goodbye_then_ends():
    events: list[str] = []

    async def goodbye():
        events.append("goodbye")

    async def end():
        events.append("end")

    await enforce_time_limit(
        max_seconds=0.05, wrap_up_seconds=0.02, say_goodbye=goodbye, end_session=end
    )
    assert events == ["goodbye", "end"]


async def test_time_limit_ends_even_if_goodbye_overruns():
    ended = asyncio.Event()

    async def slow_goodbye():
        await asyncio.sleep(10)

    async def end():
        ended.set()

    await asyncio.wait_for(
        enforce_time_limit(
            max_seconds=0.05, wrap_up_seconds=0.03, say_goodbye=slow_goodbye, end_session=end
        ),
        timeout=1,
    )
    assert ended.is_set()


async def test_phone_claim_posts_caller_with_auth():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers.get("authorization")
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"allowed": False, "count": 3, "limit": 2})

    claim = await claim_phone_session(_settings(), "+15550001111", client=_client(handler))
    assert not claim.allowed and claim.count == 3
    assert seen == {
        "url": "https://worker.test/api/v1/sessions/claim",
        "auth": "Bearer k",
        "body": {"caller": "+15550001111"},
    }


async def test_phone_claim_fails_open():
    def broken(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    assert (await claim_phone_session(_settings(), "+1555", client=_client(broken))).allowed
    # No storage configured, or no caller ID: nothing to count against.
    assert (await claim_phone_session(_settings(backend_base_url=""), "+1555")).allowed
    assert (await claim_phone_session(_settings(), "unknown")).allowed


def test_default_limits():
    s = Settings(_env_file=None)
    assert s.max_session_seconds == 90
    assert 0 < s.session_wrap_up_seconds < s.max_session_seconds

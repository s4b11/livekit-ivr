"""Embed token endpoint: every web session gets a private room with the agent dispatched."""

import pytest
from livekit import api

from conftest import TEST_LIVEKIT_KEY, TEST_LIVEKIT_SECRET, make_settings, requires_postgres
from voice_assistant.api.app import create_app
from voice_assistant.api.tokens import create_embed_session


def _verify(token: str):
    return api.TokenVerifier(TEST_LIVEKIT_KEY, TEST_LIVEKIT_SECRET).verify(token)


def test_embed_session_grants_one_private_room_and_dispatches_agent():
    session = create_embed_session(make_settings(), participant_name="  Alice  ")
    claims = _verify(session.participant_token)

    assert session.server_url == "wss://test-project.livekit.cloud"
    assert session.room_name.startswith("web-")
    assert claims.identity == session.participant_identity
    assert claims.name == "Alice"
    assert claims.video.room_join is True
    assert claims.video.room == session.room_name
    assert [a.agent_name for a in claims.room_config.agents] == ["sabith-assistant"]


def test_embed_sessions_are_unique_per_request():
    first = create_embed_session(make_settings())
    second = create_embed_session(make_settings())
    assert first.room_name != second.room_name
    assert first.participant_identity != second.participant_identity
    assert _verify(first.participant_token).name == "Visitor"


@requires_postgres
async def test_token_endpoint_returns_standard_response(app_client):
    resp = await app_client.post("/api/v1/token", json={"participant_name": "Alice"})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["server_url"] == "wss://test-project.livekit.cloud"
    assert _verify(body["participant_token"]).video.room == body["room_name"]

    # The body is optional.
    assert (await app_client.post("/api/v1/token")).status_code == 201


@requires_postgres
async def test_token_endpoint_ignores_client_supplied_room(app_client):
    resp = await app_client.post("/api/v1/token", json={"room_name": "someone-elses-room"})
    assert resp.status_code == 201
    assert resp.json()["room_name"] != "someone-elses-room"


@requires_postgres
async def test_widget_assets_are_served(app_client):
    script = await app_client.get("/embed/embed.js")
    assert script.status_code == 200
    assert "/api/v1/token" in script.text
    assert (await app_client.get("/embed/")).status_code == 200


async def _client(settings):
    from httpx import ASGITransport, AsyncClient

    app = create_app(settings)
    return app, AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@requires_postgres
async def test_token_endpoint_unavailable_without_livekit_credentials():
    app, client = await _client(make_settings(livekit_api_key="", livekit_api_secret=""))
    async with app.router.lifespan_context(app), client:
        assert (await client.post("/api/v1/token")).status_code == 503


@requires_postgres
@pytest.mark.parametrize("path", ["/api/v1/calls", "/api/v1/messages"])
async def test_private_endpoints_require_api_key_when_configured(path):
    app, client = await _client(make_settings(backend_api_key="s3cret"))
    async with app.router.lifespan_context(app), client:
        assert (await client.get(path)).status_code == 401
        wrong = {"Authorization": "Bearer nope"}
        assert (await client.get(path, headers=wrong)).status_code == 401
        right = {"Authorization": "Bearer s3cret"}
        assert (await client.get(path, headers=right)).status_code == 200
        # Public endpoints stay open: browsers need them.
        assert (await client.post("/api/v1/token")).status_code == 201
        assert (await client.get("/health")).status_code == 200

"""FastAPI + PostgreSQL integration tests: ingest a call, retrieve transcript."""

import pytest

from conftest import requires_postgres

pytestmark = requires_postgres

SAMPLE_CALL = {
    "room_name": "call-_+15551234567_test1",
    "agent_name": "sabith-assistant",
    "channel": "phone",
    "caller_number": "+15551234567",
    "called_number": "+16505550100",
    "sip_call_id": "SCL_test123",
    "status": "completed",
    "started_at": "2026-07-21T10:00:00Z",
    "ended_at": "2026-07-21T10:02:05Z",
    "duration_seconds": 125.0,
    "items": [
        {
            "role": "assistant",
            "content": "Hello! You've reached Sabith's AI assistant. How can I help?",
        },
        {"role": "user", "content": "What does Sabith work on?"},
        {
            "role": "assistant",
            "content": "Sabith builds real-time voice AI agents and the backends behind them.",
            "interrupted": True,
        },
    ],
    "report": {"job_id": "job_123", "sdk_version": "1.6.6"},
}


async def test_health_reports_database_up(app_client):
    resp = await app_client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["database"] == "up"


async def test_ingest_call_persists_transcript(app_client):
    resp = await app_client.post("/api/v1/calls/ingest", json=SAMPLE_CALL)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["id"]
    assert body["caller_number"] == "+15551234567"
    assert body["channel"] == "phone"
    assert len(body["transcript_items"]) == 3
    assert body["transcript_items"][2]["interrupted"] is True


async def test_list_and_get_call_roundtrip(app_client):
    created = (await app_client.post("/api/v1/calls/ingest", json=SAMPLE_CALL)).json()

    listing = await app_client.get("/api/v1/calls")
    assert listing.status_code == 200
    assert any(c["id"] == created["id"] for c in listing.json())

    detail = await app_client.get(f"/api/v1/calls/{created['id']}")
    assert detail.status_code == 200
    items = detail.json()["transcript_items"]
    assert [i["role"] for i in items] == ["assistant", "user", "assistant"]
    assert items[0]["idx"] == 0
    assert detail.json()["duration_seconds"] == 125.0


async def test_get_missing_call_returns_404(app_client):
    resp = await app_client.get("/api/v1/calls/doesnotexist")
    assert resp.status_code == 404


async def test_caller_message_stored_and_linked_to_call(app_client):
    # The agent's take_message tool posts a message mid-call (before the call record exists).
    msg = {
        "room_name": SAMPLE_CALL["room_name"],
        "caller_name": "Alice",
        "contact": "alice@example.com",
        "message": "Please call me back about a voice agent project.",
    }
    resp = await app_client.post("/api/v1/messages", json=msg)
    assert resp.status_code == 201
    assert resp.json()["call_id"] is None

    # When the call ends, ingest links the orphan message to the call record.
    call = (await app_client.post("/api/v1/calls/ingest", json=SAMPLE_CALL)).json()

    messages = (await app_client.get("/api/v1/messages")).json()
    assert len(messages) == 1
    assert messages[0]["call_id"] == call["id"]
    assert messages[0]["caller_name"] == "Alice"


async def test_ingest_minimal_payload(app_client):
    resp = await app_client.post("/api/v1/calls/ingest", json={"room_name": "call-minimal"})
    assert resp.status_code == 201
    assert resp.json()["caller_number"] == "unknown"
    assert resp.json()["channel"] == "unknown"
    assert resp.json()["transcript_items"] == []


@pytest.mark.parametrize("payload", [{}, {"items": []}])
async def test_ingest_requires_room_name(app_client, payload):
    resp = await app_client.post("/api/v1/calls/ingest", json=payload)
    assert resp.status_code == 422

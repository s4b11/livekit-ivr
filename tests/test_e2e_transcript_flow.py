"""End-to-end wiring test: the exact payload the agent worker builds after a call
(build_ingest_payload) must be accepted by the API service and land in
PostgreSQL - the same path used by on_session_end in production.
"""

from conftest import requires_postgres
from test_transcript_parser import SAMPLE_HISTORY
from voice_assistant.agent.transcript import build_ingest_payload

pytestmark = requires_postgres


async def test_agent_payload_roundtrips_through_backend(app_client):
    payload = build_ingest_payload(
        room_name="call-_+15559876543_x7ab",
        agent_name="sabith-assistant",
        channel="phone",
        chat_history=SAMPLE_HISTORY,
        caller_number="+15559876543",
        called_number="+14849649535",
        sip_call_id="SCL_e2e",
        started_at=1784650000.0,
        duration=42.0,
        report={"job_id": "job_e2e", "sdk_version": "1.6.6"},
    )

    resp = await app_client.post("/api/v1/calls/ingest", json=payload)
    assert resp.status_code == 201, resp.text
    call_id = resp.json()["id"]

    detail = (await app_client.get(f"/api/v1/calls/{call_id}")).json()
    assert detail["caller_number"] == "+15559876543"
    assert detail["channel"] == "phone"
    assert detail["called_number"] == "+14849649535"
    assert detail["duration_seconds"] == 42.0
    assert detail["started_at"] is not None
    assert detail["ended_at"] is not None

    roles = [i["role"] for i in detail["transcript_items"]]
    assert roles == ["assistant", "user", "assistant", "tool_call", "tool_output"]
    assert detail["transcript_items"][2]["interrupted"] is True

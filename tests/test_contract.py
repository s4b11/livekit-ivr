"""Contract between the agent and the storage API (the Cloudflare Worker in web/).

`contract/ingest_payload.json` is exactly what the agent posts when a conversation
ends. This test pins the agent to it; the Worker's test suite posts the same file
to its ingest endpoint. If the payload changes, regenerate the fixture:

    uv run python tests/test_contract.py
"""

import json
from pathlib import Path

from test_transcript_parser import SAMPLE_HISTORY
from voice_assistant.agent.transcript import build_ingest_payload

FIXTURE = Path(__file__).parent.parent / "contract" / "ingest_payload.json"


def build_sample_payload() -> dict:
    return build_ingest_payload(
        room_name="call-_+15559876543_x7ab",
        agent_name="sabith-assistant",
        chat_history=SAMPLE_HISTORY,
        channel="phone",
        caller_number="+15559876543",
        called_number="+14849649535",
        sip_call_id="SCL_contract",
        started_at=1784650000.0,
        duration=42.0,
        report={"job_id": "job_contract", "sdk_version": "1.6.6"},
    )


def test_agent_payload_matches_contract_fixture():
    assert build_sample_payload() == json.loads(FIXTURE.read_text(encoding="utf-8"))


if __name__ == "__main__":
    FIXTURE.write_text(json.dumps(build_sample_payload(), indent=2) + "\n", encoding="utf-8")
    print(f"wrote {FIXTURE}")

"""Unit tests for the session-report -> ingest-payload parser (no I/O)."""

from voice_assistant.agent.transcript import build_ingest_payload, parse_chat_history

SAMPLE_HISTORY = {
    "items": [
        {"id": "1", "type": "message", "role": "system", "content": ["instructions"]},
        {
            "id": "2",
            "type": "message",
            "role": "assistant",
            "content": ["You've reached Sabith's AI assistant, how can I help?"],
            "interrupted": False,
            "created_at": 1784650000.0,
        },
        {
            "id": "3",
            "type": "message",
            "role": "user",
            "content": ["What does Sabith work on?"],
            "interrupted": False,
            "created_at": 1784650005.0,
        },
        {
            "id": "4",
            "type": "message",
            "role": "assistant",
            "content": ["Sabith builds real-time voice AI agents"],
            "interrupted": True,
            "created_at": 1784650010.0,
        },
        {
            "id": "5",
            "type": "function_call",
            "name": "take_message",
            "arguments": '{"caller_name": "Alice"}',
            "created_at": 1784650015.0,
        },
        {
            "id": "6",
            "type": "function_call_output",
            "output": "The message has been recorded.",
            "created_at": 1784650016.0,
        },
        {"id": "7", "type": "message", "role": "user", "content": [], "created_at": 1784650020.0},
    ]
}


def test_parse_extracts_user_and_assistant_turns_in_order():
    items = parse_chat_history(SAMPLE_HISTORY)
    roles = [i["role"] for i in items]
    assert roles == ["assistant", "user", "assistant", "tool_call", "tool_output"]


def test_parse_skips_system_messages_and_empty_content():
    items = parse_chat_history(SAMPLE_HISTORY)
    assert all("instructions" not in i["content"] for i in items)
    assert all(i["content"] for i in items)


def test_parse_preserves_interrupted_flag():
    items = parse_chat_history(SAMPLE_HISTORY)
    interrupted = [i for i in items if i["interrupted"]]
    assert len(interrupted) == 1
    assert interrupted[0]["content"].startswith("Sabith builds")


def test_parse_converts_epoch_to_iso_timestamps():
    items = parse_chat_history(SAMPLE_HISTORY)
    assert items[0]["timestamp"] is not None
    assert items[0]["timestamp"].startswith("2026-")


def test_parse_handles_empty_history():
    assert parse_chat_history(None) == []
    assert parse_chat_history({}) == []
    assert parse_chat_history({"items": []}) == []


def test_build_ingest_payload_computes_ended_at():
    payload = build_ingest_payload(
        room_name="call-_+15551234567_abcd",
        agent_name="sabith-assistant",
        chat_history=SAMPLE_HISTORY,
        caller_number="+15551234567",
        started_at=1784650000.0,
        duration=125.5,
    )
    assert payload["room_name"] == "call-_+15551234567_abcd"
    assert payload["caller_number"] == "+15551234567"
    assert payload["duration_seconds"] == 125.5
    assert payload["started_at"] is not None
    assert payload["ended_at"] is not None
    assert len(payload["items"]) == 5


def test_build_ingest_payload_defaults():
    payload = build_ingest_payload(
        room_name="r", agent_name="a", chat_history=None, started_at=None, duration=None
    )
    assert payload["caller_number"] == "unknown"
    assert payload["started_at"] is None
    assert payload["ended_at"] is None
    assert payload["items"] == []

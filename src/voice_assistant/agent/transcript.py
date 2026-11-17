"""Pure helpers to turn a LiveKit session report into a backend ingest payload.

Kept free of livekit imports so it can be unit-tested without a running session.
"""

from datetime import datetime, timezone
from typing import Any


def _epoch_to_dt(value: Any) -> datetime | None:
    if isinstance(value, (int, float)) and value > 0:
        return datetime.fromtimestamp(value, tz=timezone.utc)
    return None


def _content_to_text(content: Any) -> str:
    """Chat item content is a list that may mix strings and media placeholders."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = [part for part in content if isinstance(part, str)]
        return "\n".join(parts).strip()
    return ""


def parse_chat_history(history: dict | None) -> list[dict]:
    """Extract ordered transcript items from a ChatContext.to_dict() payload.

    Returns dicts matching the backend's TranscriptItemIn schema:
    {role, content, interrupted, timestamp}.
    """
    items: list[dict] = []
    for raw in (history or {}).get("items", []):
        if not isinstance(raw, dict):
            continue
        item_type = raw.get("type")
        timestamp = _epoch_to_dt(raw.get("created_at"))
        if item_type == "message":
            role = raw.get("role", "")
            if role not in ("user", "assistant"):
                continue  # skip system/developer messages
            text = _content_to_text(raw.get("content"))
            if not text:
                continue  # audio-only item whose transcription never arrived
            items.append(
                {
                    "role": role,
                    "content": text,
                    "interrupted": bool(raw.get("interrupted", False)),
                    "timestamp": timestamp.isoformat() if timestamp else None,
                }
            )
        elif item_type == "function_call":
            items.append(
                {
                    "role": "tool_call",
                    "content": f"{raw.get('name', '')}({raw.get('arguments', '')})",
                    "interrupted": False,
                    "timestamp": timestamp.isoformat() if timestamp else None,
                }
            )
        elif item_type == "function_call_output":
            items.append(
                {
                    "role": "tool_output",
                    "content": str(raw.get("output", "")),
                    "interrupted": False,
                    "timestamp": timestamp.isoformat() if timestamp else None,
                }
            )
    return items


def build_ingest_payload(
    *,
    room_name: str,
    agent_name: str,
    chat_history: dict | None,
    channel: str = "unknown",
    caller_number: str = "unknown",
    called_number: str = "",
    sip_call_id: str = "",
    started_at: float | None = None,
    duration: float | None = None,
    report: dict | None = None,
    status: str = "completed",
) -> dict:
    started_dt = _epoch_to_dt(started_at)
    ended_dt = None
    if started_dt is not None and isinstance(duration, (int, float)):
        ended_dt = _epoch_to_dt(started_at + duration)
    return {
        "room_name": room_name,
        "agent_name": agent_name,
        "channel": channel or "unknown",
        "caller_number": caller_number or "unknown",
        "called_number": called_number or "",
        "sip_call_id": sip_call_id or "",
        "status": status,
        "started_at": started_dt.isoformat() if started_dt else None,
        "ended_at": ended_dt.isoformat() if ended_dt else None,
        "duration_seconds": float(duration) if isinstance(duration, (int, float)) else None,
        "items": parse_chat_history(chat_history),
        "report": report,
    }

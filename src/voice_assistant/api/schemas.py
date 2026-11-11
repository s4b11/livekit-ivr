"""Pydantic request/response schemas for the API service."""

from datetime import datetime

from pydantic import BaseModel, Field


class TranscriptItemIn(BaseModel):
    role: str
    content: str = ""
    interrupted: bool = False
    timestamp: datetime | None = None


class CallIngestRequest(BaseModel):
    """Posted by the agent worker after a call ends (from on_session_end)."""

    room_name: str
    agent_name: str = ""
    channel: str = "unknown"  # phone | web | unknown
    caller_number: str = "unknown"
    called_number: str = ""
    sip_call_id: str = ""
    status: str = "completed"
    started_at: datetime | None = None
    ended_at: datetime | None = None
    duration_seconds: float | None = None
    items: list[TranscriptItemIn] = Field(default_factory=list)
    report: dict | None = None


class TranscriptItemOut(TranscriptItemIn):
    id: str
    idx: int

    model_config = {"from_attributes": True}


class CallOut(BaseModel):
    id: str
    room_name: str
    agent_name: str
    channel: str
    caller_number: str
    called_number: str
    sip_call_id: str
    status: str
    started_at: datetime | None
    ended_at: datetime | None
    duration_seconds: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CallDetailOut(CallOut):
    transcript_items: list[TranscriptItemOut] = Field(default_factory=list)


class CallerMessageIn(BaseModel):
    """Posted live, mid-call, by the agent's take_message tool."""

    room_name: str = ""
    caller_name: str = ""
    contact: str = ""
    message: str


class CallerMessageOut(CallerMessageIn):
    id: str
    call_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenRequest(BaseModel):
    """Body of the embed token request. Room and agent are chosen server-side."""

    participant_name: str = Field(default="", max_length=80)


class TokenResponse(BaseModel):
    """LiveKit's standard token endpoint response, plus the generated room."""

    server_url: str
    participant_token: str
    room_name: str
    participant_identity: str


class TelephonyStatusOut(BaseModel):
    agent_name: str
    phone_number: str
    livekit_url: str
    dispatch_rules: list[dict] = Field(default_factory=list)

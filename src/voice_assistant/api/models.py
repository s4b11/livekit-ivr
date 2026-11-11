"""SQLAlchemy ORM models for call sessions, transcripts, and caller messages."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return uuid.uuid4().hex


class Base(DeclarativeBase):
    pass


class CallSession(Base):
    """One conversation handled by the assistant, over the phone or the web."""

    __tablename__ = "call_sessions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    room_name: Mapped[str] = mapped_column(String(255), index=True)
    agent_name: Mapped[str] = mapped_column(String(128), default="")
    channel: Mapped[str] = mapped_column(String(16), default="unknown")
    caller_number: Mapped[str] = mapped_column(String(64), default="unknown")
    called_number: Mapped[str] = mapped_column(String(64), default="")
    sip_call_id: Mapped[str] = mapped_column(String(255), default="")
    status: Mapped[str] = mapped_column(String(32), default="completed")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    report: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    transcript_items: Mapped[list["TranscriptItem"]] = relationship(
        back_populates="call", cascade="all, delete-orphan", order_by="TranscriptItem.idx"
    )
    messages: Mapped[list["CallerMessage"]] = relationship(
        back_populates="call", cascade="all, delete-orphan"
    )


class TranscriptItem(Base):
    """A single conversation turn within a call."""

    __tablename__ = "transcript_items"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    call_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("call_sessions.id", ondelete="CASCADE"), index=True
    )
    idx: Mapped[int] = mapped_column(Integer)
    role: Mapped[str] = mapped_column(String(32))  # user | assistant | tool_call | tool_output
    content: Mapped[str] = mapped_column(Text, default="")
    interrupted: Mapped[bool] = mapped_column(Boolean, default=False)
    timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    call: Mapped[CallSession] = relationship(back_populates="transcript_items")


class CallerMessage(Base):
    """A message the assistant took for its owner (written mid-call by a tool)."""

    __tablename__ = "caller_messages"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    call_id: Mapped[str | None] = mapped_column(
        String(32), ForeignKey("call_sessions.id", ondelete="SET NULL"), nullable=True
    )
    room_name: Mapped[str] = mapped_column(String(255), default="", index=True)
    caller_name: Mapped[str] = mapped_column(String(255), default="")
    contact: Mapped[str] = mapped_column(String(255), default="")
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    call: Mapped[CallSession | None] = relationship(back_populates="messages")

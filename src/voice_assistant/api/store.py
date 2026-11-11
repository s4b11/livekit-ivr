"""CRUD operations against PostgreSQL."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from . import schemas
from .models import CallerMessage, CallSession, TranscriptItem


async def ingest_call(session: AsyncSession, payload: schemas.CallIngestRequest) -> CallSession:
    call = CallSession(
        room_name=payload.room_name,
        agent_name=payload.agent_name,
        channel=payload.channel,
        caller_number=payload.caller_number,
        called_number=payload.called_number,
        sip_call_id=payload.sip_call_id,
        status=payload.status,
        started_at=payload.started_at,
        ended_at=payload.ended_at,
        duration_seconds=payload.duration_seconds,
        report=payload.report,
    )
    for idx, item in enumerate(payload.items):
        call.transcript_items.append(
            TranscriptItem(
                idx=idx,
                role=item.role,
                content=item.content,
                interrupted=item.interrupted,
                timestamp=item.timestamp,
            )
        )
    session.add(call)

    # Link any mid-call messages that were stored for this room before the call record existed.
    await session.flush()
    orphans = await session.scalars(
        select(CallerMessage).where(
            CallerMessage.room_name == payload.room_name, CallerMessage.call_id.is_(None)
        )
    )
    for msg in orphans:
        msg.call_id = call.id

    await session.commit()
    await session.refresh(call, attribute_names=["transcript_items"])
    return call


async def list_calls(session: AsyncSession, limit: int = 50) -> list[CallSession]:
    result = await session.scalars(
        select(CallSession).order_by(CallSession.created_at.desc()).limit(limit)
    )
    return list(result)


async def get_call(session: AsyncSession, call_id: str) -> CallSession | None:
    return await session.scalar(
        select(CallSession)
        .where(CallSession.id == call_id)
        .options(selectinload(CallSession.transcript_items))
    )


async def create_message(session: AsyncSession, payload: schemas.CallerMessageIn) -> CallerMessage:
    msg = CallerMessage(
        room_name=payload.room_name,
        caller_name=payload.caller_name,
        contact=payload.contact,
        message=payload.message,
    )
    session.add(msg)
    await session.commit()
    await session.refresh(msg)
    return msg


async def list_messages(session: AsyncSession, limit: int = 100) -> list[CallerMessage]:
    result = await session.scalars(
        select(CallerMessage).order_by(CallerMessage.created_at.desc()).limit(limit)
    )
    return list(result)

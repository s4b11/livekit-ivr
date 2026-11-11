"""API service for the assistant.

Public (called from browsers):
- GET  /health                      liveness + DB connectivity
- POST /api/v1/token                mint a LiveKit token that starts a web session
- GET  /embed/embed.js              the embeddable widget
- GET  /embed/                      demo page for the widget
- GET  /app/                        the React voice UI, when it has been built

Private (called by the agent worker; bearer `BACKEND_API_KEY` when set):
- POST /api/v1/calls/ingest         store a finished conversation + transcript
- GET  /api/v1/calls                list stored conversations
- GET  /api/v1/calls/{id}           conversation detail incl. transcript
- POST /api/v1/messages             store a message taken mid-conversation
- GET  /api/v1/messages             list messages
- GET  /api/v1/telephony/status     agent name, phone number, live dispatch rules
"""

import hmac
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from voice_assistant import __version__
from voice_assistant.api import schemas, store
from voice_assistant.api.db import (
    create_engine,
    create_session_factory,
    get_db_session,
    init_db,
)
from voice_assistant.api.tokens import create_embed_session
from voice_assistant.config import Settings, get_settings

STATIC_DIR = Path(__file__).parent / "static"
# Build output of web/ (see Dockerfile.api). Absent in a plain source checkout.
WEB_APP_DIR = STATIC_DIR / "app"


async def require_api_key(request: Request) -> None:
    """Guard the private endpoints with a shared bearer key, when one is configured."""
    expected: str = request.app.state.settings.backend_api_key
    if not expected:
        return
    supplied = request.headers.get("authorization", "").removeprefix("Bearer ").strip()
    if not hmac.compare_digest(supplied.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="invalid or missing API key")


public = APIRouter()
private = APIRouter(prefix="/api/v1", dependencies=[Depends(require_api_key)])


@public.get("/health")
async def health(request: Request):
    db_ok = True
    try:
        async with request.app.state.engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    return {"status": "ok", "database": "up" if db_ok else "down"}


@public.post("/api/v1/token", response_model=schemas.TokenResponse, status_code=201)
async def create_token(request: Request, payload: schemas.TokenRequest | None = None):
    cfg: Settings = request.app.state.settings
    if not cfg.livekit_configured:
        raise HTTPException(status_code=503, detail="LiveKit is not configured")
    return create_embed_session(cfg, payload.participant_name if payload else "")


@private.post("/calls/ingest", response_model=schemas.CallDetailOut, status_code=201)
async def ingest_call(
    payload: schemas.CallIngestRequest,
    session: AsyncSession = Depends(get_db_session),
):
    return await store.ingest_call(session, payload)


@private.get("/calls", response_model=list[schemas.CallOut])
async def list_calls(session: AsyncSession = Depends(get_db_session), limit: int = 50):
    return await store.list_calls(session, limit=limit)


@private.get("/calls/{call_id}", response_model=schemas.CallDetailOut)
async def get_call(call_id: str, session: AsyncSession = Depends(get_db_session)):
    call = await store.get_call(session, call_id)
    if call is None:
        raise HTTPException(status_code=404, detail="call not found")
    return call


@private.post("/messages", response_model=schemas.CallerMessageOut, status_code=201)
async def create_message(
    payload: schemas.CallerMessageIn,
    session: AsyncSession = Depends(get_db_session),
):
    return await store.create_message(session, payload)


@private.get("/messages", response_model=list[schemas.CallerMessageOut])
async def list_messages(session: AsyncSession = Depends(get_db_session), limit: int = 100):
    return await store.list_messages(session, limit=limit)


@private.get("/telephony/status", response_model=schemas.TelephonyStatusOut)
async def telephony_status(request: Request):
    cfg: Settings = request.app.state.settings
    rules: list[dict] = []
    if cfg.livekit_configured:
        try:
            rules = await _list_dispatch_rules(cfg)
        except Exception as exc:  # pragma: no cover - network dependent
            rules = [{"error": str(exc)}]
    return schemas.TelephonyStatusOut(
        agent_name=cfg.agent_name,
        phone_number=cfg.phone_number,
        livekit_url=cfg.livekit_url,
        dispatch_rules=rules,
    )


async def _list_dispatch_rules(cfg: Settings) -> list[dict]:
    from livekit import api as lk_api

    lkapi = lk_api.LiveKitAPI(
        url=cfg.livekit_http_url,
        api_key=cfg.livekit_api_key,
        api_secret=cfg.livekit_api_secret,
    )
    try:
        resp = await lkapi.sip.list_sip_dispatch_rule(lk_api.ListSIPDispatchRuleRequest())
        return [
            {
                "id": item.sip_dispatch_rule_id,
                "name": item.name,
                "agents": [d.agent_name for d in item.room_config.agents]
                if item.HasField("room_config")
                else [],
            }
            for item in resp.items
        ]
    finally:
        await lkapi.aclose()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        engine = create_engine(settings.database_url)
        app.state.engine = engine
        app.state.session_factory = create_session_factory(engine)
        await init_db(engine)
        yield
        await engine.dispose()

    app = FastAPI(title="Sabith's Voice Assistant API", version=__version__, lifespan=lifespan)
    app.state.settings = settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    app.include_router(public)
    app.include_router(private)
    if WEB_APP_DIR.is_dir():
        app.mount("/app", StaticFiles(directory=WEB_APP_DIR, html=True), name="app")
    app.mount("/embed", StaticFiles(directory=STATIC_DIR, html=True), name="embed")
    return app


app = create_app()

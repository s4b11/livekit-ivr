import asyncio
import os

import pytest
from dotenv import load_dotenv

load_dotenv(".env.local")
load_dotenv(".env")

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://assistant:assistant@localhost:5433/voice_assistant_test",
)


def _postgres_available() -> bool:
    import asyncpg

    async def _try() -> bool:
        try:
            conn = await asyncio.wait_for(
                asyncpg.connect(
                    TEST_DATABASE_URL.replace("+asyncpg", "").rsplit("/", 1)[0] + "/postgres"
                ),
                timeout=5,
            )
            await conn.close()
            return True
        except Exception:
            return False

    return asyncio.run(_try())


POSTGRES_UP = _postgres_available()
LIVEKIT_CONFIGURED = bool(
    os.environ.get("LIVEKIT_API_KEY") and os.environ.get("LIVEKIT_API_SECRET")
)

requires_postgres = pytest.mark.skipif(
    not POSTGRES_UP, reason="PostgreSQL is not reachable (docker compose up -d)"
)
requires_livekit = pytest.mark.skipif(
    not LIVEKIT_CONFIGURED, reason="LIVEKIT_API_KEY/SECRET not configured"
)


@pytest.fixture(scope="session", autouse=True)
def _ensure_test_database():
    """Create the dedicated test database once per test session."""
    if not POSTGRES_UP:
        yield
        return

    import asyncpg

    async def _create() -> None:
        admin_url = TEST_DATABASE_URL.replace("+asyncpg", "").rsplit("/", 1)[0] + "/postgres"
        conn = await asyncpg.connect(admin_url)
        try:
            db_name = TEST_DATABASE_URL.rsplit("/", 1)[1]
            exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", db_name)
            if not exists:
                await conn.execute(f'CREATE DATABASE "{db_name}"')
        finally:
            await conn.close()

    asyncio.run(_create())
    yield


TEST_LIVEKIT_KEY = "APItestkey"
TEST_LIVEKIT_SECRET = "test-secret-that-is-at-least-32-bytes-long"


def make_settings(**overrides):
    """Settings isolated from the developer's .env: test DB, fake LiveKit keys."""
    from voice_assistant.config import Settings

    values = {
        "database_url": TEST_DATABASE_URL,
        "livekit_url": "wss://test-project.livekit.cloud",
        "livekit_api_key": TEST_LIVEKIT_KEY,
        "livekit_api_secret": TEST_LIVEKIT_SECRET,
        "agent_name": "sabith-assistant",
        "backend_api_key": "",
        "embed_allowed_origins": "*",
    }
    values.update(overrides)
    return Settings(**values)


@pytest.fixture
async def app_client():
    """FastAPI app bound to the test database + httpx client (fresh tables per test)."""
    from httpx import ASGITransport, AsyncClient

    from voice_assistant.api.app import create_app
    from voice_assistant.api.db import create_engine
    from voice_assistant.api.models import Base

    settings = make_settings()

    engine = create_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()

    app = create_app(settings)
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client

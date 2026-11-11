"""Application settings, loaded from the environment and `.env` / `.env.local`."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- LiveKit Cloud ---
    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""

    # --- Gemini Live API ---
    google_api_key: str = ""
    gemini_live_model: str = ""  # empty -> plugin default
    gemini_voice: str = "Puck"
    # Optional BCP-47 code (e.g. "en-US"). Native-audio models pick the language
    # from the prompt, so this is left empty unless the chosen model needs it.
    gemini_language: str = ""

    # --- Agent wiring ---
    agent_name: str = "sabith-assistant"
    sip_room_prefix: str = "call-"
    web_room_prefix: str = "web-"
    phone_number: str = ""  # set after provisioning

    # --- API service ---
    database_url: str = "postgresql+asyncpg://assistant:assistant@localhost:5433/voice_assistant"
    # Where the agent posts transcripts and messages. Empty disables persistence:
    # the agent still works, and messages are written to the worker log instead.
    backend_base_url: str = ""
    # Shared secret protecting the call/message endpoints. Empty = no auth (local dev).
    backend_api_key: str = ""
    # Comma-separated origins allowed to request embed tokens ("*" = any site).
    embed_allowed_origins: str = "*"
    embed_token_ttl_minutes: int = 10

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.embed_allowed_origins.split(",") if o.strip()]

    @property
    def livekit_configured(self) -> bool:
        return bool(self.livekit_url and self.livekit_api_key and self.livekit_api_secret)

    @property
    def livekit_http_url(self) -> str:
        """LiveKit server APIs are called over HTTPS, not the websocket scheme."""
        return self.livekit_url.replace("wss://", "https://").replace("ws://", "http://")


@lru_cache
def get_settings() -> Settings:
    return Settings()

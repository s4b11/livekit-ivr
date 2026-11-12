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
    gemini_live_model: str = "gemini-3.8-live"
    gemini_voice: str = "Puck"
    # Optional BCP-47 code (e.g. "en-US"). Native-audio models pick the language
    # from the prompt, so this is left empty unless the chosen model needs it.
    gemini_language: str = ""
    # Languages the speech transcription should expect, as comma-separated BCP-47
    # codes. Pinning this stops English speech being transcribed in another script.
    # Empty = let Gemini detect the language.
    transcription_languages: str = "en-IN"

    # --- Agent wiring ---
    agent_name: str = "sabith-assistant"
    sip_room_prefix: str = "call-"
    phone_number: str = ""  # set after provisioning

    # --- Storage API (the Cloudflare Worker in web/) ---
    # Where the agent posts transcripts and messages. Empty disables persistence:
    # the agent still works, and messages are written to the worker log instead.
    backend_base_url: str = ""
    # Shared secret the Worker requires on its private endpoints.
    backend_api_key: str = ""

    @property
    def transcription_language_codes(self) -> list[str]:
        return [c.strip() for c in self.transcription_languages.split(",") if c.strip()]

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

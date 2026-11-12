"""The realtime model's transcription settings, and that they serialize for the Gemini API."""

from livekit.agents.types import NOT_GIVEN

from voice_assistant.agent.realtime import build_realtime_model, build_transcription_config
from voice_assistant.config import Settings


def _settings(**overrides) -> Settings:
    return Settings(_env_file=None, google_api_key="test-key", **overrides)


def test_transcription_is_pinned_to_indian_english_by_default():
    config = build_transcription_config(_settings())
    assert config.language_hints.language_codes == ["en-IN"]
    assert "Sabith" in config.adaptation_phrases


def test_transcription_languages_are_configurable():
    config = build_transcription_config(_settings(transcription_languages="en-IN, en-US"))
    assert config.language_hints.language_codes == ["en-IN", "en-US"]


def test_empty_setting_falls_back_to_auto_detection():
    assert build_transcription_config(_settings(transcription_languages="")).language_hints is None


def test_defaults_to_gemini_3_8_live(monkeypatch):
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    model = build_realtime_model(_settings())
    assert model.model == "gemini-3.8-live"
    # gemini-3.8-live manages its own thinking; a thinking config is only sent to 2.5 models.
    assert model._opts.thinking_config is NOT_GIVEN


def test_uses_the_v1beta_live_endpoint(monkeypatch):
    # google-genai 3.x defaults to v1, where the Live API returns HTTP 404.
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    assert build_realtime_model(_settings())._opts.api_version == "v1beta"


def test_thinking_budget_still_applies_to_gemini_2_5(monkeypatch):
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    model = build_realtime_model(
        _settings(gemini_live_model="gemini-2.5-flash-native-audio-preview-12-2025")
    )
    assert model._opts.thinking_config.thinking_budget == 0


def test_realtime_model_builds_with_pinned_transcription(monkeypatch):
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")  # the plugin reads it from the environment
    build_realtime_model(_settings())

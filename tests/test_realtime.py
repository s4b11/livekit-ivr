"""The realtime model's transcription settings, and that they serialize for the Gemini API."""

from google.genai import _live_converters, types

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


def test_config_serializes_for_the_gemini_developer_api():
    # The Developer API rejects some fields (e.g. the deprecated language_codes);
    # this is the same conversion the SDK runs when the session connects.
    wire = _live_converters._AudioTranscriptionConfig_to_mldev(
        build_transcription_config(_settings())
    )
    assert wire["languageHints"] == types.LanguageHints(language_codes=["en-IN"])


def test_realtime_model_builds_with_pinned_transcription(monkeypatch):
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")  # the plugin reads it from the environment
    build_realtime_model(_settings())

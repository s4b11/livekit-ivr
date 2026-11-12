"""Gemini Live API realtime model, tuned for phone and browser audio."""

from google.genai import types
from livekit.plugins import google

from voice_assistant.config import Settings
from voice_assistant.profile import PROFILE

# Terms the transcriber should recognise, so they are not misheard.
TRANSCRIPTION_PHRASES = [
    PROFILE.name,
    PROFILE.first_name,
    *(project.name for project in PROFILE.projects),
    "IoTides",
    "LiveKit",
    "FastAPI",
    "Gemini",
    "Kollam",
]


def build_transcription_config(settings: Settings) -> types.AudioTranscriptionConfig:
    """Transcription pinned to the configured language(s) instead of auto-detection."""
    codes = settings.transcription_language_codes
    return types.AudioTranscriptionConfig(
        language_hints=types.LanguageHints(language_codes=codes) if codes else None,
        adaptation_phrases=TRANSCRIPTION_PHRASES,
    )


def uses_thinking_budget(model: str) -> bool:
    """Only Gemini 2.5 Live models take the thinking budget this agent sets."""
    return "2.5" in model


def build_realtime_model(settings: Settings) -> google.realtime.RealtimeModel:
    """Build the speech-to-speech model.

    - Server-side VAD (automatic activity detection) with high start sensitivity so
      barge-in is caught quickly; a 400 ms silence window balances response speed
      against cutting people off on noisy phone audio.
    - START_OF_ACTIVITY_INTERRUPTS enables true barge-in interruption.
    - On Gemini 2.5 native-audio models, thinking_budget=0 disables dynamic
      thinking, which otherwise makes some replies stall for seconds. Gemini 3.x
      Live models manage thinking themselves (gemini-3.8-live rejects a
      thinking level on the Gemini API), so no thinking config is sent to them.
    - Input and output audio transcription are enabled so the stored transcript
      (and the web widget's captions) contain both sides of the conversation.
      Both are pinned to TRANSCRIPTION_LANGUAGES (default en-IN), so English
      speech is not transcribed in another script.
    """
    kwargs: dict = {}
    if settings.gemini_live_model:
        kwargs["model"] = settings.gemini_live_model
    if uses_thinking_budget(settings.gemini_live_model):
        kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=0)
    if settings.gemini_language:
        kwargs["language"] = settings.gemini_language
    return google.realtime.RealtimeModel(
        voice=settings.gemini_voice,
        temperature=0.6,
        input_audio_transcription=build_transcription_config(settings),
        output_audio_transcription=build_transcription_config(settings),
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(
                disabled=False,
                start_of_speech_sensitivity=types.StartSensitivity.START_SENSITIVITY_HIGH,
                end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_HIGH,
                prefix_padding_ms=300,
                silence_duration_ms=400,
            ),
            activity_handling=types.ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
        ),
        **kwargs,
    )

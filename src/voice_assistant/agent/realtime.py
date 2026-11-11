"""Gemini Live API realtime model, tuned for phone and browser audio."""

from google.genai import types
from livekit.plugins import google

from voice_assistant.config import Settings


def build_realtime_model(settings: Settings) -> google.realtime.RealtimeModel:
    """Build the speech-to-speech model.

    - Server-side VAD (automatic activity detection) with high start sensitivity so
      barge-in is caught quickly; a 400 ms silence window balances response speed
      against cutting people off on noisy phone audio.
    - START_OF_ACTIVITY_INTERRUPTS enables true barge-in interruption.
    - thinking_budget=0 disables dynamic thinking, which otherwise makes some
      replies stall for seconds while others are instant.
    - Input and output audio transcription are enabled so the stored transcript
      (and the web widget's captions) contain both sides of the conversation.
    """
    kwargs: dict = {}
    if settings.gemini_live_model:
        kwargs["model"] = settings.gemini_live_model
    if settings.gemini_language:
        kwargs["language"] = settings.gemini_language
    return google.realtime.RealtimeModel(
        voice=settings.gemini_voice,
        temperature=0.6,
        thinking_config=types.ThinkingConfig(thinking_budget=0),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
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

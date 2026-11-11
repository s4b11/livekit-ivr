"""The system prompt is rendered from the profile: check what it promises and withholds."""

import re

from voice_assistant.agent.prompts import (
    INSTRUCTIONS,
    build_greeting_instructions,
    build_instructions,
)
from voice_assistant.profile import PROFILE, render_profile


def test_instructions_enforce_english_only():
    assert "Speak ONLY in English" in INSTRUCTIONS
    # No non-Latin script anywhere in the prompt.
    assert not re.search(r"[^\x00-\x7f]", INSTRUCTIONS)


def test_instructions_introduce_the_owner_not_impersonate_him():
    assert "personal AI assistant for Sabith S B" in INSTRUCTIONS
    assert "You are an AI assistant, not Sabith" in INSTRUCTIONS


def test_instructions_contain_every_profile_fact():
    rendered = render_profile()
    assert rendered in build_instructions()
    for project in PROFILE.projects:
        assert project.name in rendered
    for role in PROFILE.experience:
        assert role.company in rendered
    for value in PROFILE.contact.values():
        assert value in rendered


def test_profile_shares_no_private_phone_number():
    # Public contact channels only: no digit run that looks like a phone number.
    assert not re.search(r"\+?\d[\d\s-]{8,}\d", render_profile())


def test_greeting_introduces_the_assistant_in_english():
    greeting = build_greeting_instructions()
    assert "Sabith S B's AI assistant" in greeting
    assert "English" in greeting

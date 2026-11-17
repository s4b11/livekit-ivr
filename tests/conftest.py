import os

import pytest
from dotenv import load_dotenv

load_dotenv(".env.local")
load_dotenv(".env")

LIVEKIT_CONFIGURED = bool(
    os.environ.get("LIVEKIT_API_KEY") and os.environ.get("LIVEKIT_API_SECRET")
)

requires_livekit = pytest.mark.skipif(
    not LIVEKIT_CONFIGURED, reason="LIVEKIT_API_KEY/SECRET not configured"
)

"""Access tokens for web and embedded sessions.

Each token admits one visitor to a fresh private room and carries a room
configuration that dispatches the assistant into it. The room name and the
agent are always chosen here, never by the client.
"""

import secrets
from dataclasses import dataclass
from datetime import timedelta

from livekit import api

from voice_assistant.config import Settings


@dataclass(frozen=True)
class EmbedSession:
    server_url: str
    participant_token: str
    room_name: str
    participant_identity: str


def create_embed_session(settings: Settings, participant_name: str = "") -> EmbedSession:
    room_name = f"{settings.web_room_prefix}{secrets.token_hex(6)}"
    identity = f"visitor-{secrets.token_hex(4)}"
    token = (
        api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(identity)
        .with_name(participant_name.strip() or "Visitor")
        .with_ttl(timedelta(minutes=settings.embed_token_ttl_minutes))
        .with_grants(
            api.VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
                can_publish_data=True,
            )
        )
        .with_room_config(
            api.RoomConfiguration(agents=[api.RoomAgentDispatch(agent_name=settings.agent_name)])
        )
    )
    return EmbedSession(
        server_url=settings.livekit_url,
        participant_token=token.to_jwt(),
        room_name=room_name,
        participant_identity=identity,
    )

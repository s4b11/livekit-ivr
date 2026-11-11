import { RoomAgentDispatch, RoomConfiguration } from '@livekit/protocol';
import { AccessToken } from 'livekit-server-sdk';

export interface EmbedSession {
  server_url: string;
  participant_token: string;
  room_name: string;
  participant_identity: string;
}

function randomHex(bytes: number): string {
  const buffer = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buffer, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function livekitConfigured(env: Env): boolean {
  return Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET);
}

/**
 * Admit one visitor to a fresh private room and dispatch the assistant into it.
 * The room name and the agent are always chosen here, never by the client.
 */
export async function createEmbedSession(env: Env, participantName = ''): Promise<EmbedSession> {
  const roomName = `${env.WEB_ROOM_PREFIX}${randomHex(6)}`;
  const identity = `visitor-${randomHex(4)}`;

  const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity,
    name: participantName.trim() || 'Visitor',
    ttl: `${Number(env.TOKEN_TTL_MINUTES) || 10}m`,
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  token.roomConfig = new RoomConfiguration({
    agents: [new RoomAgentDispatch({ agentName: env.AGENT_NAME })],
  });

  return {
    server_url: env.LIVEKIT_URL!,
    participant_token: await token.toJwt(),
    room_name: roomName,
    participant_identity: identity,
  };
}

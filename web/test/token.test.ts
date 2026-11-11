import { TokenVerifier } from 'livekit-server-sdk';
import { describe, expect, it } from 'vitest';

import { request } from './helpers';

const verifier = new TokenVerifier('APItestkey', 'test-secret-that-is-at-least-32-bytes-long');

async function mint(json?: unknown) {
  const response = await request('/api/v1/token', { method: 'POST', json });
  return { response, body: (await response.json()) as Record<string, string> };
}

describe('POST /api/v1/token', () => {
  it('returns the standard LiveKit token response', async () => {
    const { response, body } = await mint({ participant_name: '  Alice  ' });
    expect(response.status).toBe(201);
    expect(body.server_url).toBe('wss://test-project.livekit.cloud');

    const claims = await verifier.verify(body.participant_token);
    expect(claims.sub).toBe(body.participant_identity);
    expect(claims.name).toBe('Alice');
    expect(claims.video).toMatchObject({ roomJoin: true, room: body.room_name });
    expect(body.room_name).toMatch(/^web-[0-9a-f]{12}$/);
  });

  it('dispatches the assistant into the room', async () => {
    const { body } = await mint();
    const claims = await verifier.verify(body.participant_token);
    expect(claims.roomConfig?.agents?.map((agent) => agent.agentName)).toEqual([
      'sabith-assistant',
    ]);
  });

  it('accepts an empty body and gives every visitor a private room', async () => {
    const first = await mint();
    const second = await mint();
    expect(first.response.status).toBe(201);
    expect(first.body.room_name).not.toBe(second.body.room_name);
    expect(first.body.participant_identity).not.toBe(second.body.participant_identity);
  });

  it('ignores a client-supplied room', async () => {
    const { body } = await mint({ room_name: 'someone-elses-room' });
    expect(body.room_name).not.toBe('someone-elses-room');
  });

  it('is unavailable without LiveKit credentials', async () => {
    const response = await request(
      '/api/v1/token',
      { method: 'POST' },
      { LIVEKIT_API_SECRET: undefined },
    );
    expect(response.status).toBe(503);
  });

  it('allows cross-origin requests from embedding sites', async () => {
    const response = await request('/api/v1/token', {
      method: 'POST',
      headers: { Origin: 'https://example.com' },
    });
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('restricts origins when EMBED_ALLOWED_ORIGINS is set', async () => {
    const overrides = { EMBED_ALLOWED_ORIGINS: 'https://sabithsb.fermyon.app' };
    const call = (origin: string) =>
      request('/api/v1/token', { method: 'POST', headers: { Origin: origin } }, overrides);

    const allowed = await call('https://sabithsb.fermyon.app');
    expect(allowed.headers.get('access-control-allow-origin')).toBe(
      'https://sabithsb.fermyon.app',
    );
    const denied = await call('https://evil.example');
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
  });
});

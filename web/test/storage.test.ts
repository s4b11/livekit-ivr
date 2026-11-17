import { describe, expect, it } from 'vitest';

import contractPayload from '../../contract/ingest_payload.json';
import { AUTH, post, request } from './helpers';

const SAMPLE_CALL = {
  room_name: 'call-_+15551234567_test1',
  agent_name: 'sabith-assistant',
  channel: 'phone',
  caller_number: '+15551234567',
  called_number: '+16505550100',
  sip_call_id: 'SCL_test123',
  started_at: '2026-07-21T10:00:00Z',
  ended_at: '2026-07-21T10:02:05Z',
  duration_seconds: 125,
  items: [
    { role: 'assistant', content: "You've reached Sabith's AI assistant. How can I help?" },
    { role: 'user', content: 'What does Sabith work on?' },
    { role: 'assistant', content: 'Sabith builds real-time voice AI agents.', interrupted: true },
  ],
  report: { job_id: 'job_123' },
};

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const json = async (response: Response) => (await response.json()) as Json;
const get = (path: string) => request(path, { headers: AUTH });

describe('health', () => {
  it('reports the database as up', async () => {
    const response = await request('/health');
    expect(await json(response)).toEqual({ status: 'ok', database: 'up' });
  });
});

describe('calls', () => {
  it('stores a conversation with its transcript in order', async () => {
    const response = await post('/api/v1/calls/ingest', SAMPLE_CALL);
    expect(response.status).toBe(201);
    const body = await json(response);
    expect(body).toMatchObject({ caller_number: '+15551234567', channel: 'phone' });
    expect(body.transcript_items.map((item: Json) => [item.idx, item.role])).toEqual([
      [0, 'assistant'],
      [1, 'user'],
      [2, 'assistant'],
    ]);
    expect(body.transcript_items[2].interrupted).toBe(true);
    expect(body.transcript_items[0].interrupted).toBe(false);
  });

  it('lists and fetches stored conversations', async () => {
    const created = await json(await post('/api/v1/calls/ingest', SAMPLE_CALL));

    const listing = await json(await get('/api/v1/calls'));
    expect(listing.some((call: Json) => call.id === created.id)).toBe(true);

    const detail = await json(await get(`/api/v1/calls/${created.id}`));
    expect(detail.duration_seconds).toBe(125);
    expect(detail.transcript_items).toHaveLength(3);
  });

  it('returns 404 for an unknown conversation', async () => {
    expect((await get('/api/v1/calls/doesnotexist')).status).toBe(404);
  });

  it('applies defaults to a minimal payload', async () => {
    const body = await json(await post('/api/v1/calls/ingest', { room_name: 'call-minimal' }));
    expect(body).toMatchObject({ caller_number: 'unknown', channel: 'unknown' });
    expect(body.transcript_items).toEqual([]);
  });

  it.each([{}, { items: [] }, { room_name: '' }])('rejects %j without a room name', async (bad) => {
    expect((await post('/api/v1/calls/ingest', bad)).status).toBe(422);
  });

  it('rejects an empty body', async () => {
    const response = await request('/api/v1/calls/ingest', {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
    });
    expect(response.status).toBe(422);
  });

  it('accepts exactly what the agent sends (shared contract fixture)', async () => {
    const response = await post('/api/v1/calls/ingest', contractPayload);
    expect(response.status).toBe(201);
    const body = await json(response);
    expect(body).toMatchObject({
      caller_number: '+15559876543',
      called_number: '+14849649535',
      duration_seconds: 42,
      channel: 'phone',
    });
    expect(body.transcript_items.map((item: Json) => item.role)).toEqual([
      'assistant',
      'user',
      'assistant',
      'tool_call',
      'tool_output',
    ]);
    expect(body.transcript_items[2].interrupted).toBe(true);
  });
});

describe('messages', () => {
  it('stores a message mid-call and links it when the call ends', async () => {
    const message = {
      room_name: SAMPLE_CALL.room_name,
      caller_name: 'Alice',
      contact: 'alice@example.com',
      message: 'Please call me back about a voice agent project.',
    };
    const created = await post('/api/v1/messages', message);
    expect(created.status).toBe(201);
    expect((await json(created)).call_id).toBeNull();

    const call = await json(await post('/api/v1/calls/ingest', SAMPLE_CALL));

    const messages = await json(await get('/api/v1/messages'));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ call_id: call.id, caller_name: 'Alice' });
  });

  it('requires message text', async () => {
    expect((await post('/api/v1/messages', { caller_name: 'Alice' })).status).toBe(422);
  });
});

describe('private endpoint authentication', () => {
  it.each(['/api/v1/calls', '/api/v1/messages'])('%s requires the API key', async (path) => {
    expect((await request(path)).status).toBe(401);
    expect((await request(path, { headers: { Authorization: 'Bearer nope' } })).status).toBe(401);
    expect((await get(path)).status).toBe(200);
  });

  it('fails closed when no API key is configured', async () => {
    const response = await request('/api/v1/calls', { headers: AUTH }, { BACKEND_API_KEY: '' });
    expect(response.status).toBe(503);
  });

  it('leaves the public endpoints open', async () => {
    expect((await request('/health')).status).toBe(200);
    expect((await request('/api/v1/token', { method: 'POST' })).status).toBe(201);
  });
});

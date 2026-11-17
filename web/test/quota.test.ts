import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { claimSession } from '../worker/quota';
import { AUTH, post, request } from './helpers';

const fromIp = (ip: string) => request('/api/v1/token', { method: 'POST', headers: { 'cf-connecting-ip': ip } });

describe('daily session allowance (web)', () => {
  it('allows two sessions per IP per day, then refuses with 429', async () => {
    const first = await fromIp('198.51.100.7');
    const second = await fromIp('198.51.100.7');
    const third = await fromIp('198.51.100.7');

    expect(first.status).toBe(201);
    expect(((await first.json()) as Record<string, number>).sessions_remaining_today).toBe(1);
    expect(second.status).toBe(201);
    expect(((await second.json()) as Record<string, number>).sessions_remaining_today).toBe(0);
    expect(third.status).toBe(429);
    expect(Number(third.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(((await third.json()) as Record<string, string>).detail).toMatch(/today/);
  });

  it('counts each visitor separately', async () => {
    await fromIp('198.51.100.8');
    await fromIp('198.51.100.8');
    expect((await fromIp('198.51.100.8')).status).toBe(429);
    expect((await fromIp('198.51.100.9')).status).toBe(201);
  });

  it('tells the widget how long a session may last', async () => {
    const body = (await (await fromIp('198.51.100.10')).json()) as Record<string, number>;
    expect(body.max_duration_seconds).toBe(90);
  });

  it('stores only hashed IPs', async () => {
    await fromIp('198.51.100.11');
    const { results } = await env.DB.prepare('SELECT key FROM session_quota').all<{ key: string }>();
    expect(results.length).toBeGreaterThan(0);
    for (const { key } of results) {
      expect(key).toMatch(/^(ip|phone):[0-9a-f]{64}$/);
      expect(key).not.toContain('198.51.100');
    }
  });

  it('starts a fresh allowance each UTC day and prunes old rows', async () => {
    const day1 = new Date('2026-01-01T23:00:00Z');
    const day2 = new Date('2026-01-02T01:00:00Z');
    const day4 = new Date('2026-01-04T01:00:00Z');
    expect((await claimSession(env.DB, 'ip:test', 1, day1)).allowed).toBe(true);
    expect((await claimSession(env.DB, 'ip:test', 1, day1)).allowed).toBe(false);
    expect((await claimSession(env.DB, 'ip:test', 1, day2)).allowed).toBe(true);
    await claimSession(env.DB, 'ip:other', 1, day4);
    const old = await env.DB.prepare("SELECT COUNT(*) AS n FROM session_quota WHERE day = '2026-01-01'").first<{ n: number }>();
    expect(old?.n).toBe(0);
  });
});

describe('daily session allowance (phone)', () => {
  it('lets the agent claim calls per caller number', async () => {
    const claim = async () => (await (await post('/api/v1/sessions/claim', { caller: '+15551230000' })).json()) as Record<string, unknown>;
    expect(await claim()).toMatchObject({ allowed: true, count: 1, limit: 2 });
    expect(await claim()).toMatchObject({ allowed: true, count: 2 });
    expect(await claim()).toMatchObject({ allowed: false, count: 3 });
  });

  it('requires the backend API key', async () => {
    const response = await request('/api/v1/sessions/claim', { method: 'POST', json: { caller: '+1555' } });
    expect(response.status).toBe(401);
    expect((await post('/api/v1/sessions/claim', { caller: '' }, AUTH)).status).toBe(422);
  });
});

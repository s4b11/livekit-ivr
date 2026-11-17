import { env } from 'cloudflare:workers';

import app from '../worker/index';

export const AUTH = { Authorization: 'Bearer test-backend-key' };

/** Call the Worker directly, with optional binding overrides. */
export function request(
  path: string,
  init: { method?: string; json?: unknown; headers?: Record<string, string> } = {},
  overrides: Partial<Env> = {},
) {
  // Each request comes from its own visitor unless the test says otherwise, so the
  // daily session allowance only applies where a test sets cf-connecting-ip.
  const headers: Record<string, string> = {
    'cf-connecting-ip': `203.0.113.${Math.floor(Math.random() * 250) + 1}-${crypto.randomUUID()}`,
    ...init.headers,
  };
  let body: string | undefined;
  if (init.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.json);
  }
  return app.request(path, { method: init.method ?? 'GET', headers, body }, { ...env, ...overrides });
}

export const post = (path: string, json?: unknown, headers: Record<string, string> = AUTH) =>
  request(path, { method: 'POST', json, headers });

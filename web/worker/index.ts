/**
 * API for the assistant, running on Cloudflare Workers.
 *
 * Public (called from browsers):
 *   GET  /health                liveness + database connectivity
 *   POST /api/v1/token          mint a LiveKit token that starts a web session
 *                               (SESSIONS_PER_DAY per visitor IP per UTC day)
 *
 * Private (called by the agent; `Authorization: Bearer $BACKEND_API_KEY`):
 *   POST /api/v1/calls/ingest   store a finished conversation + transcript
 *   GET  /api/v1/calls          list stored conversations
 *   GET  /api/v1/calls/:id      conversation detail incl. transcript
 *   POST /api/v1/messages       store a message taken mid-conversation
 *   GET  /api/v1/messages       list messages
 *   POST /api/v1/sessions/claim count a phone call against the caller's daily allowance
 *
 * Everything else is a static asset: the React voice UI and the embed widget.
 */
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import type { ZodType } from 'zod';

import * as db from './db';
import { claimSession, hashKey, sessionsPerDay } from './quota';
import {
  callerMessageSchema,
  callIngestSchema,
  sessionClaimSchema,
  tokenRequestSchema,
} from './schemas';
import { createEmbedSession, livekitConfigured } from './token';

type AppContext = Context<{ Bindings: Env }>;

const app = new Hono<{ Bindings: Env }>();

function allowedOrigins(env: Env): string[] {
  return env.EMBED_ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.byteLength !== right.byteLength) return false;
  return crypto.subtle.timingSafeEqual(left, right);
}

/** Parse a JSON body against a schema; an empty body counts as `{}`. */
async function parseBody<T>(c: AppContext, schema: ZodType<T>) {
  const raw = await c.req.text();
  let json: unknown = {};
  if (raw.trim()) {
    try {
      json = JSON.parse(raw);
    } catch {
      return { error: c.json({ detail: 'invalid JSON body' }, 400) } as const;
    }
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    return { error: c.json({ detail: result.error.issues }, 422) } as const;
  }
  return { data: result.data } as const;
}

app.onError((error, c) => {
  console.error(error);
  return c.json({ detail: 'internal error' }, 500);
});

app.use('/api/*', (c, next) => {
  const origins = allowedOrigins(c.env);
  return cors({
    origin: origins.includes('*') ? '*' : origins,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  })(c, next);
});

app.get('/health', async (c) => {
  let database = 'up';
  try {
    await c.env.DB.prepare('SELECT 1').first();
  } catch {
    database = 'down';
  }
  return c.json({ status: 'ok', database });
});

app.post('/api/v1/token', async (c) => {
  if (!livekitConfigured(c.env)) {
    return c.json({ detail: 'LiveKit is not configured' }, 503);
  }
  const body = await parseBody(c, tokenRequestSchema);
  if (body.error) return body.error;

  const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
  const quota = await claimSession(c.env.DB, `ip:${await hashKey(ip)}`, sessionsPerDay(c.env));
  if (!quota.allowed) {
    return c.json(
      {
        detail: `You've used today's ${quota.limit} conversations with the assistant. Please come back tomorrow, or email Sabith directly.`,
        limit: quota.limit,
      },
      429,
      { 'Retry-After': String(secondsUntilUtcMidnight()) },
    );
  }

  const session = await createEmbedSession(c.env, body.data.participant_name);
  return c.json(
    {
      ...session,
      max_duration_seconds: Number(c.env.MAX_SESSION_SECONDS) || 90,
      sessions_remaining_today: quota.limit - quota.count,
    },
    201,
  );
});

function secondsUntilUtcMidnight(now = new Date()): number {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.ceil((midnight - now.getTime()) / 1000);
}

// --- Private endpoints -------------------------------------------------------

const privateApi = new Hono<{ Bindings: Env }>();

privateApi.use(async (c, next) => {
  const expected = c.env.BACKEND_API_KEY;
  if (!expected) {
    // Fail closed: caller data is never served from an unconfigured deployment.
    return c.json({ detail: 'BACKEND_API_KEY is not configured' }, 503);
  }
  const supplied = (c.req.header('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!timingSafeEqual(supplied, expected)) {
    return c.json({ detail: 'invalid or missing API key' }, 401);
  }
  await next();
});

privateApi.post('/calls/ingest', async (c) => {
  const body = await parseBody(c, callIngestSchema);
  if (body.error) return body.error;
  return c.json(await db.ingestCall(c.env.DB, body.data), 201);
});

privateApi.get('/calls', async (c) =>
  c.json(await db.listCalls(c.env.DB, Number(c.req.query('limit') ?? 50))),
);

privateApi.get('/calls/:id', async (c) => {
  const call = await db.getCall(c.env.DB, c.req.param('id'));
  return call ? c.json(call) : c.json({ detail: 'call not found' }, 404);
});

privateApi.post('/messages', async (c) => {
  const body = await parseBody(c, callerMessageSchema);
  if (body.error) return body.error;
  return c.json(await db.createMessage(c.env.DB, body.data), 201);
});

privateApi.get('/messages', async (c) =>
  c.json(await db.listMessages(c.env.DB, Number(c.req.query('limit') ?? 100))),
);

privateApi.post('/sessions/claim', async (c) => {
  const body = await parseBody(c, sessionClaimSchema);
  if (body.error) return body.error;
  const quota = await claimSession(
    c.env.DB,
    `phone:${await hashKey(body.data.caller)}`,
    sessionsPerDay(c.env),
  );
  return c.json(quota);
});

app.route('/api/v1', privateApi);
app.all('/api/*', (c) => c.json({ detail: 'not found' }, 404));

export default app;

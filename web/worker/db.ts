import type { CallerMessageInput, CallIngest } from './schemas';

/** The raw session report is kept for debugging only; skip it when it is huge. */
const MAX_REPORT_BYTES = 900_000;

interface CallRow {
  id: string;
  room_name: string;
  agent_name: string;
  channel: string;
  caller_number: string;
  called_number: string;
  sip_call_id: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
}

interface TranscriptRow {
  id: string;
  idx: number;
  role: string;
  content: string;
  interrupted: number;
  timestamp: string | null;
}

export interface MessageRow {
  id: string;
  call_id: string | null;
  room_name: string;
  caller_name: string;
  contact: string;
  message: string;
  created_at: string;
}

const CALL_COLUMNS =
  'id, room_name, agent_name, channel, caller_number, called_number, sip_call_id, status, ' +
  'started_at, ended_at, duration_seconds, created_at';

const newId = () => crypto.randomUUID().replaceAll('-', '');
const now = () => new Date().toISOString();
const clampLimit = (limit: number, max: number) => Math.min(Math.max(Math.trunc(limit) || 1, 1), max);

function serializeReport(report: CallIngest['report']): string | null {
  if (!report) return null;
  const json = JSON.stringify(report);
  return json.length > MAX_REPORT_BYTES ? null : json;
}

/**
 * Store a finished conversation and its transcript, and link any messages taken
 * during it. One batch, so it is applied atomically.
 */
export async function ingestCall(db: D1Database, payload: CallIngest) {
  const callId = newId();
  const statements = [
    db
      .prepare(
        `INSERT INTO call_sessions (${CALL_COLUMNS}, report)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        callId,
        payload.room_name,
        payload.agent_name,
        payload.channel,
        payload.caller_number,
        payload.called_number,
        payload.sip_call_id,
        payload.status,
        payload.started_at ?? null,
        payload.ended_at ?? null,
        payload.duration_seconds ?? null,
        now(),
        serializeReport(payload.report),
      ),
    ...payload.items.map((item, idx) =>
      db
        .prepare(
          `INSERT INTO transcript_items (id, call_id, idx, role, content, interrupted, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          newId(),
          callId,
          idx,
          item.role,
          item.content,
          item.interrupted ? 1 : 0,
          item.timestamp ?? null,
        ),
    ),
    db
      .prepare('UPDATE caller_messages SET call_id = ? WHERE room_name = ? AND call_id IS NULL')
      .bind(callId, payload.room_name),
  ];
  await db.batch(statements);
  return getCall(db, callId);
}

export async function listCalls(db: D1Database, limit = 50) {
  const { results } = await db
    .prepare(`SELECT ${CALL_COLUMNS} FROM call_sessions ORDER BY created_at DESC LIMIT ?`)
    .bind(clampLimit(limit, 200))
    .all<CallRow>();
  return results;
}

export async function getCall(db: D1Database, callId: string) {
  const call = await db
    .prepare(`SELECT ${CALL_COLUMNS} FROM call_sessions WHERE id = ?`)
    .bind(callId)
    .first<CallRow>();
  if (!call) return null;

  const { results } = await db
    .prepare(
      `SELECT id, idx, role, content, interrupted, timestamp
       FROM transcript_items WHERE call_id = ? ORDER BY idx`,
    )
    .bind(callId)
    .all<TranscriptRow>();
  return {
    ...call,
    transcript_items: results.map((item) => ({ ...item, interrupted: item.interrupted === 1 })),
  };
}

export async function createMessage(db: D1Database, payload: CallerMessageInput) {
  const message: MessageRow = {
    id: newId(),
    call_id: null,
    room_name: payload.room_name,
    caller_name: payload.caller_name,
    contact: payload.contact,
    message: payload.message,
    created_at: now(),
  };
  await db
    .prepare(
      `INSERT INTO caller_messages (id, call_id, room_name, caller_name, contact, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      message.id,
      message.call_id,
      message.room_name,
      message.caller_name,
      message.contact,
      message.message,
      message.created_at,
    )
    .run();
  return message;
}

export async function listMessages(db: D1Database, limit = 100) {
  const { results } = await db
    .prepare(
      `SELECT id, call_id, room_name, caller_name, contact, message, created_at
       FROM caller_messages ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(clampLimit(limit, 500))
    .all<MessageRow>();
  return results;
}

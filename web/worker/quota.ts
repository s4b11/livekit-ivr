/** Daily session allowance: N conversations per visitor (or caller) per UTC day. */

export interface QuotaResult {
  allowed: boolean;
  count: number;
  limit: number;
}

export function sessionsPerDay(env: Env): number {
  const n = Number(env.SESSIONS_PER_DAY);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2;
}

/** SHA-256 hex, so raw IP addresses and phone numbers are never stored. */
export async function hashKey(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const utcDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Count one session against `key` for today and say whether it is within the limit.
 * Refused attempts count too, so hammering the endpoint never frees up a slot.
 */
export async function claimSession(
  db: D1Database,
  key: string,
  limit: number,
  now = new Date(),
): Promise<QuotaResult> {
  const today = utcDay(now);
  const twoDaysAgo = utcDay(new Date(now.getTime() - 2 * 86_400_000));
  const [, claimed] = await db.batch<{ count: number }>([
    // Keep the table small: yesterday's rows are no longer needed.
    db.prepare('DELETE FROM session_quota WHERE day < ?').bind(twoDaysAgo),
    db
      .prepare(
        `INSERT INTO session_quota (key, day, count) VALUES (?, ?, 1)
         ON CONFLICT (key, day) DO UPDATE SET count = count + 1
         RETURNING count`,
      )
      .bind(key, today),
  ]);
  const count = claimed.results[0]?.count ?? limit + 1;
  return { allowed: count <= limit, count, limit };
}

/**
 * Fixed-window rate limiting backed by the database, so limits survive a
 * restart and work across processes. Keyed by action + identifier (ip/email).
 */
import { sql } from "drizzle-orm";
import { getDb } from "../db/client";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const db = getDb();
  // Atomic upsert: bump the counter when still inside the window, else reset it.
  const res = await db.execute<{ count: number; window_start: Date }>(sql`
    insert into rate_limits (key, count, window_start)
    values (${key}, 1, now())
    on conflict (key) do update set
      count = case
        when rate_limits.window_start < now() - ${sql.raw(`interval '${windowSeconds} seconds'`)}
        then 1 else rate_limits.count + 1 end,
      window_start = case
        when rate_limits.window_start < now() - ${sql.raw(`interval '${windowSeconds} seconds'`)}
        then now() else rate_limits.window_start end
    returning count, window_start
  `);

  const row = res.rows[0];
  const count = Number(row?.count ?? 1);
  const started = row?.window_start ? new Date(row.window_start) : new Date();
  const elapsed = (Date.now() - started.getTime()) / 1000;
  const retry = Math.max(0, Math.ceil(windowSeconds - elapsed));

  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: retry,
  };
}

/** Clear a limiter after a successful attempt (e.g. correct password). */
export async function resetRateLimit(key: string) {
  const db = getDb();
  await db.execute(sql`delete from rate_limits where key = ${key}`);
}

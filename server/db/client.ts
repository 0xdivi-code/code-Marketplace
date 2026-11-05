/**
 * Database access.
 *
 * Development and the sandbox use PGlite (embedded PostgreSQL 18, WASM) so the
 * app runs with no external service. Setting DATABASE_URL switches to a real
 * Postgres server — the schema and every query stay identical.
 */
import { PGlite } from "@electric-sql/pglite";
import { acquireDbLock } from "../lib/dblock";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** dir: node-postgres; pglite: embedded. Shared query surface. */
export type Database = NodePgDatabase<typeof schema>;

const DATA_DIR = process.env.PGLITE_DIR ?? resolve(process.cwd(), ".data/pg");

let _db: Database | null = null;
let _client: PGlite | null = null;
let _connecting: Promise<PGlite> | null = null;
let releaseLock: (() => void) | null = null;

/**
 * PGlite is single-connection: everything must share ONE instance, otherwise
 * migrations and queries end up on different in-memory instances and tables
 * "do not exist". Always go through this.
 */
export async function getClient(): Promise<PGlite> {
  if (_client) return _client;
  if (!_connecting) {
    mkdirSync(dirname(DATA_DIR), { recursive: true });
    _connecting = (async () => {
      // PGlite is a single-writer database: take the directory lock first so a
      // second process fails loudly instead of corrupting the data.
      releaseLock = acquireDbLock(DATA_DIR);
      const c = new PGlite(DATA_DIR);
      await c.waitReady;
      _client = c;
      return c;
    })();
  }
  return _connecting;
}

export function getDb(): Database {
  if (_db) return _db;
  throw new Error("getDb() called before initDb(); call `await initDb()` at startup.");
}

/** Initialise the shared client + drizzle handle. Call once at process start. */
export async function initDb(): Promise<Database> {
  if (_db) return _db;
  const client = await getClient();
  _db = drizzlePglite(client, { schema }) as unknown as Database;
  return _db;
}

/** Raw multi-statement exec — migrations contain many commands per file. */
export async function execRaw(sqlText: string) {
  const client = await getClient();
  return client.exec(sqlText);
}

export async function closeDb() {
  if (_client) {
    await _client.close();
    _client = null;
    _db = null;
    _connecting = null;
    releaseLock?.();
    releaseLock = null;
  }
}

export { schema };

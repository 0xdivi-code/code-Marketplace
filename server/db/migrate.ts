/**
 * Migrations.
 *
 * A tiny ledger-based runner rather than a code generator: it applies the SQL
 * files in ./migrations in order and records them in `_migrations`, which keeps
 * behaviour identical on PGlite and on a real Postgres server.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { getDb, execRaw, initDb } from "./client";

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(here, "migrations");

export async function migrate({ log = true }: { log?: boolean } = {}) {
  const db = await initDb();

  await db.execute(sql`
    create table if not exists _migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const applied = new Set<string>(
    (await db.execute<{ name: string }>(sql`select name from _migrations`)).rows.map((r) => r.name),
  );

  // `FORCE_MIGRATION=<file>` re-runs one file even though it is in the ledger.
  // Used when a migration is edited before a release; it must already be
  // idempotent, which every file here is.
  const forced = process.env.FORCE_MIGRATION;
  if (forced) await db.execute(sql`delete from _migrations where name = ${forced}`);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const body = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    // A migration file holds many statements, which a prepared statement cannot
    // carry — use the raw exec path. Each file is idempotent, so a retry is safe.
    await execRaw(body);
    await db.execute(sql`insert into _migrations (name) values (${file})`);
    ran.push(file);
    if (log) console.log(`  ✓ ${file}`);
  }

  if (log) {
    console.log(ran.length ? `Applied ${ran.length} migration(s).` : "Database already up to date.");
  }
  return ran;
}

if (process.argv[1] && process.argv[1].endsWith("migrate.ts")) {
  migrate()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

/**
 * Restore a backup produced by `backup.ts`.
 *
 * Destructive: it replaces the live database and the storage root. Refuses to
 * run unless the API is stopped, because writing under a running server
 * corrupts the embedded database.
 *
 *   npx tsx server/scripts/restore.ts /var/backups/kiln/2026-11-05T02-00-00
 */
// Load ./.env exactly as the API does: these scripts must act on the same data
// directory, and dotenv does not override variables already in the environment.
import "dotenv/config";
import { readFile, rm, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const source = process.argv[2];
if (!source) {
  console.error("usage: tsx server/scripts/restore.ts <backup-directory>");
  process.exit(1);
}

const dir = resolve(source);
const storageDir = resolve(process.env.STORAGE_DIR ?? ".data/storage");
const pgDir = resolve(process.env.PGLITE_DIR ?? ".data/pg");

const manifestPath = join(dir, "manifest.json");
if (!existsSync(manifestPath)) {
  console.error(`No manifest.json in ${dir} — that is not a backup directory.`);
  process.exit(1);
}
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
  createdAt: string;
  databaseUrl: boolean;
  files: { name: string; sha256: string }[];
};

console.log(`Restoring backup from ${manifest.createdAt}`);
console.log("Stop the API before continuing. Press Ctrl-C to abort.");
await new Promise((r) => setTimeout(r, 3000));

// An embedded database cannot be replaced while a process holds it.
try {
  await rm(pgDir, { recursive: true, force: true });
  await cp(join(dir, "pg"), pgDir, { recursive: true });
  console.log("  database restored");
} catch (error) {
  console.error(
    "Could not replace the database directory. Is the API still running? " +
      "(systemctl stop kiln)",
  );
  throw error;
}

if (existsSync(join(dir, "storage.tar.gz"))) {
  await rm(storageDir, { recursive: true, force: true });
  await run("mkdir", ["-p", storageDir]);
  await run("tar", ["-xzf", join(dir, "storage.tar.gz"), "-C", storageDir]);
  console.log("  archives restored");
}

console.log(`
Restore complete. Start the API and check:
  curl -fsS http://127.0.0.1:8787/api/health
Then sign in to the admin console and confirm an order opens and a download works.
`);
process.exit(0);

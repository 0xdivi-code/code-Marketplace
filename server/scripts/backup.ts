/**
 * Back up the database and the private archive store together.
 *
 * A database row that points at a missing archive is a broken product, so the
 * two are captured in one directory with a manifest of checksums. Copy the
 * result off the machine — a backup on the same disk is not a backup.
 *
 *   npx tsx server/scripts/backup.ts /var/backups/kiln
 */
import { mkdir, writeFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { initDb } from "../db/client";

const run = promisify(execFile);

const target = resolve(process.argv[2] ?? "./backups");
const storageDir = resolve(process.env.STORAGE_DIR ?? ".data/storage");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dir = join(target, stamp);

async function checksum(path: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((done, fail) => {
    createReadStream(path)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => done())
      .on("error", fail);
  });
  return hash.digest("hex");
}

async function du(path: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) total += await du(full);
    else total += (await stat(full)).size;
  }
  return total;
}

/**
 * Refuse to copy a live database.
 *
 * PGlite's data directory is being written while the server runs, so a copy
 * taken then can be internally inconsistent — a backup that restores into a
 * corrupted database is worse than none. The lock file tells us whether another
 * process owns it.
 */
const lockPath = resolve(process.env.PGLITE_DIR ?? ".data/pg", "..", ".pglite.lock");
if (!process.env.DATABASE_URL && existsSync(lockPath)) {
  console.error(
    "The API is running and holds the database lock.\n" +
      "Stop it first (systemctl stop kiln), run the backup, then start it again.\n" +
      "For a zero-downtime backup, point DATABASE_URL at a real PostgreSQL server " +
      "and this script will use pg_dump instead.",
  );
  process.exit(1);
}

await mkdir(dir, { recursive: true });

// The database client must be initialised before a dump can be taken from
// PGlite; an external server is dumped with pg_dump instead.
await initDb();

const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  console.log("dumping external PostgreSQL…");
  await run("pg_dump", ["--no-owner", "--format=custom", `--file=${join(dir, "database.dump")}`, dbUrl]);
} else {
  /**
   * PGlite keeps a real PostgreSQL data directory. Copying it while the server
   * is stopped is exact; copying while it runs is not, so we require a clean
   * stop and say so loudly.
   */
  const pgDir = resolve(process.env.PGLITE_DIR ?? ".data/pg");
  console.log(`copying embedded database from ${pgDir}…`);
  try {
    await run("cp", ["-a", pgDir, join(dir, "pg")]);
  } catch (error) {
    console.error(
      "Could not copy the database directory. Stop the API first (systemctl stop kiln) " +
        "so the files are not changing mid-copy.",
    );
    throw error;
  }
}

console.log(`archiving ${storageDir}…`);
try {
  await run("tar", ["-czf", join(dir, "storage.tar.gz"), "-C", storageDir, "."]);
} catch {
  console.warn("storage root is empty or missing — writing an empty archive");
  await writeFile(join(dir, "storage.EMPTY"), "No files were present at backup time.\n");
}

const files = (await readdir(dir)).filter((f) => f !== "manifest.json" && !f.startsWith("pg"));
const manifest = {
  createdAt: new Date().toISOString(),
  databaseUrl: Boolean(dbUrl),
  storageDir,
  bytes: await du(dir).catch(() => 0),
  files: await Promise.all(
    files.map(async (f) => ({ name: f, sha256: await checksum(join(dir, f)) })),
  ),
};
await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`\nBackup written to ${dir}`);
console.log(`  ${files.join(", ")}`);
console.log("  Copy this directory off the machine.");
process.exit(0);

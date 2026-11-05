/**
 * Single-writer guard for the embedded database.
 *
 * PGlite is a real PostgreSQL running in-process against a directory, and two
 * processes opening the same directory corrupt it. `tsx watch` restarts can
 * overlap briefly, so we take an exclusive lock file before opening and refuse
 * to start (with a clear message) if another instance already holds it.
 */
import { mkdirSync, writeFileSync, readFileSync, unlinkSync, existsSync, openSync, closeSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function acquireDbLock(dir: string): () => void {
  const lockPath = resolve(dir, "..", ".pglite.lock");
  mkdirSync(dirname(lockPath), { recursive: true });

  try {
    // 'wx' fails if the file already exists — atomic across processes.
    const fd = openSync(lockPath, "wx");
    writeFileSync(fd, String(process.pid));
    closeSync(fd);
  } catch {
    const holder = existsSync(lockPath) ? readFileSync(lockPath, "utf8").trim() : "unknown";
    const alive = /^\d+$/.test(holder) && isProcessAlive(Number(holder));
    if (alive && Number(holder) !== process.pid) {
      throw new Error(
        `The database directory is already open by process ${holder}.\n` +
          `Stop that process first — two writers would corrupt the data.`,
      );
    }
    // Stale lock from a crash: take it over.
    writeFileSync(lockPath, String(process.pid));
  }

  const release = () => {
    try {
      if (existsSync(lockPath) && readFileSync(lockPath, "utf8").trim() === String(process.pid)) {
        unlinkSync(lockPath);
      }
    } catch {
      /* best effort */
    }
  };

  process.once("exit", release);
  process.once("SIGINT", () => {
    release();
    process.exit(0);
  });
  process.once("SIGTERM", () => {
    release();
    process.exit(0);
  });

  return release;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

#!/usr/bin/env node
/**
 * Run the API and the storefront together.
 *
 * Deliberately dependency-free: the previous `dev:all` shelled out to
 * `concurrently`, which was never declared in package.json, so it worked on a
 * machine that happened to have it globally installed and failed with
 * "concurrently: command not found" on a clean checkout.
 *
 * npm resolves each `npm run <script>` against the local node_modules/.bin, so
 * this needs nothing beyond the declared dependencies.
 */
import { spawn } from "node:child_process";

const CHILDREN = [
  { name: "api", color: "\x1b[32m", args: ["run", "api"] },
  { name: "web", color: "\x1b[36m", args: ["run", "dev"] },
];

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const running = new Set();
let shuttingDown = false;

/** Prefix every line so it is obvious which process is talking. */
function pipe(stream, name, color, target) {
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      target.write(`${color}${name.padEnd(3)}${RESET} ${DIM}│${RESET} ${line}\n`);
    }
  });
  stream.on("end", () => {
    if (buffer.trim()) target.write(`${color}${name.padEnd(3)}${RESET} ${DIM}│${RESET} ${buffer}\n`);
  });
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of running) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  }
  // Give children a moment to close their listeners, then leave.
  setTimeout(() => process.exit(code), 300);
}

for (const { name, color, args } of CHILDREN) {
  // `shell: true` makes this work on Windows, where npm is npm.cmd.
  const child = spawn("npm", args, {
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
    env: process.env,
  });
  running.add(child);

  pipe(child.stdout, name, color, process.stdout);
  pipe(child.stderr, name, color, process.stderr);

  child.on("exit", (code, signal) => {
    running.delete(child);
    if (shuttingDown) return;
    // One side dying is almost always fatal for the other: a storefront with no
    // API shows empty grids, and an API with no storefront is unreachable.
    console.log(`\n${color}${name}${RESET} exited (${signal ?? `code ${code}`}) — stopping the other process.`);
    shutdown(code ?? 1);
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log(`${DIM}Starting API and storefront. Both stop on Ctrl-C.${RESET}\n`);

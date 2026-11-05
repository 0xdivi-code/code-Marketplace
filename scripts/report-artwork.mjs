#!/usr/bin/env node
/**
 * What is artwork, and what is still a placeholder.
 *
 * Prints every slot the storefront can show, the path it currently resolves to,
 * and whether that file is actually on disk. Run it after an import to confirm
 * the swap landed, and after deleting assets to find what fell back.
 *
 *   npm run art:report
 *   npm run art:report -- --missing    # only the slots with no real image
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const only = process.argv.includes("--missing");

const refSrc = readFileSync(join(root, "src/data/ref-images.ts"), "utf8");
const artSrc = readFileSync(join(root, "src/data/artwork.ts"), "utf8");

const slots = refSrc
  .split("\n")
  .filter((l) => l.includes("file:") && l.includes("kind:"))
  .map((l) => ({
    key: /file:\s*"([^"]+)"/.exec(l)?.[1],
    kind: /kind:\s*"([^"]+)"/.exec(l)?.[1],
    label: /label:\s*"([^"]+)"/.exec(l)?.[1],
  }))
  .filter((s) => s.key && s.kind && s.label);

const artwork = new Map([...artSrc.matchAll(/^\s*"([^"]+)":\s*"([^"]+)",?$/gm)].map((m) => [m[1], m[2]]));

// keys the catalog actually uses, so unused manifest entries can be called out
const catalog = ["src/data/catalog.ts", "src/data/seed-catalog.ts"]
  .map((f) => readFileSync(join(root, f), "utf8"))
  .join("\n");
const used = new Set([
  ...[...catalog.matchAll(/refSrc\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1]),
  ...[...catalog.matchAll(/images:\s*\[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/"([a-z0-9-]+)"/g)].map((x) => x[1])),
]);

const onDisk = (p) => p && existsSync(join(root, "public", p.replace(/^\//, "")));

// an entry whose file is missing would 404 and blank the slot — ignore it, so
// the report reflects what the browser will actually get
for (const [key, p] of [...artwork]) if (!onDisk(p)) artwork.delete(key);

const rows = slots.map((s) => {
  const own = artwork.get(s.key);
  const path = own ?? (used.has(s.key) ? `/img/ref/${s.key}.webp` : null);
  const state = !path ? "unused" : onDisk(path) ? (own ? "artwork" : "reference") : "missing";
  return { ...s, path, state };
});

const shown = only ? rows.filter((r) => r.state === "missing" || r.state === "reference") : rows.filter((r) => r.state !== "unused");

const w = (label, list, i) => Math.max(label.length, ...list.map((r) => String(r[i]).length));
const c1 = Math.max(20, w("slot", shown, "key"));
const c2 = Math.max(8, w("kind", shown, "kind"));
const c3 = Math.max(9, w("status", shown, "state"));
const c4 = Math.max(20, w("resolves to", shown, "path"));

console.log("");
console.log("slot".padEnd(c1) + "  " + "kind".padEnd(c2) + "  " + "status".padEnd(c3) + "  resolves to");
console.log("─".repeat(c1 + c2 + c3 + c4 + 6));
for (const r of shown) {
  const mark = r.state === "artwork" ? "✓" : r.state === "reference" ? "~" : r.state === "missing" ? "✗" : "·";
  console.log(
    r.key.padEnd(c1) + "  " + r.kind.padEnd(c2) + "  " + r.state.padEnd(c3) + "  " + (r.path ?? "—") + "  " + mark,
  );
}

const count = (s) => rows.filter((r) => r.state === s).length;
const total = rows.filter((r) => r.state !== "unused").length;

console.log("");
console.log(`✓ artwork ${count("artwork")}   ~ reference ${count("reference")}   ✗ missing ${count("missing")}   · unused ${count("unused")}`);
if (count("missing")) {
  console.log(`\n${count("missing")} slot${count("missing") === 1 ? "" : "s"} will render generated gradient art until a file lands there.`);
  console.log("Fill them in one go:  npm run art:import -- ./artwork");
}
if (count("artwork") === total && total) console.log("\nEvery slot in use carries original artwork.");
console.log("");

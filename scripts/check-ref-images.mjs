#!/usr/bin/env node
/**
 * Guards the reference-image keys used by the catalog.
 *
 * The failure this prevents is silent rather than loud: `<ProductArt>` falls
 * back to generated gradient art whenever `refSrc()` returns undefined, so a
 * typo'd or unregistered key produced a perfectly plausible-looking cover that
 * simply was not the intended image. `p-scripts-code-generic` sat in the catalog
 * that way, pointing at nothing, and nothing complained.
 *
 * Checks, in order of how much they matter:
 *   1. every key the catalog references exists in the manifest (else: the image
 *      can never load, whatever else is true)
 *   2. the generated fetch script lists every manifest entry (else: the file is
 *      never downloaded, even on a machine that can reach the demo site)
 *   3. no orphan files sit in public/img/ref
 *
 * Use `--strict` to also fail when a reachable manifest image is not yet
 * downloaded. The default is not strict because the images live in a gitignored
 * directory: a fresh clone legitimately has none, and CI should not fail for a
 * developer who has not run the fetch script.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;
const strict = process.argv.includes("--strict");

const read = (p) => readFileSync(new URL(p, `file://${root}`), "utf8");
const manifestSrc = read("src/data/ref-images.ts");
const fetchSrc = read("scripts/fetch-ref-images.sh");

/**
 * Both catalog files matter and they are not the same file:
 *   catalog.ts       — what the storefront renders
 *   seed-catalog.ts  — what `npm run seed` writes into the database
 *
 * Checking only catalog.ts is precisely how a broken key survived: the seed file
 * still pointed at a key that did not exist, so the database got a null
 * coverPath and the product rendered gradient art forever.
 */
const CATALOG_FILES = ["src/data/catalog.ts", "src/data/seed-catalog.ts"];

const manifest = new Set([...manifestSrc.matchAll(/file:\s*"([^"]+)"/g)].map((m) => m[1]));

// Every way a catalog can name an image, across every catalog file.
const used = new Set();
const usedIn = new Map();
for (const file of CATALOG_FILES) {
  const body = read(file);
  const here = new Set();
  for (const m of body.matchAll(/refSrc\(\s*"([^"]+)"\s*\)/g)) here.add(m[1]);
  for (const m of body.matchAll(/art\((?:[^()]|\([^()]*\))*?"([a-z0-9-]+)"\s*\)/g)) here.add(m[1]);
  for (const m of body.matchAll(/images:\s*\[([^\]]*)\]/g)) {
    for (const k of m[1].matchAll(/"([a-z0-9-]+)"/g)) here.add(k[1]);
  }
  usedIn.set(file, here);
  for (const k of here) used.add(k);
}

const inScript = new Set([...fetchSrc.matchAll(/^\s*get\s+"([^"]+)"/gm)].map((m) => m[1]));

const problems = [];

const unknown = [...used].filter((k) => !manifest.has(k)).sort();
for (const k of unknown) {
  const where = [...usedIn].filter(([, keys]) => keys.has(k)).map(([f]) => f).join(", ");
  problems.push(`"${k}" is referenced in ${where} but is not in ref-images.ts — it can never load`);
}

const undownloadable = [...manifest].filter((k) => !inScript.has(k)).sort();
for (const k of undownloadable) {
  problems.push(`"${k}" is in the manifest but not in fetch-ref-images.sh — run gen-fetch-script.mjs`);
}

/*
 * Project_Images are the marketplace's own screenshots, committed under
 * public/img/products by `npm run art:projects`. They are referenced by the
 * generated project-images manifest rather than by catalog keys, so they are
 * validated separately: a product pointing at a file that is not on disk would
 * render a broken cover, which is exactly what this guard exists to prevent.
 */
const projectSrc = read("src/data/project-images.ts");
const projectFiles = [...projectSrc.matchAll(/"\/img\/products\/([^"]+)"/g)].map((m) => m[1]);
const missingProject = projectFiles.filter((f) => !existsSync(`${root}public/img/products/${f}`));
for (const f of missingProject) {
  problems.push(`public/img/products/${f} is in project-images.ts but not on disk — run npm run art:projects`);
}

const refDir = `${root}public/img/ref`;
if (existsSync(refDir)) {
  const present = new Set(readdirSync(refDir).filter((f) => f.endsWith(".webp")).map((f) => f.replace(/\.webp$/, "")));
  for (const f of present) {
    if (!manifest.has(f)) problems.push(`public/img/ref/${f}.webp is not referenced by the manifest — orphan file`);
  }
  if (strict) {
    const usedPresent = [...used].filter((k) => present.has(k)).length;
    if (usedPresent !== used.size) {
      problems.push(`${used.size - usedPresent} of ${used.size} catalog images are not downloaded — run: bash scripts/fetch-ref-images.sh`);
    }
  }
}

if (problems.length) {
  console.error(`\nReference image check failed (${problems.length} problem${problems.length === 1 ? "" : "s"}):\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error("");
  process.exit(1);
}

console.log(
  `Images OK — ${used.size} catalog keys in the manifest, ${manifest.size} fetchable; ${projectFiles.length} project screenshots present.`,
);

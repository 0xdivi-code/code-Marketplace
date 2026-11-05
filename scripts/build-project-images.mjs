#!/usr/bin/env node
/**
 * Build the storefront's own copies of the Project_Images screenshots.
 *
 * Originals stay exactly where they are, untouched, and are committed to the
 * repo as the source of truth. This produces derived copies under
 * public/img/products/ because the originals are retina-sized PNGs — several
 * are 4–6 MB, and 19 of them on a listing page is not a page anyone can load.
 *
 * Two derivatives per image, both WebP, both at the image's *own* aspect ratio:
 *
 *   <slug>/<name>-cover.webp   1280px wide, for cards and the detail cover
 *   <slug>/<name>-full.webp    2200px wide, for the detail gallery and lightbox
 *
 * No cropping and no stretching. The screenshots are 16:9-ish desktop captures;
 * cropping them to the 4:3 card frame would cut navigation and sidebars off and
 * make them read as fragments rather than products. They are scaled down only,
 * and every container they sit in already uses object-cover.
 *
 *   npm run art:projects
 *   npm run art:projects -- --force     # rebuild files that already exist
 *   npm run art:projects -- --check     # report without writing
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const SRC = join(root, "Project_Images");
const OUT = join(root, "public/img/products");
const MANIFEST = "src/data/project-images.ts";

const argv = process.argv.slice(2);
const FORCE = argv.includes("--force");
const CHECK = argv.includes("--check");

if (!existsSync(SRC)) {
  console.error(`No Project_Images folder at ${SRC}`);
  process.exit(1);
}

/* ---------------------------------------------------- product assignment map */

/**
 * Filename stem -> product slug. Every original is listed explicitly: the
 * whole point of this pass is that each casino image belongs to its own
 * casino product, so a name-matching heuristic would be the wrong tool.
 *
 * Near-duplicates are kept (they are all real screenshots and every file was
 * asked for in the gallery) but flagged, so the report is honest about the
 * fact that Shuffle's three frames show the same page at different scrolls.
 */
const ASSIGN = {
  dub_casino_1: { slug: "dubs-casino", role: "cover", note: "logged-in home" },
  dub_casino_2: { slug: "dubs-casino", role: "gallery", note: "mobile admin, near-duplicate frame" },
  dubs_casino_3: { slug: "dubs-casino", role: "gallery", note: "logged-in home, sidebar layout" },
  dubs_casino_4: { slug: "dubs-casino", role: "gallery", note: "logged-out home" },
  screenshot_2025_11_19_at_12_21_04: { slug: "dubs-casino", role: "gallery", note: "logged-out home, near-duplicate of _4" },

  shuffle_casino_1: { slug: "shuffle-casino", role: "cover", note: "" },
  shuffle_casino_2: { slug: "shuffle-casino", role: "gallery", note: "near-duplicate (scroll offset)" },
  shuffle_casino_3: { slug: "shuffle-casino", role: "gallery", note: "near-duplicate (scroll offset)" },

  minebit_casino_1: { slug: "minebit-casino", role: "cover", note: "lobby" },
  minebit_casino_2: { slug: "minebit-casino", role: "gallery", note: "slots grid" },

  whale_casino_1: { slug: "whale-casino", role: "cover", note: "casino lobby" },
  whale_casino_2: { slug: "whale-casino", role: "gallery", note: "crypto markets page" },

  kings_casino_1: { slug: "kings-casino", role: "cover", note: "" },
  dustbit_casino_1: { slug: "dustbit-casino", role: "cover", note: "casino + sportsbook" },

  moonsale_launchpad_1: { slug: "moonsale-launchpad", role: "cover", note: "swap & bridge" },
  moonsale_launchpad_2: { slug: "moonsale-launchpad", role: "gallery", note: "create launch" },
  moonsale_launchpad_3: { slug: "moonsale-launchpad", role: "gallery", note: "create token" },
  moonsale_launchpad_4: { slug: "moonsale-launchpad", role: "gallery", note: "create presale" },
  moonsale_launchpad_5: { slug: "moonsale-launchpad", role: "gallery", note: "marketing / landing" },
};

/** Storefront-facing name for each output asset. */
const stem = (f) =>
  f
    .replace(/\.png$/i, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();

const im = (args) => execFileSync("convert", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const size = (f) => {
  const [w, h] = im([f, "-ping", "-format", "%w %h", "info:"]).split(" ").map(Number);
  return { w, h };
};

const files = readdirSync(SRC).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();

const report = [];
const missing = [];
const out = new Map();

for (const file of files) {
  const key = stem(file);
  const assign = ASSIGN[key];
  if (!assign) {
    missing.push(file);
    report.push({ file, slug: "—", role: "—", out: "—", src: "—", note: "no assignment" });
    continue;
  }

  const { w, h } = size(join(SRC, file));
  const dir = join(OUT, assign.slug);
  const base = key.replace(/_casino_|_launchpad_/, "-");
  const coverOut = `${base}-cover.webp`;
  const fullOut = `${base}-full.webp`;
  const ratio = (w / h).toFixed(3);

  const coverPath = join(dir, coverOut);
  const fullPath = join(dir, fullOut);

  if (!CHECK) {
    if (FORCE || !existsSync(coverPath)) {
      mkdirSync(dir, { recursive: true });
      im([join(SRC, file), "-resize", "1280x", "-quality", "82", "-define", "webp:method=6", coverPath]);
    }
    if (FORCE || !existsSync(fullPath)) {
      mkdirSync(dir, { recursive: true });
      im([join(SRC, file), "-resize", "2200x", "-quality", "84", "-define", "webp:method=6", fullPath]);
    }
  }

  const cOut = existsSync(coverPath) ? size(coverPath) : { w: 0, h: 0 };
  const fOut = existsSync(fullPath) ? size(fullPath) : { w: 0, h: 0 };
  const inKb = statSync(join(SRC, file)).size / 1024;
  const outKb = (existsSync(coverPath) ? statSync(coverPath).size : 0) / 1024;

  // aspect ratio must survive the resize, or the storefront shows stretched art
  const coverRatio = cOut.h ? (cOut.w / cOut.h).toFixed(3) : "—";
  const drift = cOut.h ? Math.abs(Number(coverRatio) - Number(ratio)) : 0;

  out.set(key, { slug: assign.slug, cover: `/img/products/${assign.slug}/${coverOut}`, full: `/img/products/${assign.slug}/${fullOut}`, role: assign.role });

  report.push({
    file,
    slug: assign.slug,
    role: assign.role,
    out: `${cOut.w}×${cOut.h} (${outKb.toFixed(0)} kB)`,
    src: `${w}×${h} (${inKb.toFixed(0)} kB)`,
    ratio: `${ratio} → ${coverRatio}${drift > 0.01 ? " ✗ DRIFT" : ""}`,
    note: assign.note,
  });
}

/* ------------------------------------------------------------------- report */

const H = ["file", "product", "role", "source", "web", "ratio", "note"];
const W = H.map((h, i) => Math.min(i === 0 ? 40 : 34, Math.max(h.length, ...report.map((r) => String(r[h] ?? "").length))));
const row = (vals) => vals.map((v, i) => String(v ?? "").padEnd(W[i])).join("  ").trimEnd();

console.log(`\n${CHECK ? "CHECK — nothing written" : "Building"} web copies from Project_Images\n`);
console.log(row(H));
console.log(W.map((w) => "─".repeat(w)).join("  "));
for (const r of report) console.log(row(H.map((h) => r[h])));

const bySlug = new Map();
for (const r of report) {
  if (r.slug === "—") continue;
  if (!bySlug.has(r.slug)) bySlug.set(r.slug, []);
  bySlug.get(r.slug).push(r);
}

console.log("");
for (const [slug, imgs] of bySlug) {
  const cover = imgs.find((i) => i.role === "cover");
  console.log(`  ${slug.padEnd(20)} ${String(imgs.length).padStart(2)} image${imgs.length === 1 ? "" : "s"}   cover: ${cover ? cover.file : "NONE"}`);
}

if (missing.length) {
  console.log(`\n✗ ${missing.length} file(s) have no product assignment: ${missing.join(", ")}`);
}

const dupes = report.filter((r) => r.note?.includes("near-duplicate"));
if (dupes.length) {
  console.log(`\n⚠ ${dupes.length} near-duplicates kept in galleries by request — they show the same page at a different scroll offset:`);
  for (const d of dupes) console.log(`    ${d.file}`);
}

if (!CHECK) {
  /* ------------------------------------------------------- write the manifest */
  const lines = [];
  for (const [slug, imgs] of bySlug) {
    const cover = imgs.find((i) => i.role === "cover");
    const gallery = imgs.filter((i) => i.role === "gallery");
    lines.push(`  "${slug}": {`);
    if (cover) lines.push(`    cover: ${JSON.stringify(out.get(stem(cover.file)).cover)},`);
    lines.push(`    gallery: [`);
    for (const g of imgs) lines.push(`      ${JSON.stringify(out.get(stem(g.file)).full)},`);
    lines.push(`    ],`);
    lines.push(`  },`);
  }

  /*
   * Rewrite the manifest body. The empty default is `{}` on ONE line, so an
   * `[\s\S]*?\n};` pattern never matches it and the write silently no-ops —
   * which it did, leaving an empty manifest behind everything believed was
   * generated. Match braces without requiring a newline, and fail loudly if
   * the marker is missing rather than pretending the write happened.
   */
  const header = readFileSync(join(root, MANIFEST), "utf8");
  const MARKER = /export const PROJECT_IMAGES: Record<string, ProductImages> = \{[\s\S]*?\};/;
  if (!MARKER.test(header)) {
    console.error(`\n✗ Could not find the PROJECT_IMAGES block in ${MANIFEST} — refusing to write.`);
    process.exit(1);
  }
  const next = header.replace(
    MARKER,
    `export const PROJECT_IMAGES: Record<string, ProductImages> = {\n${lines.join("\n")}\n};`,
  );
  writeFileSync(join(root, MANIFEST), next);
  if (!/img\/products\//.test(readFileSync(join(root, MANIFEST), "utf8"))) {
    console.error(`\n✗ Wrote ${MANIFEST} but it contains no image paths — aborting.`);
    process.exit(1);
  }

  const total = [...bySlug.values()].reduce((n, v) => n + v.length, 0);
  const bytes = readdirSync(OUT, { recursive: true })
    .map((f) => join(OUT, String(f)))
    .filter((f) => existsSync(f) && statSync(f).isFile())
    .reduce((n, f) => n + statSync(f).size, 0);
  console.log(`\n✓ ${total} images across ${bySlug.size} products → public/img/products/ (${(bytes / 1024 / 1024).toFixed(1)} MB total)`);
  console.log(`  Wrote ${MANIFEST}`);
}

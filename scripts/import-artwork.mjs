#!/usr/bin/env node
/**
 * Import original artwork into the storefront.
 *
 *   npm run art:import -- ./artwork              # import everything it finds
 *   npm run art:import -- ./artwork --dry-run    # show the plan, write nothing
 *   npm run art:import -- ./artwork --only p-     # just product covers
 *   npm run art:import -- ./artwork --reimport    # redo files already mapped
 *   npm run art:import -- --clear                 # drop all artwork, back to placeholders
 *
 * Why this is not a copy loop:
 *
 * a) Aspect ratios. The layout crops every slot with object-cover — product
 *    cards 4:3, category tiles 3:4, the promo band 2:1, blog cards 16:10. Handle
 *    that by eye and the subject ends up outside the visible area. Each slot is
 *    cropped here, once, to the ratio it is actually displayed at.
 *
 * b) Blank edges. Scans and exports often ship with white or transparent
 *    margins. A border-colour probe plus an alpha trim removes them before the
 *    crop, so the subject fills the frame instead of floating in a rectangle.
 *
 * c) Unusable sources. A tall screenshot cannot be cropped to a wide banner
 *    without throwing most of it away. Below a threshold the frame is tiled
 *    instead, so the panel stays full and the image stays legible, rather than
 *    showing one sliver blown up. It is a fallback, and it is reported as one.
 *
 * d) Guessing. Filenames are matched against the slot labels and slugs they
 *    describe ("golden-retriever.jpg" → p-golden-retriever). Anything that
 *    cannot be matched with confidence is filled in order, and every single
 *    decision is printed as a table so a wrong match is obvious and fixable.
 *
 * Output goes to public/img/art/<key>.webp and src/data/artwork.ts. Artwork
 * takes precedence over the reference captures in refSrc(), so the swap needs
 * no reseed and no component changes.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const OUT = join(root, "public/img/art");
const MANIFEST = join(root, "src/data/artwork.ts");

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback = undefined) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};
const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--") && argv[i - 1] !== "--"));

const DRY = flag("dry-run");
const ONLY = opt("only");
const REIMPORT = flag("reimport");
const MIN_CONFIDENCE = Number(opt("threshold", "0.62"));
const MAX_SLOTS = Number(opt("max", "400"));

const IMAGE_EXT = /\.(jpe?g|png|webp|avif|tiff?|bmp)$/i;

/* ----------------------------------------------------------------- manifest */

const SLOTS = parseSlots(readFileSync(join(root, "src/data/ref-images.ts"), "utf8"));

/**
 * One manifest entry per line. Parsed line-wise rather than with one regex over
 * the whole file: the `remote` values are template literals containing `${…}`,
 * so any `[^}]*` between `file:` and `kind:` stops at the first path.
 */
export function parseSlots(src) {
  const out = [];
  for (const line of src.split("\n")) {
    if (!line.includes("file:") || !line.includes("kind:")) continue;
    const file = /file:\s*"([^"]+)"/.exec(line)?.[1];
    const kind = /kind:\s*"([^"]+)"/.exec(line)?.[1];
    const label = /label:\s*"([^"]+)"/.exec(line)?.[1];
    if (file && kind && label) out.push({ key: file, kind, label });
  }
  return out;
}

/** Displayed aspect ratio and target width per slot. */
function slotSpec(key) {
  if (key.startsWith("c-")) return { ratio: 3 / 4, width: 900, where: "category tile" };
  if (key.startsWith("b-")) return { ratio: 16 / 10, width: 1200, where: "blog card" };
  if (key.startsWith("promo-")) return { ratio: 2, width: 1400, where: "promo band" };
  if (key === "newsletter") return { ratio: 2, width: 1200, where: "newsletter panel" };
  if (key.startsWith("collection-spot-")) return { ratio: 4 / 3, width: 1200, where: "mosaic tile" };
  if (key.startsWith("cta-")) return { ratio: 4 / 3, width: 900, where: "seller polaroid" };
  if (key.startsWith("a-")) return { ratio: 1, width: 320, where: "avatar" };
  return { ratio: 4 / 3, width: 1000, where: "product card" };
}

/* -------------------------------------------------------------- image probes */

const im = (args) => execFileSync("convert", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim();

/** Width, height, and whether the file has an alpha channel. */
function probe(file) {
  const [w, h] = im([file, "-ping", "-format", "%w %h", "info:"]).split(/\s+/).map(Number);
  const alpha = im([file, "-ping", "-format", "%A", "info:"]) !== "False";
  return { w, h, alpha };
}

/** Mean colour (hex) of a region: size, gravity, offset. */
function meanColor(file, geom, gravity = "center") {
  return im([file, "-gravity", gravity, "-crop", geom, "+repage", "-resize", "1x1!", "-format", "%[hex:p{0,0}]", "info:"]);
}

const hexToRgb = (hex) => {
  const h = hex.replace("#", "").slice(0, 6);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/** Perceptual-ish distance (redmean), 0…765. */
function distance(a, b) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const rm = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

/**
 * Probe the frame's edges. Returns how uniform the border is and its colour —
 * a uniform light border is a scan margin worth trimming, a uniform *varied*
 * one is just a photo that happens to be bright at the edges.
 */
function border(file, { w, h }) {
  const s = Math.max(2, Math.round(Math.min(w, h) * 0.02));
  const strips = [
    meanColor(file, `${w}x${s}+0+0`, "north"),
    meanColor(file, `${w}x${s}+0+0`, "south"),
    meanColor(file, `${s}x${h}+0+0`, "west"),
    meanColor(file, `${s}x${h}+0+0`, "east"),
  ];
  const centre = meanColor(file, `${Math.round(w * 0.4)}x${Math.round(h * 0.4)}+0+0`);
  let spread = 0;
  for (let i = 0; i < strips.length; i++)
    for (let j = i + 1; j < strips.length; j++) spread = Math.max(spread, distance(strips[i], strips[j]));
  return { strips, uniform: spread < 40, colour: strips[0], versusCentre: distance(strips[0], centre) };
}

function hasTransparency(file) {
  // any pixel with alpha < 1.0 shows up in the alpha channel's minimum
  return im([file, "-alpha", "extract", "-format", "%[fx:minima]", "info:"]) !== "1";
}

/* ------------------------------------------------------------------ the crop */

function render(file, key, tmpDir) {
  const { ratio, width } = slotSpec(key);
  const out = join(tmpDir, `${key}.webp`);
  const info = probe(file);
  const args = [file];

  // 1. drop transparency and scan margins when they are clearly margins
  const b = border(file, info);
  const looksLikeMargin = b.uniform && b.versusCentre > 30;
  if (b.looksLikeMargin || (info.alpha && hasTransparency(file))) {
    args.push("-fuzz", "8%", "-trim", "+repage");
  }

  // 2. measure what survived the trim
  const trimmed = probe2(args);
  const tr = trimmed.w / trimmed.h;
  const targetH = Math.round(width / ratio);

  if (tr >= ratio * 0.78) {
    // close enough in shape: crop to the displayed ratio, centred
    args.push("-resize", `${width}x${targetH}^`, "-gravity", "center", "-extent", `${width}x${targetH}`);
    args.push("-quality", "82", out);
    execFileSync("convert", args);
    return { out, mode: "crop", detail: `cropped to ${ratio.toFixed(2)}:1` };
  }

  // 3. too tall to crop honestly: tile it so the panel stays full
  const cols = Math.min(4, Math.max(2, Math.round(ratio / tr)));
  const cellW = Math.round(width / cols);
  // each cell is as tall as the whole panel; side by side they sum to `width`
  const cellH = Math.round(width / ratio);
  const cells = [];
  const base = args;
  for (let i = 0; i < cols; i++) {
    const cell = join(tmpDir, `${key}-${i}.webp`);
    execFileSync("convert", [
      ...base,
      "-resize", `${cellW}x${cellH}^`,
      "-gravity", i % 2 === 0 ? "north" : "south",
      "-extent", `${cellW}x${cellH}`,
      "-quality", "82", cell,
    ]);
    cells.push(cell);
  }
  execFileSync("convert", [...cells, "+append", "-quality", "82", out]);
  return { out, mode: "tiled", detail: `${cols}×${1} tile — source was too tall to crop` };
}

/** Probe the geometry of a chain of convert args (before the output file). */
function probe2(args) {
  const out = im([...args, "-format", "%w %h", "info:"]).split(/\s+/).map(Number);
  return { w: out[0], h: out[1] };
}

/* ------------------------------------------------------------ naming / match */

const words = (s) =>
  s
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[_+]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/**
 * Confidence that a file describes a slot. Weighted by how many of the slot's
 * own words appear in the filename, with a bonus for an exact key match and a
 * penalty for generic words that appear in half the labels.
 */
function score(file, slot) {
  /*
   * The basename only. A full path scores twice over: `/art/photos/x.jpg`
   * "matches" the Photos category no matter what the file actually shows, and
   * one folder called `nature/` drags every image inside it toward the single
   * slot with that word. Folders say where a file is stored, not what it is.
   */
  const f = new Set(words(file.split("/").pop()));
  if (!f.size) return 0;
  const label = words(slot.label);
  const keyWords = words(slot.key.replace(/^(p|c|b|a)-/, ""));
  const generic = new Set(["the", "and", "a", "of", "in", "at", "pack", "set", "studio", "design"]);
  const all = [...new Set([...label, ...keyWords])].filter((w) => !generic.has(w));
  if (!all.length) return 0;

  let hits = 0;
  let weight = 0;
  for (const w of all) {
    const wt = w.length >= 5 ? 1.4 : 1;
    weight += wt;
    if (f.has(w)) hits += wt;
    else if ([...f].some((x) => x.length > 3 && (x.startsWith(w.slice(0, 4)) || w.startsWith(x.slice(0, 4))))) hits += wt * 0.5;
  }
  const base = hits / weight;
  const flat = words(file).join(" ");
  const exact = flat === words(slot.key).join(" ") ? 0.25 : 0;
  return Math.min(1, base + exact);
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (IMAGE_EXT.test(name) && st.size > 2048) acc.push(p);
  }
  return acc;
}

/* --------------------------------------------------------------------- main */

if (flag("clear")) {
  writeFileSync(
    MANIFEST,
    readFileSync(MANIFEST, "utf8").replace(/export const ARTWORK: Record<string, string> = \{[\s\S]*?\};/, "export const ARTWORK: Record<string, string> = {};"),
  );
  console.log("Artwork cleared — every slot is back to its placeholder.");
  process.exit(0);
}

const source = positional[0] ?? opt("from");
if (!source) {
  console.error("Give me a folder:  npm run art:import -- ./artwork");
  process.exit(1);
}
const srcDir = resolve(root, source);
if (!existsSync(srcDir)) {
  console.error(`No such folder: ${srcDir}`);
  process.exit(1);
}

let files = walk(srcDir);
if (!files.length) {
  console.error(`No images (jpg/png/webp/avif/tiff/bmp) inside ${relative(root, srcDir)}`);
  process.exit(1);
}
files.sort();

const existing = new Map(
  [...readFileSync(MANIFEST, "utf8").matchAll(/^\s*"([^"]+)":\s*"([^"]+)",?$/gm)].map((m) => [m[1], m[2]]),
);

const slots = SLOTS.filter((s) => (ONLY ? s.key.startsWith(ONLY) : true) && (REIMPORT ? true : !existing.has(s.key)));

// score every file against every slot, then assign greedily by best pair
const pairs = [];
for (const f of files) for (const s of slots) pairs.push({ f, s, c: score(f, s) });
pairs.sort((a, b) => b.c - a.c);

const taken = new Set();
const claimed = new Set();
const plan = [];
for (const { f, s, c } of pairs) {
  if (c < MIN_CONFIDENCE) break;
  if (taken.has(f) || claimed.has(s.key)) continue;
  taken.add(f);
  claimed.add(s.key);
  plan.push({ file: f, slot: s, confidence: c, how: "matched name" });
}

// anything left over fills the remaining slots in order, flagged as a guess
const leftovers = files.filter((f) => !taken.has(f));
const remaining = slots.filter((s) => !claimed.has(s.key));
for (const [i, f] of leftovers.entries()) {
  if (i >= remaining.length) break;
  plan.push({ file: f, slot: remaining[i], confidence: 0, how: "filled in order" });
}

const unmatchedFiles = leftovers.slice(remaining.length);
const skippedFiles = files.filter((f) => taken.has(f) || plan.some((p) => p.file === f)).length;

if (!plan.length) {
  console.log(`\nNo free slots${ONLY ? ` for keys starting "${ONLY}"` : ""}. Use --reimport to replace artwork that is already mapped.`);
  process.exit(0);
}

const tmpDir = join(root, ".data/artwork-tmp");
mkdirSync(tmpDir, { recursive: true });
if (!DRY) mkdirSync(OUT, { recursive: true });

const rows = [];
const written = new Map(existing);

for (const step of plan) {
  // "../../../tmp/uptest/photos/x.jpg" is unreadable in a table; the folder the
  // file came from is the part that carries meaning
  const parts = step.file.split("/");
  const rel = parts.slice(-2).join("/");
  try {
    if (DRY) {
      const { ratio } = slotSpec(step.slot.key);
      const i = probe(step.file);
      rows.push([step.slot.key, rel, `${i.w}×${i.h}`, `${ratio.toFixed(2)}:1`, step.how, ""]);
      continue;
    }
    const res = render(step.file, step.slot.key, tmpDir);
    const dest = join(OUT, `${step.slot.key}.webp`);
    execFileSync("cp", [res.out, dest]);
    const size = statSync(dest).size;

    // a near-blank import is the one failure that otherwise ships silently:
    // the file exists, the layout is intact, and the slot just looks empty
    const stddev = Number(im([dest, "-colorspace", "gray", "-format", "%[fx:standard_deviation]", "info:"]));
    const note = size < 2000 || stddev < 0.02 ? "⚠ near-blank output — check this slot" : "";

    written.set(step.slot.key, `/img/art/${step.slot.key}.webp`);
    rows.push([step.slot.key, rel, `${(size / 1024).toFixed(0)} kB`, res.detail, step.how, note]);
  } catch (err) {
    rows.push([step.slot.key, rel, "—", "FAILED", step.how, String(err.message).split("\n")[0].slice(0, 50)]);
  }
}

/* -------------------------------------------------------------------- report */

const HEAD = ["slot", "source", "output", "crop", "assigned by", ""];
const widths = HEAD.map((h, i) =>
  Math.min(i === 1 ? 30 : 40, Math.max(h.length, ...rows.map((r) => String(r[i]).length))),
);
const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join("  ").trimEnd();

console.log(`\n${DRY ? "DRY RUN — nothing written" : "Importing"} ${plan.length} image${plan.length === 1 ? "" : "s"} from ${relative(root, srcDir) || "."}\n`);
console.log(line(HEAD));
console.log(line(widths.map((w) => "─".repeat(w))));
for (const r of rows) console.log(line(r));

if (unmatchedFiles.length) {
  console.log(`\n${unmatchedFiles.length} file${unmatchedFiles.length === 1 ? "" : "s"} left over (more art than slots):`);
  for (const f of unmatchedFiles.slice(0, 10)) console.log(`  · ${relative(root, f)}`);
  if (unmatchedFiles.length > 10) console.log(`  · …and ${unmatchedFiles.length - 10} more`);
}

const guessed = rows.filter((r) => r[4] === "filled in order").length;
if (guessed) console.log(`\n${guessed} assigned by position, not name — worth a look before you ship.`);

// a manifest entry whose file is gone would resolve to a 404 and silently
// blank the slot, so it is dropped rather than trusted
for (const [key, path] of [...written]) {
  if (!existsSync(join(root, "public", path.replace(/^\//, "")))) written.delete(key);
}

if (!DRY) {
  const entries = [...written.entries()].sort(([a], [b]) => a.localeCompare(b));
  const body = entries.map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n");
  writeFileSync(
    MANIFEST,
    readFileSync(MANIFEST, "utf8").replace(
      /export const ARTWORK: Record<string, string> = \{[\s\S]*?\};/,
      `export const ARTWORK: Record<string, string> = {\n${body}\n};`,
    ),
  );
  console.log(`\n✓ ${entries.length} slots now use original artwork.`);
  console.log(`  Wrote src/data/artwork.ts and public/img/art/ (${(readdirSync(OUT).reduce((n, f) => n + statSync(join(OUT, f)).size, 0) / 1024 / 1024).toFixed(1)} MB).`);
  console.log(`  Undo everything with: npm run art:import -- --clear`);
}

try {
  execFileSync("rm", ["-rf", tmpDir]);
} catch {}

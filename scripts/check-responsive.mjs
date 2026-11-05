/**
 * Responsive regression guard.
 *
 * Horizontal overflow is the failure nobody notices on their own monitor: one
 * nowrap label or an unsized grid item and the page scrolls sideways on a
 * phone. This walks every public page at the widths that matter and fails if
 * the document is wider than the viewport.
 *
 *   node scripts/check-responsive.mjs
 *
 * Requires the dev server (or a preview build) on PORT, default 5175.
 */
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 5175}`;
const WIDTHS = [320, 360, 390, 414, 480, 640, 768, 834, 1024, 1024, 1280, 1440];
const PAGES = ["/", "/browse", "/bundles", "/collections", "/item/quill-cms", "/free", "/blog", "/checkout"];

// puppeteer-core ships no browser, so the path has to come from somewhere. Fail
// with an instruction rather than a stack trace deep inside the launcher.
const executablePath =
  process.env.CHROME ??
  ["/tmp/chromium", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"].find((p) =>
    existsSync(p),
  );

if (!executablePath || !existsSync(executablePath)) {
  console.error(
    [
      "No Chrome/Chromium binary found.",
      "",
      "Point CHROME at one, e.g.",
      "  CHROME=/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome npm run test:responsive",
      "",
      "or install one with",
      "  npx @puppeteer/browsers install chrome-headless-shell@stable",
    ].join("\n"),
  );
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath,
  args: ["--no-sandbox"],
  env: { ...process.env, LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH ?? "/tmp/al2023x/lib:/tmp" },
});

const failures = [];
const page = await browser.newPage();

for (const width of WIDTHS) {
  await page.setViewport({ width, height: 900, isMobile: width < 700 });
  for (const path of PAGES) {
    await page.goto(BASE + path, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 500));
    const { overflow, culprit } = await page.evaluate(() => {
      const de = document.documentElement;
      const over = de.scrollWidth - de.clientWidth;
      let culprit = "";
      if (over > 2) {
        for (const el of document.querySelectorAll("*")) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > de.clientWidth + 2) {
            culprit = `${el.tagName.toLowerCase()}.${(el.className || "").toString().slice(0, 60)}`;
            break;
          }
        }
      }
      return { overflow: over, culprit };
    });
    if (overflow > 2) failures.push(`${width}px ${path} +${overflow}px ← ${culprit}`);
  }
}

await browser.close();

if (failures.length) {
  console.error(`\n${failures.length} responsive failure(s):\n`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`Responsive check passed: ${WIDTHS.length} widths × ${PAGES.length} pages, no horizontal overflow.`);

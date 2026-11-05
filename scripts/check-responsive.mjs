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
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 5175}`;
const WIDTHS = [320, 360, 390, 414, 480, 640, 768, 834, 1024, 1024, 1280, 1440];
const PAGES = ["/", "/browse", "/bundles", "/collections", "/item/quill-cms", "/free", "/blog", "/checkout"];

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? "/tmp/chromium",
  args: ["--no-sandbox"],
  env: { ...process.env, LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH ?? "/tmp/al2023/lib" },
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

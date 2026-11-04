import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const EXEC = "/tmp/chromium";
const BASE = process.env.SHOT_BASE || "http://localhost:5173";
const OUT = process.argv[2] || "/tmp/shots";
const only = process.argv[3] || null;
fs.mkdirSync(OUT, { recursive: true });

const routes = [
  ["home", "/"],
  ["browse", "/browse"],
  ["product", "/item/forge-saas-starter"],
  ["collections", "/collections"],
  ["collection", "/collection/the-launch-stack"],
  ["free", "/free"],
  ["cart", "/cart"],
  ["checkout", "/checkout"],
  ["login", "/login"],
  ["register", "/register"],
  ["account", "/account"],
  ["account-library", "/account/library"],
  ["account-orders", "/account/orders"],
  ["about", "/about"],
  ["contact", "/contact"],
  ["blog", "/blog"],
  ["changelog", "/changelog"],
  ["faq", "/page/faq"],
  ["admin", "/admin"],
  ["admin-products", "/admin/products"],
  ["admin-editor", "/admin/products/forge-saas-starter"],
  ["admin-categories", "/admin/categories"],
  ["admin-orders", "/admin/orders"],
  ["admin-order", "/admin/orders/KL-10482"],
  ["admin-customers", "/admin/customers"],
  ["admin-payments", "/admin/payments"],
  ["admin-banners", "/admin/banners"],
  ["admin-promotions", "/admin/promotions"],
  ["admin-content", "/admin/content"],
  ["admin-settings", "/admin/settings"],
  ["admin-activity", "/admin/activity"],
];

const browser = await puppeteer.launch({
  executablePath: EXEC,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
  env: { ...process.env, LD_LIBRARY_PATH: "/tmp/al2023/lib" },
});

const problems = [];
const consoleErrors = [];

for (const theme of ["light", "dark"]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(`[${m.location()?.url?.split("/").pop()}] ${m.text()}`.slice(0, 220));
  });
  page.on("pageerror", (e) => consoleErrors.push("PAGEERROR " + e.message.slice(0, 220)));

  await page.evaluateOnNewDocument((t) => {
    localStorage.setItem("kiln-theme", JSON.stringify({ state: { theme: t }, version: 0 }));
  }, theme);

  for (const [name, route] of routes) {
    if (only && !name.includes(only)) continue;
    await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 500));
    // walk the page so IntersectionObserver reveals fire, then return to top
    await page.evaluate(async () => {
      const step = Math.round(window.innerHeight * 0.6);
      const max = document.body.scrollHeight;
      for (let y = 0; y < max; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 90));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 250));
    });
    await new Promise((r) => setTimeout(r, 500));

    const audit = await page.evaluate(() => {
      const doc = document.documentElement;
      const overflowX = doc.scrollWidth - doc.clientWidth;
      const body = document.body;
      return {
        overflowX,
        height: body.scrollHeight,
        theme: doc.className,
        text: body.innerText.slice(0, 120).replace(/\s+/g, " "),
        h1: document.querySelector("h1")?.innerText?.replace(/\s+/g, " ").slice(0, 80) ?? null,
        bg: getComputedStyle(document.body).backgroundColor,
      };
    });

    if (audit.overflowX > 2) problems.push(`${theme}/${name}: horizontal overflow ${audit.overflowX}px`);
    if (audit.height < 400) problems.push(`${theme}/${name}: suspiciously short page (${audit.height}px)`);
    if (!audit.h1 && !["cart", "checkout"].includes(name)) problems.push(`${theme}/${name}: no h1`);

    const suffix = theme === "light" ? "" : "-dark";
    await page.screenshot({
      path: path.join(OUT, `${name}${suffix}.png`),
      fullPage: name.startsWith("admin") ? false : true,
      captureBeyondViewport: true,
    });
    console.log(`${theme.padEnd(5)} ${name.padEnd(18)} h1="${audit.h1 ?? "—"}" ${audit.height}px  ovf=${audit.overflowX}`);
  }
  await page.close();
}

// mobile pass
const m = await browser.newPage();
await m.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
for (const [name, route] of [["home", "/"], ["browse", "/browse"], ["product", "/item/forge-saas-starter"], ["admin", "/admin"], ["cart", "/cart"], ["login", "/login"]]) {
  await m.goto(BASE + route, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 400));
  await m.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.6);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 80));
    }
    window.scrollTo(0, 0);
  });
  await new Promise((r) => setTimeout(r, 400));
  const ovf = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (ovf > 2) problems.push(`mobile/${name}: horizontal overflow ${ovf}px`);
  await m.screenshot({ path: path.join(OUT, `m-${name}.png`), fullPage: false });
  console.log(`mobile ${name.padEnd(12)} ovf=${ovf}`);
}

await browser.close();

console.log("\n=== problems ===");
if (problems.length === 0) console.log("none");
problems.forEach((p) => console.log(" • " + p));

const uniq = [...new Set(consoleErrors)];
console.log(`\n=== console errors (${uniq.length}) ===`);
uniq.slice(0, 15).forEach((e) => console.log(" • " + e));

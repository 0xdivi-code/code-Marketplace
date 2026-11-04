import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({ url: "http://localhost:5173/" });

const errors: string[] = [];
const origError = console.error;
console.error = (...args: unknown[]) => {
  const text = args.map(String).join(" ");
  if (/Warning: React does not recognize|not wrapped in act/.test(text)) return;
  errors.push(text);
  origError(...args);
};

const { createElement: h } = await import("react");
const { renderToString } = await import("react-dom/server");
const { MemoryRouter } = await import("react-router-dom");
const { default: App } = await import("../src/App.tsx");

const routes = [
  "/", "/browse", "/browse?q=stripe", "/category/saas-starters", "/item/forge-saas-starter",
  "/item/empty-states", "/collections", "/collection/the-launch-stack", "/free", "/cart",
  "/checkout", "/order/KL-10482", "/login", "/register", "/forgot-password", "/reset-password",
  "/account", "/account/library", "/account/orders", "/account/wishlist", "/account/settings",
  "/about", "/contact", "/blog", "/blog/pricing-a-starter-kit", "/changelog", "/page/licensing",
  "/page/faq", "/page/terms", "/page/privacy", "/page/refunds", "/page/cookies", "/page/support",
  "/admin", "/admin/products", "/admin/products/forge-saas-starter", "/admin/products/new",
  "/admin/categories", "/admin/orders", "/admin/orders/KL-10482", "/admin/customers",
  "/admin/payments", "/admin/banners", "/admin/promotions", "/admin/content", "/admin/settings",
  "/admin/activity", "/definitely-not-a-page",
];

let failed = 0;
for (const route of routes) {
  try {
    const html = renderToString(
      h(MemoryRouter, { initialEntries: [route] }, h(App)),
    );
    const len = html.length;
    const bad = html.includes("Kiln") || html.includes("kiln") ? "" : " (no brand text!)";
    if (len < 500) {
      console.log(`⚠ ${route.padEnd(36)} short render (${len} chars)`);
      failed++;
    } else {
      console.log(`✓ ${route.padEnd(36)} ${len.toLocaleString()} chars${bad}`);
    }
  } catch (e) {
    failed++;
    console.log(`✗ ${route.padEnd(36)} ${(e as Error).message.slice(0, 140)}`);
  }
}

console.log(`\n${routes.length - failed}/${routes.length} routes rendered`);
if (errors.length) {
  console.log(`\nConsole errors (${errors.length}):`);
  for (const e of errors.slice(0, 8)) console.log("  •", e.slice(0, 200));
  process.exitCode = 1;
}

/**
 * Payment + delivery acceptance tests.
 *
 * These run against the real Hono app in-process, on a throwaway PGlite
 * directory (`PGLITE_DIR=.data/test-pg`), so they never touch dev data.
 *
 *     npm run test:payments
 *
 * The point is not coverage — it is the list of things that must never break:
 * money that arrives twice, tokens used after a refund, expired invoices that
 * settle, coupons that discount themselves after being rejected.
 */
import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Isolate the database BEFORE anything imports the client.
const dir = mkdtempSync(join(tmpdir(), "kiln-test-"));
process.env.PGLITE_DIR = dir;
process.env.STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.API_AUTOSTART = "false";
process.env.NOWPAYMENTS_API_KEY = "";
process.env.NOWPAYMENTS_IPN_SECRET = "";

const { migrate } = await import("../db/migrate");
const { seed } = await import("../db/seed");
const { default: app } = await import("../index");
const { getDb, getClient } = await import("../db/client");
const t = await import("../db/schema");
const { eq, sql } = await import("drizzle-orm");

await migrate({ log: false });
const db0 = getDb();
/**
 * Wipe first, then seed. `seed()` treats any existing catalogue as "already
 * seeded" and skips demo data, so a leftover directory from an earlier run
 * would otherwise make every test fail for the wrong reason.
 */
await db0.execute(sql`
  truncate table downloads, licenses, payments, payment_sessions, order_items,
    orders, reviews, collection_items, collections, pricing_tiers,
    product_versions, product_files, products, categories, authors, coupons,
    webhook_events, activity_log, users, sessions, download_tokens
  restart identity cascade
`);
await seed({ log: false });

/* ------------------------------------------------------------------ helpers */

let passed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push(`${name}\n      ${(err as Error).message}`);
    console.log(`  ✗ ${name}`);
  }
}

const request = (path: string, init?: RequestInit & { cookie?: string }) => {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (init?.cookie) headers.set("cookie", init.cookie);
  return app.fetch(new Request(`http://localhost${path}`, { ...init, headers }));
};

const json = async (path: string, init?: RequestInit & { cookie?: string }) => {
  const res = await request(path, init);
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: res.status, body };
};

/** Log in and keep the Set-Cookie pair. */
async function login(email: string, password: string): Promise<string> {
  const res = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const set = res.headers.getSetCookie?.() ?? [];
  assert.ok(set.length > 0, `login for ${email} returned no cookie`);
  return set.map((c) => c.split(";")[0]).join("; ");
}

async function adminLogin(email: string, password: string): Promise<string> {
  const res = await request("/api/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const set = res.headers.getSetCookie?.() ?? [];
  assert.ok(set.length > 0, "admin login returned no cookie");
  return set.map((c) => c.split(";")[0]).join("; ");
}

/** Run a paid order end to end and return its number plus the invoice ref. */
async function paidOrder(cookie: string, slug: string, license = "personal") {
  const co = await json("/api/account/checkout", {
    method: "POST",
    cookie,
    body: JSON.stringify({
      lines: [{ slug, license, quantity: 1 }],
      idempotencyKey: `test-${Math.random().toString(36).slice(2)}`,
    }),
  });
  assert.equal(co.status, 201, `checkout failed: ${JSON.stringify(co.body)}`);
  const order = co.body!.order as { number: string };
  const payment = co.body!.payment as { invoiceUrl: string };
  const ref = payment.invoiceUrl.split("/").pop()!;
  const paid = await json(`/api/webhooks/sandbox/${ref}/pay`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  assert.equal(paid.status, 200, `sandbox pay failed: ${JSON.stringify(paid.body)}`);
  return { number: order.number, ref };
}

const OWNER = { email: "owner@kiln.dev", password: "kiln-owner-demo-2026" };
const CUSTOMER = { email: "amara@okafor.design", password: "demo1234" };

const admin = await adminLogin(OWNER.email, OWNER.password);
const customer = await login(CUSTOMER.email, CUSTOMER.password);

/* -------------------------------------------------------------- the suite */

console.log("\npayment + delivery\n");

await test("an unpaid order cannot be downloaded", async () => {
  const co = await json("/api/account/checkout", {
    method: "POST",
    cookie: customer,
    body: JSON.stringify({
      lines: [{ slug: "relay-api", license: "personal", quantity: 1 }],
      idempotencyKey: `unpaid-${Date.now()}`,
    }),
  });
  assert.equal(co.status, 201, JSON.stringify(co.body));
  const dl = await json("/api/account/download/relay-api", { method: "POST", cookie: customer });
  assert.equal(dl.status, 403, "a pending order must not mint a download link");
});

await test("a paid order unlocks exactly one licence", async () => {
  const { number } = await paidOrder(customer, "lattice-admin", "extended");
  const order = await json(`/api/account/orders/${number}`, { cookie: customer });
  assert.equal((order.body!.order as { status: string }).status, "paid");

  const db = getDb();
  const rows = await db.select().from(t.licenses).where(eq(t.licenses.status, "active"));
  const mine = rows.filter((r) => r.license === "extended");
  assert.ok(mine.length >= 1, "extended licence was not granted");
});

await test("replaying a payment webhook never double-grants", async () => {
  const { number, ref } = await paidOrder(customer, "quill-cms", "personal");
  const db = getDb();
  const [order] = await db.select().from(t.orders).where(eq(t.orders.number, number)).limit(1);
  const before = (await db.select().from(t.licenses).where(eq(t.licenses.orderId, order.id))).length;

  for (let i = 0; i < 3; i++) {
    const res = await json(`/api/webhooks/sandbox/${ref}/pay`, { method: "POST", body: "{}" });
    assert.equal(res.status, 200);
    assert.match(String((res.body!.forwarded as { note: string }).note), /duplicate/i);
  }
  const after = (await db.select().from(t.licenses).where(eq(t.licenses.orderId, order.id))).length;
  assert.equal(after, before, `replays granted ${after - before} extra licences`);
});

await test("an expired invoice closes the order and mints nothing", async () => {
  const co = await json("/api/account/checkout", {
    method: "POST",
    cookie: customer,
    body: JSON.stringify({
      lines: [{ slug: "gatehouse-auth", license: "personal", quantity: 1 }],
      idempotencyKey: `exp-${Date.now()}`,
    }),
  });
  const ref = (co.body!.payment as { invoiceUrl: string }).invoiceUrl.split("/").pop()!;
  const number = (co.body!.order as { number: string }).number;

  const exp = await json(`/api/webhooks/sandbox/${ref}/pay`, {
    method: "POST",
    body: JSON.stringify({ scenario: "expired" }),
  });
  assert.equal(exp.status, 200);
  const order = await json(`/api/account/orders/${number}`, { cookie: customer });
  assert.equal((order.body!.order as { status: string }).status, "cancelled");
  const dl = await json("/api/account/download/gatehouse-auth", { method: "POST", cookie: customer });
  assert.equal(dl.status, 403);
});

await test("a failed payment never settles", async () => {
  const co = await json("/api/account/checkout", {
    method: "POST",
    cookie: customer,
    body: JSON.stringify({
      lines: [{ slug: "beacon-analytics", license: "personal", quantity: 1 }],
      idempotencyKey: `fail-${Date.now()}`,
    }),
  });
  assert.equal(co.status, 201, `checkout failed: ${JSON.stringify(co.body)}`);
  const ref = (co.body!.payment as { invoiceUrl: string }).invoiceUrl.split("/").pop()!;
  await json(`/api/webhooks/sandbox/${ref}/pay`, {
    method: "POST",
    body: JSON.stringify({ scenario: "failed" }),
  });
  const number = (co.body!.order as { number: string }).number;
  const order = await json(`/api/account/orders/${number}`, { cookie: customer });
  assert.notEqual((order.body!.order as { status: string }).status, "paid");
});

await test("an underpayment is recorded but never unlocks", async () => {
  const co = await json("/api/account/checkout", {
    method: "POST",
    cookie: customer,
    body: JSON.stringify({
      lines: [{ slug: "ledger-billing", license: "personal", quantity: 1 }],
      idempotencyKey: `under-${Date.now()}`,
    }),
  });
  const ref = (co.body!.payment as { invoiceUrl: string }).invoiceUrl.split("/").pop()!;
  const number = (co.body!.order as { number: string }).number;
  await json(`/api/webhooks/sandbox/${ref}/pay`, {
    method: "POST",
    body: JSON.stringify({ scenario: "underpaid" }),
  });
  const order = await json(`/api/account/orders/${number}`, { cookie: customer });
  assert.notEqual((order.body!.order as { status: string }).status, "paid");
});

await test("a download token works without a cookie and is capped at 3 uses", async () => {
  await paidOrder(customer, "beacon-analytics", "personal");
  const mint = await json("/api/account/download/beacon-analytics", { method: "POST", cookie: customer });
  assert.equal(mint.status, 200, JSON.stringify(mint.body));
  const url = mint.body!.url as string;

  for (let i = 1; i <= 3; i++) {
    const res = await request(url); // deliberately no cookie
    assert.equal(res.status, 200, `use ${i} should succeed`);
  }
  const fourth = await request(url);
  assert.equal(fourth.status, 403, "a 4th use must be refused");
});

await test("a forged token is refused", async () => {
  const res = await request("/api/account/downloads/this-token-was-never-minted");
  assert.equal(res.status, 403);
});

await test("a refund revokes a token minted before it", async () => {
  const { number } = await paidOrder(customer, "forge-saas-starter", "personal");
  const mint = await json("/api/account/download/forge-saas-starter", { method: "POST", cookie: customer });
  const url = mint.body!.url as string;

  const refund = await json(`/api/admin/orders/${number}/refund`, {
    method: "POST",
    cookie: admin,
    body: JSON.stringify({ reason: "test", notify: false }),
  });
  assert.equal(refund.status, 200, JSON.stringify(refund.body));
  assert.ok((refund.body!.revoked as number) >= 1, "no licence was revoked");

  const res = await request(url);
  assert.equal(res.status, 403, "a refunded order must not serve the file");
});

await test("refunding twice is refused", async () => {
  const { number } = await paidOrder(customer, "kiln-ui", "commercial");
  const first = await json(`/api/admin/orders/${number}/refund`, {
    method: "POST",
    cookie: admin,
    body: JSON.stringify({ notify: false }),
  });
  assert.equal(first.status, 200);
  const second = await json(`/api/admin/orders/${number}/refund`, {
    method: "POST",
    cookie: admin,
    body: JSON.stringify({ notify: false }),
  });
  assert.equal(second.status, 409);
});

await test("a pending order cannot be refunded", async () => {
  const co = await json("/api/account/checkout", {
    method: "POST",
    cookie: customer,
    body: JSON.stringify({
      lines: [{ slug: "carbon-cli", license: "personal", quantity: 1 }],
      idempotencyKey: `pend-${Date.now()}`,
    }),
  });
  const number = (co.body!.order as { number: string }).number;
  const res = await json(`/api/admin/orders/${number}/refund`, {
    method: "POST",
    cookie: admin,
    body: JSON.stringify({ notify: false }),
  });
  assert.equal(res.status, 409);
});

await test("a rejected coupon charges full price", async () => {
  // WELCOME10 ships expired in the demo data.
  const q = await json("/api/account/quote", {
    method: "POST",
    body: JSON.stringify({
      lines: [{ slug: "lattice-admin", license: "personal", quantity: 1 }],
      coupon: "WELCOME10",
    }),
  });
  assert.equal(q.status, 200);
  assert.equal(q.body!.discount, 0, "an expired coupon still discounted the cart");
  assert.ok((q.body!.notices as string[]).length > 0);
});

await test("a fixed coupon is capped at its face value", async () => {
  await json("/api/admin/coupons", {
    method: "POST",
    cookie: admin,
    body: JSON.stringify({ code: "TEST25", kind: "fixed", value: 25, limit: 5, minSubtotal: 0 }),
  });
  const q = await json("/api/account/quote", {
    method: "POST",
    body: JSON.stringify({
      lines: [{ slug: "lattice-admin", license: "developer", quantity: 1 }],
      coupon: "TEST25",
    }),
  });
  const subtotal = q.body!.subtotal as number;
  assert.ok(subtotal > 2500, "expected a cart larger than the coupon");
  assert.equal(q.body!.discount, 2500, "fixed coupon must take exactly $25");
});

await test("a product-scoped coupon rejects an unrelated cart", async () => {
  await json("/api/admin/coupons", {
    method: "POST",
    cookie: admin,
    body: JSON.stringify({ code: "ONLYCARBON", kind: "percent", value: 50, limit: 5, productSlug: "carbon-cli" }),
  });
  const wrong = await json("/api/account/quote", {
    method: "POST",
    body: JSON.stringify({
      lines: [{ slug: "lattice-admin", license: "personal", quantity: 1 }],
      coupon: "ONLYCARBON",
    }),
  });
  assert.equal(wrong.body!.discount, 0);
  const right = await json("/api/account/quote", {
    method: "POST",
    body: JSON.stringify({
      lines: [{ slug: "carbon-cli", license: "personal", quantity: 1 }],
      coupon: "ONLYCARBON",
    }),
  });
  assert.equal(right.body!.discount, Math.round((right.body!.subtotal as number) / 2));
});

await test("a minimum-spend coupon is refused below the threshold", async () => {
  await json("/api/admin/coupons", {
    method: "POST",
    cookie: admin,
    body: JSON.stringify({ code: "BIGSPEND", kind: "percent", value: 10, limit: 5, minSubtotal: 50000 }),
  });
  const small = await json("/api/account/quote", {
    method: "POST",
    body: JSON.stringify({
      lines: [{ slug: "carbon-cli", license: "personal", quantity: 1 }],
      coupon: "BIGSPEND",
    }),
  });
  assert.equal(small.body!.discount, 0);

  const big = await json("/api/account/quote", {
    method: "POST",
    body: JSON.stringify({
      lines: [{ slug: "lattice-admin", license: "developer", quantity: 1 }],
      coupon: "BIGSPEND",
    }),
  });
  assert.ok(
    (big.body!.discount as number) > 0,
    `a qualifying cart should discount; got disc=${big.body!.discount} sub=${big.body!.subtotal} notices=${JSON.stringify(big.body!.notices)}`,
  );
});

await test("a live sale price is what the server charges", async () => {
  const patch = await json("/api/admin/products/carbon-cli", {
    method: "PATCH",
    cookie: admin,
    body: JSON.stringify({ salePrice: 2900, saleEndsAt: "2099-01-01" }),
  });
  assert.equal(patch.status, 200, JSON.stringify(patch.body));

  const q = await json("/api/account/quote", {
    method: "POST",
    body: JSON.stringify({ lines: [{ slug: "carbon-cli", license: "personal", quantity: 1 }] }),
  });
  assert.equal(q.body!.total, 2900, "the sale price was not charged");
  const line = (q.body!.lines as { saleApplied: boolean }[])[0];
  assert.equal(line.saleApplied, true);
});

await test("an ended sale charges list price again", async () => {
  await json("/api/admin/products/carbon-cli", {
    method: "PATCH",
    cookie: admin,
    body: JSON.stringify({ salePrice: 2900, saleEndsAt: "2020-01-01" }),
  });
  const q = await json("/api/account/quote", {
    method: "POST",
    body: JSON.stringify({ lines: [{ slug: "carbon-cli", license: "personal", quantity: 1 }] }),
  });
  assert.equal((q.body!.lines as { saleApplied: boolean }[])[0].saleApplied, false);
  assert.equal(q.body!.total, 4900);
});

await test("a signature-rejected webhook is logged, not applied", async () => {
  const co = await json("/api/account/checkout", {
    method: "POST",
    cookie: customer,
    body: JSON.stringify({
      lines: [{ slug: "gatehouse-auth", license: "personal", quantity: 1 }],
      idempotencyKey: `sig-${Date.now()}`,
    }),
  });
  const number = (co.body!.order as { number: string }).number;

  // The real NOWPayments route verifies an HMAC the sandbox payload will not
  // satisfy, so this must be refused and recorded as a rejection.
  const res = await request("/api/webhooks/nowpayments", {
    method: "POST",
    headers: { "x-nowpayments-sig": "deadbeef" },
    body: JSON.stringify({
      payment_status: "finished",
      order_id: number,
      price_amount: 1,
      pay_amount: 1,
    }),
  });
  assert.ok(res.status >= 400, `forged webhook accepted with ${res.status}`);

  const order = await json(`/api/account/orders/${number}`, { cookie: customer });
  assert.notEqual((order.body!.order as { status: string }).status, "paid");
});

await test("admin diagnostics expose the rejected webhook", async () => {
  const res = await json("/api/admin/payments/webhooks", { cookie: admin });
  assert.equal(res.status, 200);
  const events = res.body!.events as { signatureOk: boolean }[];
  assert.ok(events.some((e) => e.signatureOk === false), "the forgery was not recorded");
});

await test("a bundle prices below its members and grants every licence", async () => {
  const created = await json("/api/admin/bundles", {
    method: "POST",
    cookie: admin,
    body: JSON.stringify({
      slug: "test-bundle",
      name: "Test Bundle",
      price: 99,
      products: ["lattice-admin", "relay-api"],
    }),
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));

  const q = await json("/api/account/quote", {
    method: "POST",
    body: JSON.stringify({ lines: [{ slug: "test-bundle", license: "personal", quantity: 1 }] }),
  });
  assert.equal(q.status, 200);
  assert.equal(q.body!.total, 9900, "the bundle price was not charged");
  const line = (q.body!.lines as { grants: unknown[]; listPrice: number }[])[0];
  assert.equal(line.grants.length, 2, "the bundle should grant two products");
  assert.ok(line.listPrice > 9900, "the struck-through total should exceed the bundle price");
});

await test("buying a bundle delivers both products", async () => {
  const bought = await paidOrder(customer, "test-bundle", "personal");
  const lib = await json("/api/account/library", { cookie: customer });
  const slugs = (lib.body!.library as { slug: string }[]).map((i) => i.slug);
  assert.ok(slugs.includes("lattice-admin"), "lattice-admin missing from library");
  assert.ok(slugs.includes("relay-api"), "relay-api missing from library");

  const order = await json(`/api/account/orders/${bought.number}`, { cookie: customer });
  assert.equal((order.body!.order as { total: number }).total, 9900, "order total should be the bundle price");
});

await test("an inactive bundle is not purchasable", async () => {
  await json("/api/admin/bundles/test-bundle", {
    method: "PATCH",
    cookie: admin,
    body: JSON.stringify({ active: false }),
  });
  const q = await json("/api/account/quote", {
    method: "POST",
    body: JSON.stringify({ lines: [{ slug: "test-bundle", license: "personal", quantity: 1 }] }),
  });
  assert.deepEqual(q.body!.missing, ["test-bundle"]);
});

/* -------------------------------------------------------------------- teardown */

const close = await getClient();
await close.close();
rmSync(dir, { recursive: true, force: true });

console.log(`\n  ${passed} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}
process.exit(0);

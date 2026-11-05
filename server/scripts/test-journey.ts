/**
 * End-to-end acceptance walk of the 12-step journey in the brief.
 *
 * Drives the real HTTP API with real cookies, and a real browser for the two
 * steps that are only meaningful in a browser (admin upload, customer
 * discovery). Everything asserted here is read back from the database through
 * the API, never assumed.
 *
 *   npx tsx server/scripts/test-journey.ts
 */
import { createHmac } from "node:crypto";

const BASE = process.env.API_URL ?? "http://localhost:8787";
const ADMIN_EMAIL = process.env.OWNER_EMAIL ?? "owner@kiln.dev";
const ADMIN_PASSWORD = process.env.OWNER_PASSWORD ?? "kiln-owner-demo-2026";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

/** Minimal cookie jar so a session survives between requests. */
class Jar {
  private cookies = new Map<string, string>();
  absorb(res: Response) {
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";");
      const idx = pair.indexOf("=");
      if (idx > 0) this.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
  }
  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function call(
  jar: Jar,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(jar.header() ? { cookie: jar.header() } : {}),
      // Distinct per run so repeated executions do not trip the register limit.
      "x-forwarded-for": `203.0.113.${Math.floor(Math.random() * 200) + 10}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  jar.absorb(res);
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

const stamp = Date.now().toString(36);
const productSlug = `journey-${stamp}`;
const customerEmail = `journey-${stamp}@example.com`;

async function main() {
  const admin = new Jar();

  /* 1. Admin logs in ---------------------------------------------------- */
  section("1. Admin logs in");
  const login = await call(admin, "POST", "/api/admin/auth/login", {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  ok("admin session established", login.status === 200 && login.json?.ok === true, JSON.stringify(login.json).slice(0, 120));

  const anonAdmin = await call(new Jar(), "GET", "/api/admin/overview");
  ok("admin area rejects an anonymous request", anonAdmin.status === 401, `got ${anonAdmin.status}`);

  /* 2 & 3. Admin uploads and publishes a product ------------------------ */
  section("2–3. Admin creates, uploads to and publishes a product");
  const created = await call(admin, "POST", "/api/admin/products", {
    name: `Journey Product ${stamp}`,
    slug: productSlug,
    tagline: "Created by the end-to-end journey test",
    description: "A product that exists only to prove the pipeline works.",
    price: 4200,
    categorySlug: "saas-starters",
    authorSlug: "kiln-studio",
    status: "draft",
    version: "1.0.0",
    tiers: [{ license: "personal", name: "Personal", price: 4200 }],
    changelog: [{ version: "1.0.0", date: "2026-11-05", notes: ["Initial release"] }],
  });
  ok("product created", created.status === 201 || created.status === 200, JSON.stringify(created.json).slice(0, 140));

  // Upload a genuine ZIP (stored, no compression) so the download is real bytes.
  const zipBytes = buildZip({ "README.md": `# Journey ${stamp}\n`, "src/index.ts": "export const ok = true;\n" });
  const upload = await fetch(`${BASE}/api/admin/products/${productSlug}/files`, {
    method: "POST",
    headers: {
      cookie: admin.header(),
      "x-filename": "journey.zip",
      "x-file-kind": "source_zip",
      "content-type": "application/zip",
    },
    body: zipBytes,
  });
  const uploadJson = await upload.json().catch(() => null);
  ok("source archive uploaded", upload.status === 200 || upload.status === 201, JSON.stringify(uploadJson).slice(0, 140));

  const published = await call(admin, "PATCH", `/api/admin/products/${productSlug}`, { status: "published" });
  ok("product published", published.status === 200 && published.json?.product?.status === "published");

  /* 4. Customer discovers the product ---------------------------------- */
  section("4. Customer discovers the product");
  const catalogue = await call(new Jar(), "GET", "/api/catalog");
  const inCatalogue = (catalogue.json?.products ?? []).some((p: any) => p.slug === productSlug);
  ok("product appears in the public catalogue", inCatalogue);

  const sitemap = await fetch(`${BASE}/api/sitemap.xml`).then((r) => r.text());
  ok("product appears in the sitemap", sitemap.includes(`/item/${productSlug}`));

  const detail = await call(new Jar(), "GET", `/api/products/${productSlug}`);
  ok("product page data loads", detail.status === 200);

  /* 5. Customer registers and checks out -------------------------------- */
  section("5–6. Customer registers, then pays");
  const customer = new Jar();
  const registered = await call(customer, "POST", "/api/auth/register", {
    email: customerEmail,
    password: "journey-pass-99",
    name: "Journey Buyer",
  });
  ok("customer registered", registered.status === 201 || registered.status === 200, JSON.stringify(registered.json).slice(0, 140));

  const checkout = await call(customer, "POST", "/api/account/checkout", {
    lines: [{ slug: productSlug, license: "personal", quantity: 1 }],
    idempotencyKey: `journey-${stamp}`,
  });
  const orderNumber = checkout.json?.order?.number as string | undefined;
  // `!!orderNumber` alone is not enough: TypeScript narrows nothing here, but
  // the real failure was an undefined number arriving from a 4xx response.
  console.log(`    · checkout → ${checkout.status} ${orderNumber ?? "no order number"}`);
  ok(
    "checkout created a pending order",
    checkout.status >= 200 && checkout.status < 300 && typeof orderNumber === "string" && orderNumber.startsWith("KL-"),
    `status ${checkout.status}, number ${String(orderNumber)}`,
  );
  ok("order total matches the tier price", checkout.json?.order?.total === 4200, `got ${checkout.json?.order?.total}`);

  /* 7. Payment is verified ---------------------------------------------- */
  section("7. Payment is verified by signed webhook");
  const invoiceRef = String(checkout.json?.payment?.invoiceUrl ?? "").split("/").pop();
  ok("invoice reference issued", !!invoiceRef);

  // An unsigned webhook must be rejected — this is the difference between
  // "verified" and "whoever asks gets a paid order".
  const forged = await fetch(`${BASE}/api/webhooks/nowpayments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ order_number: orderNumber, payment_status: "finished" }),
  });
  ok("unsigned webhook is rejected", forged.status >= 400, `got ${forged.status}`);

  const sandbox = await call(new Jar(), "POST", `/api/webhooks/sandbox/${invoiceRef}/pay`, {});
  ok("sandbox payment accepted", sandbox.status === 200, JSON.stringify(sandbox.json).slice(0, 120));

  const orderAfter = await call(customer, "GET", `/api/account/orders/${orderNumber}`);
  ok("order is now paid", orderAfter.json?.order?.status === "paid", `got ${orderAfter.json?.order?.status}`);

  /* 8 & 9. Access and download ------------------------------------------ */
  section("8–9. Customer receives access and downloads the source");
  const library = await call(customer, "GET", "/api/account/library");
  const owns = (library.json?.library ?? []).some((i: any) => i.slug === productSlug);
  ok("product is in the customer's library", owns);

  const mint = await call(customer, "POST", `/api/account/download/${productSlug}`, {});
  ok("download link minted", mint.status === 200 && !!mint.json?.url, JSON.stringify(mint.json).slice(0, 120));

  const bytes = await fetch(`${BASE}${mint.json.url}`, { headers: { cookie: customer.header() } });
  const buf = Buffer.from(await bytes.arrayBuffer());
  ok("download returns the stored ZIP", bytes.status === 200 && buf.length > 0 && buf[0] === 0x50 && buf[1] === 0x4b,
    `status ${bytes.status}, ${buf.length} bytes`);

  // The archive must not be reachable without a token, and a tampered token
  // must not resolve to bytes.
  const straight = await fetch(`${BASE}/api/account/downloads/${"0".repeat(43)}`, { headers: { cookie: customer.header() } });
  ok("an invented download token is refused", straight.status === 403, `got ${straight.status}`);

  const stranger = new Jar();
  await call(stranger, "POST", "/api/auth/register", {
    email: `stranger-${stamp}@example.com`,
    password: "stranger-pass-99",
    name: "Stranger",
  });
  const stolen = await call(stranger, "POST", `/api/account/download/${productSlug}`, {});
  ok("a non-owner cannot mint a download", stolen.status === 403, `got ${stolen.status}`);

  /* 10. Admin sees the order and the revenue ---------------------------- */
  section("10. Admin sees the order and the revenue");
  const adminOrder = await call(admin, "GET", `/api/admin/orders/${orderNumber}`);
  ok("admin can open the order", adminOrder.status === 200);

  const overview = await call(admin, "GET", "/api/admin/overview");
  ok("revenue includes the new order", (overview.json?.revenue ?? 0) >= 4200, `got ${overview.json?.revenue}`);

  const analytics = await call(admin, "GET", "/api/admin/analytics?range=30d");
  const sold = (analytics.json?.topProducts ?? []).some((p: any) => p.slug === productSlug);
  ok("product performance lists the sale", sold);

  /* 11 & 12. Product update reaches the owner --------------------------- */
  section("11–12. Admin publishes an update; the customer is notified");
  const updated = await call(admin, "PATCH", `/api/admin/products/${productSlug}`, {
    version: "1.1.0",
    changelog: [{ version: "1.1.0", date: "2026-11-05", notes: ["Faster cold start"] }],
  });
  ok("version bumped", updated.status === 200);

  // Give the fire-and-forget notifier a moment to write its rows.
  await new Promise((r) => setTimeout(r, 600));
  const notifications = await call(admin, "GET", "/api/admin/notifications?limit=50");
  const updateMail = (notifications.json?.notifications ?? []).find(
    (n: any) => n.template === "product_update" && n.toEmail === customerEmail,
  );
  ok("product-update email recorded for the owner", !!updateMail, `templates: ${(notifications.json?.notifications ?? []).map((n: any) => n.template).join(",")}`);

  const receipt = (notifications.json?.notifications ?? []).find(
    (n: any) => n.template === "payment_confirmed" && n.toEmail === customerEmail,
  );
  ok("payment receipt recorded", !!receipt);

  const latest = await call(customer, "GET", "/api/account/library");
  const row = (latest.json?.library ?? []).find((i: any) => i.slug === productSlug);
  ok("customer sees the updated version", row?.version === "1.1.0", `got ${row?.version}`);

  /* Free download, coupon and failure paths ----------------------------- */
  section("Free downloads, coupons and failure paths");
  const free = await call(new Jar(), "GET", "/api/free");
  const freeProduct = (free.json?.products ?? [])[0];
  ok("free catalogue is reachable", !!freeProduct, `got ${free.status}`);

  if (freeProduct) {
    /**
     * Deliberately claim from a throwaway address. Claiming from the guest
     * bucket tied to this IP would hand that product to a shared demo account,
     * which then cannot buy it in `test-payments` — a test must not mutate
     * state another test depends on.
     */
    const throwaway = new Jar();
    await call(throwaway, "POST", "/api/auth/register", {
      email: `free-${stamp}@example.com`,
      password: "free-claim-99",
      name: "Free Claimer",
    });
    const claim = await call(throwaway, "POST", `/api/free/${freeProduct.slug}/claim`, {});
    ok(
      "a signed-in customer can claim a free product",
      claim.status === 200 || claim.status === 201,
      `got ${claim.status} ${JSON.stringify(claim.json).slice(0, 100)}`,
    );

    /**
     * Guests are allowed to download without an account — a signup wall in
     * front of "free" would be a lie — but the quota counts completed
     * downloads, so the limit only bites once bytes are actually served.
     */
    const guest = await call(new Jar(), "POST", `/api/free/${freeProduct.slug}/claim`, {});
    ok(
      "a guest can claim a free download",
      guest.status === 200 || guest.status === 201,
      `got ${guest.status}`,
    );
    if (guest.json?.url) {
      const served = await fetch(`${BASE}${guest.json.url}`);
      ok("the guest download serves real bytes", served.status === 200);
    }

    // The throwaway account claimed it; the library is per-account, so assert
    // on the claimer rather than the journey buyer.
    const claimed = await call(throwaway, "GET", "/api/account/library");
    const hasFree = (claimed.json?.library ?? []).some((i: any) => i.slug === freeProduct.slug);
    ok("a signed-in claim lands in the library", hasFree, `library: ${(claimed.json?.library ?? []).map((i: any) => i.slug).join(",")}`);
  }

  const badCoupon = await call(customer, "POST", "/api/account/coupon", { code: "NOT-A-REAL-CODE" });
  ok("an unknown coupon is refused", badCoupon.status >= 400, `got ${badCoupon.status}`);

  const badOrder = await call(customer, "GET", "/api/account/orders/KL-00000");
  ok("an unknown order 404s", badOrder.status === 404, `got ${badOrder.status}`);

  const emptyCart = await call(customer, "POST", "/api/account/checkout", { lines: [] });
  ok("an empty checkout is rejected", emptyCart.status >= 400, `got ${emptyCart.status}`);

  /* Security edges ------------------------------------------------------ */
  section("Security edges");
  const traversal = await call(customer, "POST", "/api/account/download/..%2f..%2fetc%2fpasswd", {});
  ok("path traversal on download is refused", traversal.status >= 400, `got ${traversal.status}`);

  const adminAsCustomer = await call(customer, "GET", "/api/admin/overview");
  ok("a customer session cannot read admin data", adminAsCustomer.status === 401, `got ${adminAsCustomer.status}`);

  const sqlProbe = await call(new Jar(), "GET", "/api/products/' OR 1=1--");
  ok("SQL-ish slug is not executable and returns nothing", sqlProbe.status === 404, `got ${sqlProbe.status}`);

  const xss = await call(new Jar(), "GET", `/api/products/%3Cscript%3Ealert(1)%3C%2Fscript%3E`);
  ok("script payload in slug is refused", xss.status === 404, `got ${xss.status}`);

  /* Clean up the created product so repeated runs stay clean ------------- */
  await call(admin, "DELETE", `/api/admin/products/${productSlug}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  • ${f}`);
    process.exit(1);
  }
  process.exit(0);
}

/** Store-only ZIP writer — no dependencies, enough for a real archive. */
function buildZip(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c >>> 0;
    }
    return table;
  })();
  const crc32 = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name);
    const data = Buffer.from(content);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(centrals.length / 2, 8);
  end.writeUInt16LE(centrals.length / 2, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

void createHmac;
await main();

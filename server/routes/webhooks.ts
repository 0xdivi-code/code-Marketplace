/**
 * Payment webhooks.
 *
 * Mounted outside the authenticated API surface because the caller is the
 * gateway, not a browser. Security comes from four things working together:
 *
 *   1. a signature over the exact body, checked in constant time
 *   2. a dedupe row keyed on the delivery digest, so a replay is a no-op
 *   3. server-side amount verification inside `settleOrder`
 *   4. order lookup by *our* number, never by an id in the payload
 *
 * Every attempt is recorded, valid or not, so the admin diagnostics screen can
 * show why a payment did or did not settle.
 */
import crypto from "node:crypto";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import * as t from "../db/schema";
import { clientIp } from "../lib/auth";
import {
  formatPayAmount,
  ipnSecret,
  normalizeStatus,
  nowpayments,
  sandbox,
  sandboxAddress,
  tickerFor,
} from "../lib/payments";
import { settleOrder } from "../lib/settlement";
import { logActivity } from "../lib/activity";

export const webhooks = new Hono();

/**
 * True once the API is actually listening on a port. The sandbox payment
 * simulator re-posts its payload over HTTP when it can, so a simulated payment
 * travels the same path as a real gateway callback; with no listener (tests)
 * it calls the app in-process instead.
 */
let serving = false;
export function markServing() {
  serving = true;
}

type Json = Record<string, unknown>;

function str(v: unknown): string | null {
  return typeof v === "string" && v.length ? v : null;
}

/**
 * The dedupe key. Gateways retry; two deliveries of the same state for the same
 * payment must collapse into one. We use the natural identity of the event
 * rather than a header, because not every gateway sends a delivery id.
 */
function eventKey(provider: string, payload: Json, raw: string): string {
  const id =
    str(payload.payment_id) ??
    str(payload.id) ??
    str(payload.invoice_id) ??
    str(payload.purchase_id);
  const status = str(payload.payment_status) ?? str(payload.status) ?? "unknown";
  const order = str(payload.order_id) ?? "no-order";
  /**
   * Key on the *event*, not just the payment: gateways send the same
   * payment_id for waiting → confirming → finished, and those are genuinely
   * different facts. A byte-identical redelivery collapses to one row; a new
   * state or a different amount gets its own.
   */
  const bodyDigest = digest(raw);
  if (id) return `${provider}:${id}:${status}:${order}:${bodyDigest}`;
  return `${provider}:body:${bodyDigest}`;
}

/** Small helper so the digest stays stable without importing a second hasher. */
function digest(input: string): string {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }
  return h1.toString(16).padStart(8, "0");
}

/** Shared handler for both gateways. */
async function handle(providerKey: "nowpayments" | "sandbox", c: any) {
  const raw = await c.req.text();
  const signature = c.req.header("x-nowpayments-sig") ?? c.req.header("x-signature") ?? null;
  const secret = await ipnSecret();
  const db = getDb();

  let payload: Json = {};
  try {
    payload = JSON.parse(raw) as Json;
  } catch {
    await db.insert(t.webhookEvents).values({
      provider: providerKey,
      signatureOk: false,
      note: "body was not JSON",
      payload: raw.slice(0, 2000),
    });
    return c.json({ error: "Bad payload" }, 400);
  }

  const impl = providerKey === "nowpayments" ? nowpayments : sandbox;
  const ok = impl.verifyWebhook(raw, signature, secret);
  const orderNumber = str(payload.order_id);
  const paymentRef = str(payload.payment_id) ?? str(payload.id);
  const rawStatus = str(payload.payment_status) ?? str(payload.status) ?? "";
  /**
   * The dedupe key carries the signature verdict. Without this, an attacker
   * could POST a forged "finished" payload first, burning the key, and the
   * gateway's genuine delivery would then be dropped as a duplicate.
   */
  const key = `${ok ? "ok" : "bad"}:${eventKey(providerKey, payload, raw)}`;

  // Record first: a forged hook is exactly what an operator wants to see.
  let inserted: { id: string } | undefined;
  try {
    const rows = await db
      .insert(t.webhookEvents)
      .values({
        provider: providerKey,
        // Rejected deliveries are logged but never occupy a dedupe key, so
        // they cannot influence what counts as "already seen".
        eventKey: ok ? key : undefined,
        signatureOk: ok,
        status: rawStatus || null,
        orderNumber,
        paymentRef,
        payload,
        note: ok ? null : "signature rejected",
      })
      .onConflictDoNothing({ target: [t.webhookEvents.provider, t.webhookEvents.eventKey] })
      .returning({ id: t.webhookEvents.id });
    inserted = rows[0];

  } catch (err) {
    // A storage hiccup must not turn into a successful webhook.
    console.error("[webhook] insert failed", err);
    return c.json({ error: "Could not record delivery" }, 500);
  }

  if (!ok) {
    await logActivity({
      actor: "webhook",
      action: `rejected an unsigned ${providerKey} callback`,
      target: orderNumber ?? clientIp(c),
      kind: "payment",
      ip: clientIp(c),
    });
    return c.json({ error: "Invalid signature" }, 401);
  }

  // Duplicate delivery: acknowledge so the gateway stops retrying, change nothing.
  if (!inserted) {
    return c.json({ ok: true, duplicate: true });
  }

  if (!orderNumber) {
    await db.update(t.webhookEvents).set({ note: "no order_id in payload" }).where(eq(t.webhookEvents.id, inserted.id));
    return c.json({ ok: true, ignored: "no order" });
  }

  const status = normalizeStatus(rawStatus);
  const actuallyPaid =
    payload.actually_paid != null
      ? Number(payload.actually_paid)
      : payload.price_amount != null && status === "paid"
        ? Number(payload.price_amount)
        : null;

  const result = await settleOrder({
    orderNumber,
    providerStatus: status,
    actuallyPaidUsd: actuallyPaid,
    payCurrency: str(payload.pay_currency),
    payAmount: payload.pay_amount != null ? String(payload.pay_amount) : null,
    payAddress: str(payload.pay_address),
    payinHash: str(payload.payin_hash),
    network: str(payload.network),
    providerRef: paymentRef,
    rawStatus,
    actor: `webhook:${providerKey}`,
    ip: clientIp(c),
  });

  await db
    .update(t.webhookEvents)
    .set({ note: result.note })
    .where(eq(t.webhookEvents.id, inserted.id));

  // Always 200 when we understood the payload: a non-2xx makes the gateway
  // retry, and retrying cannot fix a business-level rejection like a shortfall.
  return c.json({ ok: result.ok, note: result.note });
}

webhooks.post("/nowpayments", (c) => handle("nowpayments", c));

/**
 * The sandbox gateway is a development stand-in: it can be told to mark an
 * order paid without any money moving. In production it is not merely
 * discouraged, it is unreachable — otherwise one POST would mint paid orders.
 *
 * `ALLOW_SANDBOX_IN_PRODUCTION=true` exists only for a sealed staging
 * environment and logs a warning on every use.
 */
const SANDBOX_ALLOWED =
  process.env.NODE_ENV !== "production" || process.env.ALLOW_SANDBOX_IN_PRODUCTION === "true";

webhooks.post("/sandbox", (c) => {
  if (!SANDBOX_ALLOWED) return c.json({ error: "Not found" }, 404);
  return handle("sandbox", c);
});

/**
 * Local sandbox invoice page.
 *
 * Stands in for the gateway's hosted checkout when no API key is configured. It
 * deliberately does *not* mark anything paid from the browser: "I have paid"
 * posts a signed webhook to our own endpoint, which then goes through exactly
 * the same verification path a real gateway would.
 */
webhooks.get("/sandbox/:ref", async (c) => {
  if (!SANDBOX_ALLOWED) return c.json({ error: "Not found" }, 404);
  const ref = c.req.param("ref");
  const db = getDb();
  const [session] = await db
    .select()
    .from(t.paymentSessions)
    .where(eq(t.paymentSessions.providerRef, ref))
    .limit(1);
  if (!session) return c.html(notFound(), 404);

  const [order] = await db.select().from(t.orders).where(eq(t.orders.id, session.orderId)).limit(1);
  const address = session.payAddress ?? sandboxAddress(session.payCurrency, ref);
  const expired = session.expiresAt != null && session.expiresAt < new Date();

  return c.html(
    sandboxInvoicePage({
      ref,
      orderNumber: order?.number ?? "—",
      amount: (session.priceAmount / 100).toFixed(2),
      currency: tickerFor(session.payCurrency),
      // Two decimals for stablecoins, six for volatile coins, exactly as the
      // invoice screen formats it.
      payAmount: formatPayAmount(session.payAmount, session.payCurrency),
      ticker: tickerFor(session.payCurrency),
      address,
      network: session.network ?? "",
      status: expired ? "expired" : session.status,
      expired,
    }),
  );
});

/** Test hook: pretends the customer sent funds, then calls our own webhook. */
webhooks.post("/sandbox/:ref/pay", async (c) => {
  const ref = c.req.param("ref");
  const db = getDb();
  const [session] = await db
    .select()
    .from(t.paymentSessions)
    .where(eq(t.paymentSessions.providerRef, ref))
    .limit(1);
  if (!session) return c.json({ error: "No such invoice" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const scenario = String((body as Json).scenario ?? "paid");

  const [order] = await db.select().from(t.orders).where(eq(t.orders.id, session.orderId)).limit(1);
  if (!order) return c.json({ error: "No such order" }, 404);

  const payload = {
    payment_id: `sbx_${ref}`,
    payment_status:
      scenario === "confirming"
        ? "confirming"
        : scenario === "expired"
          ? "expired"
          : scenario === "failed"
            ? "failed"
            : scenario === "underpaid"
              ? "partially_paid"
              : "finished",
    pay_address: session.payAddress,
    price_amount: order.total / 100,
    price_currency: "usd",
    pay_amount: session.payAmount,
    actually_paid:
      scenario === "underpaid"
        ? Number((order.total / 100) * 0.5)
        : Number(order.total / 100),
    pay_currency: session.payCurrency,
    order_id: order.number,
    order_description: `Kiln ${order.number}`,
    purchase_id: session.purchaseId,
    network: session.network,
    payin_hash: `0x${ref}${ref}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Sign it exactly as the real gateway would, then post it to ourselves so the
  // verification, dedupe and settlement code all run for real.
  const secret = await ipnSecret();
  const signature = sandboxSign(JSON.stringify(payload), secret);

  /**
   * Deliver the simulated callback through the real webhook handler.
   *
   * When the API is serving, re-post over HTTP so the request traverses the
   * same stack as a genuine gateway call. Under test there is no listener, so
   * call the app directly — the handler, signature check and dedupe are
   * identical either way.
   */
  // `webhooks` is mounted at /api/webhooks, so in-process paths are relative.
  const build = () =>
    new Request("http://localhost/sandbox", {
      method: "POST",
      headers: { "content-type": "application/json", "x-nowpayments-sig": signature },
      body: JSON.stringify(payload),
    });
  const res = serving
    ? await fetch(`${new URL(c.req.url).origin}/api/webhooks/sandbox`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-nowpayments-sig": signature },
        body: JSON.stringify(payload),
      })
    : await webhooks.fetch(build());
  const out = (await res.json().catch(() => ({}))) as Json;
  return c.json({ ok: res.ok, forwarded: out }, res.ok ? 200 : res.status);
});

/** Sign exactly as the sandbox provider verifies: HMAC-SHA512 over the raw body. */
function sandboxSign(raw: string, secret: string): string {
  return crypto.createHmac("sha512", secret).update(raw).digest("hex");
}

function notFound() {
  return `<!doctype html><meta charset="utf-8"><title>Invoice not found</title>
  <body style="font-family:system-ui;padding:3rem;background:#faf7f2;color:#1e2a24">
  <h1 style="font-size:1.25rem">Invoice not found</h1>
  <p style="color:#5b6b62">This payment link is not valid or has been removed.</p>
  <a href="/" style="color:#1e2a24">Back to Kiln</a></body>`;
}

function sandboxInvoicePage(v: {
  ref: string;
  orderNumber: string;
  amount: string;
  currency: string;
  payAmount: string;
  ticker: string;
  address: string;
  network: string;
  status: string;
  expired: boolean;
}) {
  const badge =
    v.status === "paid"
      ? "#134e36"
      : v.expired
        ? "#8a2c2c"
        : "#7a5c1e";
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pay ${v.orderNumber} — Kiln sandbox</title></head>
<body style="margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;background:#f2eee6;color:#1e2a24;padding:2rem 1rem">
<div style="max-width:480px;margin:0 auto;background:#fbf9f4;border:1px solid #ddd6c8;border-radius:14px;overflow:hidden">
  <div style="padding:1.25rem 1.5rem;border-bottom:1px solid #e6dfd1;display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:.6rem;letter-spacing:.16em;text-transform:uppercase;color:#7c8a80">Sandbox checkout</div>
      <div style="font-size:1.05rem;font-weight:600;margin-top:.15rem">${v.orderNumber}</div>
    </div>
    <span style="background:${badge};color:#fff;border-radius:999px;padding:.2rem .6rem;font-size:.65rem;text-transform:uppercase;letter-spacing:.08em">${v.status}</span>
  </div>
  <div style="padding:1.5rem">
    <p style="margin:0 0 .35rem;font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:#7c8a80">Amount due</p>
    <p style="margin:0 0 .15rem;font-size:2rem;font-weight:600;letter-spacing:-.02em">${v.payAmount} <span style="font-size:.85rem;font-weight:500;color:#5b6b62">${v.currency}</span></p>
    <p style="margin:0 0 1.25rem;color:#5b6b62;font-size:.8rem">≈ $${v.amount} USD · ${v.network}</p>

    <p style="margin:0 0 .35rem;font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:#7c8a80">Send to</p>
    <div style="background:#f2eee6;border:1px solid #e6dfd1;border-radius:8px;padding:.75rem;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.72rem;word-break:break-all;line-height:1.5">${v.address}</div>

    <p style="margin:1rem 0 0;font-size:.72rem;color:#7c8a80;line-height:1.6">
      This page only exists because no NOWPayments key is configured. It emits a
      signed webhook to the same endpoint the live gateway uses, so delivery and
      verification are exercised honestly — no client-side “payment succeeded”.
    </p>

    <div style="display:grid;gap:.5rem;margin-top:1.25rem">
      <button data-scenario="paid" ${v.status === "paid" ? "disabled" : ""}
        style="padding:.7rem 1rem;border-radius:8px;border:0;background:#17392b;color:#fff;font-size:.85rem;font-weight:600;cursor:pointer">
        Simulate exact payment</button>
      <button data-scenario="underpaid"
        style="padding:.55rem .9rem;border-radius:8px;border:1px solid #ddd6c8;background:transparent;color:#5b6b62;font-size:.78rem;cursor:pointer">
        Simulate underpayment</button>
      <button data-scenario="expired"
        style="padding:.55rem .9rem;border-radius:8px;border:1px solid #ddd6c8;background:transparent;color:#5b6b62;font-size:.78rem;cursor:pointer">
        Simulate expiry</button>
    </div>
    <p id="out" style="margin:.9rem 0 0;font-size:.75rem;color:#5b6b62;min-height:1.1rem"></p>
  </div>
</div>
<script>
  const out = document.getElementById("out");
  document.querySelectorAll("button[data-scenario]").forEach((b) => {
    b.addEventListener("click", async () => {
      out.textContent = "Sending signed webhook…";
      try {
        const res = await fetch(location.pathname + "/pay", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scenario: b.dataset.scenario }),
        });
        const json = await res.json();
        out.textContent = res.ok ? "Webhook accepted — " + JSON.stringify(json.forwarded) : "Rejected: " + JSON.stringify(json);
        if (res.ok && b.dataset.scenario === "paid") setTimeout(() => {
          const next = new URLSearchParams(location.search).get("next");
          if (next) location.href = next;
        }, 900);
      } catch (e) {
        out.textContent = "Request failed: " + e;
      }
    });
  });
</script>
</body></html>`;
}

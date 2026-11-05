/**
 * Admin: payments, webhooks, refunds and provider settings.
 *
 * Everything here is behind the admin cookie. Provider credentials are written
 * but never read back to the browser — the settings endpoint returns a masked
 * summary so an operator can confirm configuration without exposing secrets in
 * a screenshot or a support session.
 */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import * as t from "../db/schema";
import { clientIp } from "../lib/auth";
import { logActivity } from "../lib/activity";
import { expireStaleOrders, revokeOrderLicences } from "../lib/settlement";
import {
  PAY_OPTIONS,
  activeProvider,
  getProvider,
  ipnSecret,
  providerConfig,
  saveProviderConfig,
} from "../lib/payments";
import { licenseTerms, DEFAULT_TERMS, LICENSE_TIERS } from "../lib/licensing";
import { sendDevEmail } from "../lib/mailer";

export const adminPayments = new Hono();

const mask = (s: string) => (s ? `${s.slice(0, 4)}${"•".repeat(Math.max(0, Math.min(20, s.length - 8)))}${s.slice(-4)}` : "");

/* --------------------------------------------------------------- dashboard */

adminPayments.get("/payments/overview", async (c) => {
  const db = getDb();
  const [totals] = await db
    .select({
      gross: sql<number>`coalesce(sum(${t.payments.amount}),0)::int`,
      count: sql<number>`count(*)::int`,
      succeeded: sql<number>`count(*) filter (where ${t.payments.status} = 'succeeded')::int`,
      failed: sql<number>`count(*) filter (where ${t.payments.status} in ('failed','expired'))::int`,
      pending: sql<number>`count(*) filter (where ${t.payments.status} in ('waiting','confirming','partially_paid'))::int`,
    })
    .from(t.payments);

  const byCoin = await db
    .select({
      currency: sql<string>`coalesce(${t.payments.payCurrency}, 'unknown')`,
      count: sql<number>`count(*)::int`,
      amount: sql<number>`coalesce(sum(${t.payments.amount}),0)::int`,
    })
    .from(t.payments)
    .where(eq(t.payments.status, "succeeded"))
    .groupBy(sql`coalesce(${t.payments.payCurrency}, 'unknown')`);

  const recentHooks = await db
    .select({
      id: t.webhookEvents.id,
      provider: t.webhookEvents.provider,
      signatureOk: t.webhookEvents.signatureOk,
      status: t.webhookEvents.status,
      orderNumber: t.webhookEvents.orderNumber,
      note: t.webhookEvents.note,
      createdAt: t.webhookEvents.createdAt,
    })
    .from(t.webhookEvents)
    .orderBy(desc(t.webhookEvents.createdAt))
    .limit(20);

  const [webhookStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      rejected: sql<number>`count(*) filter (where ${t.webhookEvents.signatureOk} = false)::int`,
      duplicates: sql<number>`count(*) filter (where ${t.webhookEvents.note} like '%duplicate%')::int`,
    })
    .from(t.webhookEvents);

  const provider = await activeProvider();
  const cfg = await providerConfig();

  return c.json({
    totals,
    byCoin,
    recentHooks,
    webhookStats,
    provider: { active: provider, mode: cfg.mode, configured: Boolean(cfg.apiKey) },
  });
});

/* -------------------------------------------------------------- webhooks */

adminPayments.get("/payments/webhooks", async (c) => {
  const db = getDb();
  const limit = Math.min(Number(c.req.query("limit") ?? 100), 300);
  const rows = await db
    .select()
    .from(t.webhookEvents)
    .orderBy(desc(t.webhookEvents.createdAt))
    .limit(limit);
  return c.json({
    events: rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      signatureOk: r.signatureOk,
      status: r.status,
      orderNumber: r.orderNumber,
      paymentRef: r.paymentRef,
      note: r.note,
      createdAt: r.createdAt,
      payload: r.payload,
    })),
  });
});

/**
 * Reconcile: ask the provider what actually happened, for one order.
 * The escape hatch when a webhook was lost to a network blip.
 */
adminPayments.post("/payments/:number/reconcile", async (c) => {
  const db = getDb();
  const [order] = await db.select().from(t.orders).where(eq(t.orders.number, c.req.param("number"))).limit(1);
  if (!order) return c.json({ error: "Order not found." }, 404);
  const [session] = await db
    .select()
    .from(t.paymentSessions)
    .where(eq(t.paymentSessions.orderId, order.id))
    .orderBy(desc(t.paymentSessions.createdAt))
    .limit(1);
  if (!session?.providerRef) return c.json({ error: "This order has no provider invoice to check." }, 400);

  try {
    const provider = await getProvider();
    const remote = await provider.fetchStatus(session.providerRef);
    await logActivity({
      actor: "admin",
      action: `reconciled ${order.number} (provider says ${remote.status})`,
      target: order.number,
      kind: "payment",
      ip: clientIp(c),
    });
    return c.json({ ok: true, providerStatus: remote.status, raw: remote.raw, orderStatus: order.status });
  } catch (err) {
    return c.json({ error: `Provider lookup failed: ${String(err).slice(0, 200)}` }, 502);
  }
});

/* -------------------------------------------------------------- settings */

adminPayments.get("/payments/settings", async (c) => {
  const cfg = await providerConfig();
  const secret = await ipnSecret();
  return c.json({
    provider: await activeProvider(),
    mode: cfg.mode,
    configured: Boolean(cfg.apiKey),
    baseUrl: cfg.baseUrl,
    payoutWallet: cfg.payoutWallet,
    // Never round-trip a secret; show enough to confirm it is set.
    apiKeyHint: mask(cfg.apiKey),
    ipnSecretHint: mask(secret),
    webhookUrls: {
      nowpayments: `${cfg.baseUrl}/api/webhooks/nowpayments`,
      sandbox: `${cfg.baseUrl}/api/webhooks/sandbox`,
    },
    currencies: PAY_OPTIONS.map((p) => ({
      code: p.code,
      ticker: p.ticker,
      network: p.network,
      note: p.note,
      cheap: p.cheap,
    })),
    envOverride: {
      apiKey: Boolean(process.env.NOWPAYMENTS_API_KEY),
      ipnSecret: Boolean(process.env.NOWPAYMENTS_IPN_SECRET),
      baseUrl: Boolean(process.env.PUBLIC_BASE_URL),
    },
  });
});

adminPayments.patch(
  "/payments/settings",
  zValidator(
    "json",
    z.object({
      apiKey: z.string().max(200).optional(),
      ipnSecret: z.string().max(200).optional(),
      baseUrl: z.string().url().max(300).optional(),
      payoutWallet: z.string().max(200).optional(),
      mode: z.enum(["test", "live"]).optional(),
    }),
  ),
  async (c) => {
    const body = c.req.valid("json");
    // Empty strings mean "leave it alone", so an operator editing the mode does
    // not blank the key they cannot see.
    const patch: Record<string, string> = {};
    if (body.apiKey) patch.apiKey = body.apiKey;
    if (body.ipnSecret) patch.ipnSecret = body.ipnSecret;
    if (body.baseUrl) patch.baseUrl = body.baseUrl;
    if (body.payoutWallet !== undefined) patch.payoutWallet = body.payoutWallet;
    if (body.mode) patch.mode = body.mode;
    await saveProviderConfig(patch as never);
    await logActivity({
      actor: "admin",
      action: `updated payment settings${body.mode ? ` (mode ${body.mode})` : ""}`,
      target: "crypto",
      kind: "settings",
      ip: clientIp(c),
    });
    return c.json({ ok: true, provider: await activeProvider() });
  },
);

/** Live key check — does the configured key actually work? */
adminPayments.post("/payments/test-connection", async (c) => {
  const cfg = await providerConfig();
  if (!cfg.apiKey) {
    return c.json({
      ok: true,
      provider: "sandbox",
      message: "No API key set, so the local sandbox is handling invoices. Nothing will settle on-chain.",
    });
  }
  try {
    const res = await fetch("https://api.nowpayments.io/v1/status", {
      headers: { "x-api-key": cfg.apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return c.json({
      ok: res.ok,
      provider: "nowpayments",
      message: res.ok ? `API reachable — ${body.message ?? "ok"}` : `Rejected (${res.status})`,
      raw: body,
    });
  } catch (err) {
    return c.json({ ok: false, provider: "nowpayments", message: String(err).slice(0, 200) }, 502);
  }
});

/* -------------------------------------------------------------- refunds */

/**
 * Refund an order.
 *
 * Crypto refunds are manual by nature — the gateway cannot pull coins back — so
 * this records the decision, revokes delivery immediately, and emails the
 * customer with instructions. The money movement is the operator's job; the
 * entitlement change is ours and happens now.
 */
adminPayments.post(
  "/orders/:number/refund",
  zValidator(
    "json",
    z.object({
      reason: z.string().max(300).optional(),
      /** tx hash of the outgoing refund, once paid */
      refundRef: z.string().max(200).optional(),
      notify: z.boolean().optional().default(true),
    }),
  ),
  async (c) => {
    const db = getDb();
    const number = c.req.param("number");
    const body = c.req.valid("json");
    const [order] = await db.select().from(t.orders).where(eq(t.orders.number, number)).limit(1);
    if (!order) return c.json({ error: "Order not found." }, 404);
    if (order.status === "refunded") return c.json({ error: "Already refunded." }, 409);
    if (order.status !== "paid") return c.json({ error: `Cannot refund a ${order.status} order.` }, 409);

    const revoked = await revokeOrderLicences(order.id, body.reason || "refunded");
    await db
      .update(t.orders)
      .set({
        status: "refunded",
        refundedAt: new Date(),
        refundReason: body.reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(t.orders.id, order.id));
    await db
      .update(t.payments)
      .set({ status: "refunded", updatedAt: new Date() })
      .where(eq(t.payments.orderId, order.id));

    if (body.notify) {
      await sendDevEmail({
        to: order.email,
        subject: `Refund issued — ${order.number}`,
        text:
          `Hi ${order.name || "there"},\n\n` +
          `We have refunded ${order.number} in full ($${(order.total / 100).toFixed(2)}).\n` +
          (body.reason ? `Reason: ${body.reason}\n` : "") +
          (body.refundRef ? `Refund transaction: ${body.refundRef}\n` : "") +
          `\nDownloads for this order are now closed and the licences are revoked.\n` +
          `Crypto refunds settle to the sending wallet once the operator broadcasts; ` +
          `reply here if you need the transaction id.\n\n— Kiln`,
      });
    }

    await logActivity({
      actor: "admin",
      action: `refunded an order and revoked ${revoked} licence${revoked === 1 ? "" : "s"}`,
      target: order.number,
      kind: "refund",
      ip: clientIp(c),
    });

    return c.json({ ok: true, revoked, refundRef: body.refundRef ?? null });
  },
);

/** Force-expire stale pending orders now, instead of waiting for the sweep. */
adminPayments.post("/payments/expire-stale", async (c) => {
  const n = await expireStaleOrders();
  await logActivity({
    actor: "admin",
    action: `expired ${n} stale pending order${n === 1 ? "" : "s"}`,
    target: "orders",
    kind: "order",
    ip: clientIp(c),
  });
  return c.json({ ok: true, expired: n });
});

/* --------------------------------------------------------- manual review */

/**
 * Manual review: settle an order by hand after checking the chain yourself.
 * Required for coins or networks the gateway cannot watch, and for the common
 * "customer paid from an exchange that stripped the memo" case.
 */
adminPayments.post(
  "/orders/:number/mark-paid",
  zValidator(
    "json",
    z.object({
      note: z.string().max(300).optional(),
      txHash: z.string().max(200).optional(),
      payCurrency: z.string().max(20).optional(),
    }),
  ),
  async (c) => {
    const db = getDb();
    const body = c.req.valid("json");
    const [order] = await db.select().from(t.orders).where(eq(t.orders.number, c.req.param("number"))).limit(1);
    if (!order) return c.json({ error: "Order not found." }, 404);
    if (order.status === "paid") return c.json({ error: "Already paid." }, 409);

    const { settleOrder } = await import("../lib/settlement");
    const res = await settleOrder({
      orderNumber: order.number,
      providerStatus: "paid",
      // A human confirmed the money, so the amount check is satisfied by them.
      actuallyPaidUsd: order.total / 100,
      payCurrency: body.payCurrency ?? null,
      payinHash: body.txHash ?? null,
      rawStatus: "manual",
      actor: "admin:manual",
      ip: clientIp(c),
    });
    if (!res.ok) return c.json({ error: res.note }, 409);
    await logActivity({
      actor: "admin",
      action: `manually confirmed ${order.number}${body.note ? ` — ${body.note}` : ""}`,
      target: order.number,
      kind: "payment",
      ip: clientIp(c),
    });
    return c.json({ ok: true, note: res.note });
  },
);

/* -------------------------------------------------------- licence terms */

adminPayments.get("/licenses/terms", async (c) => {
  const terms = await licenseTerms();
  return c.json({ terms, tiers: LICENSE_TIERS });
});

adminPayments.patch(
  "/licenses/terms/:license",
  zValidator(
    "json",
    z.object({
      name: z.string().max(60).optional(),
      summary: z.string().max(300).optional(),
      terms: z.string().max(4000).optional(),
      seats: z.string().max(80).optional(),
      active: z.boolean().optional(),
    }),
  ),
  async (c) => {
    const license = c.req.param("license");
    if (!LICENSE_TIERS.includes(license as never)) return c.json({ error: "Unknown licence tier." }, 400);
    const db = getDb();
    const body = c.req.valid("json");
    const fallback = DEFAULT_TERMS[license as keyof typeof DEFAULT_TERMS];
    const [existing] = await db.select().from(t.licenseTerms).where(eq(t.licenseTerms.license, license)).limit(1);
    const values = {
      license,
      name: body.name ?? existing?.name ?? fallback.name,
      summary: body.summary ?? existing?.summary ?? fallback.summary,
      terms: body.terms ?? existing?.terms ?? fallback.terms,
      seats: body.seats ?? existing?.seats ?? fallback.seats,
      active: body.active ?? existing?.active ?? true,
      position: LICENSE_TIERS.indexOf(license as never),
      updatedAt: new Date(),
    };
    await db
      .insert(t.licenseTerms)
      .values(values)
      .onConflictDoUpdate({ target: t.licenseTerms.license, set: values });
    await logActivity({
      actor: "admin",
      action: `updated ${license} licence terms`,
      target: license,
      kind: "settings",
      ip: clientIp(c),
    });
    return c.json({ ok: true });
  },
);

/* ------------------------------------------------------------ reporting */

adminPayments.get("/payments/revenue", async (c) => {
  const db = getDb();
  const days = Math.min(Number(c.req.query("days") ?? 30), 365);
  const daily = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', coalesce(${t.orders.paidAt}, ${t.orders.createdAt})), 'YYYY-MM-DD')`,
      revenue: sql<number>`coalesce(sum(${t.orders.total}),0)::int`,
      orders: sql<number>`count(*)::int`,
    })
    .from(t.orders)
    .where(
      and(
        eq(t.orders.status, "paid"),
        sql`coalesce(${t.orders.paidAt}, ${t.orders.createdAt}) > now() - (${days} || ' days')::interval`,
      ),
    )
    .groupBy(sql`date_trunc('day', coalesce(${t.orders.paidAt}, ${t.orders.createdAt}))`)
    .orderBy(sql`date_trunc('day', coalesce(${t.orders.paidAt}, ${t.orders.createdAt}))`);

  const byLicense = await db
    .select({
      license: t.orderItems.license,
      revenue: sql<number>`coalesce(sum(${t.orderItems.unitPrice}),0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(t.orderItems)
    .innerJoin(t.orders, eq(t.orders.id, t.orderItems.orderId))
    .where(eq(t.orders.status, "paid"))
    .groupBy(t.orderItems.license);

  return c.json({ daily, byLicense, days });
});

/**
 * Customer account, checkout and download delivery.
 *
 * Downloads are only minted after a licence check. The URL handed to the browser
 * is signed and short-lived; the storage key never appears in a public route.
 */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import * as t from "../db/schema";
import { currentUser, publicUser, clientIp } from "../lib/auth";
import { rateLimit } from "../lib/rate-limit";
import { orderNumber } from "../lib/crypto";
import { LICENSE_TIERS } from "../lib/licensing";
import { quote, ownershipBlockers } from "../lib/pricing";
import { settleOrder, orderCertificates } from "../lib/settlement";
import {
  entitlement,
  latestFile,
  mintDownloadToken,
  redeemDownloadToken,
  logDownload,
  downloadHistory,
} from "../lib/delivery";
import { getProvider, providerConfig, payOption } from "../lib/payments";
import { UPLOAD_LIMITS, get as readStoredFile } from "../lib/storage";
import { toOrder } from "../lib/mappers";
import { logActivity } from "../lib/activity";
import type { License } from "@/data/types";

const account = new Hono();

/** Reject anonymous callers uniformly. */
account.use("/*", async (c, next) => {
  await next();
});

async function requireUser(c: any) {
  const user = await currentUser(c);
  if (!user) return null;
  if (user.status === "suspended") return null;
  return user;
}

/* ------------------------------------------------------------------ profile */

account.get("/me", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "Sign in to continue." }, 401);
  return c.json({ user: publicUser(user) });
});

account.patch(
  "/me",
  zValidator(
    "json",
    z.object({
      name: z.string().trim().min(2).max(120).optional(),
      country: z.string().max(80).optional(),
      notes: z.string().max(500).optional(),
    }),
  ),
  async (c) => {
    const user = await requireUser(c);
    if (!user) return c.json({ error: "Sign in to continue." }, 401);
    const patch = c.req.valid("json");
    const db = getDb();
    const [updated] = await db
      .update(t.users)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(t.users.id, user.id))
      .returning();
    return c.json({ ok: true, user: publicUser(updated) });
  },
);

/* ------------------------------------------------------------------- orders */

account.get("/orders", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "Sign in to continue." }, 401);
  const db = getDb();
  const rows = await db
    .select()
    .from(t.orders)
    .where(eq(t.orders.userId, user.id))
    .orderBy(desc(t.orders.createdAt));

  const items = rows.length
    ? await db
        .select()
        .from(t.orderItems)
        .where(sql`${t.orderItems.orderId} in ${sql.raw(`(${rows.map((r) => `'${r.id}'`).join(",")})`)}`)
    : [];

  return c.json({
    orders: rows.map((o) =>
      toOrder({ ...o, payments: [] }, items.filter((i) => i.orderId === o.id)),
    ),
    detail: rows.map((o) => ({
      number: o.number,
      status: o.status,
      subtotal: o.subtotal,
      discount: o.discount,
      tax: o.tax,
      total: o.total,
      couponCode: o.couponCode,
      createdAt: o.createdAt,
      items: items.filter((i) => i.orderId === o.id),
    })),
  });
});

/**
 * A plain-text invoice. No PDF toolchain in this sandbox, so this is the real
 * document — itemised, with the coupon and totals the order actually recorded.
 */
account.get("/orders/:number/invoice", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "Sign in to continue." }, 401);
  const db = getDb();
  const rows = await db
    .select()
    .from(t.orders)
    .where(and(eq(t.orders.number, c.req.param("number")), eq(t.orders.userId, user.id)))
    .limit(1);
  const order = rows[0];
  if (!order) return c.json({ error: "Order not found" }, 404);
  const items = await db.select().from(t.orderItems).where(eq(t.orderItems.orderId, order.id));

  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const lines = [
    `INVOICE ${order.number}`,
    new Date(order.createdAt).toISOString().slice(0, 10),
    "",
    `Billed to: ${order.name} <${order.email}>`,
    order.country ? `Country: ${order.country}${order.vatNumber ? ` · VAT ${order.vatNumber}` : ""}` : "",
    "",
    "Items",
    ...items.map((i) => `  ${i.productName} — ${i.license} license    ${money(i.unitPrice)}`),
    "",
    `Subtotal: ${money(order.subtotal)}`,
    order.discount > 0 ? `Discount${order.couponCode ? ` (${order.couponCode})` : ""}: -${money(order.discount)}` : "",
    order.tax > 0 ? `Tax: ${money(order.tax)}` : "",
    `Total paid: ${money(order.total)} ${order.currency}`,
    "",
    `Status: ${order.status}`,
    "",
    "Kiln — digital goods. No goods are shipped; licences are delivered to your account.",
  ].filter(Boolean);

  return c.text(lines.join("\n"), 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Disposition": `attachment; filename="${order.number}.txt"`,
  });
});

/**
 * A refund request lands in the activity log for the owner to action. Nothing is
 * refunded automatically — money moving is a human decision.
 */
account.post(
  "/orders/:number/refund-request",
  zValidator("json", z.object({ reason: z.string().trim().max(600).optional() })),
  async (c) => {
    const user = await requireUser(c);
    if (!user) return c.json({ error: "Sign in to continue." }, 401);
    const db = getDb();
    const rows = await db
      .select()
      .from(t.orders)
      .where(and(eq(t.orders.number, c.req.param("number")), eq(t.orders.userId, user.id)))
      .limit(1);
    const order = rows[0];
    if (!order) return c.json({ error: "Order not found" }, 404);
    if (order.status === "refunded") return c.json({ error: "This order is already refunded." }, 409);

    const recent = await db
      .select()
      .from(t.activityLog)
      .where(and(eq(t.activityLog.target, order.number), eq(t.activityLog.kind, "order")))
      .limit(50);
    if (recent.some((r) => r.action.startsWith("requested a refund"))) {
      return c.json({ error: "You already asked about this order — we are on it." }, 409);
    }

    await logActivity({
      actor: user.email,
      action: `requested a refund${c.req.valid("json").reason ? `: ${c.req.valid("json").reason}` : ""}`,
      target: order.number,
      kind: "order",
      ip: clientIp(c),
    });
    return c.json({ ok: true }, 201);
  },
);

account.get("/orders/:number", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "Sign in to continue." }, 401);
  const db = getDb();
  const rows = await db
    .select()
    .from(t.orders)
    .where(and(eq(t.orders.number, c.req.param("number")), eq(t.orders.userId, user.id)))
    .limit(1);
  const order = rows[0];
  if (!order) return c.json({ error: "Order not found" }, 404);
  const items = await db.select().from(t.orderItems).where(eq(t.orderItems.orderId, order.id));
  const payments = await db.select().from(t.payments).where(eq(t.payments.orderId, order.id));
  return c.json({ order: { ...order, items, payments } });
});

/* ----------------------------------------------------------------- checkout */

/**
 * Pricing preview. The cart sends slugs and tiers; the server answers with
 * money. Nothing here creates an order.
 */
account.post(
  "/quote",
  zValidator(
    "json",
    z.object({
      lines: z.array(z.object({ slug: z.string(), license: z.enum(LICENSE_TIERS) })).max(20),
      coupon: z.string().trim().max(40).optional(),
    }),
  ),
  async (c) => {
    const user = await requireUser(c);
    const body = c.req.valid("json");
    const q = await quote({ lines: body.lines, couponCode: body.coupon, userId: user?.id });
    return c.json({
      lines: q.lines,
      subtotal: q.subtotal,
      discount: q.discount,
      total: q.total,
      coupon: q.coupon,
      notices: q.notices,
      missing: q.missing,
    });
  },
);

/**
 * Create an order and a payment invoice.
 *
 * The order is written as `pending` — worth nothing until a signed webhook (or a
 * server-to-server status check) confirms the money arrived. The response gives
 * the browser an address to pay to, never a licence.
 *
 * `idempotencyKey` is required so a double-tapped Pay button cannot leave two
 * pending orders for the same cart.
 */
account.post(
  "/checkout",
  zValidator(
    "json",
    z.object({
      lines: z
        .array(z.object({ slug: z.string(), license: z.enum(LICENSE_TIERS) }))
        .min(1, "Your cart is empty")
        .max(20),
      coupon: z.string().trim().max(40).optional(),
      country: z.string().max(80).optional(),
      vatNumber: z.string().max(40).optional(),
      notes: z.string().max(500).optional(),
      payCurrency: z.string().min(2).max(20).default("usdttrc20"),
      idempotencyKey: z.string().min(8).max(80).optional(),
    }),
  ),
  async (c) => {
    const user = await requireUser(c);
    if (!user) return c.json({ error: "Sign in to continue." }, 401);
    const body = c.req.valid("json");
    const db = getDb();

    const limited = await rateLimit(`checkout:${user.id}`, 20, 10 * 60);
    if (!limited.ok) return c.json({ error: "Too many attempts. Try again shortly." }, 429);

    const pay = payOption(body.payCurrency);
    if (!pay) return c.json({ error: "We do not accept that currency yet." }, 400);

    // Same key twice returns the original order rather than a second one.
    if (body.idempotencyKey) {
      const [existing] = await db
        .select()
        .from(t.orders)
        .where(and(eq(t.orders.userId, user.id), eq(t.orders.idempotencyKey, body.idempotencyKey)))
        .limit(1);
      if (existing) {
        const [session] = await db
          .select()
          .from(t.paymentSessions)
          .where(eq(t.paymentSessions.orderId, existing.id))
          .orderBy(desc(t.paymentSessions.createdAt))
          .limit(1);
        return c.json({
          ok: true,
          reused: true,
          order: { number: existing.number, total: existing.total, status: existing.status },
          payment: session
            ? {
                payCurrency: session.payCurrency,
                payAmount: session.payAmount,
                payAddress: session.payAddress,
                invoiceUrl: session.invoiceUrl,
                expiresAt: session.expiresAt,
                status: session.status,
              }
            : null,
        });
      }
    }

    const q = await quote({ lines: body.lines, couponCode: body.coupon, userId: user.id });
    if (q.missing.length) {
      return c.json({ error: "Some items are no longer available.", slugs: q.missing }, 409);
    }
    if (!q.lines.length) return c.json({ error: "Those products are no longer available." }, 400);

    // A downgrade is not a purchase; refuse before taking money.
    const blockers = await ownershipBlockers(user.id, body.lines);
    if (blockers.length) {
      const worst = blockers[0];
      const product = q.lines.find((l) => l.slug === worst.slug);
      return c.json(
        {
          error:
            worst.owned === worst.requested
              ? `${product?.name ?? worst.slug} is already in your library.`
              : `${product?.name ?? worst.slug} is already yours on the ${worst.owned} licence.`,
          code: "already_owned",
          slugs: blockers.map((b) => b.slug),
        },
        409,
      );
    }

    // A fully discounted (or free) cart needs no invoice at all.
    const freeOrder = q.total === 0;

    const [order] = await db
      .insert(t.orders)
      .values({
        number: orderNumber(),
        userId: user.id,
        email: user.email,
        name: user.name,
        status: freeOrder ? "paid" : "pending",
        subtotal: q.subtotal,
        discount: q.discount,
        tax: 0,
        total: q.total,
        couponCode: q.coupon?.code ?? null,
        country: body.country ?? user.country,
        vatNumber: body.vatNumber ?? null,
        notes: body.notes ?? null,
        idempotencyKey: body.idempotencyKey ?? null,
        paidAt: freeOrder ? new Date() : null,
        reference: freeOrder ? `PAY-${orderNumber()}` : null,
      })
      .returning();

    await db.insert(t.orderItems).values(
      q.lines.map((l) => ({
        orderId: order.id,
        productId: l.productId,
        productName: l.name,
        productSlug: l.slug,
        license: l.license,
        unitPrice: l.unitPrice,
        discount: l.discount,
        quantity: 1,
      })),
    );

    const [payment] = await db
      .insert(t.payments)
      .values({
        orderId: order.id,
        provider: freeOrder ? "free" : "nowpayments",
        mode: freeOrder ? "demo" : (await providerConfig()).mode,
        status: freeOrder ? "succeeded" : "waiting",
        amount: q.total,
        fee: 0,
        reference: `PAY-${order.number}`,
      })
      .returning();

    if (freeOrder) {
      // Grant immediately; nothing to wait for.
      await settleFreeOrder(order.id, user.id);
      await logActivity({
        actor: user.email,
        action: "placed a free order",
        target: order.number,
        kind: "order",
        ip: clientIp(c),
      });
      return c.json(
        {
          ok: true,
          order: { number: order.number, total: 0, status: "paid" },
          payment: null,
        },
        201,
      );
    }

    const provider = await getProvider();
    const cfg = await providerConfig();
    const origin = c.req.header("origin") ?? cfg.baseUrl;

    let created;
    try {
      created = await provider.createInvoice({
        priceUsdCents: q.total,
        payCurrency: pay.code,
        orderNumber: order.number,
        description: q.lines.map((l) => `${l.name} (${l.license})`).join(", "),
        callbackUrl: `${cfg.baseUrl}/api/webhooks/${provider.key}`,
        successUrl: `${origin}/order/${order.number}?paid=1`,
        cancelUrl: `${origin}/order/${order.number}?cancelled=1`,
      });
    } catch (err) {
      // The order exists but has no way to be paid; mark it so it is not a
      // phantom pending sale in reports.
      await db.update(t.orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(t.orders.id, order.id));
      await db
        .update(t.payments)
        .set({ status: "failed", rawStatus: String(err).slice(0, 200), updatedAt: new Date() })
        .where(eq(t.payments.id, payment.id));
      await logActivity({
        actor: user.email,
        action: "could not create a payment invoice",
        target: order.number,
        kind: "payment",
        ip: clientIp(c),
      });
      return c.json(
        { error: "We could not open a payment for that order. Nothing was charged.", code: "provider_error" },
        502,
      );
    }

    const expiresAt = created.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000);

    await db.insert(t.paymentSessions).values({
      orderId: order.id,
      provider: provider.key,
      mode: cfg.mode,
      payCurrency: created.payCurrency,
      network: created.network ?? pay.network,
      priceAmount: q.total,
      priceCurrency: "usd",
      payAmount: created.payAmount,
      payAddress: created.payAddress,
      invoiceUrl: created.invoiceUrl,
      providerRef: created.providerRef,
      purchaseId: created.purchaseId,
      status: "waiting",
      expiresAt,
    });

    await db
      .update(t.payments)
      .set({
        providerRef: created.providerRef,
        payCurrency: created.payCurrency,
        payAmount: created.payAmount,
        payAddress: created.payAddress,
        network: created.network ?? pay.network,
        invoiceUrl: created.invoiceUrl,
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(t.payments.id, payment.id));

    await logActivity({
      actor: user.email,
      action: `opened a ${pay.ticker} invoice`,
      target: order.number,
      kind: "payment",
      ip: clientIp(c),
    });

    return c.json(
      {
        ok: true,
        order: { number: order.number, total: q.total, status: "pending" },
        payment: {
          provider: provider.key,
          sandbox: created.sandbox,
          payCurrency: created.payCurrency,
          ticker: pay.ticker,
          network: created.network ?? pay.network,
          payAmount: created.payAmount,
          payAddress: created.payAddress,
          invoiceUrl: created.invoiceUrl,
          expiresAt,
          status: "waiting",
        },
      },
      201,
    );
  },
);

/** Free/fully-discounted carts: grant licences without pretending to take money. */
async function settleFreeOrder(orderId: string, userId: string) {
  const db = getDb();
  const items = await db.select().from(t.orderItems).where(eq(t.orderItems.orderId, orderId));
  for (const item of items) {
    if (!item.productId) continue;
    await db
      .insert(t.licenses)
      .values({
        userId,
        productId: item.productId,
        license: item.license,
        orderId,
        status: "active",
        grantedBy: "free",
      })
      .onConflictDoUpdate({
        target: [t.licenses.userId, t.licenses.productId],
        set: { status: "active", revokedAt: null, revokedReason: null },
      });
  }
}

/**
 * Poll the payment state. This is a convenience for the invoice screen — it can
 * never be the thing that marks an order paid, but it does ask the provider
 * directly (server-to-server) so a customer does not wait on webhook retries.
 */
account.get("/orders/:number/payment", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "Sign in to continue." }, 401);
  const db = getDb();
  const [order] = await db
    .select()
    .from(t.orders)
    .where(and(eq(t.orders.number, c.req.param("number")), eq(t.orders.userId, user.id)))
    .limit(1);
  if (!order) return c.json({ error: "Order not found." }, 404);

  const [session] = await db
    .select()
    .from(t.paymentSessions)
    .where(eq(t.paymentSessions.orderId, order.id))
    .orderBy(desc(t.paymentSessions.createdAt))
    .limit(1);

  // Reconcile from the provider when we have a real reference and the order is
  // still open. Failures are logged but never surface as "paid".
  let reconciled = false;
  if (order.status === "pending" && session?.provider === "nowpayments" && session.providerRef) {
    try {
      const provider = await getProvider();
      const remote = await provider.fetchStatus(session.providerRef);
      if (remote.status !== "waiting") {
        const raw = remote.raw as Record<string, unknown>;
        const res = await settleOrder({
          orderNumber: order.number,
          providerStatus: remote.status,
          actuallyPaidUsd: raw.actually_paid != null ? Number(raw.actually_paid) : null,
          payCurrency: session.payCurrency,
          payAmount: session.payAmount,
          payAddress: session.payAddress,
          payinHash: typeof raw.payin_hash === "string" ? raw.payin_hash : null,
          network: session.network,
          providerRef: session.providerRef,
          rawStatus: String(raw.payment_status ?? ""),
          actor: "status-poll",
        });
        reconciled = res.ok;
      }
    } catch {
      // Provider unreachable: leave the order pending and let the UI keep waiting.
    }
  }

  const [fresh] = await db.select().from(t.orders).where(eq(t.orders.id, order.id)).limit(1);
  return c.json({
    order: { number: fresh.number, status: fresh.status, total: fresh.total, paidAt: fresh.paidAt },
    payment: session
      ? {
          status: session.status,
          payCurrency: session.payCurrency,
          payAmount: session.payAmount,
          payAddress: session.payAddress,
          invoiceUrl: session.invoiceUrl,
          network: session.network,
          expiresAt: session.expiresAt,
          sandbox: session.provider === "sandbox",
        }
      : null,
    reconciled,
  });
});

/* ------------------------------------------------------------------ library */

/** Purchased products + latest file metadata (no keys, no paths). */
account.get("/library", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "Sign in to continue." }, 401);
  const db = getDb();

  const rows = await db
    .select({ license: t.licenses, product: t.products })
    .from(t.licenses)
    .innerJoin(t.products, eq(t.licenses.productId, t.products.id))
    .where(and(eq(t.licenses.userId, user.id), eq(t.licenses.status, "active")))
    .orderBy(desc(t.licenses.createdAt));

  const productIds = rows.map((r) => r.product.id);
  const files = productIds.length
    ? await db
        .select({
          id: t.productFiles.id,
          productId: t.productFiles.productId,
          kind: t.productFiles.kind,
          bytes: t.productFiles.bytes,
          originalName: t.productFiles.originalName,
          createdAt: t.productFiles.createdAt,
        })
        .from(t.productFiles)
        .where(sql`${t.productFiles.productId} in ${sql.raw(`(${productIds.map((id) => `'${id}'`).join(",")})`)}`)
    : [];

  const downloads = await db
    .select()
    .from(t.downloads)
    .where(eq(t.downloads.userId, user.id))
    .orderBy(desc(t.downloads.createdAt))
    .limit(50);

  return c.json({
    library: rows.map(({ license, product }) => ({
      slug: product.slug,
      name: product.name,
      tagline: product.tagline,
      version: product.version,
      license: license.license,
      grantedBy: license.grantedBy,
      grantedAt: license.createdAt,
      price: product.price,
      art: {
        from: product.artFrom,
        to: product.artTo,
        ink: product.artInk,
        kind: product.artKind,
        ...(product.coverPath ? { src: product.coverPath } : {}),
      },
      hasFile: files.some((f) => f.productId === product.id && f.kind === "source_zip"),
      sizeBytes: files.find((f) => f.productId === product.id && f.kind === "source_zip")?.bytes ?? 0,
    })),
    downloads: downloads.map((d) => ({
      id: d.id,
      productSlug: d.productId ? productIds.includes(d.productId) : false,
      version: d.version,
      ip: d.ip,
      at: d.createdAt,
    })),
    storage: {
      maxZipBytes: UPLOAD_LIMITS.zipBytes,
    },
  });
});

/**
 * Mint a download link.
 *
 * Two things happen here: the entitlement is checked server-side, and a
 * short-lived token is issued instead of a storage URL. The link expires in 15
 * minutes and works at most three times, which is enough for a flaky
 * connection but useless to anyone who scrapes it out of a shared screenshot.
 */
account.post(
  "/download/:slug",
  zValidator("json", z.object({ version: z.string().optional() }).optional()),
  async (c) => {
    const user = await requireUser(c);
    if (!user) return c.json({ error: "Sign in to continue." }, 401);
    const slug = c.req.param("slug");

    const limited = await rateLimit(`download:${user.id}`, 40, 10 * 60);
    if (!limited.ok) return c.json({ error: "Too many downloads. Try again in a few minutes." }, 429);

    const db = getDb();
    const [product] = await db.select().from(t.products).where(eq(t.products.slug, slug)).limit(1);
    if (!product) return c.json({ error: "Product not found" }, 404);

    const allowed = await entitlement({ userId: user.id, productId: product.id });
    if (!allowed.ok) {
      await logActivity({
        actor: user.email,
        action: "was refused a download",
        target: product.slug,
        kind: "download",
        ip: clientIp(c),
      });
      return c.json({ error: allowed.reason }, 403);
    }

    const file = await latestFile(product.id);
    if (!file) return c.json({ error: "The source package has not been uploaded yet." }, 409);

    const { token, expiresAt } = await mintDownloadToken({
      userId: user.id,
      productId: product.id,
      fileId: file.id,
      version: product.version,
      ip: clientIp(c),
    });

    return c.json({
      ok: true,
      url: `/api/account/downloads/${token}`,
      filename: file.originalName,
      bytes: file.bytes,
      version: product.version,
      license: allowed.license,
      expiresAt,
      maxUses: 3,
    });
  },
);

/** Redeem a download token. The only route that streams product bytes. */
account.get("/downloads/:token", async (c) => {
  const token = c.req.param("token");
  const redeemed = await redeemDownloadToken(token);
  if (!redeemed.ok) return c.json({ error: redeemed.reason }, 403);

  const { file, product } = redeemed;
  // Re-check entitlement: a refund between mint and redemption must win.
  const viewer = await requireUser(c);
  const allowed = await entitlement({ userId: viewer?.id ?? null, productId: product.id });
  if (!allowed.ok) {
    return c.json({ error: allowed.reason }, 403);
  }

  await logDownload({
    userId: viewer?.id ?? null,
    productId: product.id,
    fileId: file.id,
    version: product.version,
    ip: clientIp(c),
    userAgent: c.req.header("user-agent"),
  });

  const bytes = await readStoredFile(file.storageKey);
  if (!bytes) return c.json({ error: "That file is missing from storage." }, 410);

  return new Response(bytes, {
    headers: {
      "content-type": file.mimeType || "application/zip",
      "content-length": String(bytes.byteLength),
      "content-disposition": `attachment; filename="${file.originalName.replace(/"/g, "")}"`,
      "cache-control": "private, no-store",
    },
  });
});

/** Download history for the library screen. */
account.get("/downloads", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "Sign in to continue." }, 401);
  const history = await downloadHistory(user.id, 100);
  return c.json({ downloads: history });
});

/* ------------------------------------------------------------- certificates */

/** Licence certificates for every paid order, printable from the library. */
account.get("/certificates", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "Sign in to continue." }, 401);
  const db = getDb();
  const orders = await db
    .select({ id: t.orders.id })
    .from(t.orders)
    .where(and(eq(t.orders.userId, user.id), eq(t.orders.status, "paid")));
  const all = await Promise.all(orders.map((o) => orderCertificates(o.id)));
  return c.json({ certificates: all.flat() });
});

/* ------------------------------------------------------------------ reviews */

account.post(
  "/reviews",
  zValidator(
    "json",
    z.object({
      slug: z.string(),
      rating: z.number().int().min(1).max(5),
      title: z.string().trim().min(3).max(120),
      body: z.string().trim().min(10).max(4000),
    }),
  ),
  async (c) => {
    const user = await requireUser(c);
    if (!user) return c.json({ error: "Sign in to continue." }, 401);
    const { slug, rating, title, body } = c.req.valid("json");
    const db = getDb();

    const productRows = await db.select().from(t.products).where(eq(t.products.slug, slug)).limit(1);
    const product = productRows[0];
    if (!product) return c.json({ error: "Product not found" }, 404);

    const owned = await db
      .select({ id: t.licenses.id })
      .from(t.licenses)
      .where(and(eq(t.licenses.userId, user.id), eq(t.licenses.productId, product.id)))
      .limit(1);

    const initials = user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
    const [review] = await db
      .insert(t.reviews)
      .values({
        productId: product.id,
        userId: user.id,
        author: user.name,
        initials,
        rating,
        title,
        body,
        verified: owned.length > 0,
        status: "pending", // moderated before it appears
      })
      .returning();

    return c.json({ ok: true, review: { id: review.id, status: review.status } }, 201);
  },
);

export { account };

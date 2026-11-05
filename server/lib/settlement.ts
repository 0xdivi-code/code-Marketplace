/**
 * Settlement: the one place an order becomes paid.
 *
 * Everything the browser says is treated as a rumour. This module is called
 * only from webhook handlers and admin actions, and it:
 *
 *   1. resolves the order by our own number, never by anything the caller chose
 *   2. verifies the amount actually received against the quoted amount
 *   3. is idempotent — a replayed webhook cannot grant a second licence or send
 *      a second receipt
 *   4. grants licences, bumps sales and sends the receipt in one sequence
 */
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import * as t from "../db/schema";
import { logActivity } from "./activity";
import { sendDevEmail } from "./mailer";
import { certificateNumber, certificateText, DEFAULT_TERMS, type LicenseTier } from "./licensing";
import { providerConfig, type NormalizedStatus } from "./payments";

export type SettleResult = {
  ok: boolean;
  /** why nothing changed, for the webhook log */
  note: string;
  alreadyPaid?: boolean;
  orderNumber?: string;
};

/**
 * Shortfall tolerance. Stablecoin payers occasionally underpay by dust because
 * of exchange rounding; anything more than 2% (and at least a cent) is treated
 * as a partial payment needing human review rather than silently honoured.
 */
export function withinTolerance(quotedCents: number, actuallyPaidUsd: number | null): boolean {
  if (actuallyPaidUsd == null) return false;
  const paidCents = Math.round(actuallyPaidUsd * 100);
  const shortfall = quotedCents - paidCents;
  if (shortfall <= 0) return true;
  const tolerance = Math.max(1, Math.round(quotedCents * 0.02));
  return shortfall <= tolerance;
}

/**
 * Mark an order paid and deliver it. Safe to call repeatedly.
 */
export async function settleOrder(input: {
  orderNumber: string;
  providerStatus: NormalizedStatus;
  /** USD value the provider says arrived, if it says */
  actuallyPaidUsd?: number | null;
  payCurrency?: string | null;
  payAmount?: string | null;
  payAddress?: string | null;
  payinHash?: string | null;
  network?: string | null;
  providerRef?: string | null;
  rawStatus?: string | null;
  actor?: string;
  ip?: string | null;
}): Promise<SettleResult> {
  const db = getDb();
  const orderRows = await db.select().from(t.orders).where(eq(t.orders.number, input.orderNumber)).limit(1);
  const order = orderRows[0];
  if (!order) return { ok: false, note: `no order ${input.orderNumber}` };

  const status = input.providerStatus;

  // ---- non-final states just update the payment row for the UI
  if (status === "waiting" || status === "confirming" || status === "partially_paid") {
    await db
      .update(t.payments)
      .set({ status, rawStatus: input.rawStatus ?? null, updatedAt: new Date() })
      .where(
        input.providerRef
          ? eq(t.payments.providerRef, input.providerRef)
          : eq(t.payments.orderId, order.id),
      );
    if (status === "partially_paid") {
      await db
        .update(t.orders)
        .set({ notes: sql`coalesce(${t.orders.notes} || E'\n', '') || ${`Underpaid ${input.payAmount ?? "?"} ${input.payCurrency ?? ""} on ${new Date().toISOString()}`}` })
        .where(eq(t.orders.id, order.id));
    }
    return { ok: true, note: `status ${status} recorded`, orderNumber: order.number };
  }

  if (status === "expired" || status === "failed") {
    // Only cancel an order that has not been paid; a paid order must never be
    // un-paid by a late delivery of an unrelated expiry hook.
    if (order.status === "paid") {
      return { ok: true, note: "already paid; ignoring expiry", alreadyPaid: true, orderNumber: order.number };
    }
    await db
      .update(t.payments)
      .set({ status, rawStatus: input.rawStatus ?? null, updatedAt: new Date() })
      .where(eq(t.payments.orderId, order.id));
    // Expiry/failure may only close an order that is *still* pending. Guarding
    // on the status in SQL means a race with a simultaneous paid webhook can
    // never cancel a sale.
    const closed = await db
      .update(t.orders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(t.orders.id, order.id), eq(t.orders.status, "pending")))
      .returning({ id: t.orders.id });
    return {
      ok: true,
      note: closed.length ? `order ${status}` : `order already ${order.status}; ignored ${status}`,
      orderNumber: order.number,
    };
  }

  if (status !== "paid") {
    return { ok: false, note: `unhandled status ${status}` };
  }

  // ---- paid
  if (order.status === "paid") {
    // Idempotent path: make sure the payment row is settled, change nothing else.
    await db
      .update(t.payments)
      .set({ status: "succeeded", rawStatus: input.rawStatus ?? null, updatedAt: new Date() })
      .where(
        input.providerRef
          ? eq(t.payments.providerRef, input.providerRef)
          : eq(t.payments.orderId, order.id),
      );
    return { ok: true, note: "duplicate confirmation ignored", alreadyPaid: true, orderNumber: order.number };
  }
  if (order.status === "refunded" || order.status === "cancelled") {
    return { ok: false, note: `order is ${order.status}; refusing to re-settle`, orderNumber: order.number };
  }

  // Amount check — the whole point of server-side verification.
  if (!withinTolerance(order.total, input.actuallyPaidUsd ?? null)) {
    await db
      .update(t.payments)
      .set({ status: "partially_paid", rawStatus: input.rawStatus ?? null, updatedAt: new Date() })
      .where(eq(t.payments.orderId, order.id));
    await logActivity({
      actor: "webhook",
      action: `rejected an underpaid order (${input.actuallyPaidUsd ?? "?"} vs ${order.total / 100} USD)`,
      target: order.number,
      kind: "payment",
      ip: input.ip ?? null,
    });
    return { ok: false, note: "amount short of quote", orderNumber: order.number };
  }

  const items = await db.select().from(t.orderItems).where(eq(t.orderItems.orderId, order.id));
  const paidAt = new Date();
  const reference = `PAY-${order.number}-${paidAt.getFullYear()}`;

  await db
    .update(t.orders)
    .set({ status: "paid", paidAt, reference, updatedAt: paidAt })
    .where(and(eq(t.orders.id, order.id), eq(t.orders.status, "pending")));

  await db
    .update(t.payments)
    .set({
      status: "succeeded",
      providerRef: input.providerRef ?? undefined,
      payCurrency: input.payCurrency ?? undefined,
      payAmount: input.payAmount ?? undefined,
      payAddress: input.payAddress ?? undefined,
      payinHash: input.payinHash ?? undefined,
      network: input.network ?? undefined,
      actuallyPaid: input.actuallyPaidUsd != null ? String(input.actuallyPaidUsd) : undefined,
      rawStatus: input.rawStatus ?? null,
      updatedAt: paidAt,
    })
    .where(eq(t.payments.orderId, order.id));

  await db
    .update(t.paymentSessions)
    .set({ status: "paid", updatedAt: paidAt })
    .where(eq(t.paymentSessions.orderId, order.id));

  // ---- delivery: licences and sales counters
  if (order.userId) {
    for (const item of items) {
      if (!item.productId) continue;
      await db
        .insert(t.licenses)
        .values({
          userId: order.userId,
          productId: item.productId,
          license: item.license as LicenseTier,
          orderId: order.id,
          status: "active",
          grantedBy: "purchase",
        })
        .onConflictDoUpdate({
          target: [t.licenses.userId, t.licenses.productId],
          set: {
            license: item.license as LicenseTier,
            status: "active",
            orderId: order.id,
            revokedAt: null,
            revokedReason: null,
          },
        });
      await db
        .update(t.products)
        .set({ sales: sql`${t.products.sales} + 1` })
        .where(eq(t.products.id, item.productId));
    }
  }

  // ---- receipt
  const lines = items
    .map((i) => `  ${i.quantity} x ${i.productName} (${i.license}) — $${(i.unitPrice / 100).toFixed(2)}`)
    .join("\n");
  const money = (c: number) => `$${(c / 100).toFixed(2)}`;
  const { baseUrl } = await providerConfig();
  await sendDevEmail({
    to: order.email,
    subject: `Payment received — ${order.number}`,
    text:
      `Hi ${order.name || "there"},\n\n` +
      `We have confirmed your payment of ${money(order.total)}.\n\n` +
      `${lines}\n\n` +
      (order.discount ? `Discount ${order.couponCode ?? ""}: -${money(order.discount)}\n` : "") +
      `Total ${money(order.total)}\n\n` +
      `Paid with ${input.payCurrency?.toUpperCase() ?? "crypto"}` +
      (input.payinHash ? ` (tx ${input.payinHash.slice(0, 16)}…)` : "") +
      `.\n\n` +
      `Your downloads are unlocked now:\n${baseUrl}/account/library\n\n` +
      `Reference ${reference}\n\n— Kiln`,
  });

  await logActivity({
    actor: input.actor ?? "webhook",
    action: "confirmed payment and released downloads",
    target: order.number,
    kind: "payment",
    ip: input.ip ?? null,
  });

  return { ok: true, note: "order paid", orderNumber: order.number };
}

/** Cancels unpaid orders whose invoice window closed. Idempotent. */
export async function expireStaleOrders(): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: t.orders.id, number: t.orders.number })
    .from(t.orders)
    .where(and(eq(t.orders.status, "pending"), sql`${t.orders.createdAt} < now() - interval '2 hours'`));
  for (const row of rows) {
    await db.update(t.orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(t.orders.id, row.id));
    await db.update(t.payments).set({ status: "expired", updatedAt: new Date() }).where(eq(t.payments.orderId, row.id));
    await db.update(t.paymentSessions).set({ status: "expired", updatedAt: new Date() }).where(eq(t.paymentSessions.orderId, row.id));
  }
  return rows.length;
}

/** Revoke every licence granted by an order — used by the refund path. */
export async function revokeOrderLicences(orderId: string, reason: string): Promise<number> {
  const db = getDb();
  const items = await db.select().from(t.orderItems).where(eq(t.orderItems.orderId, orderId));
  let revoked = 0;
  for (const item of items) {
    if (!item.productId) continue;
    const res = await db
      .update(t.licenses)
      .set({ status: "revoked", revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(t.licenses.orderId, orderId), eq(t.licenses.productId, item.productId)))
      .returning({ id: t.licenses.id });
    revoked += res.length;
    await db
      .update(t.products)
      .set({ sales: sql`greatest(${t.products.sales} - 1, 0)` })
      .where(eq(t.products.id, item.productId));
  }
  return revoked;
}

/** Certificate payload for an order line. */
export async function orderCertificates(orderId: string) {
  const db = getDb();
  const rows = await db
    .select({ order: t.orders, item: t.orderItems })
    .from(t.orderItems)
    .innerJoin(t.orders, eq(t.orders.id, t.orderItems.orderId))
    .where(eq(t.orderItems.orderId, orderId));
  return rows.map(({ order, item }) => {
    const tier = item.license as LicenseTier;
    const number = `${order.number}-${tier[0].toUpperCase()}`;
    return {
      number,
      orderNumber: order.number,
      holder: order.name || order.email,
      product: item.productName,
      productSlug: item.productSlug,
      tier,
      tierName: DEFAULT_TERMS[tier]?.name ?? tier,
      seats: DEFAULT_TERMS[tier]?.seats ?? "",
      issuedAt: (order.paidAt ?? order.createdAt).toISOString(),
      text: certificateText({
        number,
        orderNumber: order.number,
        holder: order.name || order.email,
        product: item.productName,
        tier,
        issuedAt: order.paidAt ?? order.createdAt,
        seats: DEFAULT_TERMS[tier]?.seats ?? "",
      }),
    };
  });
}

export { certificateNumber };

/**
 * Delivery.
 *
 * Downloads never expose a storage key directly. The customer asks for a file,
 * the server checks entitlement (an active licence, or a free product), mints a
 * short-lived token, and the download route redeems it. Tokens are stored hashed
 * so a database leak cannot be replayed, and each one has a hard use cap.
 */
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import * as t from "../db/schema";
import { newToken, sha256 } from "./crypto";

/** How long a minted link stays usable. */
export const TOKEN_TTL_MS = 15 * 60 * 1000;
/** How many times one link may be used (retries, interrupted downloads). */
export const MAX_USES = 3;

export const FREE_DOWNLOAD_LIMIT = 5;

export type Entitlement =
  | { ok: true; license: string; free: boolean; via: string }
  | { ok: false; reason: string };

/**
 * Can this viewer download this product?
 *
 * Guests may download free products — the brief allows optional registration —
 * but only through the free-products route, which applies its own quota.
 */
export async function entitlement(input: {
  userId?: string | null;
  productId: string;
}): Promise<Entitlement> {
  const db = getDb();
  const [product] = await db.select().from(t.products).where(eq(t.products.id, input.productId)).limit(1);
  if (!product) return { ok: false, reason: "That product no longer exists." };
  if (product.status !== "published") return { ok: false, reason: "That product is not available." };
  if (product.free) return { ok: true, license: "personal", free: true, via: "free" };

  if (!input.userId) return { ok: false, reason: "Sign in to download this." };

  const [licence] = await db
    .select()
    .from(t.licenses)
    .where(
      and(
        eq(t.licenses.userId, input.userId),
        eq(t.licenses.productId, input.productId),
        eq(t.licenses.status, "active"),
      ),
    )
    .limit(1);
  if (licence) return { ok: true, license: licence.license, free: false, via: "licence" };

  // Look at the most recent order for this product: a refund must read as a
  // refund, not as an older pending order that happens to sort first.
  const [latest] = await db
    .select({ number: t.orders.number, status: t.orders.status })
    .from(t.orderItems)
    .innerJoin(t.orders, eq(t.orders.id, t.orderItems.orderId))
    .where(and(eq(t.orderItems.productId, input.productId), eq(t.orders.userId, input.userId)))
    .orderBy(sql`${t.orders.createdAt} desc`)
    .limit(1);

  if (latest?.status === "refunded") {
    return { ok: false, reason: `Order ${latest.number} was refunded, so this licence is closed.` };
  }
  if (latest?.status === "cancelled") {
    return { ok: false, reason: `Order ${latest.number} was cancelled — nothing was delivered.` };
  }
  return {
    ok: false,
    reason: latest
      ? `Order ${latest.number} is ${latest.status} — downloads unlock once payment confirms.`
      : "You do not own this product yet.",
  };
}

/** Latest versioned file of a given kind (defaults to the source zip). */
export async function latestFile(
  productId: string,
  kind: "source_zip" | "document" | "image" = "source_zip",
) {
  const db = getDb();
  const rows = await db
    .select()
    .from(t.productFiles)
    .where(and(eq(t.productFiles.productId, productId), eq(t.productFiles.kind, kind)))
    .orderBy(sql`${t.productFiles.createdAt} desc`)
    .limit(1);
  return rows[0] ?? null;
}

/** Mint a signed download token. Returns the opaque string, not the row. */
export async function mintDownloadToken(input: {
  userId?: string | null;
  productId: string;
  fileId: string;
  version?: string | null;
  ip?: string | null;
}): Promise<{ token: string; expiresAt: Date }> {
  const db = getDb();
  const token = newToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await db.insert(t.downloadTokens).values({
    tokenHash: sha256(token),
    userId: input.userId ?? null,
    productId: input.productId,
    fileId: input.fileId,
    version: input.version ?? null,
    expiresAt,
    ip: input.ip ?? null,
    maxUses: MAX_USES,
  });
  return { token, expiresAt };
}

export type RedeemResult =
  | {
      ok: true;
      file: typeof t.productFiles.$inferSelect;
      product: typeof t.products.$inferSelect;
      tokenId: string;
      /** the account the link was minted for — the entitlement to re-check */
      userId: string | null;
    }
  | { ok: false; reason: string };

/** Consume one use of a token. Single source of truth for link validity. */
export async function redeemDownloadToken(token: string): Promise<RedeemResult> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(t.downloadTokens)
    .where(eq(t.downloadTokens.tokenHash, sha256(token)))
    .limit(1);
  if (!row) return { ok: false, reason: "That download link is not valid." };
  if (row.expiresAt < new Date()) return { ok: false, reason: "That download link has expired." };
  if (row.uses >= row.maxUses) return { ok: false, reason: "That download link has been used too many times." };

  const [file] = await db.select().from(t.productFiles).where(eq(t.productFiles.id, row.fileId!)).limit(1);
  if (!file) return { ok: false, reason: "The file is no longer attached to this product." };
  const [product] = await db.select().from(t.products).where(eq(t.products.id, row.productId!)).limit(1);
  if (!product) return { ok: false, reason: "That product no longer exists." };

  return { ok: true, file, product, tokenId: row.id, userId: row.userId };
}

/**
 * Charge one use to a token, after every check has passed.
 *
 * Kept separate from `redeemDownloadToken` on purpose: revocation and storage
 * failures must not silently eat a customer's remaining uses.
 */
export async function consumeDownloadToken(tokenId: string): Promise<void> {
  const db = getDb();
  await db
    .update(t.downloadTokens)
    .set({ uses: sql`${t.downloadTokens.uses} + 1`, usedAt: new Date() })
    .where(eq(t.downloadTokens.id, tokenId));
}

/** Append to the audit trail. Called from the route that streams bytes. */
export async function logDownload(input: {
  userId?: string | null;
  productId: string;
  fileId: string;
  version?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const db = getDb();
  await db.insert(t.downloads).values({
    userId: input.userId ?? null,
    productId: input.productId,
    fileId: input.fileId,
    version: input.version ?? null,
    ip: input.ip ?? null,
    userAgent: input.userAgent?.slice(0, 400) ?? null,
  });
}

/** Device/customer download history for the library screen. */
export async function downloadHistory(userId: string, limit = 50) {
  const db = getDb();
  return db
    .select({
      id: t.downloads.id,
      version: t.downloads.version,
      createdAt: t.downloads.createdAt,
      productName: t.products.name,
      productSlug: t.products.slug,
    })
    .from(t.downloads)
    .innerJoin(t.products, eq(t.products.id, t.downloads.productId))
    .where(eq(t.downloads.userId, userId))
    .orderBy(sql`${t.downloads.createdAt} desc`)
    .limit(limit);
}

/** Has the customer already pulled this file since the last version bump? */
export async function hasNewVersion(userId: string, productId: string, version: string | null) {
  if (!version) return false;
  const db = getDb();
  const [row] = await db
    .select({ id: t.downloads.id })
    .from(t.downloads)
    .where(
      and(
        eq(t.downloads.userId, userId),
        eq(t.downloads.productId, productId),
        eq(t.downloads.version, version),
      ),
    )
    .limit(1);
  return !row;
}

/** Free-product quota per viewer per day, so a link cannot be farmed. */
export async function freeQuotaUsed(key: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(t.downloads)
    .where(and(eq(t.downloads.ip, key), sql`${t.downloads.createdAt} > now() - interval '24 hours'`));
  return rows[0]?.n ?? 0;
}

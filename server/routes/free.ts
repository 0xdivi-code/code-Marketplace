/**
 * Free products.
 *
 * Downloading free code should not require an account — a signup wall in front
 * of "zero dollars" is a lie. Guests get a quota keyed on a hash of their IP;
 * signed-in customers get the file attached to their library so version updates
 * can reach them later.
 */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import * as t from "../db/schema";
import { currentUser, clientIp } from "../lib/auth";
import { sha256 } from "../lib/crypto";
import {
  freeQuotaUsed,
  latestFile,
  consumeDownloadToken,
  redeemDownloadToken,
  entitlement,
  logDownload,
  FREE_DOWNLOAD_LIMIT,
} from "../lib/delivery";
import { get as readStoredFile } from "../lib/storage";
import { rateLimit } from "../lib/rate-limit";
import { logActivity } from "../lib/activity";


const free = new Hono();

/** Public catalogue of free items, with the version customers would get. */
free.get("/free", async (c) => {
  const db = getDb();
  const rows = await db
    .select()
    .from(t.products)
    .where(and(eq(t.products.free, true), eq(t.products.status, "published")))
    .orderBy(t.products.position);
  return c.json({
    products: rows.map((p) => ({
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
      version: p.version,
      category: null,
      updated: p.updated,
      downloads: p.sales,
      art: { from: p.artFrom, to: p.artTo, ink: p.artInk, kind: p.artKind },
    })),
  });
});

/**
 * Claim a free product.
 *
 * Signing in is optional: an account turns the download into a library entry
 * with update notifications, a guest just gets the bytes.
 */
free.post(
  "/free/:slug/claim",
  zValidator("json", z.object({ email: z.string().email().optional() }).optional()),
  async (c) => {
    const slug = c.req.param("slug");
    const ip = clientIp(c);
    const limited = await rateLimit(`free:${ip}`, 20, 60 * 60);
    if (!limited.ok) return c.json({ error: "Too many downloads from this connection." }, 429);

    const db = getDb();
    const [product] = await db.select().from(t.products).where(eq(t.products.slug, slug)).limit(1);
    if (!product) return c.json({ error: "Product not found" }, 404);
    if (!product.free) return c.json({ error: "That item is not free." }, 402);
    if (product.status !== "published") return c.json({ error: "That item is not available." }, 404);

    const user = await currentUser(c);

    // Guests are capped per IP per day; the cap is generous enough for a real
    // person re-downloading after a dead laptop.
    if (!user) {
      const used = await freeQuotaUsed(ip);
      if (used >= FREE_DOWNLOAD_LIMIT) {
        return c.json(
          {
            error: "You have hit the guest download limit for today. Create a free account to keep downloading.",
            code: "guest_limit",
          },
          429,
        );
      }
    }

    const file = await latestFile(product.id);
    if (!file) return c.json({ error: "The package has not been uploaded yet." }, 409);

    if (user) {
      await db
        .insert(t.licenses)
        .values({
          userId: user.id,
          productId: product.id,
          license: "personal",
          status: "active",
          grantedBy: "free",
        })
        .onConflictDoNothing({ target: [t.licenses.userId, t.licenses.productId] });
    }

    const token = crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const { sha256 } = await import("../lib/crypto");
    await db.insert(t.downloadTokens).values({
      tokenHash: sha256(token),
      userId: user?.id ?? null,
      productId: product.id,
      fileId: file.id,
      version: product.version,
      expiresAt,
      ip,
      maxUses: 3,
    });

    await db
      .update(t.products)
      .set({ sales: sql`${t.products.sales} + 1` })
      .where(eq(t.products.id, product.id));

    await logActivity({
      actor: user?.email ?? `guest:${ip}`,
      action: "claimed a free product",
      target: product.slug,
      kind: "download",
      ip,
    });

    return c.json(
      {
        ok: true,
        url: `/api/downloads/${token}`,
        filename: file.originalName,
        bytes: file.bytes,
        version: product.version,
        expiresAt,
        inLibrary: Boolean(user),
      },
      201,
    );
  },
);

/**
 * Redeem a download token.
 *
 * Public because guests hold tokens too — the token *is* the credential, it is
 * hashed at rest, expires in 30 minutes and allows three uses. Entitlement is
 * re-checked here, so a refund between mint and redemption still wins.
 */
free.get("/downloads/:token", async (c) => {
  const token = c.req.param("token");
  const db = getDb();
  const redeemed = await redeemDownloadToken(token);
  if (!redeemed.ok) {
    await logActivity({
      actor: "guest",
      action: "presented an unusable download link",
      target: token.slice(0, 8),
      kind: "download",
      ip: clientIp(c),
    });
    return c.json({ error: redeemed.reason }, 403);
  }

  const { file, product } = redeemed;
  /**
   * The token is the credential: it was minted for a specific customer, so the
   * entitlement check runs as that customer even if the browser dropped its
   * cookie (in-app browsers, link previewers, a fresh device).
   */
  const viewer = await currentUser(c);
  const ownerId = redeemed.userId ?? viewer?.id ?? null;
  const allowed = await entitlement({ userId: ownerId, productId: product.id });
  if (!allowed.ok) return c.json({ error: allowed.reason }, 403);

  const bytes = await readStoredFile(file.storageKey);
  if (!bytes) return c.json({ error: "That file is missing from storage." }, 410);

  // Only a delivered file costs a use.
  await consumeDownloadToken(redeemed.tokenId);
  await logDownload({
    userId: ownerId,
    productId: product.id,
    fileId: file.id,
    version: product.version,
    ip: clientIp(c),
    userAgent: c.req.header("user-agent"),
  });

  // Buffer is a Uint8Array; the DOM typings just do not say so.
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": file.mimeType || "application/zip",
      "content-length": String(bytes.byteLength),
      // Strip anything that could break the header, and keep the original name.
      "content-disposition": `attachment; filename="${file.originalName.replace(/["\r\n]/g, "")}"`,
      "cache-control": "private, no-store",
    },
  });
});

/**
 * Version updates.
 *
 * For a signed-in customer, tells them which of their free items moved on since
 * they last pulled the file. Guests have no identity to notify, which is the
 * honest trade for skipping the signup wall.
 */
free.get("/free/updates", async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ updates: [] });
  const db = getDb();
  const rows = await db
    .select({
      slug: t.products.slug,
      name: t.products.name,
      version: t.products.version,
      lastVersion: sql<string | null>`(
        select d.version from downloads d
        where d.user_id = ${user.id} and d.product_id = ${t.products.id}
        order by d.created_at desc limit 1
      )`,
    })
    .from(t.licenses)
    .innerJoin(t.products, eq(t.products.id, t.licenses.productId))
    .where(and(eq(t.licenses.userId, user.id), eq(t.licenses.status, "active")));

  return c.json({
    updates: rows.filter((r) => r.lastVersion && r.lastVersion !== r.version),
  });
});

export { free };

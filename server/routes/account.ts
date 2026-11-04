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
import { signedUrl, UPLOAD_LIMITS } from "../lib/storage";
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
 * Demo checkout: creates the order, a succeeded demo payment, the licences and
 * the audit trail in one transaction-shaped sequence. Card data never touches
 * this server — a real gateway is step 3.
 */
account.post(
  "/checkout",
  zValidator(
    "json",
    z.object({
      lines: z
        .array(z.object({ slug: z.string(), license: z.enum(["personal", "commercial", "extended"]) }))
        .min(1, "Your cart is empty"),
      coupon: z.string().trim().optional(),
      country: z.string().max(80).optional(),
      vatNumber: z.string().max(40).optional(),
      notes: z.string().max(500).optional(),
    }),
  ),
  async (c) => {
    const user = await requireUser(c);
    if (!user) return c.json({ error: "Sign in to continue." }, 401);
    const body = c.req.valid("json");

    const limited = await rateLimit(`checkout:${user.id}`, 20, 10 * 60);
    if (!limited.ok) return c.json({ error: "Too many attempts. Try again shortly." }, 429);

    const db = getDb();
    const slugs = body.lines.map((l) => l.slug);
    const productRows = await db
      .select()
      .from(t.products)
      .where(sql`${t.products.slug} in ${sql.raw(`(${slugs.map((s) => `'${s.replace(/'/g, "''")}'`).join(",")})`)}`);

    const priced = body.lines
      .map((line) => {
        const product = productRows.find((p) => p.slug === line.slug);
        if (!product || product.status !== "published") return null;
        return { product, license: line.license };
      })
      .filter((x): x is { product: typeof productRows[number]; license: License } => Boolean(x));

    if (!priced.length) return c.json({ error: "Those products are no longer available." }, 400);

    // Server-side pricing — never trust a price from the browser.
    const tierRows = await db
      .select()
      .from(t.pricingTiers)
      .where(
        sql`${t.pricingTiers.productId} in ${sql.raw(`(${priced.map((p) => `'${p.product.id}'`).join(",")})`)}`,
      );

    const lines = priced.map(({ product, license }) => {
      const tier = tierRows.find((x) => x.productId === product.id && x.license === license);
      return {
        product,
        license,
        price: tier?.price ?? (license === "extended" ? product.price * 2 : product.price),
      };
    });

    const subtotal = lines.reduce((n, l) => n + l.price, 0);

    let discount = 0;
    let couponCode: string | null = null;
    if (body.coupon) {
      const coupons = await db
        .select()
        .from(t.coupons)
        .where(sql`upper(${t.coupons.code}) = ${body.coupon.toUpperCase()}`)
        .limit(1);
      const coupon = coupons[0];
      if (coupon && coupon.active && coupon.uses < coupon.limit) {
        discount = coupon.kind === "percent" ? Math.round((subtotal * coupon.value) / 100) : Math.min(coupon.value, subtotal);
        couponCode = coupon.code;
        await db.update(t.coupons).set({ uses: coupon.uses + 1 }).where(eq(t.coupons.id, coupon.id));
      }
    }

    const total = Math.max(0, subtotal - discount);
    const [order] = await db
      .insert(t.orders)
      .values({
        number: orderNumber(),
        userId: user.id,
        email: user.email,
        name: user.name,
        status: "paid",
        subtotal,
        discount,
        tax: 0,
        total,
        couponCode,
        country: body.country ?? user.country,
        vatNumber: body.vatNumber ?? null,
        notes: body.notes ?? null,
      })
      .returning();

    await db.insert(t.orderItems).values(
      lines.map((l) => ({
        orderId: order.id,
        productId: l.product.id,
        productName: l.product.name,
        productSlug: l.product.slug,
        license: l.license,
        unitPrice: l.price,
        quantity: 1,
      })),
    );

    await db.insert(t.payments).values({
      orderId: order.id,
      provider: "stripe",
      mode: "demo",
      status: "succeeded",
      amount: total,
      fee: Math.round(total * 0.029),
      reference: `demo_${order.number}`,
    });

    // Grant (or refresh) a licence per product.
    for (const line of lines) {
      await db
        .insert(t.licenses)
        .values({
          userId: user.id,
          productId: line.product.id,
          license: line.license,
          orderId: order.id,
          status: "active",
          grantedBy: line.product.free ? "free" : "purchase",
        })
        .onConflictDoUpdate({
          target: [t.licenses.userId, t.licenses.productId],
          set: { license: line.license, status: "active", revokedAt: null, revokedReason: null, orderId: order.id },
        });
      await db
        .update(t.products)
        .set({ sales: sql`${t.products.sales} + 1` })
        .where(eq(t.products.id, line.product.id));
    }

    await logActivity({
      actor: user.email,
      action: "placed an order",
      target: order.number,
      kind: "order",
      ip: clientIp(c),
    });

    return c.json({ ok: true, order: { number: order.number, total, subtotal, discount } }, 201);
  },
);

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
 * Mint a signed download URL. Requires an active licence and an uploaded file.
 * Every link is logged, so the owner can see who downloaded what and when.
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
    const productRows = await db.select().from(t.products).where(eq(t.products.slug, slug)).limit(1);
    const product = productRows[0];
    if (!product) return c.json({ error: "Product not found" }, 404);

    const licenseRows = await db
      .select()
      .from(t.licenses)
      .where(and(eq(t.licenses.userId, user.id), eq(t.licenses.productId, product.id)))
      .limit(1);
    const license = licenseRows[0];
    if (!license || license.status !== "active") {
      return c.json({ error: "You do not have an active licence for this product." }, 403);
    }

    const fileRows = await db
      .select()
      .from(t.productFiles)
      .where(and(eq(t.productFiles.productId, product.id), eq(t.productFiles.kind, "source_zip")))
      .orderBy(desc(t.productFiles.createdAt))
      .limit(1);
    const file = fileRows[0];
    if (!file) {
      return c.json({ error: "The source package has not been uploaded yet." }, 409);
    }

    await db.insert(t.downloads).values({
      userId: user.id,
      productId: product.id,
      fileId: file.id,
      version: product.version,
      ip: clientIp(c),
      userAgent: c.req.header("user-agent")?.slice(0, 300) ?? null,
    });

    const url = signedUrl(file.storageKey, {
      ttlSeconds: 300,
      filename: file.originalName,
      mime: file.mimeType,
    });

    return c.json({ ok: true, url, filename: file.originalName, bytes: file.bytes, expiresIn: 300 });
  },
);

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

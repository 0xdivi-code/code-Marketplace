/**
 * Admin: catalogue structure, customers, orders, reviews, coupons and the CMS.
 * Split from admin.ts to keep the product/upload code readable.
 */
import { Hono } from "hono";
import type { Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import * as t from "../db/schema";
import { currentAdmin, isAdmin, destroyAllSessions, publicUser } from "../lib/auth";
import { audit } from "../lib/activity";
import { toCategory, toCoupon, toCustomer, toOrder, toReview, slugify } from "../lib/mappers";
import { readUpload, UploadError } from "../lib/upload";
import { publicAssetUrl, remove } from "../lib/storage";
import { orderNumber } from "../lib/crypto";

const adminApi = new Hono();

adminApi.use("/*", async (c, next) => {
  const user = await currentAdmin(c);
  if (!user || !isAdmin(user) || user.status === "suspended") {
    return c.json({ error: "Admin sign-in required." }, 401);
  }
  await next();
});

/* --------------------------------------------------------------- categories */

adminApi.get("/categories", async (c) => {
  const db = getDb();
  const rows = await db.select().from(t.categories).orderBy(asc(t.categories.position));
  const counts = await db.execute<{ category_id: string; n: number }>(
    sql`select category_id, count(*)::int as n from products where category_id is not null group by 1`,
  );
  const countMap = new Map(counts.rows.map((r) => [r.category_id, r.n]));
  return c.json({
    categories: rows.map((row) => ({
      ...toCategory(row),
      id: row.id,
      parentId: row.parentId,
      position: row.position,
      imagePath: row.imagePath,
      products: countMap.get(row.id) ?? 0,
    })),
  });
});

const categoryInput = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(90).optional(),
  blurb: z.string().max(400).optional(),
  parentSlug: z.string().max(90).nullable().optional(),
  from: z.string().max(20).optional(),
  to: z.string().max(20).optional(),
  glyph: z.string().max(40).optional(),
  position: z.number().int().min(0).optional(),
  imagePath: z.string().max(400).nullable().optional(),
});

adminApi.post("/categories", zValidator("json", categoryInput), async (c) => {
  const input = c.req.valid("json");
  const db = getDb();
  const slug = slugify(input.slug || input.name);

  let parentId: string | null = null;
  if (input.parentSlug) {
    const parent = await db.select().from(t.categories).where(eq(t.categories.slug, input.parentSlug)).limit(1);
    // A subcategory is just a category with a parent — no second table, no drift.
    parentId = parent[0]?.id ?? null;
  }

  const [row] = await db
    .insert(t.categories)
    .values({
      slug,
      name: input.name,
      blurb: input.blurb ?? "",
      parentId,
      from: input.from ?? "#17392b",
      to: input.to ?? "#3d7a58",
      glyph: input.glyph ?? "layers",
      position: input.position ?? 0,
      imagePath: input.imagePath ?? null,
    })
    .returning();

  await audit(c, { action: `created the category “${row.name}”`, target: row.slug, kind: "product" });
  return c.json({ ok: true, category: { ...toCategory(row), id: row.id } }, 201);
});

adminApi.patch("/categories/:slug", zValidator("json", categoryInput.partial()), async (c) => {
  const input = c.req.valid("json");
  const db = getDb();
  const slug = c.req.param("slug");
  const rows = await db.select().from(t.categories).where(eq(t.categories.slug, slug)).limit(1);
  const existing = rows[0];
  if (!existing) return c.json({ error: "Category not found" }, 404);

  let parentId = existing.parentId;
  if (input.parentSlug !== undefined) {
    if (input.parentSlug === null || input.parentSlug === "") parentId = null;
    else {
      const parent = await db.select().from(t.categories).where(eq(t.categories.slug, input.parentSlug)).limit(1);
      // Refuse to make a category its own parent — that would form a cycle.
      parentId = parent[0] && parent[0].id !== existing.id ? parent[0].id : null;
    }
  }

  const [row] = await db
    .update(t.categories)
    .set({
      name: input.name ?? existing.name,
      slug: input.slug ? slugify(input.slug) : existing.slug,
      blurb: input.blurb ?? existing.blurb,
      parentId,
      from: input.from ?? existing.from,
      to: input.to ?? existing.to,
      glyph: input.glyph ?? existing.glyph,
      position: input.position ?? existing.position,
      imagePath: input.imagePath !== undefined ? input.imagePath : existing.imagePath,
      updatedAt: new Date(),
    })
    .where(eq(t.categories.id, existing.id))
    .returning();

  await audit(c, { action: `updated the category “${row.name}”`, target: row.slug, kind: "product" });
  return c.json({ ok: true, category: { ...toCategory(row), id: row.id } });
});

adminApi.delete("/categories/:slug", async (c) => {
  const db = getDb();
  const rows = await db.select().from(t.categories).where(eq(t.categories.slug, c.req.param("slug"))).limit(1);
  const category = rows[0];
  if (!category) return c.json({ error: "Category not found" }, 404);

  const used = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(t.products)
    .where(eq(t.products.categoryId, category.id));
  if (used[0].n > 0) {
    return c.json({ error: `Move the ${used[0].n} product${used[0].n === 1 ? "" : "s"} in this category first.` }, 409);
  }

  await db.delete(t.categories).where(eq(t.categories.id, category.id));
  await audit(c, { action: `deleted the category “${category.name}”`, target: category.slug, kind: "product" });
  return c.json({ ok: true });
});

adminApi.post("/categories/:slug/image", async (c) => {
  const db = getDb();
  const rows = await db.select().from(t.categories).where(eq(t.categories.slug, c.req.param("slug"))).limit(1);
  const category = rows[0];
  if (!category) return c.json({ error: "Category not found" }, 404);

  const nodeReq = (c.env as { incoming?: import("node:http").IncomingMessage })?.incoming;
  if (!nodeReq) return c.json({ error: "Uploads require the node adapter." }, 501);
  try {
    const file = await readUpload(c.req.raw, nodeReq, { kind: "image", productId: `category-${category.id}` });
    const [row] = await db
      .update(t.categories)
      .set({ imagePath: publicAssetUrl(file.storageKey), updatedAt: new Date() })
      .where(eq(t.categories.id, category.id))
      .returning();
    await audit(c, { action: `changed the image for “${category.name}”`, target: category.slug, kind: "product" });
    return c.json({ ok: true, imagePath: row.imagePath });
  } catch (err) {
    if (err instanceof UploadError) return c.json({ error: err.message }, err.status as 400);
    return c.json({ error: "Upload failed." }, 500);
  }
});

/* ---------------------------------------------------------------- customers */

adminApi.get("/customers", async (c) => {
  const db = getDb();
  const q = (c.req.query("q") ?? "").trim();
  const rows = await db
    .select()
    .from(t.users)
    .where(
      and(
        eq(t.users.role, "customer"),
        q ? or(ilike(t.users.name, `%${q}%`), ilike(t.users.email, `%${q}%`)) : undefined,
      ),
    )
    .orderBy(desc(t.users.createdAt));

  const spend = await db.execute<{ user_id: string; orders: number; spent: number }>(sql`
    select user_id, count(*)::int as orders, coalesce(sum(total), 0)::int as spent
    from orders where status = 'paid' and user_id is not null group by 1
  `);
  const spendMap = new Map(spend.rows.map((r) => [r.user_id, r]));

  return c.json({
    customers: rows.map((u) =>
      toCustomer(u, { orders: spendMap.get(u.id)?.orders ?? 0, spent: spendMap.get(u.id)?.spent ?? 0 }),
    ),
    detail: rows.map((u) => ({
      id: u.id,
      email: u.email,
      emailVerified: Boolean(u.emailVerifiedAt),
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      notes: u.notes,
      status: u.status,
    })),
  });
});

adminApi.get("/customers/:id", async (c) => {
  const db = getDb();
  const rows = await db.select().from(t.users).where(eq(t.users.id, c.req.param("id"))).limit(1);
  const user = rows[0];
  if (!user) return c.json({ error: "Customer not found" }, 404);

  const [orders, licenses, downloads, reviews] = await Promise.all([
    db.select().from(t.orders).where(eq(t.orders.userId, user.id)).orderBy(desc(t.orders.createdAt)),
    db
      .select({ license: t.licenses, product: t.products })
      .from(t.licenses)
      .innerJoin(t.products, eq(t.licenses.productId, t.products.id))
      .where(eq(t.licenses.userId, user.id)),
    db.select().from(t.downloads).where(eq(t.downloads.userId, user.id)).orderBy(desc(t.downloads.createdAt)).limit(50),
    db.select().from(t.reviews).where(eq(t.reviews.userId, user.id)),
  ]);

  const orderIds = orders.map((o) => o.id);
  const items = orderIds.length
    ? await db.select().from(t.orderItems).where(inArray(t.orderItems.orderId, orderIds))
    : [];

  return c.json({
    customer: {
      ...toCustomer(user, {
        orders: orders.filter((o) => o.status === "paid").length,
        spent: orders.filter((o) => o.status === "paid").reduce((n, o) => n + o.total, 0),
      }),
      emailVerified: Boolean(user.emailVerifiedAt),
      lastLoginAt: user.lastLoginAt,
      notes: user.notes,
    },
    orders: orders.map((o) => ({
      ...toOrder(o, items.filter((i) => i.orderId === o.id)),
      statusRaw: o.status,
      number: o.number,
    })),
    licenses: licenses.map(({ license, product }) => ({
      productSlug: product.slug,
      productName: product.name,
      license: license.license,
      status: license.status,
      grantedBy: license.grantedBy,
      grantedAt: license.createdAt,
      revokedReason: license.revokedReason,
    })),
    downloads: downloads.map((d) => ({ id: d.id, version: d.version, ip: d.ip, at: d.createdAt })),
    reviews: reviews.map((r) => ({ id: r.id, title: r.title, rating: r.rating, status: r.status })),
  });
});

adminApi.patch(
  "/customers/:id",
  zValidator(
    "json",
    z.object({
      name: z.string().trim().min(2).max(120).optional(),
      country: z.string().max(80).optional(),
      notes: z.string().max(2000).optional(),
      status: z.enum(["active", "suspended"]).optional(),
    }),
  ),
  async (c) => {
    const db = getDb();
    const id = c.req.param("id");
    const rows = await db.select().from(t.users).where(eq(t.users.id, id)).limit(1);
    const user = rows[0];
    if (!user) return c.json({ error: "Customer not found" }, 404);

    const input = c.req.valid("json");
    const [updated] = await db
      .update(t.users)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(t.users.id, id))
      .returning();

    // Suspension has to bite immediately, not when the cookie expires.
    if (input.status === "suspended") await destroyAllSessions(id);

    await audit(c, {
      action:
        input.status === "suspended"
          ? `suspended ${user.email}`
          : input.status === "active"
            ? `reactivated ${user.email}`
            : `updated ${user.email}`,
      target: user.email,
      kind: "customer",
    });

    return c.json({ ok: true, customer: publicUser(updated) });
  },
);

/** Manual grant — a comp, a support fix, a giveaway. */
adminApi.post(
  "/customers/:id/licenses",
  zValidator(
    "json",
    z.object({
      slug: z.string(),
      license: z.enum(["personal", "commercial", "extended"]).default("commercial"),
    }),
  ),
  async (c) => {
    const db = getDb();
    const id = c.req.param("id");
    const { slug, license } = c.req.valid("json");
    const [user] = await db.select().from(t.users).where(eq(t.users.id, id)).limit(1);
    if (!user) return c.json({ error: "Customer not found" }, 404);
    const [product] = await db.select().from(t.products).where(eq(t.products.slug, slug)).limit(1);
    if (!product) return c.json({ error: "Product not found" }, 404);

    await db
      .insert(t.licenses)
      .values({
        userId: user.id,
        productId: product.id,
        license,
        status: "active",
        grantedBy: "manual",
      })
      .onConflictDoUpdate({
        target: [t.licenses.userId, t.licenses.productId],
        set: { status: "active", license, revokedAt: null, revokedReason: null, grantedBy: "manual" },
      });

    await audit(c, {
      action: `granted ${product.name} to ${user.email}`,
      target: user.email,
      kind: "customer",
    });
    return c.json({ ok: true }, 201);
  },
);

/** Revoke access without deleting the purchase record. */
adminApi.delete("/customers/:id/licenses/:slug", async (c) => {
  const db = getDb();
  const id = c.req.param("id");
  const slug = c.req.param("slug");
  const reason = c.req.query("reason") ?? "Revoked by studio";

  const [product] = await db.select().from(t.products).where(eq(t.products.slug, slug)).limit(1);
  if (!product) return c.json({ error: "Product not found" }, 404);

  const [updated] = await db
    .update(t.licenses)
    .set({ status: "revoked", revokedAt: new Date(), revokedReason: reason })
    .where(and(eq(t.licenses.userId, id), eq(t.licenses.productId, product.id)))
    .returning();
  if (!updated) return c.json({ error: "No licence for that product" }, 404);

  const [user] = await db.select().from(t.users).where(eq(t.users.id, id)).limit(1);
  await audit(c, {
    action: `revoked ${product.name} from ${user?.email ?? id}`,
    target: user?.email ?? id,
    kind: "customer",
  });
  return c.json({ ok: true });
});

/* ------------------------------------------------------------------- orders */

adminApi.get("/orders", async (c) => {
  const db = getDb();
  const q = (c.req.query("q") ?? "").trim();
  const rows = await db
    .select()
    .from(t.orders)
    .where(q ? or(ilike(t.orders.number, `%${q}%`), ilike(t.orders.email, `%${q}%`)) : undefined)
    .orderBy(desc(t.orders.createdAt));

  const items = rows.length
    ? await db.select().from(t.orderItems).where(inArray(t.orderItems.orderId, rows.map((r) => r.id)))
    : [];
  const payments = rows.length
    ? await db
        .select({
          orderId: t.payments.orderId,
          provider: t.payments.provider,
          mode: t.payments.mode,
          status: t.payments.status,
          reference: t.payments.reference,
        })
        .from(t.payments)
        .where(inArray(t.payments.orderId, rows.map((r) => r.id)))
    : [];

  return c.json({
    orders: rows.map((o) => {
      const pays = payments.filter((p) => p.orderId === o.id);
      return {
        ...toOrder({ ...o, payments: pays }, items.filter((i) => i.orderId === o.id)),
        statusRaw: o.status,
        number: o.number,
        email: o.email,
        name: o.name,
        userId: o.userId,
        createdAt: o.createdAt,
        paymentStatus: pays[0]?.status ?? null,
        paymentMode: pays[0]?.mode ?? null,
        paymentProvider: pays[0]?.provider ?? null,
        items: items.filter((i) => i.orderId === o.id),
      };
    }),
  });
});

/**
 * Every captured payment, newest first, with the daily totals the finance view
 * needs. Payouts are not simulated — this is the gateway's ledger.
 */
adminApi.get("/payments", async (c) => {
  const db = getDb();
  const rows = await db
    .select({
      id: t.payments.id,
      orderId: t.payments.orderId,
      provider: t.payments.provider,
      mode: t.payments.mode,
      status: t.payments.status,
      amount: t.payments.amount,
      fee: t.payments.fee,
      reference: t.payments.reference,
      createdAt: t.payments.createdAt,
      number: t.orders.number,
      email: t.orders.email,
      name: t.orders.name,
    })
    .from(t.payments)
    .innerJoin(t.orders, eq(t.orders.id, t.payments.orderId))
    .orderBy(desc(t.payments.createdAt));

  const captured = rows.filter((r) => r.status === "succeeded");
  const daily = new Map<string, { gross: number; fees: number; count: number }>();
  for (const row of captured) {
    const day = row.createdAt.toISOString().slice(0, 10);
    const entry = daily.get(day) ?? { gross: 0, fees: 0, count: 0 };
    entry.gross += row.amount;
    entry.fees += row.fee;
    entry.count += 1;
    daily.set(day, entry);
  }

  return c.json({
    payments: rows,
    totals: {
      gross: captured.reduce((n, r) => n + r.amount, 0),
      fees: captured.reduce((n, r) => n + r.fee, 0),
      net: captured.reduce((n, r) => n + r.amount - r.fee, 0),
      count: captured.length,
      refunded: rows.filter((r) => r.status === "refunded").length,
      avgOrder: captured.length ? Math.round(captured.reduce((n, r) => n + r.amount, 0) / captured.length) : 0,
    },
    daily: [...daily.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([day, v]) => ({ day, ...v })),
  });
});

adminApi.get("/orders/:number", async (c) => {
  const db = getDb();
  const rows = await db.select().from(t.orders).where(eq(t.orders.number, c.req.param("number"))).limit(1);
  const order = rows[0];
  if (!order) return c.json({ error: "Order not found" }, 404);
  const [items, payments, customer, files] = await Promise.all([
    db.select().from(t.orderItems).where(eq(t.orderItems.orderId, order.id)),
    db.select().from(t.payments).where(eq(t.payments.orderId, order.id)),
    order.userId ? db.select().from(t.users).where(eq(t.users.id, order.userId)).limit(1) : Promise.resolve([]),
    db.select().from(t.productFiles).where(eq(t.productFiles.kind, "source_zip")),
  ]);
  return c.json({
    order: { ...order, items, payments },
    customer: customer[0] ? publicUser(customer[0]) : null,
    availableFiles: files.length,
  });
});

adminApi.patch(
  "/orders/:number",
  zValidator(
    "json",
    z.object({
      status: z.enum(["pending", "paid", "refunded", "cancelled"]).optional(),
      notes: z.string().max(2000).optional(),
    }),
  ),
  async (c) => {
    const db = getDb();
    const rows = await db.select().from(t.orders).where(eq(t.orders.number, c.req.param("number"))).limit(1);
    const order = rows[0];
    if (!order) return c.json({ error: "Order not found" }, 404);
    const input = c.req.valid("json");

    const [updated] = await db
      .update(t.orders)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(t.orders.id, order.id))
      .returning();

    // A refund must also close access, otherwise the customer keeps the source.
    // But if the same customer bought the product again on another order that is
    // still paid, their licence stays — only the refunded purchase disappears.
    if (input.status === "refunded" && order.status !== "refunded") {
      const affected = await db.select().from(t.licenses).where(eq(t.licenses.orderId, order.id));
      for (const licence of affected) {
        const survivors = order.userId
          ? await db
              .select({ id: t.orders.id, number: t.orders.number })
              .from(t.orders)
              .innerJoin(t.orderItems, eq(t.orderItems.orderId, t.orders.id))
              .where(
                and(
                  eq(t.orders.userId, order.userId),
                  eq(t.orderItems.productId, licence.productId),
                  eq(t.orders.status, "paid"),
                  sql`${t.orders.id} <> ${order.id}`,
                ),
              )
              .limit(1)
          : [];

        if (survivors[0]) {
          // Re-read the surviving purchase so an upgrade refunded after the fact
          // falls back to the tier the customer actually still owns.
          const survivorLine = (
            await db
              .select({ license: t.orderItems.license })
              .from(t.orderItems)
              .where(and(eq(t.orderItems.orderId, survivors[0].id), eq(t.orderItems.productId, licence.productId)))
              .limit(1)
          )[0];
          await db
            .update(t.licenses)
            .set({
              orderId: survivors[0].id,
              license: survivorLine?.license ?? licence.license,
              status: "active",
              revokedAt: null,
              revokedReason: null,
            })
            .where(eq(t.licenses.id, licence.id));
        } else {
          await db
            .update(t.licenses)
            .set({ status: "revoked", revokedAt: new Date(), revokedReason: `Order ${order.number} refunded` })
            .where(eq(t.licenses.id, licence.id));
        }
      }
      await db.update(t.payments).set({ status: "refunded" }).where(eq(t.payments.orderId, order.id));
      await audit(c, { action: `refunded order ${order.number}`, target: order.number, kind: "order" });
    } else {
      await audit(c, { action: `updated order ${order.number}`, target: order.number, kind: "order" });
    }

    return c.json({ ok: true, order: { number: updated.number, status: updated.status } });
  },
);

/** CSV export — the owner keeps their data. */
adminApi.get("/export/:kind", async (c) => {
  const db = getDb();
  const kind = c.req.param("kind");
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  let rows: Record<string, unknown>[] = [];
  let header: string[] = [];

  if (kind === "orders") {
    const orders = await db.select().from(t.orders).orderBy(desc(t.orders.createdAt));
    header = ["number", "email", "name", "status", "subtotal", "discount", "total", "currency", "coupon", "created_at"];
    rows = orders.map((o) => ({
      number: o.number,
      email: o.email,
      name: o.name,
      status: o.status,
      subtotal: (o.subtotal / 100).toFixed(2),
      discount: (o.discount / 100).toFixed(2),
      total: (o.total / 100).toFixed(2),
      currency: o.currency,
      coupon: o.couponCode ?? "",
      created_at: o.createdAt instanceof Date ? o.createdAt.toISOString() : o.createdAt,
    }));
  } else if (kind === "customers") {
    const users = await db.select().from(t.users).where(eq(t.users.role, "customer"));
    header = ["id", "name", "email", "country", "status", "verified", "created_at", "last_login"];
    rows = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      country: u.country ?? "",
      status: u.status,
      verified: Boolean(u.emailVerifiedAt),
      created_at: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
      last_login: u.lastLoginAt instanceof Date ? u.lastLoginAt.toISOString() : "",
    }));
  } else if (kind === "downloads") {
    const dl = await db
      .select({ d: t.downloads, email: t.users.email, product: t.products.name })
      .from(t.downloads)
      .leftJoin(t.users, eq(t.downloads.userId, t.users.id))
      .leftJoin(t.products, eq(t.downloads.productId, t.products.id))
      .orderBy(desc(t.downloads.createdAt));
    header = ["email", "product", "version", "ip", "at"];
    rows = dl.map((r) => ({
      email: r.email ?? "",
      product: r.product ?? "",
      version: r.d.version ?? "",
      ip: r.d.ip ?? "",
      at: r.d.createdAt instanceof Date ? r.d.createdAt.toISOString() : r.d.createdAt,
    }));
  } else {
    return c.json({ error: "Unknown export" }, 400);
  }

  const csv = [header.join(","), ...rows.map((r) => header.map((h) => esc(r[h])).join(","))].join("\n");
  await audit(c, { action: `exported ${kind} as CSV`, target: kind, kind: "settings" });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kiln-${kind}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});

/* ------------------------------------------------------------------ reviews */

adminApi.get("/reviews", async (c) => {
  const db = getDb();
  const rows = await db
    .select({ r: t.reviews, product: t.products.slug, productName: t.products.name })
    .from(t.reviews)
    .leftJoin(t.products, eq(t.reviews.productId, t.products.id))
    .orderBy(desc(t.reviews.createdAt));
  return c.json({
    reviews: rows.map(({ r, product, productName }) => ({
      ...toReview(r, product ?? ""),
      status: r.status,
      productName,
      createdAt: r.createdAt,
    })),
  });
});

adminApi.patch(
  "/reviews/:id",
  zValidator("json", z.object({ status: z.enum(["pending", "published", "rejected"]) })),
  async (c) => {
    const db = getDb();
    const [updated] = await db
      .update(t.reviews)
      .set({ status: c.req.valid("json").status })
      .where(eq(t.reviews.id, c.req.param("id")))
      .returning();
    if (!updated) return c.json({ error: "Review not found" }, 404);

    // Keep the denormalised product rating honest after moderation.
    const agg = await db.execute<{ avg: number; n: number }>(
      sql`select coalesce(round(avg(rating) * 10), 0)::int as avg, count(*)::int as n from reviews where product_id = ${updated.productId} and status = 'published'`,
    );
    await db
      .update(t.products)
      .set({ rating: agg.rows[0].avg, reviews: agg.rows[0].n })
      .where(eq(t.products.id, updated.productId));

    await audit(c, { action: `${updated.status === "published" ? "published" : updated.status} review ${updated.id.slice(0, 8)}`, target: updated.id, kind: "content" });
    return c.json({ ok: true });
  },
);

/* ------------------------------------------------------------------ coupons */

adminApi.get("/coupons", async (c) => {
  const db = getDb();
  const rows = await db.select().from(t.coupons).orderBy(desc(t.coupons.createdAt));
  return c.json({ coupons: rows.map(toCoupon) });
});

adminApi.post(
  "/coupons",
  zValidator(
    "json",
    z.object({
      code: z.string().trim().min(2).max(40),
      kind: z.enum(["percent", "fixed"]).default("percent"),
      value: z.number().int().min(1),
      limit: z.number().int().min(1).max(100000).default(100),
      expires: z.string().optional(),
      /** blank means the whole cart */
      productSlug: z.string().trim().max(120).optional(),
      categorySlug: z.string().trim().max(120).optional(),
      minSubtotal: z.number().int().min(0).default(0),
      oncePerCustomer: z.boolean().default(true),
    }),
  ),
  async (c) => {
    const db = getDb();
    const input = c.req.valid("json");
    if (input.kind === "percent" && input.value > 100) {
      return c.json({ error: "A percentage cannot exceed 100." }, 400);
    }
    try {
      const [row] = await db
        .insert(t.coupons)
        .values({
          code: input.code.toUpperCase(),
          kind: input.kind,
          value: input.kind === "fixed" ? input.value * 100 : input.value,
          limit: input.limit,
          expiresAt: input.expires ? new Date(input.expires) : null,
          active: true,
          productSlug: input.productSlug || null,
          categorySlug: input.categorySlug || null,
          minSubtotal: input.minSubtotal,
          oncePerCustomer: input.oncePerCustomer,
        })
        .returning();
      await audit(c, { action: `created the coupon ${row.code}`, target: row.code, kind: "promo" });
      return c.json({ ok: true, coupon: toCoupon(row) }, 201);
    } catch {
      return c.json({ error: "That code already exists." }, 409);
    }
  },
);

adminApi.patch(
  "/coupons/:code",
  zValidator(
    "json",
    z.object({
      active: z.boolean().optional(),
      limit: z.number().int().min(1).optional(),
      productSlug: z.string().trim().max(120).nullable().optional(),
      categorySlug: z.string().trim().max(120).nullable().optional(),
      minSubtotal: z.number().int().min(0).optional(),
      oncePerCustomer: z.boolean().optional(),
    }),
  ),
  async (c) => {
    const db = getDb();
    const input = c.req.valid("json");
    const [row] = await db
      .update(t.coupons)
      .set(input)
      .where(sql`upper(${t.coupons.code}) = ${c.req.param("code").toUpperCase()}`)
      .returning();
    if (!row) return c.json({ error: "Coupon not found" }, 404);
    await audit(c, { action: `${input.active === false ? "paused" : "updated"} the coupon ${row.code}`, target: row.code, kind: "promo" });
    return c.json({ ok: true, coupon: toCoupon(row) });
  },
);

adminApi.delete("/coupons/:code", async (c) => {
  const db = getDb();
  const [row] = await db
    .delete(t.coupons)
    .where(sql`upper(${t.coupons.code}) = ${c.req.param("code").toUpperCase()}`)
    .returning();
  if (!row) return c.json({ error: "Coupon not found" }, 404);
  await audit(c, { action: `deleted the coupon ${row.code}`, target: row.code, kind: "promo" });
  return c.json({ ok: true });
});

/* ---------------------------------------------------------------- CMS: pages */

adminApi.get("/pages", async (c) => {
  const db = getDb();
  const rows = await db.select().from(t.pages).orderBy(asc(t.pages.position));
  return c.json({ pages: rows });
});

adminApi.patch(
  "/pages/:slug",
  zValidator(
    "json",
    z.object({
      title: z.string().trim().min(2).max(200).optional(),
      body: z.string().max(80000).optional(),
      excerpt: z.string().max(600).optional(),
      status: z.enum(["published", "draft"]).optional(),
      category: z.string().max(80).optional(),
    }),
  ),
  async (c) => {
    const db = getDb();
    const [row] = await db
      .update(t.pages)
      .set({ ...c.req.valid("json"), updatedAt: new Date() })
      .where(eq(t.pages.slug, c.req.param("slug")))
      .returning();
    if (!row) return c.json({ error: "Page not found" }, 404);
    await audit(c, { action: `edited the page “${row.title}”`, target: row.slug, kind: "content" });
    return c.json({ ok: true, page: row });
  },
);

adminApi.post(
  "/pages",
  zValidator("json", z.object({ title: z.string().min(2).max(200), slug: z.string().max(90).optional(), body: z.string().max(80000).default("") })),
  async (c) => {
    const db = getDb();
    const input = c.req.valid("json");
    const [row] = await db
      .insert(t.pages)
      .values({
        title: input.title,
        slug: slugify(input.slug || input.title),
        body: input.body,
        status: "draft",
      })
      .returning();
    await audit(c, { action: `created the page “${row.title}”`, target: row.slug, kind: "content" });
    return c.json({ ok: true, page: row }, 201);
  },
);

/* ----------------------------------------------------------- CMS: homepage */

adminApi.get("/homepage", async (c) => {
  const db = getDb();
  const [sections, announcements, settings, collections, items] = await Promise.all([
    db.select().from(t.homepageSections).orderBy(asc(t.homepageSections.position)),
    db.select().from(t.announcements).orderBy(asc(t.announcements.position)),
    db.select().from(t.settings),
    db.select().from(t.collections),
    db.select().from(t.collectionItems).orderBy(asc(t.collectionItems.position)),
  ]);
  const products = await db.select({ id: t.products.id, slug: t.products.slug, name: t.products.name }).from(t.products);

  return c.json({
    sections,
    announcements,
    settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
    collections: collections.map((col) => ({
      slug: col.slug,
      name: col.name,
      blurb: col.blurb,
      imagePath: col.imagePath,
      products: items
        .filter((i) => i.collectionId === col.id)
        .map((i) => products.find((p) => p.id === i.productId)?.slug)
        .filter(Boolean),
    })),
  });
});

adminApi.patch(
  "/homepage/sections/:key",
  zValidator(
    "json",
    z.object({
      label: z.string().max(120).optional(),
      enabled: z.boolean().optional(),
      config: z.record(z.string(), z.unknown()).optional(),
      position: z.number().int().min(0).optional(),
    }),
  ),
  async (c) => {
    const db = getDb();
    const input = c.req.valid("json");
    const [row] = await db
      .update(t.homepageSections)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(t.homepageSections.key, c.req.param("key")))
      .returning();
    if (!row) return c.json({ error: "Section not found" }, 404);
    await audit(c, { action: `${row.enabled ? "enabled" : "disabled"} the “${row.label}” section`, target: row.key, kind: "content" });
    return c.json({ ok: true, section: row });
  },
);

/** Reorder in one call — the admin drags rows, the UI persists the order. */
adminApi.post(
  "/homepage/sections/reorder",
  zValidator("json", z.object({ keys: z.array(z.string()).min(1) })),
  async (c) => {
    const db = getDb();
    const keys = c.req.valid("json").keys;
    for (let i = 0; i < keys.length; i++) {
      await db.update(t.homepageSections).set({ position: i }).where(eq(t.homepageSections.key, keys[i]));
    }
    await audit(c, { action: "reordered homepage sections", target: "homepage", kind: "content" });
    return c.json({ ok: true });
  },
);

adminApi.post(
  "/announcements",
  zValidator(
    "json",
    z.object({
      text: z.string().trim().min(2).max(200),
      href: z.string().max(300).optional(),
      active: z.boolean().default(true),
    }),
  ),
  async (c) => {
    const db = getDb();
    const input = c.req.valid("json");
    if (input.active) await db.update(t.announcements).set({ active: false });
    const [row] = await db
      .insert(t.announcements)
      .values({ text: input.text, href: input.href ?? null, active: input.active })
      .returning();
    await audit(c, { action: "published an announcement banner", target: row.id, kind: "content" });
    return c.json({ ok: true, announcement: row }, 201);
  },
);

adminApi.patch(
  "/announcements/:id",
  zValidator("json", z.object({ text: z.string().max(200).optional(), href: z.string().max(300).nullable().optional(), active: z.boolean().optional() })),
  async (c) => {
    const db = getDb();
    const input = c.req.valid("json");
    if (input.active) await db.update(t.announcements).set({ active: false });
    const [row] = await db
      .update(t.announcements)
      .set(input)
      .where(eq(t.announcements.id, c.req.param("id")))
      .returning();
    if (!row) return c.json({ error: "Announcement not found" }, 404);
    await audit(c, { action: `${row.active ? "activated" : "deactivated"} an announcement`, target: row.id, kind: "content" });
    return c.json({ ok: true, announcement: row });
  },
);

adminApi.delete("/announcements/:id", async (c) => {
  const db = getDb();
  await db.delete(t.announcements).where(eq(t.announcements.id, c.req.param("id")));
  await audit(c, { action: "deleted an announcement", target: c.req.param("id"), kind: "content" });
  return c.json({ ok: true });
});

/* ---------------------------------------------------------------- CMS: settings */

/** Every key/value the storefront reads, in one call, so the admin can edit them. */
adminApi.get("/settings", async (c) => {
  const db = getDb();
  const rows = await db.select().from(t.settings).orderBy(asc(t.settings.key));
  return c.json({
    settings: rows,
    values: Object.fromEntries(rows.map((r) => [r.key, r.value])),
  });
});

adminApi.patch(
  "/settings",
  zValidator("json", z.object({ values: z.record(z.string(), z.unknown()) })),
  async (c) => {
    const db = getDb();
    const { values } = c.req.valid("json");
    for (const [key, value] of Object.entries(values)) {
      await db
        .insert(t.settings)
        .values({ key, value: value as never })
        .onConflictDoUpdate({ target: t.settings.key, set: { value: value as never, updatedAt: new Date() } });
    }
    await audit(c, { action: `updated ${Object.keys(values).length} setting(s)`, target: "settings", kind: "settings" });
    return c.json({ ok: true });
  },
);

/** Hero image upload — replaces the banner with no deploy. */
adminApi.post("/settings/:key/image", async (c) => {
  const nodeReq = (c.env as { incoming?: import("node:http").IncomingMessage })?.incoming;
  if (!nodeReq) return c.json({ error: "Uploads require the node adapter." }, 501);
  try {
    const file = await readUpload(c.req.raw, nodeReq, { kind: "image", productId: "site" });
    const url = publicAssetUrl(file.storageKey);
    const db = getDb();
    await db
      .insert(t.settings)
      .values({ key: c.req.param("key"), value: url as never })
      .onConflictDoUpdate({ target: t.settings.key, set: { value: url as never, updatedAt: new Date() } });
    await audit(c, { action: `replaced the ${c.req.param("key")} image`, target: c.req.param("key"), kind: "content" });
    return c.json({ ok: true, url });
  } catch (err) {
    if (err instanceof UploadError) return c.json({ error: err.message }, err.status as 400);
    return c.json({ error: "Upload failed." }, 500);
  }
});

/* --------------------------------------------------------- private moderation */

adminApi.get("/activity", async (c) => {
  const db = getDb();
  const rows = await db.select().from(t.activityLog).orderBy(desc(t.activityLog.createdAt)).limit(200);
  return c.json({ activity: rows });
});

/** Everything in one call, for the admin search palette. */
adminApi.get("/search", async (c) => {
  const db = getDb();
  const q = (c.req.query("q") ?? "").trim();
  if (q.length < 2) return c.json({ products: [], orders: [], customers: [] });
  const [products, orders, customers] = await Promise.all([
    db.select({ slug: t.products.slug, name: t.products.name, status: t.products.status }).from(t.products).where(ilike(t.products.name, `%${q}%`)).limit(6),
    db.select({ number: t.orders.number, email: t.orders.email, total: t.orders.total }).from(t.orders).where(or(ilike(t.orders.number, `%${q}%`), ilike(t.orders.email, `%${q}%`))).limit(6),
    db.select({ id: t.users.id, name: t.users.name, email: t.users.email }).from(t.users).where(and(eq(t.users.role, "customer"), or(ilike(t.users.name, `%${q}%`), ilike(t.users.email, `%${q}%`)))).limit(6),
  ]);
  return c.json({ products, orders, customers });
});

/* ---------------------------------------------------------------- bundles */

/** Bundles with their members resolved, for the admin screen. */
adminApi.get("/bundles", async (c) => {
  const db = getDb();
  const [rows, members] = await Promise.all([
    db.select().from(t.bundles).orderBy(desc(t.bundles.createdAt)),
    db
      .select({ bundleId: t.bundleItems.bundleId, position: t.bundleItems.position, product: t.products })
      .from(t.bundleItems)
      .innerJoin(t.products, eq(t.products.id, t.bundleItems.productId)),
  ]);
  return c.json({
    bundles: rows.map((b) => {
      const items = members
        .filter((m) => m.bundleId === b.id)
        .sort((a, z) => a.position - z.position)
        .map((m) => ({ slug: m.product.slug, name: m.product.name, price: m.product.price }));
      return {
        ...b,
        items,
        separateTotal: items.reduce((n, i) => n + i.price, 0),
      };
    }),
  });
});

const bundleInput = z.object({
  slug: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(160),
  tagline: z.string().max(240).optional(),
  description: z.string().max(4000).optional(),
  /** dollars, converted to cents here */
  price: z.number().min(0).max(100_000),
  license: z.enum(["personal", "commercial", "extended", "developer"]).optional(),
  active: z.boolean().optional(),
  featured: z.boolean().optional(),
  /** product slugs, in display order */
  products: z.array(z.string().trim().min(1)).min(1).max(24),
});

/** Resolve product slugs to ids, or report which ones do not exist. */
async function resolveBundleProducts(slugs: string[]) {
  const db = getDb();
  const rows = await db
    .select({ id: t.products.id, slug: t.products.slug })
    .from(t.products)
    .where(inArray(t.products.slug, [...new Set(slugs)]));
  const missing = slugs.filter((s) => !rows.some((r) => r.slug === s));
  return { rows, missing };
}

adminApi.post("/bundles", zValidator("json", bundleInput), async (c) => {
  const db = getDb();
  const input = c.req.valid("json");
  const { rows, missing } = await resolveBundleProducts(input.products);
  if (missing.length) return c.json({ error: `Unknown product: ${missing.join(", ")}` }, 400);

  // A "bundle" that costs more than its parts is a pricing mistake, not an
  // offer. Refuse it rather than putting a strange number in front of buyers.
  const prices = await db
    .select({ id: t.products.id, price: t.products.price })
    .from(t.products)
    .where(inArray(t.products.id, rows.map((r) => r.id)));
  const separate = prices.reduce((n, p) => n + p.price, 0);
  if (Math.round(input.price * 100) > separate) {
    return c.json(
      { error: `The bundle price is above the ${(separate / 100).toFixed(2)} the products cost separately.` },
      400,
    );
  }

  const [bundle] = await db
    .insert(t.bundles)
    .values({
      slug: slugify(input.slug),
      name: input.name,
      tagline: input.tagline ?? "",
      description: input.description ?? "",
      price: Math.round(input.price * 100),
      license: input.license ?? "personal",
      active: input.active ?? true,
      featured: input.featured ?? false,
    })
    .returning();

  await db.insert(t.bundleItems).values(
    input.products.map((slug, i) => ({
      bundleId: bundle.id,
      productId: rows.find((r) => r.slug === slug)!.id,
      position: i,
    })),
  );

  await audit(c, { action: `created the bundle ${bundle.name}`, target: bundle.slug, kind: "promo" });
  return c.json({ ok: true, bundle }, 201);
});

adminApi.patch("/bundles/:slug", zValidator("json", bundleInput.partial()), async (c) => {
  const db = getDb();
  const input = c.req.valid("json");
  const slug = c.req.param("slug");
  const [existing] = await db.select().from(t.bundles).where(eq(t.bundles.slug, slug)).limit(1);
  if (!existing) return c.json({ error: "Bundle not found" }, 404);

  let resolved: { id: string; slug: string }[] = [];
  if (input.products) {
    const found = await resolveBundleProducts(input.products);
    if (found.missing.length) return c.json({ error: `Unknown product: ${found.missing.join(", ")}` }, 400);
    resolved = found.rows;
  }

  const [bundle] = await db
    .update(t.bundles)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.tagline !== undefined ? { tagline: input.tagline } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.price !== undefined ? { price: Math.round(input.price * 100) } : {}),
      ...(input.license !== undefined ? { license: input.license } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.featured !== undefined ? { featured: input.featured } : {}),
      updatedAt: new Date(),
    })
    .where(eq(t.bundles.id, existing.id))
    .returning();

  if (input.products && resolved.length) {
    await db.delete(t.bundleItems).where(eq(t.bundleItems.bundleId, existing.id));
    await db.insert(t.bundleItems).values(
      input.products.map((s, i) => ({
        bundleId: existing.id,
        productId: resolved.find((r) => r.slug === s)!.id,
        position: i,
      })),
    );
  }

  await audit(c, { action: `updated the bundle ${bundle.name}`, target: bundle.slug, kind: "promo" });
  return c.json({ ok: true, bundle });
});

adminApi.delete("/bundles/:slug", async (c) => {
  const db = getDb();
  const [row] = await db
    .delete(t.bundles)
    .where(eq(t.bundles.slug, c.req.param("slug")))
    .returning();
  if (!row) return c.json({ error: "Bundle not found" }, 404);
  await audit(c, { action: `deleted the bundle ${row.name}`, target: row.slug, kind: "promo" });
  return c.json({ ok: true });
});

export { adminApi as adminContentApi };

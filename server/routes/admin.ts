/**
 * Admin API.
 *
 * Every route below sits behind `requireAdmin`, which demands an admin-scope
 * session cookie. A customer cookie — even a valid one — cannot reach any of it.
 * The store is single-owner: only accounts with role owner|admin exist, and
 * there is no vendor registration path anywhere in the system.
 */
import { Hono } from "hono";
import type { Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import * as t from "../db/schema";
import { currentAdmin, isAdmin } from "../lib/auth";
import { audit, logActivity } from "../lib/activity";
import {
  toCategory,
  toCustomer,
  toOrder,
  toProduct,
  toReview,
  slugify,
} from "../lib/mappers";
import { readUpload, readStreamUpload, UploadError } from "../lib/upload";
import { signedUrl, publicAssetUrl, UPLOAD_LIMITS } from "../lib/storage";
import { orderNumber } from "../lib/crypto";
import type { License } from "@/data/types";

const adminApi = new Hono();

/* ------------------------------------------------------------------- guard */

adminApi.use("/*", async (c, next) => {
  const user = await currentAdmin(c);
  if (!user || !isAdmin(user) || user.status === "suspended") {
    return c.json({ error: "Admin sign-in required." }, 401);
  }
  await next();
});

const ctx = (c: Context) => c;

/* --------------------------------------------------------------- dashboard */

adminApi.get("/overview", async (c) => {
  const db = getDb();
  const [revenue, orderCount, customerCount, productCount, downloads, pendingReviews, recentOrders, activity, topProducts] =
    await Promise.all([
      db
        .select({ n: sql<number>`coalesce(sum(${t.orders.total}),0)::int` })
        .from(t.orders)
        .where(eq(t.orders.status, "paid")),
      db.select({ n: sql<number>`count(*)::int` }).from(t.orders),
      db.select({ n: sql<number>`count(*)::int` }).from(t.users).where(eq(t.users.role, "customer")),
      db.select({ n: sql<number>`count(*)::int` }).from(t.products),
      db.select({ n: sql<number>`count(*)::int` }).from(t.downloads),
      db.select({ n: sql<number>`count(*)::int` }).from(t.reviews).where(eq(t.reviews.status, "pending")),
      db.select().from(t.orders).orderBy(desc(t.orders.createdAt)).limit(6),
      db.select().from(t.activityLog).orderBy(desc(t.activityLog.createdAt)).limit(8),
      db
        .select({ name: t.products.name, slug: t.products.slug, sales: t.products.sales, price: t.products.price, rating: t.products.rating })
        .from(t.products)
        .orderBy(desc(t.products.sales))
        .limit(5),
    ]);

  const [categoryCount, activeCoupons] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(t.categories),
    db.select({ n: sql<number>`count(*)::int` }).from(t.coupons).where(eq(t.coupons.active, true)),
  ]);

  const monthly = await db.execute<{ month: string; total: number }>(sql`
    select to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
           coalesce(sum(total), 0)::int as total
    from orders
    where status = 'paid'
    group by 1
    order by 1
  `);

  const byCategory = await db.execute<{ name: string; n: number }>(sql`
    select c.name, count(p.id)::int as n
    from categories c
    left join products p on p.category_id = c.id
    group by c.name
    order by n desc
  `);

  return c.json({
    revenue: revenue[0].n,
    orders: orderCount[0].n,
    customers: customerCount[0].n,
    products: productCount[0].n,
    categories: categoryCount[0].n,
    activeCoupons: activeCoupons[0].n,
    downloads: downloads[0].n,
    pendingReviews: pendingReviews[0].n,
    recentOrders: recentOrders.map((o) => ({ ...o, createdAt: o.createdAt })),
    activity,
    topProducts,
    monthly: monthly.rows,
    byCategory: byCategory.rows,
  });
});

/* ---------------------------------------------------------------- products */

adminApi.get("/products", async (c) => {
  const db = getDb();
  const q = (c.req.query("q") ?? "").trim();
  const status = c.req.query("status") ?? "";

  const rows = await db
    .select({ p: t.products, categorySlug: t.categories.slug, authorSlug: t.authors.slug })
    .from(t.products)
    .leftJoin(t.categories, eq(t.products.categoryId, t.categories.id))
    .leftJoin(t.authors, eq(t.products.authorId, t.authors.id))
    .where(
      and(
        q ? or(ilike(t.products.name, `%${q}%`), ilike(t.products.slug, `%${q}%`)) : undefined,
        status && status !== "all" ? eq(t.products.status, status as "published") : undefined,
      ),
    )
    .orderBy(asc(t.products.position), desc(t.products.sales));

  const [tiers, versions, files] = await Promise.all([
    db.select().from(t.pricingTiers).orderBy(asc(t.pricingTiers.position)),
    db.select().from(t.productVersions),
    db.select().from(t.productFiles),
  ]);

  return c.json({
    products: rows.map(({ p, categorySlug, authorSlug }) => ({
      ...toProduct({ ...p, categorySlug, authorSlug }, {
        tiers: tiers
          .filter((x) => x.productId === p.id)
          .map((x) => ({
            license: x.license as License,
            name: x.name,
            price: x.price,
            compareAt: x.compareAt,
            summary: x.summary,
            seats: x.seats,
            includes: x.includes ?? [],
            popular: x.popular,
          })),
        versions: versions
          .filter((v) => v.productId === p.id)
          .map((v) => ({ version: v.version, notes: v.notes ?? [], releasedAt: v.releasedAt })),
      }),
      id: p.id,
      hasSource: files.some((f) => f.productId === p.id && f.kind === "source_zip"),
      fileCount: files.filter((f) => f.productId === p.id).length,
      sales: p.sales,
      views: p.views,
      publishedAt: p.publishedAt,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
    })),
  });
});

const productInput = z.object({
  name: z.string().trim().min(2, "Give the product a name").max(140),
  slug: z.string().trim().max(90).optional(),
  tagline: z.string().trim().max(200).optional(),
  description: z.string().max(20000).optional(),
  categorySlug: z.string().optional(),
  authorSlug: z.string().optional(),
  stack: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["published", "draft", "review", "archived"]).optional(),
  price: z.number().int().min(0).max(10_000_000).optional(),
  compareAt: z.number().int().min(0).max(10_000_000).nullable().optional(),
  /** real sale price — charged while live, unlike compareAt */
  salePrice: z.number().int().min(0).max(10_000_000).nullable().optional(),
  saleEndsAt: z.string().nullable().optional(),
  free: z.boolean().optional(),
  featured: z.boolean().optional(),
  trending: z.boolean().optional(),
  isNew: z.boolean().optional(),
  bestseller: z.boolean().optional(),
  license: z.string().max(40).optional(),
  version: z.string().max(24).optional(),
  released: z.string().max(40).optional(),
  updated: z.string().max(40).optional(),
  features: z.array(z.object({ title: z.string(), body: z.string() })).optional(),
  highlights: z.array(z.string()).optional(),
  includes: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional(),
  gallery: z.array(z.object({ id: z.string(), caption: z.string(), path: z.string().optional() })).optional(),
  seoTitle: z.string().max(200).optional(),
  seoDescription: z.string().max(400).optional(),
  art: z
    .object({
      from: z.string().max(20),
      to: z.string().max(20),
      ink: z.string().max(20),
      kind: z.enum(["window", "grid", "terminal", "waves"]),
    })
    .optional(),
  tiers: z
    .array(
      z.object({
        license: z.enum(["personal", "commercial", "extended", "developer"]),
        name: z.string().max(60),
        price: z.number().int().min(0),
        compareAt: z.number().int().min(0).nullable().optional(),
        summary: z.string().max(300).optional(),
        seats: z.string().max(120).optional(),
        includes: z.array(z.string()).optional(),
        popular: z.boolean().optional(),
      }),
    )
    .optional(),
  changelog: z
    .array(z.object({ version: z.string().max(24), date: z.string().max(40), notes: z.array(z.string()) }))
    .optional(),
});

/** Resolve category/author slugs to ids, creating the slug only if unknown. */
async function resolveRefs(input: { categorySlug?: string; authorSlug?: string }) {
  const db = getDb();
  let categoryId: string | null = null;
  let authorId: string | null = null;

  if (input.categorySlug) {
    const rows = await db.select().from(t.categories).where(eq(t.categories.slug, input.categorySlug)).limit(1);
    categoryId = rows[0]?.id ?? null;
  }
  if (input.authorSlug) {
    const rows = await db.select().from(t.authors).where(eq(t.authors.slug, input.authorSlug)).limit(1);
    authorId = rows[0]?.id ?? null;
  }
  return { categoryId, authorId };
}

async function writeTiers(productId: string, tiers: NonNullable<z.infer<typeof productInput>["tiers"]>) {
  const db = getDb();
  await db.delete(t.pricingTiers).where(eq(t.pricingTiers.productId, productId));
  if (!tiers?.length) return;
  await db.insert(t.pricingTiers).values(
    tiers.map((tier, i) => ({
      productId,
      license: tier.license,
      name: tier.name,
      price: tier.price,
      compareAt: tier.compareAt ?? null,
      summary: tier.summary ?? "",
      seats: tier.seats ?? "",
      includes: tier.includes ?? [],
      popular: tier.popular ?? false,
      position: i,
    })),
  );
}

async function writeChangelog(productId: string, entries: NonNullable<z.infer<typeof productInput>["changelog"]>) {
  const db = getDb();
  await db.delete(t.productVersions).where(eq(t.productVersions.productId, productId));
  if (!entries?.length) return;
  await db.insert(t.productVersions).values(
    entries.map((e, i) => ({
      productId,
      version: e.version,
      notes: e.notes,
      releasedAt: e.date,
      isCurrent: i === 0,
    })),
  );
}

adminApi.post("/products", zValidator("json", productInput), async (c) => {
  const input = c.req.valid("json");
  const db = getDb();

  const slug = slugify(input.slug || input.name);
  const existing = await db.select({ id: t.products.id }).from(t.products).where(eq(t.products.slug, slug)).limit(1);
  const finalSlug = existing.length ? `${slug}-${Math.random().toString(36).slice(2, 6)}` : slug;

  if (input.salePrice != null && input.salePrice >= (input.price ?? 0)) {
    return c.json({ error: "A sale price must be below the list price." }, 400);
  }

  const { categoryId, authorId } = await resolveRefs(input);

  const [row] = await db
    .insert(t.products)
    .values({
      slug: finalSlug,
      name: input.name,
      tagline: input.tagline ?? "",
      description: input.description ?? "",
      categoryId,
      authorId,
      stack: input.stack ?? [],
      tags: input.tags ?? [],
      status: input.status ?? "draft",
      price: input.price ?? 0,
      compareAt: input.compareAt ?? null,
      salePrice: input.salePrice ?? null,
      saleEndsAt: input.saleEndsAt ? new Date(input.saleEndsAt) : null,
      free: input.free ?? false,
      featured: input.featured ?? false,
      trending: input.trending ?? false,
      isNew: input.isNew ?? true,
      bestseller: input.bestseller ?? false,
      license: input.license ?? "Regular",
      version: input.version ?? "1.0.0",
      released: input.released ?? new Date().toISOString().slice(0, 10),
      updated: input.updated ?? new Date().toISOString().slice(0, 10),
      artFrom: input.art?.from ?? "#17392b",
      artTo: input.art?.to ?? "#3d7a58",
      artInk: input.art?.ink ?? "#eef4e9",
      artKind: input.art?.kind ?? "window",
      features: input.features ?? [],
      highlights: input.highlights ?? [],
      includes: input.includes ?? [],
      requirements: input.requirements ?? [],
      gallery: input.gallery ?? [],
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
      publishedAt: input.status === "published" ? new Date() : null,
    })
    .returning();

  await writeTiers(row.id, input.tiers ?? []);
  await writeChangelog(row.id, input.changelog ?? []);
  await audit(c, { action: `created the product “${row.name}”`, target: row.slug, kind: "product" });

  return c.json({ ok: true, product: { id: row.id, slug: row.slug, status: row.status } }, 201);
});

adminApi.get("/products/:slug", async (c) => {
  const db = getDb();
  const rows = await db
    .select({ p: t.products, categorySlug: t.categories.slug, authorSlug: t.authors.slug })
    .from(t.products)
    .leftJoin(t.categories, eq(t.products.categoryId, t.categories.id))
    .leftJoin(t.authors, eq(t.products.authorId, t.authors.id))
    .where(eq(t.products.slug, c.req.param("slug")))
    .limit(1);
  const row = rows[0];
  if (!row) return c.json({ error: "Product not found" }, 404);

  const [tiers, versions, files] = await Promise.all([
    db.select().from(t.pricingTiers).where(eq(t.pricingTiers.productId, row.p.id)).orderBy(asc(t.pricingTiers.position)),
    db.select().from(t.productVersions).where(eq(t.productVersions.productId, row.p.id)),
    db.select().from(t.productFiles).where(eq(t.productFiles.productId, row.p.id)).orderBy(desc(t.productFiles.createdAt)),
  ]);

  return c.json({
    product: {
      ...toProduct(
        { ...row.p, categorySlug: row.categorySlug, authorSlug: row.authorSlug },
        {
          tiers: tiers.map((x) => ({
            license: x.license as License,
            name: x.name,
            price: x.price,
            compareAt: x.compareAt,
            summary: x.summary,
            seats: x.seats,
            includes: x.includes ?? [],
            popular: x.popular,
          })),
          versions: versions.map((v) => ({ version: v.version, notes: v.notes ?? [], releasedAt: v.releasedAt })),
        },
      ),
      id: row.p.id,
      artFrom: row.p.artFrom,
      artTo: row.p.artTo,
      artInk: row.p.artInk,
      artKind: row.p.artKind,
      galleryPaths: row.p.gallery ?? [],
      seoTitle: row.p.seoTitle ?? "",
      seoDescription: row.p.seoDescription ?? "",
      tags: row.p.tags ?? [],
      publishedAt: row.p.publishedAt,
    },
    files: files.map((f) => ({
      id: f.id,
      kind: f.kind,
      originalName: f.originalName,
      bytes: f.bytes,
      checksum: f.checksum,
      createdAt: f.createdAt,
      url: signedUrl(f.storageKey, { ttlSeconds: 600, filename: f.originalName, mime: f.mimeType }),
    })),
  });
});

adminApi.patch("/products/:slug", zValidator("json", productInput.partial()), async (c) => {
  const input = c.req.valid("json");
  const db = getDb();
  const slug = c.req.param("slug");
  const rows = await db.select().from(t.products).where(eq(t.products.slug, slug)).limit(1);
  const existing = rows[0];
  if (!existing) return c.json({ error: "Product not found" }, 404);

  // A sale priced above list would silently never apply; reject it instead of
  // storing a number the storefront quietly ignores.
  if (input.salePrice != null) {
    const list = input.price ?? existing.price;
    if (existing.free || list === 0) return c.json({ error: "Free products cannot be on sale." }, 400);
    if (input.salePrice >= list) return c.json({ error: "A sale price must be below the list price." }, 400);
  }

  const { categoryId, authorId } = await resolveRefs(input);

  const patch: Partial<typeof t.products.$inferInsert> = {
    updatedAt: new Date(),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.slug !== undefined && input.slug !== slug ? { slug: slugify(input.slug) } : {}),
    ...(input.tagline !== undefined ? { tagline: input.tagline } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(authorId ? { authorId } : {}),
    ...(input.stack !== undefined ? { stack: input.stack } : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
    ...(input.price !== undefined ? { price: input.price } : {}),
    ...(input.compareAt !== undefined ? { compareAt: input.compareAt } : {}),
    ...(input.salePrice !== undefined ? { salePrice: input.salePrice } : {}),
    ...(input.saleEndsAt !== undefined
      ? { saleEndsAt: input.saleEndsAt ? new Date(input.saleEndsAt) : null }
      : {}),
    ...(input.free !== undefined ? { free: input.free } : {}),
    ...(input.featured !== undefined ? { featured: input.featured } : {}),
    ...(input.trending !== undefined ? { trending: input.trending } : {}),
    ...(input.isNew !== undefined ? { isNew: input.isNew } : {}),
    ...(input.bestseller !== undefined ? { bestseller: input.bestseller } : {}),
    ...(input.license !== undefined ? { license: input.license } : {}),
    ...(input.version !== undefined ? { version: input.version } : {}),
    ...(input.released !== undefined ? { released: input.released } : {}),
    ...(input.updated !== undefined ? { updated: input.updated } : {}),
    ...(input.features !== undefined ? { features: input.features } : {}),
    ...(input.highlights !== undefined ? { highlights: input.highlights } : {}),
    ...(input.includes !== undefined ? { includes: input.includes } : {}),
    ...(input.requirements !== undefined ? { requirements: input.requirements } : {}),
    ...(input.gallery !== undefined ? { gallery: input.gallery as never } : {}),
    ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle } : {}),
    ...(input.seoDescription !== undefined ? { seoDescription: input.seoDescription } : {}),
    ...(input.art
      ? { artFrom: input.art.from, artTo: input.art.to, artInk: input.art.ink, artKind: input.art.kind }
      : {}),
  };

  if (input.status && input.status !== existing.status) {
    patch.status = input.status;
    if (input.status === "published" && !existing.publishedAt) patch.publishedAt = new Date();
  }

  const [updated] = await db.update(t.products).set(patch).where(eq(t.products.id, existing.id)).returning();

  if (input.tiers) await writeTiers(existing.id, input.tiers);
  if (input.changelog) await writeChangelog(existing.id, input.changelog);

  const verb =
    input.status && input.status !== existing.status
      ? input.status === "published"
        ? `published “${updated.name}”`
        : `moved “${updated.name}” to ${input.status}`
      : `updated “${updated.name}”`;
  await audit(c, { action: verb, target: updated.slug, kind: "product" });

  return c.json({ ok: true, product: { id: updated.id, slug: updated.slug, status: updated.status } });
});

adminApi.post("/products/:slug/duplicate", async (c) => {
  const db = getDb();
  const rows = await db.select().from(t.products).where(eq(t.products.slug, c.req.param("slug"))).limit(1);
  const source = rows[0];
  if (!source) return c.json({ error: "Product not found" }, 404);

  const [copy] = await db
    .insert(t.products)
    .values({
      ...source,
      id: undefined as never,
      slug: `${source.slug}-copy-${Math.random().toString(36).slice(2, 5)}`,
      name: `${source.name} (copy)`,
      status: "draft",
      sales: 0,
      views: 0,
      reviews: 0,
      publishedAt: null,
      createdAt: undefined as never,
      updatedAt: new Date(),
    })
    .returning();

  const tiers = await db.select().from(t.pricingTiers).where(eq(t.pricingTiers.productId, source.id));
  if (tiers.length) {
    await db.insert(t.pricingTiers).values(
      tiers.map((x) => ({ ...x, id: undefined as never, productId: copy.id })),
    );
  }
  const versions = await db.select().from(t.productVersions).where(eq(t.productVersions.productId, source.id));
  if (versions.length) {
    await db.insert(t.productVersions).values(
      versions.map((v) => ({ ...v, id: undefined as never, productId: copy.id, isCurrent: false })),
    );
  }

  await audit(c, { action: `duplicated “${source.name}”`, target: copy.slug, kind: "product" });
  return c.json({ ok: true, product: { id: copy.id, slug: copy.slug } }, 201);
});

adminApi.delete("/products/:slug", async (c) => {
  const db = getDb();
  const rows = await db.select().from(t.products).where(eq(t.products.slug, c.req.param("slug"))).limit(1);
  const product = rows[0];
  if (!product) return c.json({ error: "Product not found" }, 404);

  const files = await db.select().from(t.productFiles).where(eq(t.productFiles.productId, product.id));
  await db.delete(t.products).where(eq(t.products.id, product.id));
  const { remove } = await import("../lib/storage");
  for (const f of files) await remove(f.storageKey).catch(() => {});

  await audit(c, { action: `deleted “${product.name}”`, target: product.slug, kind: "product" });
  return c.json({ ok: true });
});

/* ----------------------------------------------------------------- uploads */

adminApi.post("/products/:slug/files", async (c) => {
  const db = getDb();
  const rows = await db.select().from(t.products).where(eq(t.products.slug, c.req.param("slug"))).limit(1);
  const product = rows[0];
  if (!product) return c.json({ error: "Product not found" }, 404);

  const kind = (c.req.query("kind") ?? "source") as "source" | "image" | "document";
  const nodeReq = (c.env as { incoming?: import("node:http").IncomingMessage })?.incoming;
  const stream = c.req.raw.body as AsyncIterable<Uint8Array> | null;
  if (!nodeReq && !stream) return c.json({ error: "Uploads require the node adapter." }, 501);

  try {
    const file =
      kind === "source"
        ? await readStreamUpload(c.req.raw, stream ?? (nodeReq as unknown as AsyncIterable<Uint8Array>), {
            kind: "source_zip",
            productId: product.id,
          })
        : await readUpload(c.req.raw, nodeReq as import("node:http").IncomingMessage, {
            kind: kind === "image" ? "image" : "document",
            productId: product.id,
          });

    const [row] = await db
      .insert(t.productFiles)
      .values({
        productId: product.id,
        kind: kind === "source" ? "source_zip" : kind === "image" ? "image" : "document",
        storageKey: file.storageKey,
        originalName: file.originalName,
        mimeType: file.mimeType,
        bytes: file.bytes,
        checksum: file.checksum,
      })
      .returning();

    // An image uploaded as a cover becomes the product art source.
    if (kind === "image") {
      await db.update(t.products).set({ coverPath: publicAssetUrl(row.storageKey) }).where(eq(t.products.id, product.id));
    }

    // Replacing a source package keeps one current archive: old rows stay for
    // audit, the newest is what customers receive.
    if (kind === "source") {
      await db.update(t.products).set({ updated: new Date().toISOString().slice(0, 10) }).where(eq(t.products.id, product.id));
    }

    await audit(c, {
      action: `uploaded ${file.originalName} (${(file.bytes / 1024 / 1024).toFixed(1)} MB)`,
      target: product.slug,
      kind: "product",
    });

    return c.json(
      {
        ok: true,
        file: {
          id: row.id,
          originalName: row.originalName,
          bytes: row.bytes,
          kind: row.kind,
          checksum: row.checksum,
          // admin preview only; customers always get a freshly signed link
          url: signedUrl(row.storageKey, { ttlSeconds: 600, filename: row.originalName, mime: row.mimeType }),
        },
        limits: UPLOAD_LIMITS,
      },
      201,
    );
  } catch (err) {
    if (err instanceof UploadError) return c.json({ error: err.message }, err.status as 400);
    console.error("[upload]", err);
    return c.json({ error: "Upload failed." }, 500);
  }
});

adminApi.delete("/files/:id", async (c) => {
  const db = getDb();
  const rows = await db.select().from(t.productFiles).where(eq(t.productFiles.id, c.req.param("id"))).limit(1);
  const file = rows[0];
  if (!file) return c.json({ error: "File not found" }, 404);
  const { remove } = await import("../lib/storage");
  await remove(file.storageKey).catch(() => {});
  await db.delete(t.productFiles).where(eq(t.productFiles.id, file.id));
  await audit(c, { action: `deleted file ${file.originalName}`, target: file.productId, kind: "product" });
  return c.json({ ok: true });
});

/** Admin-only signed preview for a file that has not been published. */
adminApi.get("/files/:id/url", async (c) => {
  const db = getDb();
  const rows = await db.select().from(t.productFiles).where(eq(t.productFiles.id, c.req.param("id"))).limit(1);
  const file = rows[0];
  if (!file) return c.json({ error: "File not found" }, 404);
  return c.json({
    url: signedUrl(file.storageKey, { ttlSeconds: 300, filename: file.originalName, mime: file.mimeType }),
    expiresIn: 300,
  });
});

export { adminApi };

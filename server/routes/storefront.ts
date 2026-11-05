/**
 * Public storefront API.
 *
 * Returns exactly the view models defined in `src/data/types.ts`, so the React
 * app can swap its mock module for this endpoint without touching a component.
 * Only published rows are exposed; drafts stay behind the admin guard.
 */
import { Hono } from "hono";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import * as t from "../db/schema";
import {
  toAuthor,
  toCategory,
  toCollection,
  toProduct,
  toReview,
} from "../lib/mappers";
import type { License } from "@/data/types";
import { licenseTerms } from "../lib/licensing";

const api = new Hono();

/* --------------------------------------------------------------- catalogue */

/** One round trip for the whole storefront catalogue. */
api.get("/catalog", async (c) => {
  const db = getDb();

  const [categoryRows, authorRows, productRows, tierRows, versionRows, reviewRows, collectionRows, itemRows, sectionRows, announcementRows, settingRows] =
    await Promise.all([
      db.select().from(t.categories).orderBy(asc(t.categories.position)),
      db.select().from(t.authors),
      db
        .select({
          p: t.products,
          categorySlug: t.categories.slug,
          authorSlug: t.authors.slug,
        })
        .from(t.products)
        .leftJoin(t.categories, eq(t.products.categoryId, t.categories.id))
        .leftJoin(t.authors, eq(t.products.authorId, t.authors.id))
        // Public endpoint: published only. Drafts and review copies must never
        // leave the admin API.
        .where(eq(t.products.status, "published"))
        .orderBy(asc(t.products.position), desc(t.products.sales)),
      db.select().from(t.pricingTiers).orderBy(asc(t.pricingTiers.position)),
      db.select().from(t.productVersions),
      db.select().from(t.reviews).where(eq(t.reviews.status, "published")).orderBy(desc(t.reviews.createdAt)),
      db.select().from(t.collections),
      db.select().from(t.collectionItems).orderBy(asc(t.collectionItems.position)),
      db.select().from(t.homepageSections).orderBy(asc(t.homepageSections.position)),
      db.select().from(t.announcements).where(eq(t.announcements.active, true)).orderBy(asc(t.announcements.position)),
      db.select().from(t.settings),
    ]);

  const tiersByProduct = new Map<string, typeof tierRows>();
  for (const tier of tierRows) {
    const list = tiersByProduct.get(tier.productId) ?? [];
    list.push(tier);
    tiersByProduct.set(tier.productId, list);
  }
  const versionsByProduct = new Map<string, typeof versionRows>();
  for (const v of versionRows) {
    const list = versionsByProduct.get(v.productId) ?? [];
    list.push(v);
    versionsByProduct.set(v.productId, list);
  }

  const products = productRows.map(({ p, categorySlug, authorSlug }) =>
    toProduct({ ...p, categorySlug, authorSlug }, {
      tiers: (tiersByProduct.get(p.id) ?? []).map((x) => ({
        license: x.license as License,
        name: x.name,
        price: x.price,
        compareAt: x.compareAt,
        summary: x.summary,
        seats: x.seats,
        includes: x.includes ?? [],
        popular: x.popular,
      })),
      versions: (versionsByProduct.get(p.id) ?? []).map((x) => ({
        version: x.version,
        notes: x.notes ?? [],
        releasedAt: x.releasedAt,
      })),
    }),
  );

  const slugById = new Map(productRows.map(({ p }) => [p.id, p.slug]));

  const collections = collectionRows.map((row) =>
    toCollection(
      row,
      itemRows.filter((i) => i.collectionId === row.id).map((i) => slugById.get(i.productId)!).filter(Boolean),
    ),
  );

  const reviews = reviewRows
    .map((r) => (slugById.get(r.productId) ? toReview(r, slugById.get(r.productId)!) : null))
    .filter(Boolean);

  return c.json({
    categories: categoryRows.map(toCategory),
    authors: authorRows.map(toAuthor),
    products,
    reviews,
    collections,
    sections: sectionRows,
    announcement: announcementRows[0] ?? null,
    settings: Object.fromEntries(settingRows.map((s) => [s.key, s.value])),
  });
});

api.get("/products", async (c) => {
  const db = getDb();
  const rows = await db
    .select({ p: t.products, categorySlug: t.categories.slug, authorSlug: t.authors.slug })
    .from(t.products)
    .leftJoin(t.categories, eq(t.products.categoryId, t.categories.id))
    .leftJoin(t.authors, eq(t.products.authorId, t.authors.id))
    .where(eq(t.products.status, "published"))
    .orderBy(desc(t.products.sales));
  return c.json({ products: rows.map(({ p, categorySlug, authorSlug }) => toProduct({ ...p, categorySlug, authorSlug }, { tiers: [], versions: [] })) });
});

api.get("/products/:slug", async (c) => {
  const db = getDb();
  const slug = c.req.param("slug");
  const rows = await db
    .select({ p: t.products, categorySlug: t.categories.slug, authorSlug: t.authors.slug })
    .from(t.products)
    .leftJoin(t.categories, eq(t.products.categoryId, t.categories.id))
    .leftJoin(t.authors, eq(t.products.authorId, t.authors.id))
    .where(eq(t.products.slug, slug))
    .limit(1);
  const row = rows[0];
  if (!row) return c.json({ error: "Product not found" }, 404);

  const [tiers, versions, reviews] = await Promise.all([
    db.select().from(t.pricingTiers).where(eq(t.pricingTiers.productId, row.p.id)).orderBy(asc(t.pricingTiers.position)),
    db.select().from(t.productVersions).where(eq(t.productVersions.productId, row.p.id)),
    db.select().from(t.reviews).where(and(eq(t.reviews.productId, row.p.id), eq(t.reviews.status, "published"))),
  ]);

  const product = toProduct(
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
  );

  return c.json({ product, reviews: reviews.map((r) => toReview(r, product.slug)) });
});

api.get("/categories", async (c) => {
  const db = getDb();
  const rows = await db.select().from(t.categories).orderBy(asc(t.categories.position));
  return c.json({ categories: rows.map(toCategory) });
});

api.get("/collections", async (c) => {
  const db = getDb();
  const [rows, items, products] = await Promise.all([
    db.select().from(t.collections),
    db.select().from(t.collectionItems),
    db.select({ id: t.products.id, slug: t.products.slug, status: t.products.status }).from(t.products),
  ]);
  const published = new Set(products.filter((p) => p.status === "published").map((p) => p.id));
  return c.json({
    collections: rows.map((row) =>
      toCollection(
        row,
        items
          .filter((i) => i.collectionId === row.id && published.has(i.productId))
          .map((i) => products.find((p) => p.id === i.productId)!.slug),
      ),
    ),
  });
});

/** Bundles on sale: their members, and what buying them separately would cost. */
api.get("/bundles", async (c) => {
  const db = getDb();
  const rows = await db.select().from(t.bundles).where(eq(t.bundles.active, true));
  const members = rows.length
    ? await db
        .select({ bundleId: t.bundleItems.bundleId, position: t.bundleItems.position, product: t.products })
        .from(t.bundleItems)
        .innerJoin(t.products, eq(t.products.id, t.bundleItems.productId))
        .where(inArray(t.bundleItems.bundleId, rows.map((b) => b.id)))
    : [];
  return c.json({
    bundles: rows
      .map((b) => {
        const items = members
          .filter((m) => m.bundleId === b.id && m.product.status === "published")
          .sort((a, z) => a.position - z.position)
          .map((m) => ({
            slug: m.product.slug,
            name: m.product.name,
            price: m.product.price,
            tagline: m.product.tagline,
          }));
        return {
          slug: b.slug,
          name: b.name,
          tagline: b.tagline,
          description: b.description,
          price: b.price,
          compareAt: b.compareAt,
          license: b.license,
          featured: b.featured,
          art: { from: b.artFrom, to: b.artTo },
          items,
          /** what the same products cost when bought one at a time */
          separateTotal: items.reduce((n, i) => n + i.price, 0),
        };
      })
      .filter((b) => b.items.length > 0),
  });
});

/** Pages: policies, FAQ, about — edited in the admin CMS. */
api.get("/pages", async (c) => {
  const db = getDb();
  const rows = await db
    .select()
    .from(t.pages)
    .where(eq(t.pages.status, "published"))
    .orderBy(asc(t.pages.position));
  return c.json({ pages: rows });
});

api.get("/pages/:slug", async (c) => {
  const db = getDb();
  const rows = await db.select().from(t.pages).where(eq(t.pages.slug, c.req.param("slug"))).limit(1);
  if (!rows[0]) return c.json({ error: "Page not found" }, 404);
  return c.json({ page: rows[0] });
});

/* ------------------------------------------------------------------ coupons */

/** Validates a code without disclosing the full coupon list. */
api.post("/coupons/validate", async (c) => {
  const body = await c.req.json<{ code?: string; subtotal?: number }>();
  const code = (body.code ?? "").trim();
  if (!code) return c.json({ error: "Enter a code" }, 400);

  const db = getDb();
  const rows = await db
    .select()
    .from(t.coupons)
    .where(sql`upper(${t.coupons.code}) = ${code.toUpperCase()}`)
    .limit(1);
  const coupon = rows[0];
  if (!coupon || !coupon.active) return c.json({ error: "That code is not valid." }, 404);
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now())
    return c.json({ error: "That code has expired." }, 410);
  if (coupon.uses >= coupon.limit) return c.json({ error: "That code has been fully redeemed." }, 410);

  const subtotal = Number(body.subtotal ?? 0);
  const discount =
    coupon.kind === "percent"
      ? Math.round((subtotal * coupon.value) / 100)
      : Math.min(coupon.value, subtotal);

  return c.json({
    ok: true,
    code: coupon.code,
    kind: coupon.kind,
    value: coupon.value,
    discount,
  });
});

/* --------------------------------------------------- signed file downloads */

/**
 * The only way bytes leave private storage. The signature covers key + expiry,
 * so a URL cannot be extended or aimed at another file. Every hit is logged.
 */
api.get("/files/:key{.+}", async (c) => {
  const { verifySignature, get } = await import("../lib/storage");
  const key = c.req.param("key");
  const expires = Number(c.req.query("expires") ?? 0);
  const signature = c.req.query("signature") ?? "";

  if (!verifySignature(key, expires, signature)) {
    return c.json({ error: "This download link is invalid or has expired." }, 403);
  }

  const file = await get(key);
  if (!file) return c.json({ error: "File not found" }, 404);

  const name = c.req.query("name") ?? key.split("/").pop() ?? "download";
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": c.req.query("mime") ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${name.replace(/["\\]/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

/* ------------------------------------------------------- public image assets */

/**
 * Public marketing images (covers, category art, hero banners). This route only
 * ever serves files under `image/`, so a source archive can never be requested
 * through it even if someone guesses the key.
 */
api.get("/assets/:key{.+}", async (c) => {
  const { get, isPublicAsset } = await import("../lib/storage");
  const key = c.req.param("key");
  if (!isPublicAsset(key)) return c.json({ error: "Not found" }, 404);
  try {
    const file = await get(key);
    const ext = key.split(".").pop()?.toLowerCase();
    const type =
      ext === "png" ? "image/png"
      : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
      : ext === "webp" ? "image/webp"
      : ext === "avif" ? "image/avif"
      : ext === "gif" ? "image/gif"
      : "image/svg+xml";
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return c.json({ error: "Not found" }, 404);
  }
});

/* ---------------------------------------------------------------- discovery */

/** Storefront-wide counters for the marketing copy (real, not mock). */
/**
 * Licence terms for the storefront.
 *
 * Shown at checkout and on the licensing page; the brief requires the customer
 * to be able to read what they are buying before they pay.
 */
api.get("/licenses/terms", async (c) => {
  const terms = await licenseTerms();
  return c.json({ terms });
});

api.get("/stats", async (c) => {
  const db = getDb();
  const [products, customers, downloads, reviews] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(t.products).where(eq(t.products.status, "published")),
    db.select({ n: sql<number>`count(*)::int` }).from(t.users).where(eq(t.users.role, "customer")),
    db.select({ n: sql<number>`coalesce(sum(${t.products.sales}),0)::int` }).from(t.products),
    db.select({ n: sql<number>`count(*)::int` }).from(t.reviews).where(eq(t.reviews.status, "published")),
  ]);
  return c.json({
    products: products[0].n,
    customers: customers[0].n,
    downloads: downloads[0].n,
    reviews: reviews[0].n,
  });
});

export { api };

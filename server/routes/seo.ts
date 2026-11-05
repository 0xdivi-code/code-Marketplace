/**
 * Search-engine surfaces.
 *
 * `robots.txt` and `sitemap.xml` are generated from the database so a new
 * product, category or journal post is discoverable without a redeploy. They
 * are mounted on the API host; the reverse proxy in production rewrites
 * `https://<domain>/robots.txt` to `/api/robots.txt` (see DEPLOYMENT.md).
 */
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import * as t from "../db/schema";

export const seo = new Hono();

/** The public origin. Falls back to the request's own origin. */
function siteOrigin(requestUrl: string): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const url = new URL(requestUrl);
  return `${url.protocol}//${url.host}`;
}

seo.get("/robots.txt", (c) => {
  const origin = siteOrigin(c.req.url);
  const body = [
    "User-agent: *",
    "Allow: /",
    // Private areas: nothing here is useful to a crawler and some of it is
    // per-session. Download links are single-use tokens and must never be indexed.
    "Disallow: /admin",
    "Disallow: /account",
    "Disallow: /checkout",
    "Disallow: /cart",
    "Disallow: /api/",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
  return c.text(body, 200, { "content-type": "text/plain; charset=utf-8" });
});

seo.get("/sitemap.xml", async (c) => {
  const origin = siteOrigin(c.req.url);
  const db = getDb();

  const [products, categories, collections, pages, bundles] = await Promise.all([
    db
      .select({ slug: t.products.slug, updatedAt: t.products.updatedAt })
      .from(t.products)
      .where(eq(t.products.status, "published")),
    db.select({ slug: t.categories.slug }).from(t.categories),
    db.select({ slug: t.collections.slug }).from(t.collections),
    db
      .select({ slug: t.pages.slug, updatedAt: t.pages.updatedAt })
      .from(t.pages)
      .where(eq(t.pages.status, "published")),
    db.select({ slug: t.bundles.slug }).from(t.bundles).where(eq(t.bundles.active, true)),
  ]);

  const staticPaths = ["/", "/browse", "/collections", "/bundles", "/free", "/blog", "/about", "/contact"];

  const url = (path: string, lastmod?: Date | null, priority = "0.6") =>
    [
      "  <url>",
      `    <loc>${origin}${path}</loc>`,
      lastmod ? `    <lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>` : "",
      `    <changefreq>weekly</changefreq>`,
      `    <priority>${priority}</priority>`,
      "  </url>",
    ]
      .filter(Boolean)
      .join("\n");

  const entries = [
    ...staticPaths.map((p) => url(p, null, p === "/" ? "1.0" : "0.7")),
    ...products.map((p) => url(`/item/${p.slug}`, p.updatedAt, "0.9")),
    ...categories.map((c) => url(`/category/${c.slug}`, null, "0.7")),
    ...collections.map((c) => url(`/collection/${c.slug}`, null, "0.6")),
    ...bundles.map((b) => url(`/bundles`, null, "0.8")),
    ...pages.map((p) => url(`/${p.slug}`, p.updatedAt, "0.5")),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");

  return c.body(xml, 200, {
    "content-type": "application/xml; charset=utf-8",
    // Cheap to regenerate, but crawlers hit it repeatedly.
    "cache-control": "public, max-age=3600",
  });
});

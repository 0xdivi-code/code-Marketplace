/**
 * Add the casino & launchpad products to a database that is already seeded.
 *
 * Why this exists rather than `npm run reseed`: reseed truncates orders,
 * licences, payments and reviews before rebuilding. That is fine on a fresh
 * demo box and completely wrong on a store that has taken orders — it would
 * delete real customer data to add seven products.
 *
 * So this is additive and idempotent:
 *
 *   - categories and products are matched by slug and only inserted when absent
 *   - an existing row is left alone, never overwritten, so an owner's edits and
 *     any real prices survive a re-run
 *   - pricing tiers and product versions are created only for products this
 *     script inserted
 *   - nothing is deleted or truncated, ever
 *
 * It reads the same `seedProducts` / `seedCategories` the seeder uses, so the
 * copy lives in one place.
 *
 *   npm run db:add-products
 *   npm run db:add-products -- --dry-run
 */
import { eq } from "drizzle-orm";
import { initDb } from "../db/client";
import { migrate } from "../db/migrate";
import * as t from "../db/schema";
import { seedCategories, seedProducts } from "../../src/data/seed-catalog";

const DRY = process.argv.includes("--dry-run");

/** Slugs this script owns. Nothing else in the catalog is touched. */
const PROJECT_SLUGS = [
  "dubs-casino",
  "shuffle-casino",
  "minebit-casino",
  "whale-casino",
  "kings-casino",
  "dustbit-casino",
  "moonsale-launchpad",
];

const PROJECT_CATEGORIES = ["casino-gaming", "crypto-launchpad"];

const say = (...a: unknown[]) => console.log(...a);

await migrate({ log: false });
const db = await initDb();

say(`\n${DRY ? "DRY RUN — no writes" : "Adding casino + launchpad products"}\n`);

/* ------------------------------------------------------------- categories */

const catIdBySlug = new Map<string, string>();
const existingCats = await db.select({ id: t.categories.id, slug: t.categories.slug }).from(t.categories);
for (const c of existingCats) catIdBySlug.set(c.slug, c.id);

for (const slug of PROJECT_CATEGORIES) {
  const cat = seedCategories.find((c) => c.slug === slug);
  if (!cat) {
    say(`  ! ${slug} missing from seedCategories`);
    continue;
  }
  if (catIdBySlug.has(slug)) {
    say(`  = category ${slug} already exists — left as is`);
    continue;
  }
  if (DRY) {
    say(`  + would create category ${slug}`);
    continue;
  }
  const [row] = await db
    .insert(t.categories)
    .values({
      slug: cat.slug,
      name: cat.name,
      blurb: cat.blurb,
      from: cat.from,
      to: cat.to,
      glyph: cat.glyph,
      imagePath: cat.src ?? null,
      position: existingCats.length + catIdBySlug.size,
    })
    .returning({ id: t.categories.id });
  catIdBySlug.set(slug, row.id);
  say(`  + created category ${slug}`);
}

/* --------------------------------------------------------------- authors */

const authors = await db.select({ id: t.authors.id, slug: t.authors.slug }).from(t.authors);
const authorIdBySlug = new Map(authors.map((a) => [a.slug, a.id]));

/* --------------------------------------------------------------- products */

const existingProducts = await db.select({ slug: t.products.slug, id: t.products.id }).from(t.products);
const existingSlugs = new Set(existingProducts.map((p) => p.slug));

let created = 0;
let skipped = 0;

for (const slug of PROJECT_SLUGS) {
  const p = seedProducts.find((x) => x.slug === slug);
  if (!p) {
    say(`  ! ${slug} missing from seedProducts`);
    continue;
  }
  if (existingSlugs.has(slug)) {
    say(`  = ${slug} already present — left as is`);
    skipped++;
    continue;
  }
  if (DRY) {
    say(`  + would create ${slug} (${p.category}) with ${p.gallery.length} gallery image(s)`);
    created++;
    continue;
  }

  const [row] = await db
    .insert(t.products)
    .values({
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
      description: p.description,
      categoryId: catIdBySlug.get(p.category) ?? null,
      authorId: authorIdBySlug.get(p.author) ?? null,
      stack: p.stack,
      status: p.status,
      price: p.price,
      compareAt: p.compareAt ?? null,
      free: p.free,
      featured: p.featured,
      trending: p.trending,
      isNew: p.new,
      bestseller: p.bestseller,
      license: p.license,
      rating: Math.round(p.rating * 10),
      reviews: p.reviews,
      sales: p.sales,
      views: p.views,
      version: p.version,
      released: p.released,
      updated: p.updated,
      artFrom: p.art.from,
      artTo: p.art.to,
      artInk: p.art.ink,
      artKind: p.art.kind,
      coverPath: p.art.src ?? null,
      features: p.features,
      highlights: p.highlights,
      includes: p.includes,
      requirements: p.requirements,
      gallery: p.gallery.map((g, gi) => ({ id: g.id || `g${gi + 1}`, caption: g.caption, path: g.src ?? "" })),
      position: existingProducts.length + created,
      publishedAt: new Date(),
    })
    .returning({ id: t.products.id });

  await db.insert(t.pricingTiers).values(
    p.tiers.map((tier, ti) => ({
      productId: row.id,
      license: tier.license,
      name: tier.name,
      price: tier.price,
      compareAt: tier.compareAt ?? null,
      summary: tier.summary,
      seats: tier.seats,
      includes: tier.includes,
      popular: Boolean(tier.popular),
      position: ti,
    })),
  );

  await db.insert(t.productVersions).values({
    productId: row.id,
    version: p.version,
    notes: p.changelog[0]?.notes ?? [],
    releasedAt: p.updated,
    isCurrent: true,
  });

  created++;
  say(`  + created ${slug} — ${p.name} (${p.gallery.length} image${p.gallery.length === 1 ? "" : "s"})`);
}

say(`\n${created} created, ${skipped} already present.${DRY ? " (dry run)" : ""}\n`);
process.exit(0);

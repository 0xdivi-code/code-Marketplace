/**
 * Seeds the database from the Step 1 catalogue.
 *
 * The mock module stays the authoring source for demo content; this imports it
 * once so the storefront reads identical data from real rows afterwards. Safe to
 * re-run: everything is upserted on natural keys.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { getDb, initDb } from "./client";
import { and, eq } from "drizzle-orm";
import * as t from "./schema";
import {
  seedAuthors as mockAuthors,
  seedCategories as mockCategories,
  seedCollections as mockCollections,
  seedCoupons as mockCoupons,
  seedCustomers as mockCustomers,
  seedOrders as mockOrders,
  seedProducts as mockProducts,
  seedReviews as mockReviews,
} from "../../src/data/seed-catalog";
import { posts as mockPosts } from "../../src/data/catalog";
import { hashPassword } from "../lib/crypto";
import { seedPages } from "../lib/page-content";

const now = () => new Date();

/** rating 4.9 -> 49 */
const rate10 = (n: number) => Math.round(n * 10);

/**
 * Every seeded product ships a real, tiny source package so the download path
 * is exercisable end to end without the user uploading anything. The archive is
 * a valid ZIP with a README and a licence stub.
 */
async function seedSourceArchives(log = true) {
  const db = getDb();
  const say = (msg: string) => log && console.log(`  ${msg}`);
  const { put, storageKey } = await import("../lib/storage");
  const products = await db.select().from(t.products).where(eq(t.products.status, "published"));

  for (const product of products) {
    const existing = await db
      .select({ id: t.productFiles.id })
      .from(t.productFiles)
      .where(and(eq(t.productFiles.productId, product.id), eq(t.productFiles.kind, "source_zip")))
      .limit(1);
    if (existing.length) continue;

    const readme = [
      `${product.name}`,
      "=".repeat(product.name.length),
      "",
      product.tagline,
      "",
      `Version ${product.version}`,
      "Licensed for use under the terms shown at checkout.",
      "",
      "Getting started",
      "---------------",
      "  1. unzip the archive",
      "  2. npm install",
      "  3. npm run dev",
      "",
      "This is the demo package generated for the storefront preview.",
      "",
    ].join("\n");

    const files: { name: string; data: string }[] = [
      { name: "README.md", data: readme },
      { name: "LICENSE.txt", data: `Kiln licence — ${product.license}\n` },
      { name: "package.json", data: JSON.stringify({ name: product.slug, version: product.version, private: true }, null, 2) },
      { name: "src/index.ts", data: `// ${product.name}\nexport const version = "${product.version}";\n` },
    ];

    const zip = makeZip(files);
    const key = storageKey("source_zip", `${product.slug}-${product.version}.zip`, product.id);
    const written = await put(key, zip);

    await db.insert(t.productFiles).values({
      productId: product.id,
      kind: "source_zip",
      storageKey: key,
      originalName: `${product.slug}-${product.version}.zip`,
      mimeType: "application/zip",
      bytes: written.bytes,
      checksum: written.checksum,
    });
  }

  if (log) say(`source archive for ${products.length} products`);
}

/** Minimal store-only ZIP writer (no deps, no compression). */
function makeZip(files: { name: string; data: string }[]): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const data = Buffer.from(file.data, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);

    chunks.push(local, name, data);
    central.push(cd, name);
    offset += local.length + name.length + data.length;
  }

  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, cdBuf, end]);
}

let crcTable: number[] | null = null;
function crc32(buf: Buffer): number {
  if (!crcTable) {
    crcTable = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export async function seed({ log = true, force = false }: { log?: boolean; force?: boolean } = {}) {
  await initDb();
  const db = getDb();
  const say = (m: string) => log && console.log(`  ${m}`);

  const counts = await db.execute<{ products: number; categories: number }>(sql`
    select (select count(*)::int from products) as products,
           (select count(*)::int from categories) as categories
  `);
  const productCount = Number(counts.rows[0]?.products ?? 0);
  const categoryCount = Number(counts.rows[0]?.categories ?? 0);

  // A half-written catalogue (products present, categories missing) means an
  // earlier run died mid-way. Demo data is disposable, so clear and re-seed
  // rather than leaving the storefront with dangling references.
  const partial = productCount > 0 && categoryCount === 0;
  if (partial || force) {
    say(force ? "force re-seed requested — clearing demo data" : "found a partial seed — clearing demo data");
    await db.execute(sql`
      truncate table
        downloads, licenses, payments, order_items, orders,
        reviews, collection_items, collections, pricing_tiers,
        product_versions, product_files, products, categories, authors, coupons,
        homepage_sections, announcements, activity_log, bundles
      restart identity cascade
    `);
  } else if (productCount > 0 && categoryCount > 0) {
    say("catalogue already seeded — skipping demo data");
    await seedDeveloperTiers(log);
    await seedSourceArchives(log);
    await seedAdmin(log);
    return;
  }

  /* ------------------------------------------------------------ categories */
  const catIdBySlug = new Map<string, string>();
  for (const [i, c] of mockCategories.entries()) {
    const [row] = await db
      .insert(t.categories)
      .values({
        slug: c.slug,
        name: c.name,
        blurb: c.blurb,
        from: c.from,
        to: c.to,
        glyph: c.glyph,
        // the catalogue carries a cover per category; dropping it here left every
        // category tile on its gradient fallback even after the artwork existed
        imagePath: c.src ?? null,
        position: i,
      })
      .returning({ id: t.categories.id });
    catIdBySlug.set(c.slug, row.id);
  }
  say(`${mockCategories.length} categories`);

  /* --------------------------------------------------------------- authors */
  const authorIdBySlug = new Map<string, string>();
  for (const a of mockAuthors) {
    const [row] = await db
      .insert(t.authors)
      .values({
        slug: a.slug,
        name: a.name,
        role: a.role,
        bio: a.bio,
        verified: a.verified,
        avatar: a.avatar,
        items: a.items,
        sales: a.sales,
        rating: rate10(a.rating),
        joined: a.joined,
        location: a.location,
        links: a.links,
      })
      .returning({ id: t.authors.id });
    authorIdBySlug.set(a.slug, row.id);
  }
  say(`${mockAuthors.length} authors`);

  /* -------------------------------------------------------------- products */
  const productIdBySlug = new Map<string, string>();
  for (const [i, p] of mockProducts.entries()) {
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
        tags: [],
        status: p.status,
        price: p.price,
        compareAt: p.compareAt ?? null,
        free: p.free,
        featured: p.featured,
        trending: p.trending,
        isNew: p.new,
        bestseller: p.bestseller,
        license: p.license,
        rating: rate10(p.rating),
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
        position: i,
        publishedAt: p.status === "published" ? now() : null,
      })
      .returning({ id: t.products.id });
    productIdBySlug.set(p.slug, row.id);

    // pricing tiers
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

    // versions from the changelog, newest flagged current
    if (p.changelog.length) {
      await db.insert(t.productVersions).values(
        p.changelog.map((c, ci) => ({
          productId: row.id,
          version: c.version,
          notes: c.notes,
          releasedAt: c.date,
          isCurrent: ci === 0,
        })),
      );
    }
  }
  say(`${mockProducts.length} products with tiers and versions`);

  /* ----------------------------------------------------------- collections */
  for (const [i, c] of mockCollections.entries()) {
    const [row] = await db
      .insert(t.collections)
      .values({ slug: c.slug, name: c.name, blurb: c.blurb, from: c.from, to: c.to })
      .returning({ id: t.collections.id });
    const items = c.products
      .map((slug, pos) => ({ collectionId: row.id, productId: productIdBySlug.get(slug), position: pos }))
      .filter((x): x is { collectionId: string; productId: string; position: number } => Boolean(x.productId));
    if (items.length) await db.insert(t.collectionItems).values(items);
    void i;
  }
  say(`${mockCollections.length} collections`);

  /* --------------------------------------------------------------- reviews */
  for (const r of mockReviews) {
    const pid = productIdBySlug.get(r.productSlug);
    if (!pid) continue;
    await db.insert(t.reviews).values({
      productId: pid,
      author: r.author,
      initials: r.initials,
      rating: r.rating,
      title: r.title,
      body: r.body,
      helpful: r.helpful,
      verified: r.verified,
      status: "published",
      createdAt: new Date(r.date),
    });
  }
  say(`${mockReviews.length} reviews`);

  /* -------------------------------------------------------------- coupons */
  for (const c of mockCoupons) {
    await db.insert(t.coupons).values({
      code: c.code,
      kind: c.kind,
      value: c.value,
      uses: c.uses,
      limit: c.limit,
      expiresAt: new Date(c.expires),
      active: c.status === "active",
    });
  }
  say(`${mockCoupons.length} coupons`);

  /* ------------------------------------------------- customers + orders */
  const demoPassword = await hashPassword("demo1234");
  const customerIdByEmail = new Map<string, string>();
  for (const c of mockCustomers) {
    const [row] = await db
      .insert(t.users)
      .values({
        email: c.email,
        passwordHash: demoPassword,
        name: c.name,
        role: "customer",
        status: c.status === "suspended" ? "suspended" : "active",
        emailVerifiedAt: c.status === "invited" ? null : now(),
        country: c.country,
        createdAt: new Date(c.joined),
      })
      .onConflictDoNothing()
      .returning({ id: t.users.id });
    if (row) {
      customerIdByEmail.set(c.email, row.id);
    } else {
      /**
       * The account survived a re-seed (users are deliberately kept). Without
       * this lookup every historical order would be written with a null buyer
       * and the admin dashboard would show a store that nobody bought from.
       */
      const [existing] = await db
        .select({ id: t.users.id })
        .from(t.users)
        .where(eq(sql`lower(${t.users.email})`, c.email.toLowerCase()))
        .limit(1);
      if (existing) customerIdByEmail.set(c.email, existing.id);
    }
  }

  /**
   * Spread the sample orders across the sample customers.
   *
   * Attaching every historical order to the first customer made the dashboard
   * look like a single account bought the whole store, and every "recent order"
   * row showed the same name.
   */
  for (const [idx, o] of mockOrders.entries()) {
    const buyer = mockCustomers[idx % Math.max(1, mockCustomers.length)];
    const email = buyer?.email ?? "buyer@example.com";
    const userId = customerIdByEmail.get(email) ?? null;
    const status = o.status === "completed" ? "paid" : o.status === "refunded" ? "refunded" : "pending";
    const [order] = await db
      .insert(t.orders)
      .values({
        number: o.id,
        userId,
        email,
        name: buyer?.name ?? "Customer",
        status,
        subtotal: o.total,
        discount: 0,
        tax: 0,
        total: o.total,
        country: buyer?.country ?? "Portugal",
        createdAt: new Date(o.date),
      })
      .returning({ id: t.orders.id });

    for (const item of o.items) {
      const p = mockProducts.find((x) => x.slug === item.productSlug);
      await db.insert(t.orderItems).values({
        orderId: order.id,
        productId: productIdBySlug.get(item.productSlug) ?? null,
        productName: p?.name ?? item.productSlug,
        productSlug: item.productSlug,
        license: item.license,
        unitPrice: item.price,
      });
      if (status === "paid" && userId) {
        const pid = productIdBySlug.get(item.productSlug);
        if (pid) {
          await db
            .insert(t.licenses)
            .values({
              userId,
              productId: pid,
              license: item.license,
              orderId: order.id,
              status: "active",
              grantedBy: "purchase",
            })
            .onConflictDoNothing();
        }
      }
    }

    await db.insert(t.payments).values({
      orderId: order.id,
      provider: "stripe",
      mode: "demo",
      status: status === "paid" ? "succeeded" : status === "refunded" ? "refunded" : "pending",
      amount: o.total,
      reference: `pi_demo_${o.id.replace(/\W/g, "")}`,
    });
  }
  say(`${mockCustomers.length} customers, ${mockOrders.length} orders`);

  /* ------------------------------------------------------------ free grants */
  const freeRow = await db.select({ id: t.products.id }).from(t.products).where(sql`free = true`).limit(1);
  if (freeRow[0] && customerIdByEmail.size) {
    for (const uid of customerIdByEmail.values()) {
      await db
        .insert(t.licenses)
        .values({ userId: uid, productId: freeRow[0].id, status: "active", grantedBy: "free", license: "personal" })
        .onConflictDoNothing();
    }
  }

  /* ---------------------------------------------------------------- content */
  await seedPages(log);

  for (const [i, post] of mockPosts.entries()) {
    await db
      .insert(t.pages)
      .values({
        slug: post.slug,
        title: post.title,
        kind: "page",
        body: post.excerpt,
        excerpt: post.excerpt,
        category: post.category,
        readMinutes: post.read,
        status: "published",
        from: post.from,
        to: post.to,
        position: i,
        publishedAt: post.date,
      })
      .onConflictDoNothing();
  }

  // homepage sections mirror the built storefront
  const sections = [
    ["hero", "Hero banner"],
    ["promise", "Promise strip"],
    ["categories", "Category grid"],
    ["trending", "Popular this week"],
    ["promo", "Promo pair"],
    ["collection", "Featured collection"],
    ["free", "Free collection"],
    ["studio", "Studio editorial"],
    ["journal", "Journal"],
    ["faq", "FAQ + newsletter"],
  ] as const;
  for (const [i, [key, label]] of sections.entries()) {
    await db
      .insert(t.homepageSections)
      .values({ key, label, enabled: true, position: i, config: {} })
      .onConflictDoNothing();
  }

  const existingAnnouncement = await db.select({ id: t.announcements.id }).from(t.announcements).limit(1);
  if (!existingAnnouncement.length) {
    await db.insert(t.announcements).values({
      text: "New drop: Ledger — Billing Engine v1.1 — usage metering, invoices and dunning.",
      href: "/item/ledger-billing",
      active: true,
      position: 0,
    });
  }

  const defaults: Record<string, unknown> = {
    store: {
      name: "Kiln",
      tagline: "Source code, maintained by the people who wrote it.",
      supportEmail: "support@kiln.dev",
      currency: "USD",
      vatRate: 0.075,
    },
    hero: {
      headline: "Production-ready code you can read.",
      sub: "Starters, dashboards and developer tools from a three-person studio.",
      primaryCta: "Browse all code",
      primaryHref: "/browse",
      secondaryCta: "See free items",
      secondaryHref: "/free",
    },
  };
  for (const [key, value] of Object.entries(defaults)) {
    await db.insert(t.settings).values({ key, value }).onConflictDoNothing();
  }

  await db.insert(t.activityLog).values({
    actor: "System",
    action: "seeded the catalogue",
    target: `${mockProducts.length} products`,
    kind: "settings",
  });

  // A starter bundle, so the storefront, checkout and the admin screen all
  // have real data to work with on a fresh install.
  const starterSlugs = ["lattice-admin", "relay-api", "gatehouse-auth"];
  const starterProducts = await db
    .select({ id: t.products.id, slug: t.products.slug, price: t.products.price })
    .from(t.products);
  const picked = starterSlugs
    .map((slug) => starterProducts.find((p) => p.slug === slug))
    .filter((p): p is { id: string; slug: string; price: number } => Boolean(p));
  if (picked.length && !(await db.select().from(t.bundles).limit(1)).length) {
    const separate = picked.reduce((n, p) => n + p.price, 0);
    const [bundle] = await db
      .insert(t.bundles)
      .values({
        slug: "full-stack-launch",
        name: "Full-stack Launch Kit",
        tagline: "Admin console, API and auth — the whole back office in one buy.",
        description:
          "Three products that are designed to run together: a data-dense admin console, a typed API layer and passwordless authentication. Buy them as a set and save against the individual prices.",
        // 35% off, rounded to the nearest dollar.
        price: Math.round((separate * 0.65) / 100) * 100,
        compareAt: separate,
        license: "personal",
        featured: true,
        artFrom: "#1d2b3a",
        artTo: "#3f6b8f",
      })
      .returning();
    await db.insert(t.bundleItems).values(
      picked.map((p, i) => ({ bundleId: bundle.id, productId: p.id, position: i })),
    );
    say("starter bundle");
  }

  say("content, homepage sections and settings");
  await seedDeveloperTiers(log);
  await seedSourceArchives(log);
  await seedAdmin(log);
  if (log) console.log("Seed complete.");
}

/**
 * Ensure every product has a developer / agency tier.
 *
 * Seeded products only carry personal/commercial/extended rows. Without a
 * developer row the storefront falls back to the personal price while checkout
 * — which scales the shelf price — charges more, and the ladder in the licence
 * picker skips a rung. Idempotent, so it is safe on every boot and on existing
 * catalogues.
 *
 * Price derives from the extended tier (1.35x, rounded to the nearest $10),
 * which keeps the ladder sensible without hand-tuning sixteen products.
 */
export async function seedDeveloperTiers(log = true) {
  const db = getDb();
  const products = await db.select().from(t.products);
  let created = 0;
  for (const product of products) {
    const tiers = await db.select().from(t.pricingTiers).where(eq(t.pricingTiers.productId, product.id));
    if (!tiers.length || tiers.some((x) => x.license === "developer")) continue;
    const extended = tiers.find((x) => x.license === "extended") ?? tiers.find((x) => x.license === "commercial");
    const base = extended?.price ?? Math.round(product.price * 2);
    const price = product.free ? 0 : Math.round((base * 1.35) / 1000) * 1000;
    await db.insert(t.pricingTiers).values({
      productId: product.id,
      license: "developer",
      name: "Developer / Agency",
      price,
      compareAt: null,
      summary: "Use it across every client project your studio ships.",
      seats: "Unlimited seats, unlimited client sites",
      includes: ["Unlimited client projects", "Unlimited seats", "Priority support", "Client-facing certificate"],
      popular: false,
      position: 3,
    });
    created++;
  }
  if (created && log) console.log(`  ${created} developer tiers created`);
  return created;
}

/**
 * The owner account. Credentials come from the environment so no password is
 * committed; the defaults are clearly marked as development-only.
 */
export async function seedAdmin(log = true) {
  await initDb();
  const db = getDb();
  const email = (process.env.OWNER_EMAIL ?? "owner@kiln.dev").toLowerCase();
  const password = process.env.OWNER_PASSWORD ?? "kiln-owner-demo-2026";

  const existing = await db.execute<{ n: number }>(
    sql`select count(*)::int as n from users where role in ('owner','admin')`,
  );
  if (Number(existing.rows[0]?.n ?? 0) > 0) {
    if (log) console.log("  owner account already exists");
    return;
  }

  await db.insert(t.users).values({
    email,
    passwordHash: await hashPassword(password),
    name: "Kiln Owner",
    role: "owner",
    status: "active",
    emailVerifiedAt: now(),
    country: "Portugal",
  });
  if (log) {
    console.log(`\n  Owner account created`);
    console.log(`    email:    ${email}`);
    console.log(`    password: ${password}`);
    console.log(`  (override with OWNER_EMAIL / OWNER_PASSWORD; 2FA is set up on first login)\n`);
  }
}

/**
 * Run only when this file is the entry point.
 *
 * Filename matching is wrong twice over: `reseed.ts` contains "seed.ts" so
 * `endsWith` matched it, and `basename` matches the wrapper at
 * server/scripts/seed.ts too. Either way the import fired a second, competing
 * seed. Compare resolved paths.
 */
const isEntryPoint =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  seed()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

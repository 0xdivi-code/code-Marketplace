/**
 * Kiln database schema — PostgreSQL (Drizzle ORM).
 *
 * Run against PGlite in development (embedded Postgres 18) and against a real
 * Postgres server in production by changing DATABASE_URL. Nothing here is
 * provider-specific, so the schema ports unchanged.
 */
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
  numeric,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/* ------------------------------------------------------------------ helpers */
const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/* -------------------------------------------------------------------- users */

/**
 * Customers and admins share one table so a single email can never exist twice.
 * `role` gates the admin panel; only the owner account has role = "owner".
 */
export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    /** scrypt: "scrypt$N$r$p$salt$hash" — never store plaintext */
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: text("role", { enum: ["customer", "admin", "owner"] })
      .notNull()
      .default("customer"),
    status: text("status", { enum: ["active", "suspended"] })
      .notNull()
      .default("active"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    /** admin 2FA */
    totpSecret: text("totp_secret"),
    totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
    /** hashed single-use recovery codes */
    recoveryCodes: jsonb("recovery_codes").$type<string[]>().default([]),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    country: text("country"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_key").on(sql`lower(${t.email})`)],
);

/** Opaque server-side sessions. The cookie holds a random token; the row holds its hash. */
export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    /** "customer" | "admin" — admin sessions are shorter lived */
    scope: text("scope", { enum: ["customer", "admin"] }).notNull().default("customer"),
    userAgent: text("user_agent"),
    ip: text("ip"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("sessions_token_key").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
  ],
);

/** Email verification + password reset tokens (single use, hashed at rest). */
export const authTokens = pgTable(
  "auth_tokens",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["verify_email", "reset_password", "admin_2fa_challenge"] }).notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("auth_tokens_token_key").on(t.tokenHash), index("auth_tokens_user_idx").on(t.userId)],
);

/* ---------------------------------------------------------------- catalogue */

export const categories = pgTable(
  "categories",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    blurb: text("blurb").notNull().default(""),
    parentId: text("parent_id"),
    from: text("from").notNull().default("#17392b"),
    to: text("to").notNull().default("#3d7a58"),
    glyph: text("glyph").notNull().default("layers"),
    imagePath: text("image_path"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("categories_slug_key").on(t.slug), index("categories_parent_idx").on(t.parentId)],
);

/** The studio that authored the code. Single-owner store, but products reference one. */
export const authors = pgTable(
  "authors",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull().default(""),
    bio: text("bio").notNull().default(""),
    verified: boolean("verified").notNull().default(false),
    avatar: text("avatar").notNull().default("KS"),
    avatarPath: text("avatar_path"),
    items: integer("items").notNull().default(0),
    sales: integer("sales").notNull().default(0),
    rating: integer("rating").notNull().default(0), // stored x10 (48 = 4.8)
    joined: text("joined").notNull().default(""),
    location: text("location").notNull().default(""),
    links: jsonb("links").$type<{ label: string; href: string }[]>().default([]),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("authors_slug_key").on(t.slug)],
);

export const products = pgTable(
  "products",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    tagline: text("tagline").notNull().default(""),
    description: text("description").notNull().default(""),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    authorId: text("author_id").references(() => authors.id, { onDelete: "set null" }),
    stack: jsonb("stack").$type<string[]>().notNull().default([]),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    /** published | draft | review | archived */
    status: text("status", { enum: ["published", "draft", "review", "archived"] })
      .notNull()
      .default("draft"),
    /** integer cents */
    price: integer("price").notNull().default(0),
    compareAt: integer("compare_at"),
    /** time-boxed sale price in cents; effective price is the lower of this and `price` */
    salePrice: integer("sale_price"),
    saleEndsAt: timestamp("sale_ends_at", { withTimezone: true }),
    free: boolean("free").notNull().default(false),
    featured: boolean("featured").notNull().default(false),
    trending: boolean("trending").notNull().default(false),
    isNew: boolean("new").notNull().default(false),
    bestseller: boolean("bestseller").notNull().default(false),
    license: text("license").notNull().default("Regular"),
    /** rating x10 so 4.9 == 49 */
    rating: integer("rating").notNull().default(0),
    reviews: integer("reviews").notNull().default(0),
    sales: integer("sales").notNull().default(0),
    views: integer("views").notNull().default(0),
    version: text("version").notNull().default("1.0.0"),
    released: text("released").notNull().default(""),
    updated: text("updated").notNull().default(""),
    // art direction — gradient fallback + optional uploaded cover
    artFrom: text("art_from").notNull().default("#17392b"),
    artTo: text("art_to").notNull().default("#3d7a58"),
    artInk: text("art_ink").notNull().default("#eef4e9"),
    artKind: text("art_kind").notNull().default("window"),
    coverPath: text("cover_path"),
    gallery: jsonb("gallery").$type<{ id: string; caption: string; path: string }[]>().default([]),
    features: jsonb("features").$type<{ title: string; body: string }[]>().default([]),
    highlights: jsonb("highlights").$type<string[]>().default([]),
    includes: jsonb("includes").$type<string[]>().default([]),
    requirements: jsonb("requirements").$type<string[]>().default([]),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    position: integer("position").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("products_slug_key").on(t.slug),
    index("products_status_idx").on(t.status),
    index("products_category_idx").on(t.categoryId),
  ],
);

export const productVersions = pgTable(
  "product_versions",
  {
    id: id(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    notes: jsonb("notes").$type<string[]>().default([]),
    releasedAt: text("released_at").notNull().default(""),
    /** latest published version — only one is flagged at a time */
    isCurrent: boolean("is_current").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("product_versions_unique").on(t.productId, t.version),
    index("product_versions_product_idx").on(t.productId),
  ],
);

/** One row per uploaded file. Storage is private; bytes never sit under /public. */
export const productFiles = pgTable(
  "product_files",
  {
    id: id(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    versionId: text("version_id").references(() => productVersions.id, { onDelete: "set null" }),
    kind: text("kind", { enum: ["source_zip", "image", "document"] }).notNull().default("source_zip"),
    /** opaque storage key — never a public URL */
    storageKey: text("storage_key").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    bytes: integer("bytes").notNull().default(0),
    /** sha256 of contents, verified after upload */
    checksum: text("checksum").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("product_files_product_idx").on(t.productId)],
);

export const pricingTiers = pgTable(
  "pricing_tiers",
  {
    id: id(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    license: text("license", { enum: ["personal", "commercial", "extended", "developer"] }).notNull(),
    name: text("name").notNull(),
    price: integer("price").notNull().default(0),
    compareAt: integer("compare_at"),
    summary: text("summary").notNull().default(""),
    seats: text("seats").notNull().default(""),
    includes: jsonb("includes").$type<string[]>().default([]),
    popular: boolean("popular").notNull().default(false),
    position: integer("position").notNull().default(0),
  },
  (t) => [uniqueIndex("pricing_tiers_unique").on(t.productId, t.license)],
);

/** What a customer is licensed to download, independent of the order that granted it. */
export const licenses = pgTable(
  "licenses",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    license: text("license", { enum: ["personal", "commercial", "extended", "developer"] }).notNull(),
    orderId: text("order_id"),
    status: text("status", { enum: ["active", "revoked"] }).notNull().default("active"),
    grantedBy: text("granted_by", { enum: ["purchase", "manual", "free"] }).notNull().default("purchase"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: text("revoked_reason"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("licenses_unique").on(t.userId, t.productId),
    index("licenses_user_idx").on(t.userId),
  ],
);

/* -------------------------------------------------------------------- sales */

export const orders = pgTable(
  "orders",
  {
    id: id(),
    /** human-facing reference, e.g. KL-10482 */
    number: text("number").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    name: text("name").notNull().default(""),
    status: text("status", { enum: ["pending", "paid", "refunded", "cancelled"] })
      .notNull()
      .default("pending"),
    subtotal: integer("subtotal").notNull().default(0),
    discount: integer("discount").notNull().default(0),
    tax: integer("tax").notNull().default(0),
    total: integer("total").notNull().default(0),
    currency: text("currency").notNull().default("USD"),
    couponCode: text("coupon_code"),
    /** quoted to support, and printed on the certificate */
    reference: text("reference"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    refundReason: text("refund_reason"),
    /** set by the client so a retried submit cannot double-charge */
    idempotencyKey: text("idempotency_key"),
    country: text("country"),
    vatNumber: text("vat_number"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("orders_number_key").on(t.number), index("orders_user_idx").on(t.userId)],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
    /** set when the line was bought as part of a bundle rather than alone */
    bundleId: text("bundle_id").references(() => bundles.id, { onDelete: "set null" }),
    /** snapshot so history survives a deleted product */
    productName: text("product_name").notNull(),
    productSlug: text("product_slug").notNull(),
    license: text("license", { enum: ["personal", "commercial", "extended", "developer"] }).notNull(),
    unitPrice: integer("unit_price").notNull().default(0),
    /** share of the order discount applied to this line, in cents */
    discount: integer("discount").notNull().default(0),
    quantity: integer("quantity").notNull().default(1),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider", {
      enum: ["stripe", "paypal", "bank", "manual", "nowpayments", "crypto_manual", "free"],
    })
      .notNull()
      .default("nowpayments"),
    mode: text("mode", { enum: ["live", "test", "demo"] }).notNull().default("test"),
    status: text("status", {
      enum: [
        "pending",
        "waiting",
        "confirming",
        "succeeded",
        "partially_paid",
        "failed",
        "expired",
        "refunded",
      ],
    })
      .notNull()
      .default("pending"),
    amount: integer("amount").notNull().default(0),
    fee: integer("fee").notNull().default(0),
    reference: text("reference"),
    /** provider-side id, the join key for webhooks */
    providerRef: text("provider_ref"),
    payCurrency: text("pay_currency"),
    payAmount: numeric("pay_amount", { precision: 24, scale: 10 }),
    payAddress: text("pay_address"),
    payinHash: text("payin_hash"),
    network: text("network"),
    actuallyPaid: numeric("actually_paid", { precision: 24, scale: 10 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    invoiceUrl: text("invoice_url"),
    /** the provider's own word for the status, kept verbatim for debugging */
    rawStatus: text("raw_status"),
    updatedAt: updatedAt(),
    createdAt: createdAt(),
  },
  (t) => [index("payments_order_idx").on(t.orderId)],
);

/** Every signed download, for audit + abuse limits. */
export const downloads = pgTable(
  "downloads",
  {
    id: id(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
    fileId: text("file_id").references(() => productFiles.id, { onDelete: "set null" }),
    version: text("version"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("downloads_user_idx").on(t.userId), index("downloads_product_idx").on(t.productId)],
);

/* -------------------------------------------------- crypto payment sessions */

/**
 * One hosted-invoice attempt. An order can be retried in a different coin
 * without destroying the audit trail, so sessions are append-only.
 */
export const paymentSessions = pgTable(
  "payment_sessions",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("nowpayments"),
    mode: text("mode").notNull().default("test"),
    payCurrency: text("pay_currency").notNull(),
    network: text("network"),
    /** cents, always in `priceCurrency` */
    priceAmount: integer("price_amount").notNull(),
    priceCurrency: text("price_currency").notNull().default("usd"),
    payAmount: numeric("pay_amount", { precision: 24, scale: 10 }),
    payAddress: text("pay_address"),
    invoiceUrl: text("invoice_url"),
    providerRef: text("provider_ref"),
    purchaseId: text("purchase_id"),
    status: text("status").notNull().default("waiting"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("payment_sessions_order_idx").on(t.orderId)],
);

/** Every inbound webhook, including forgeries. The dedupe key makes replays safe. */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: id(),
    provider: text("provider").notNull(),
    eventKey: text("event_key"),
    signatureOk: boolean("signature_ok").notNull().default(false),
    status: text("status"),
    orderNumber: text("order_number"),
    paymentRef: text("payment_ref"),
    payload: jsonb("payload").$type<unknown>(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("webhook_events_dedupe").on(t.provider, t.eventKey),
    index("webhook_events_created_idx").on(t.createdAt),
  ],
);

/** Expiring, capped download links issued per request rather than per page load. */
export const downloadTokens = pgTable(
  "download_tokens",
  {
    id: id(),
    tokenHash: text("token_hash").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => products.id, { onDelete: "cascade" }),
    fileId: text("file_id").references(() => productFiles.id, { onDelete: "set null" }),
    version: text("version"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    maxUses: integer("max_uses").notNull().default(3),
    uses: integer("uses").notNull().default(0),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("download_tokens_hash").on(t.tokenHash), index("download_tokens_user_idx").on(t.userId)],
);

/** Editable licence headings — terms are shown before checkout. */
export const licenseTerms = pgTable("license_terms", {
  id: id(),
  license: text("license").notNull().unique(),
  name: text("name").notNull(),
  summary: text("summary").notNull().default(""),
  terms: text("terms").notNull().default(""),
  seats: text("seats").notNull().default(""),
  position: integer("position").notNull().default(0),
  active: boolean("active").notNull().default(true),
  updatedAt: updatedAt(),
});

export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    author: text("author").notNull(),
    initials: text("initials").notNull().default(""),
    rating: integer("rating").notNull().default(5),
    title: text("title").notNull().default(""),
    body: text("body").notNull().default(""),
    helpful: integer("helpful").notNull().default(0),
    verified: boolean("verified").notNull().default(false),
    /** pending | published | rejected */
    status: text("status", { enum: ["pending", "published", "rejected"] })
      .notNull()
      .default("published"),
    createdAt: createdAt(),
  },
  (t) => [index("reviews_product_idx").on(t.productId)],
);

export const coupons = pgTable(
  "coupons",
  {
    id: id(),
    code: text("code").notNull(),
    kind: text("kind", { enum: ["percent", "fixed"] }).notNull().default("percent"),
    /** percent (0-100) or cents */
    value: integer("value").notNull().default(0),
    uses: integer("uses").notNull().default(0),
    limit: integer("limit").notNull().default(100),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
    /** scope: blank means the whole cart */
    productSlug: text("product_slug"),
    categorySlug: text("category_slug"),
    minSubtotal: integer("min_subtotal").notNull().default(0),
    oncePerCustomer: boolean("once_per_customer").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("coupons_code_key").on(sql`upper(${t.code})`)],
);

/* ------------------------------------------------------------------ content */

/**
 * A bundle: several products sold together for less than the sum of their
 * tiers. Deliberately flat — a bundle has its own price and its own coupon
 * scope, and buying it grants one licence per member product.
 */
export const bundles = pgTable(
  "bundles",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    tagline: text("tagline").notNull().default(""),
    description: text("description").notNull().default(""),
    /** cents; what the bundle costs */
    price: integer("price").notNull().default(0),
    /** cents; the sum of member personal prices, for the struck-through figure */
    compareAt: integer("compare_at"),
    /** which licence tier the bundle grants */
    license: text("license", { enum: ["personal", "commercial", "extended", "developer"] })
      .notNull()
      .default("personal"),
    active: boolean("active").notNull().default(true),
    featured: boolean("featured").notNull().default(false),
    artFrom: text("art_from").notNull().default("#17392b"),
    artTo: text("art_to").notNull().default("#3d7a58"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("bundles_slug_key").on(t.slug)],
);

export const bundleItems = pgTable(
  "bundle_items",
  {
    id: id(),
    bundleId: text("bundle_id")
      .notNull()
      .references(() => bundles.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [uniqueIndex("bundle_items_unique").on(t.bundleId, t.productId)],
);

export const collections = pgTable(
  "collections",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    blurb: text("blurb").notNull().default(""),
    from: text("from").notNull().default("#17392b"),
    to: text("to").notNull().default("#4b8a64"),
    imagePath: text("image_path"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("collections_slug_key").on(t.slug)],
);

export const collectionItems = pgTable(
  "collection_items",
  {
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.productId] })],
);

/** Homepage builder: ordered, toggleable sections. */
export const homepageSections = pgTable("homepage_sections", {
  id: id(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  position: integer("position").notNull().default(0),
  /** per-section editable copy */
  config: jsonb("config").$type<Record<string, unknown>>().default({}),
  updatedAt: updatedAt(),
});

export const announcements = pgTable("announcements", {
  id: id(),
  text: text("text").notNull(),
  href: text("href"),
  active: boolean("active").notNull().default(false),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
});

/** Editable static pages, FAQ entries and policies. */
export const pages = pgTable(
  "pages",
  {
    id: id(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    kind: text("kind", { enum: ["page", "policy", "faq"] }).notNull().default("page"),
    body: text("body").notNull().default(""),
    excerpt: text("excerpt").notNull().default(""),
    category: text("category").notNull().default(""),
    readMinutes: integer("read_minutes").notNull().default(4),
    status: text("status", { enum: ["published", "draft"] }).notNull().default("published"),
    imagePath: text("image_path"),
    from: text("from").notNull().default("#17392b"),
    to: text("to").notNull().default("#4b8a64"),
    position: integer("position").notNull().default(0),
    publishedAt: text("published_at").notNull().default(""),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("pages_slug_key").on(t.slug)],
);

/** Single row of site-wide settings (key/value keeps it flexible). */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: updatedAt(),
});

/** Marker table so seeding is idempotent. */
export const seedState = pgTable("seed_state", {
  key: text("key").primaryKey(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activityLog = pgTable(
  "activity_log",
  {
    id: id(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    actor: text("actor").notNull().default("System"),
    action: text("action").notNull(),
    target: text("target").notNull().default(""),
    kind: text("kind", {
      enum: ["product", "order", "customer", "settings", "content", "promo", "auth", "payment", "download", "refund"],
    })
      .notNull()
      .default("settings"),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("activity_created_idx").on(t.createdAt)],
);

/* ----------------------------------------------------------------- relations */

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  orders: many(orders),
  licenses: many(licenses),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  author: one(authors, { fields: [products.authorId], references: [authors.id] }),
  versions: many(productVersions),
  files: many(productFiles),
  tiers: many(pricingTiers),
  reviews: many(reviews),
}));

export const ordersRelations = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  payments: many(payments),
  user: one(users, { fields: [orders.userId], references: [users.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductRow = typeof products.$inferInsert;

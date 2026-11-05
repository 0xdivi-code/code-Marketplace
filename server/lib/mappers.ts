/**
 * Row → view-model mappers.
 *
 * The Step 1 UI is typed against the interfaces in src/data/types.ts. These
 * functions translate database rows into exactly those shapes so not a single
 * component has to be rewritten — the API simply replaces the mock module.
 */
import type {
  Product as ProductRow,
  Category as CategoryRow,
  Author as AuthorRow,
  Review as ReviewRow,
  CollectionRow,
  OrderRow,
  OrderItemRow,
  User as UserRow,
  Coupon as CouponRow,
} from "./types";
import type {
  Product,
  Category,
  Author,
  Review,
  Collection,
  Order,
  Customer,
  Coupon,
  ArtKind,
  License,
} from "@/data/types";

/** Rating is stored x10 (48 => 4.8) to avoid float drift. */
const rating = (v: number) => Math.round(v) / 10;

export function toCategory(c: CategoryRow): Category {
  return {
    slug: c.slug,
    name: c.name,
    blurb: c.blurb,
    from: c.from,
    to: c.to,
    glyph: c.glyph,
    parent: c.parentId ?? undefined,
    src: c.imagePath ?? undefined,
  };
}

export function toAuthor(a: AuthorRow): Author {
  return {
    slug: a.slug,
    name: a.name,
    role: a.role,
    bio: a.bio,
    verified: a.verified,
    avatar: a.avatar,
    items: a.items,
    sales: a.sales,
    rating: rating(a.rating),
    joined: a.joined,
    location: a.location,
    links: a.links ?? [],
  };
}

interface ProductExtras {
  tiers: { license: License; name: string; price: number; compareAt: number | null; summary: string; seats: string; includes: string[]; popular: boolean }[];
  versions: { version: string; notes: string[]; releasedAt: string }[];
}

export function toProduct(p: ProductRow, extras: ProductExtras): Product {
  const tiers = extras.tiers.length
    ? extras.tiers
        .slice()
        .sort((a, b) => a.price - b.price)
        .map((t) => ({
          license: t.license,
          name: t.name,
          price: t.price,
          compareAt: t.compareAt ?? undefined,
          summary: t.summary,
          seats: t.seats,
          includes: t.includes ?? [],
          popular: t.popular,
        }))
    : // never let a product render without a purchasable tier
      [
        {
          license: "personal" as License,
          name: "Personal",
          price: p.price,
          compareAt: p.compareAt ?? undefined,
          summary: "For your own projects and learning.",
          seats: "1 developer · 1 end product",
          includes: ["Full source code", "1 year of updates"],
          popular: false,
        },
      ];

  const gallery = (p.gallery ?? []).map((g) => ({
    id: g.id,
    caption: g.caption,
    from: p.artFrom,
    to: p.artTo,
    ink: p.artInk,
    kind: p.artKind as ArtKind,
    src: g.path ?? undefined,
  }));

  return {
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    category: p.categorySlug ?? p.categoryId ?? "",
    stack: p.stack ?? [],
    status: p.status,
    price: p.price,
    compareAt: p.compareAt ?? undefined,
    salePrice: p.salePrice ?? undefined,
    saleEndsAt: p.saleEndsAt ? new Date(p.saleEndsAt).toISOString() : undefined,
    rating: rating(p.rating),
    reviews: p.reviews,
    sales: p.sales,
    views: p.views,
    author: p.authorSlug ?? p.authorId ?? "",
    featured: p.featured,
    trending: p.trending,
    free: p.free,
    new: p.isNew,
    bestseller: p.bestseller,
    updated: p.updated,
    released: p.released,
    version: p.version,
    license: p.license,
    art: {
      from: p.artFrom,
      to: p.artTo,
      ink: p.artInk,
      kind: p.artKind as ArtKind,
      ...(p.coverPath ? { src: p.coverPath } : {}),
    },
    description: p.description,
    features: p.features ?? [],
    highlights: p.highlights ?? [],
    includes: p.includes ?? [],
    requirements: p.requirements ?? [],
    tiers,
    changelog: extras.versions
      .slice()
      .sort((a, b) => (a.releasedAt < b.releasedAt ? 1 : -1))
      .map((v) => ({ version: v.version, date: v.releasedAt, notes: v.notes ?? [] })),
    gallery: gallery.length
      ? gallery
      : [
          {
            id: "g1",
            caption: p.name,
            from: p.artFrom,
            to: p.artTo,
            ink: p.artInk,
            kind: p.artKind as ArtKind,
          },
        ],
  };
}

export function toReview(r: ReviewRow, productSlug: string): Review {
  return {
    id: r.id,
    productSlug,
    author: r.author,
    initials: r.initials,
    rating: r.rating,
    title: r.title,
    body: r.body,
    date: r.createdAt instanceof Date ? r.createdAt.toISOString().slice(0, 10) : String(r.createdAt).slice(0, 10),
    helpful: r.helpful,
    verified: r.verified,
  };
}

export function toCollection(
  c: CollectionRow,
  productSlugs: string[],
): Collection {
  return {
    slug: c.slug,
    name: c.name,
    blurb: c.blurb,
    products: productSlugs,
    from: c.from,
    to: c.to,
    src: c.imagePath ?? undefined,
  };
}

export function toOrder(o: OrderRow, items: OrderItemRow[]): Order {
  return {
    id: o.number,
    date:
      o.createdAt instanceof Date
        ? o.createdAt.toISOString().slice(0, 10)
        : String(o.createdAt).slice(0, 10),
    status: o.status === "paid" ? "completed" : o.status === "refunded" ? "refunded" : "pending",
    total: o.total,
    items: items.map((i) => ({
      productSlug: i.productSlug,
      license: i.license,
      price: i.unitPrice,
    })),
    // Never invent a gateway: an order with no payment row says so.
    payment: o.payments?.[0]
      ? `${o.payments[0].provider} •••• ${(o.payments[0].reference ?? "").slice(-4) || "----"}`
      : "—",
  };
}

export function toCustomer(
  u: UserRow,
  stats: { orders: number; spent: number },
): Customer {
  const initials = u.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    initials,
    orders: stats.orders,
    spent: stats.spent,
    joined:
      u.createdAt instanceof Date
        ? u.createdAt.toISOString().slice(0, 10)
        : String(u.createdAt).slice(0, 10),
    // The DB enum, the admin UI and this payload all say "suspended". A mapper
    // that renamed it "blocked" would render as an unknown badge in the UI.
    status: u.status === "suspended" ? "suspended" : u.emailVerifiedAt ? "active" : "invited",
    country: u.country ?? "—",
  };
}

export function toCoupon(c: CouponRow): Coupon {
  const expired = c.expiresAt ? new Date(c.expiresAt).getTime() < Date.now() : false;
  return {
    code: c.code,
    kind: c.kind,
    value: c.value,
    uses: c.uses,
    limit: c.limit,
    expires: c.expiresAt
      ? new Date(c.expiresAt).toISOString().slice(0, 10)
      : "2099-12-31",
    status: !c.active ? "expired" : expired ? "expired" : c.uses >= c.limit ? "expired" : "active",
    // Scope fields; blank means the whole cart.
    productSlug: c.productSlug ?? null,
    categorySlug: c.categorySlug ?? null,
    minSubtotal: c.minSubtotal ?? 0,
    oncePerCustomer: c.oncePerCustomer ?? true,
  };
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

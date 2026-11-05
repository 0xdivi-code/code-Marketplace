/**
 * Pricing.
 *
 * Every number a customer sees at checkout is recomputed here from database
 * rows. The browser sends product slugs and licence tiers, nothing else — a
 * tampered cart simply gets repriced.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import * as t from "../db/schema";
import { RANK, type LicenseTier } from "./licensing";

/**
 * A cart line is either a product slug or a bundle slug. `bundle:` is explicit
 * so a bundle and a product may share a slug without ambiguity.
 */
export type CartLine = { slug: string; license: LicenseTier };

export type PricedLine = {
  /** null for a bundle line, which expands into one licence per member */
  productId: string | null;
  slug: string;
  name: string;
  license: LicenseTier;
  /** products granted by this line; one entry for a normal line */
  grants: { productId: string; slug: string; name: string }[];
  /** set when the line is a bundle */
  bundleId?: string | null;
  /** what this line costs after any product-level sale */
  unitPrice: number;
  listPrice: number;
  saleApplied: boolean;
  discount: number;
  free: boolean;
};

export type Quote = {
  lines: PricedLine[];
  subtotal: number;
  discount: number;
  total: number;
  coupon: {
    code: string;
    kind: "percent" | "fixed";
    value: number;
    id: string;
  } | null;
  /** non-fatal notes: a coupon that did not apply, a removed line */
  notices: string[];
  missing: string[];
};

/** Effective shelf price: the sale price when it is live and cheaper. */
export function effectivePrice(product: {
  price: number;
  salePrice: number | null;
  saleEndsAt: Date | null;
}): { price: number; saleApplied: boolean } {
  const live = product.salePrice != null && (!product.saleEndsAt || product.saleEndsAt > new Date());
  if (live && product.salePrice! < product.price) {
    return { price: product.salePrice!, saleApplied: true };
  }
  return { price: product.price, saleApplied: false };
}

/**
 * Price a cart. Never throws on bad input — it reports what could not be priced
 * so the caller can 400 with a useful message.
 */
export async function quote(input: {
  lines: CartLine[];
  couponCode?: string;
  userId?: string | null;
}): Promise<Quote> {
  const db = getDb();
  const notices: string[] = [];
  const missing: string[] = [];

  const slugs = [...new Set(input.lines.map((l) => l.slug))];
  if (!slugs.length) return { lines: [], subtotal: 0, discount: 0, total: 0, coupon: null, notices, missing };

  /* --------------------------------------------------------------- bundles */

  /**
   * Bundles are resolved first. A bundle line is priced at the bundle's own
   * price and grants a licence for every member product, so the rest of the
   * pipeline (order items, licences, library) needs no special case.
   */
  const bundleRows = await db
    .select()
    .from(t.bundles)
    .where(and(inArray(t.bundles.slug, slugs), eq(t.bundles.active, true)));
  const bundleMembers = bundleRows.length
    ? await db
        .select({ bundleId: t.bundleItems.bundleId, product: t.products })
        .from(t.bundleItems)
        .innerJoin(t.products, eq(t.products.id, t.bundleItems.productId))
        .where(inArray(t.bundleItems.bundleId, bundleRows.map((b) => b.id)))
    : [];

  const productSlugs = slugs.filter((s) => !bundleRows.some((b) => b.slug === s));
  const products = productSlugs.length
    ? await db
        .select()
        .from(t.products)
        .where(and(inArray(t.products.slug, productSlugs), eq(t.products.status, "published")))
    : [];

  const tiers = await db
    .select()
    .from(t.pricingTiers)
    .where(inArray(t.pricingTiers.productId, products.map((p) => p.id)));

  const priced: PricedLine[] = [];
  for (const raw of input.lines) {
    const bundle = bundleRows.find((b) => b.slug === raw.slug);
    if (bundle) {
      const members = bundleMembers.filter((m) => m.bundleId === bundle.id).map((m) => m.product);
      if (!members.length) {
        missing.push(raw.slug);
        continue;
      }
      // Compare against the live shelf price of every member at this tier,
      // which is exactly what the customer would pay buying them separately.
      const listPrice = members.reduce((sum, m) => {
        const overall = effectivePrice(m);
        const tier = tiers.find((x) => x.productId === m.id && x.license === bundle.license);
        return sum + (tier ? tier.price : overall.price);
      }, 0);
      priced.push({
        productId: null,
        bundleId: bundle.id,
        slug: bundle.slug,
        name: bundle.name,
        license: bundle.license as LicenseTier,
        grants: members.map((m) => ({ productId: m.id, slug: m.slug, name: m.name })),
        unitPrice: bundle.price,
        listPrice: Math.max(bundle.compareAt ?? 0, listPrice, bundle.price),
        saleApplied: (bundle.compareAt ?? listPrice) > bundle.price,
        discount: 0,
        free: bundle.price === 0,
      });
      continue;
    }

    const product = products.find((p) => p.slug === raw.slug);
    if (!product) {
      missing.push(raw.slug);
      continue;
    }
    const overall = effectivePrice(product);
    const tier = tiers.find((x) => x.productId === product.id && x.license === raw.license);

    /**
     * A tier row is authoritative when present. Otherwise scale the shelf price
     * by tier, so an extended licence can never accidentally sell at the
     * personal price just because nobody configured a row.
     *
     * A live sale is a discount on the product, not just on its base price: the
     * same ratio is passed through to the configured tier prices, otherwise a
     * sale would silently do nothing for every product with tier rows.
     */
    const multiplier = raw.license === "extended" ? 2 : raw.license === "developer" ? 3 : 1;
    const saleRatio =
      overall.saleApplied && product.price > 0 ? overall.price / product.price : 1;
    const base = tier ? tier.price * saleRatio : overall.price * multiplier;
    const list = tier ? tier.price : product.price * multiplier;

    priced.push({
      productId: product.id,
      bundleId: null,
      slug: product.slug,
      name: product.name,
      license: raw.license,
      grants: [{ productId: product.id, slug: product.slug, name: product.name }],
      unitPrice: Math.max(0, Math.round(base)),
      listPrice: Math.max(0, Math.round(list)),
      saleApplied: saleRatio < 1,
      discount: 0,
      free: product.free || base === 0,
    });
  }

  const subtotal = priced.reduce((n, l) => n + l.unitPrice, 0);
  let discount = 0;
  let applied: Quote["coupon"] = null;

  if (input.couponCode && subtotal > 0) {
    const rows = await db
      .select()
      .from(t.coupons)
      .where(sql`upper(${t.coupons.code}) = ${input.couponCode.trim().toUpperCase()}`)
      .limit(1);
    const coupon = rows[0];
    const reject = (why: string) => notices.push(`${input.couponCode?.toUpperCase()}: ${why}`);

    // Collect the first reason this code cannot be used and stop there: a code
    // that was rejected must never still shave money off the total.
    let blocked: string | null = null;
    if (!coupon) blocked = "no such code";
    else if (!coupon.active) blocked = "this code is no longer active";
    else if (coupon.expiresAt && coupon.expiresAt < new Date()) blocked = "this code has expired";
    else if (coupon.uses >= coupon.limit) blocked = "this code has been fully redeemed";
    else if (subtotal < coupon.minSubtotal)
      blocked = `spend at least $${(coupon.minSubtotal / 100).toFixed(2)} to use it`;
    else if (coupon.productSlug && !priced.some((l) => l.slug === coupon.productSlug))
      blocked = "it only applies to a product not in your cart";

    /** Lines this coupon is allowed to touch. */
    let scoped = priced;
    if (!blocked && coupon?.categorySlug) {
      const inScope = await db
        .select({ slug: t.products.slug })
        .from(t.products)
        .innerJoin(t.categories, eq(t.categories.id, t.products.categoryId))
        .where(and(inArray(t.products.slug, priced.map((l) => l.slug)), eq(t.categories.slug, coupon.categorySlug)));
      if (!inScope.length) blocked = "it only applies to a category not in your cart";
      else scoped = priced.filter((l) => inScope.some((s) => s.slug === l.slug));
    }
    if (!blocked && coupon?.productSlug) {
      scoped = priced.filter((l) => l.slug === coupon.productSlug);
    }

    if (blocked) {
      reject(blocked);
    } else if (coupon) {
      const scopedTotal = scoped.reduce((n, l) => n + l.unitPrice, 0);
      if (scopedTotal > 0) {
        discount =
          coupon.kind === "percent"
            ? Math.round((scopedTotal * coupon.value) / 100)
            : Math.min(coupon.value, scopedTotal);
        applied = { code: coupon.code, kind: coupon.kind, value: coupon.value, id: coupon.id };
      }
    }

    // Per-customer redemption limit, checked against paid orders.
    if (applied && coupon?.oncePerCustomer && input.userId) {
      const prior = await db
        .select({ id: t.orders.id })
        .from(t.orders)
        .where(
          and(
            eq(t.orders.userId, input.userId),
            sql`upper(${t.orders.couponCode}) = ${coupon.code.toUpperCase()}`,
            inArray(t.orders.status, ["paid", "refunded"]),
          ),
        )
        .limit(1);
      if (prior.length) {
        discount = 0;
        applied = null;
        reject("you have already used this code");
      }
    }
  }

  const total = Math.max(0, subtotal - discount);

  // Spread the discount across lines proportionally so receipts stay honest.
  if (discount > 0 && subtotal > 0) {
    let allocated = 0;
    priced.forEach((line, i) => {
      const share =
        i === priced.length - 1
          ? discount - allocated
          : Math.round((line.unitPrice / subtotal) * discount);
      line.discount = Math.min(share, line.unitPrice);
      allocated += line.discount;
    });
  }

  return { lines: priced, subtotal, discount, total, coupon: applied, notices, missing };
}

/** Cheapest tier available for a product, for "from $x" labels. */
export async function fromPrice(productId: string, fallback: number): Promise<number> {
  const db = getDb();
  const rows = await db.select().from(t.pricingTiers).where(eq(t.pricingTiers.productId, productId));
  if (!rows.length) return fallback;
  return Math.min(...rows.map((r) => r.price));
}

/** Refuse a purchase that would be a lateral move or a downgrade. */
export async function ownershipBlockers(
  userId: string,
  lines: CartLine[],
): Promise<{ slug: string; owned: LicenseTier; requested: LicenseTier }[]> {
  const db = getDb();
  const owned = await db
    .select({ slug: t.products.slug, license: t.licenses.license })
    .from(t.licenses)
    .innerJoin(t.products, eq(t.products.id, t.licenses.productId))
    .where(and(eq(t.licenses.userId, userId), eq(t.licenses.status, "active")));

  return lines.flatMap((line) => {
    const have = owned.find((o) => o.slug === line.slug);
    if (!have) return [];
    const ownedTier = have.license as LicenseTier;
    return RANK[line.license] <= RANK[ownedTier] ? [{ slug: line.slug, owned: ownedTier, requested: line.license }] : [];
  });
}

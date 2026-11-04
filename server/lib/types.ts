/**
 * Server-side row types.
 *
 * Drizzle infers these from the schema. Products are queried with joins that add
 * `categorySlug` / `authorSlug`, so this file names those shapes once and the
 * mappers stay readable.
 */
import type { categories, authors, products, orders, orderItems, reviews, coupons, collections } from "../db/schema";

export type User = typeof import("../db/schema").users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Author = typeof authors.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type CollectionRow = typeof collections.$inferSelect;
export type OrderRow = typeof orders.$inferSelect & {
  payments?: { provider: string; reference: string | null }[];
};
export type OrderItemRow = typeof orderItems.$inferSelect;

/** A product row plus the joined slug fields the mappers prefer over ids. */
export type Product = typeof products.$inferSelect & {
  categorySlug?: string | null;
  authorSlug?: string | null;
};

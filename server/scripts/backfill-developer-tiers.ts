/**
 * Backfill the "developer / agency" tier.
 *
 * The catalogue was seeded before that tier existed, so every product has only
 * personal/commercial/extended rows. Without a developer row the storefront
 * falls back to the personal price while checkout — which scales the shelf price
 * — charges more. That mismatch is worse than any naming quibble, so we create
 * real rows once.
 *
 * Price is derived from the extended tier (1.35x, rounded to the nearest $10),
 * which keeps the ladder sensible for every product without hand-tuning 16 of
 * them. Idempotent: existing rows are left alone.
 */
import { migrate } from "../db/migrate";
import { getDb } from "../db/client";
import * as t from "../db/schema";
import { eq } from "drizzle-orm";

await migrate({ log: false });
const db = getDb();

const products = await db.select().from(t.products);
let created = 0;

for (const product of products) {
  const tiers = await db.select().from(t.pricingTiers).where(eq(t.pricingTiers.productId, product.id));
  if (tiers.some((x) => x.license === "developer")) continue;
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
  console.log(`  ${product.slug.padEnd(24)} developer $${(price / 100).toFixed(2)}`);
}

console.log(`\n${created} developer tier${created === 1 ? "" : "s"} created`);
process.exit(0);

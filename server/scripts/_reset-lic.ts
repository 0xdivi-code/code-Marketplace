import { initDb, getDb } from "../db/client";
import * as t from "../db/schema";
import { and, eq } from "drizzle-orm";
await initDb({ log: false });
const db = getDb();
const u = (await db.select().from(t.users).where(eq(t.users.email, "marcus@brightlane.io")))[0];
const p = (await db.select().from(t.products).where(eq(t.products.slug, "lattice-admin")))[0];
const o = (await db.select().from(t.orders).where(eq(t.orders.number, "KL-11300")))[0];
await db.update(t.licenses)
  .set({ license: "commercial", orderId: o.id, status: "active", revokedAt: null, revokedReason: null })
  .where(and(eq(t.licenses.userId, u.id), eq(t.licenses.productId, p.id)));
console.log("lattice licence reset to commercial on", o.number);
process.exit(0);

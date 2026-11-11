/**
 * Remove the demo storefront data before the shop takes real money.
 *
 * `npm run seed` is designed to make a good-looking store on a fresh database,
 * which means it also creates 14 demo customers whose password is the published
 * `demo1234`, two hand-written orders, reviews and coupons whose codes are in
 * the repository. On a live domain that is both a data-integrity problem and an
 * open door, and the admin API has no "delete customer" route.
 *
 * This keeps everything that makes the store a store — catalogue, prices,
 * product files, pages, settings, banners, your owner account — and deletes only
 * the seeded shopper activity.
 *
 *   sudo systemctl stop kiln
 *   sudo -u kiln node --env-file=/srv/kiln/.env server/scripts/clear-demo-data.ts --yes
 *   sudo systemctl start kiln
 *
 * It loads ./.env like the other server scripts, and refuses to run unless the
 * PGlite lock is free, NODE_ENV=production, and you passed --yes. Run it as
 * plain `node` (Node 22.18+ strips the types): tsx is not needed, and the API
 * must be stopped because PGlite is single-writer.
 */
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const dir = resolve(process.env.PGLITE_DIR ?? ".data/pg");
const lockPath = resolve(dir, "..", ".pglite.lock");

function refuse(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

if (!process.argv.includes("--yes")) {
  refuse(
    "This deletes demo customers, orders, reviews and coupons.\n" +
      "  Re-run with --yes once you are sure the database is the live one.",
  );
}

if (process.env.NODE_ENV !== "production") {
  refuse(
    "NODE_ENV is not production, so this is probably a dev database — refusing.\n" +
      "  Run it with the production env file: node --env-file=/srv/kiln/.env …",
  );
}

// Same guard as server/scripts/backup.ts: a live writer invalidates anything we
// do here, and PGlite would open a second writer on the same directory.
if (existsSync(lockPath)) {
  const holder = readFileSync(lockPath, "utf8").trim();
  refuse(
    `The database is open by process ${holder}.\n` +
      "  Stop the API first: sudo systemctl stop kiln",
  );
}

console.log(`  database: ${dir}`);
const db = new PGlite(dir);
await db.waitReady;

/**
 * A directory without the Kiln schema means PGLITE_DIR is wrong — a very easy
 * mistake to make with a hand-written env file, and an expensive one to make
 * while deleting rows. Say so instead of dumping a Postgres error.
 */
async function hasSchema(): Promise<boolean> {
  const r = await db.query<{ n: number }>(
    "select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_name = 'users'",
  );
  return r.rows[0].n > 0;
}

if (!(await hasSchema())) {
  await db.close();
  refuse(
    `No Kiln schema in ${dir}.\n` +
      "  PGLITE_DIR points somewhere else — check it against `npm run seed`'s environment.",
  );
}

try {
  const before = await db.query<{ customers: number; orders: number; reviews: number; coupons: number; staff: number }>(
    `select
       (select count(*)::int from users where role = 'customer') as customers,
       (select count(*)::int from orders)                        as orders,
       (select count(*)::int from reviews)                       as reviews,
       (select count(*)::int from coupons)                       as coupons,
       (select count(*)::int from users where role in ('owner','admin')) as staff`,
  );
  const b = before.rows[0];
  console.log(`  before: ${b.customers} customers · ${b.orders} orders · ${b.reviews} reviews · ${b.coupons} coupons · ${b.staff} staff`);

  await db.exec("begin");
  // Order cascades: items, payments, licenses and download grants are children
  // of the order (see server/db/schema.ts), so one delete clears the activity.
  await db.exec("delete from payments");
  await db.exec("delete from orders");
  await db.exec("delete from reviews");
  await db.exec("delete from coupons");
  await db.exec("delete from users where role = 'customer'");
  await db.exec("commit");

  const after = await db.query<{ customers: number; orders: number; reviews: number; coupons: number; staff: number; products: number; categories: number }>(
    `select
       (select count(*)::int from users where role = 'customer') as customers,
       (select count(*)::int from orders)                        as orders,
       (select count(*)::int from reviews)                       as reviews,
       (select count(*)::int from coupons)                       as coupons,
       (select count(*)::int from users where role in ('owner','admin')) as staff,
       (select count(*)::int from products)                      as products,
       (select count(*)::int from categories)                    as categories`,
  );
  const a = after.rows[0];
  console.log(`  after:  ${a.customers} customers · ${a.orders} orders · ${a.reviews} reviews · ${a.coupons} coupons · ${a.staff} staff`);
  console.log(`  kept:   ${a.products} products · ${a.categories} categories · pages, settings and banners untouched`);

  if (a.staff === 0) {
    console.error("\n  WARNING: no owner/admin account is left. Restore a backup or re-run seed with OWNER_* set.");
  }
} catch (error) {
  await db.exec("rollback").catch(() => {});
  throw error;
} finally {
  await db.close();
}

console.log("\n  Demo data cleared. Demo passwords no longer exist on this database.\n");

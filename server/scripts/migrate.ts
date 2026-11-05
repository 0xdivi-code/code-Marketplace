import { migrate } from "../db/migrate";
import { getDb } from "../db/client";
import { sql } from "drizzle-orm";

const applied = await migrate();
const db = getDb();
const r = await db.execute<{ table_name: string }>(
  sql`select table_name from information_schema.tables where table_schema='public' order by table_name`,
);
console.log("applied:", applied.length ? applied.join(", ") : "none (up to date)");
console.log(`tables (${r.rows.length}):`, r.rows.map((x: { table_name: string }) => x.table_name).join(", "));
process.exit(0);

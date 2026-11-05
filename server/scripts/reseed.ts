/**
 * Destructive: clears demo data and rebuilds it.
 *
 * Only for local/demo environments. Never run against production.
 */
import { migrate } from "../db/migrate";
import { seed } from "../db/seed";

if (process.env.NODE_ENV === "production") {
  throw new Error("reseed refuses to run with NODE_ENV=production");
}

await migrate({ log: false });
await seed({ force: true });
process.exit(0);

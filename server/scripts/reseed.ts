/**
 * Destructive: clears demo data and rebuilds it.
 *
 * Only for local/demo environments. Never run against production.
 */
// Load ./.env exactly as the API does: these scripts must act on the same data
// directory, and dotenv does not override variables already in the environment.
import "dotenv/config";
import { migrate } from "../db/migrate";
import { seed } from "../db/seed";

if (process.env.NODE_ENV === "production") {
  throw new Error("reseed refuses to run with NODE_ENV=production");
}

await migrate({ log: false });
await seed({ force: true });
process.exit(0);

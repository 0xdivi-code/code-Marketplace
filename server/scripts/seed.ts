// Load ./.env exactly as the API does: these scripts must act on the same data
// directory, and dotenv does not override variables already in the environment.
import "dotenv/config";
import { migrate } from "../db/migrate";
import { seed } from "../db/seed";

await migrate({ log: false });
await seed();
process.exit(0);

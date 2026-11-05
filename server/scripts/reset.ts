import { migrate } from "../db/migrate";
import { seed } from "../db/seed";

await migrate({ log: true });
await seed();
process.exit(0);

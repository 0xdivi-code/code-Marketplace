/**
 * Keyed settings.
 *
 * The `settings` table is a plain key → jsonb store which the storefront already
 * uses for hero copy and store details. This is a thin typed wrapper so payment
 * credentials and licence terms can live beside them without each caller
 * hand-rolling the upsert.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { settings } from "../db/schema";

export async function getSetting<T>(key: string): Promise<T | null> {
  const db = getDb();
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return (rows[0]?.value as T) ?? null;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const db = getDb();
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

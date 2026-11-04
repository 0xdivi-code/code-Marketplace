/** Append-only admin/audit trail. Never throws into a request path. */
import { getDb } from "../db/client";
import * as t from "../db/schema";
import { currentAdmin } from "./auth";
import type { Context } from "hono";

type Kind = "product" | "order" | "customer" | "settings" | "content" | "promo" | "auth";

export async function logActivity(input: {
  actor?: string;
  actorId?: string;
  action: string;
  target?: string;
  kind?: Kind;
  ip?: string;
}): Promise<void> {
  try {
    const db = getDb();
    await db.insert(t.activityLog).values({
      actor: input.actor ?? "System",
      actorId: input.actorId ?? null,
      action: input.action,
      target: input.target ?? "",
      kind: input.kind ?? "settings",
      ip: input.ip ?? null,
    });
  } catch (err) {
    console.error("[activity] failed to record entry", err);
  }
}

/** Same, but stamps the signed-in admin from the request context. */
export async function audit(c: Context, input: { action: string; target?: string; kind?: Kind }) {
  const admin = await currentAdmin(c).catch(() => null);
  return logActivity({
    actor: admin?.email ?? "System",
    actorId: admin?.id,
    action: input.action,
    target: input.target,
    kind: input.kind,
  });
}

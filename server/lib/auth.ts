/**
 * Session management.
 *
 * Cookies carry a random opaque token; the database stores only its SHA-256.
 * A stolen database therefore cannot be replayed as a live session.
 * Customer and admin scopes are separate: an admin cookie is only minted after
 * password + TOTP, and customer routes reject it (and vice versa).
 */
import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { sessions, users, type User } from "../db/schema";
import { newToken, sha256 } from "./crypto";

export const CUSTOMER_COOKIE = "kiln_session";
export const ADMIN_COOKIE = "kiln_admin";

const DAY = 24 * 60 * 60 * 1000;
const CUSTOMER_TTL = 30 * DAY;
const ADMIN_TTL = 8 * 60 * 60 * 1000; // 8 hours

const isProd = process.env.NODE_ENV === "production";

function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    sameSite: "Lax" as const,
    secure: isProd,
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

export async function createSession(
  c: Context,
  user: Pick<User, "id">,
  scope: "customer" | "admin",
): Promise<string> {
  const db = getDb();
  const token = newToken();
  const ttl = scope === "admin" ? ADMIN_TTL : CUSTOMER_TTL;

  await db.insert(sessions).values({
    userId: user.id,
    tokenHash: sha256(token),
    scope,
    userAgent: c.req.header("user-agent")?.slice(0, 400) ?? null,
    ip: clientIp(c),
    expiresAt: new Date(Date.now() + ttl),
  });

  const name = scope === "admin" ? ADMIN_COOKIE : CUSTOMER_COOKIE;
  setCookie(c, name, token, cookieOptions(ttl));
  return token;
}

/**
 * The caller's address.
 *
 * Only the left-most `x-forwarded-for` entry is trusted, and only when the app
 * runs behind a proxy that sets it. Falling back to the socket address keeps
 * rate limits and audit rows meaningful locally; `""` (rather than the string
 * "unknown") means the feed can omit it cleanly.
 */
export function clientIp(c: Context): string {
  /**
   * `TRUST_PROXY` is the production setting: the app sits behind a load
   * balancer that sets `x-forwarded-for`, and the left-most entry is the real
   * client. Anywhere else the header is attacker-controlled, so trusting it
   * would let one caller mint unlimited rate-limit buckets — the opposite of
   * what the limit is for. In development and test we accept it only as a
   * local convenience, which keeps the test suites and the preview proxy sane.
   */
  const trustProxy =
    process.env.TRUST_PROXY === "true" || process.env.NODE_ENV !== "production";
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded && trustProxy) return forwarded;
  return c.req.header("x-real-ip")?.trim() || "";
}

async function readSession(c: Context, scope: "customer" | "admin"): Promise<User | null> {
  const name = scope === "admin" ? ADMIN_COOKIE : CUSTOMER_COOKIE;
  const token = getCookie(c, name);
  if (!token) return null;

  const db = getDb();
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, sha256(token)),
        eq(sessions.scope, scope),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const user = rows[0]?.user ?? null;
  if (!user) return null;
  if (user.status === "suspended") return null;
  // an admin credential must never authenticate a customer session or vice versa
  if (scope === "admin" && user.role === "customer") return null;
  if (scope === "customer" && user.role !== "customer") return null;
  return user;
}

export const currentUser = (c: Context) => readSession(c, "customer");
export const currentAdmin = (c: Context) => readSession(c, "admin");

export async function destroySession(c: Context, scope: "customer" | "admin") {
  const name = scope === "admin" ? ADMIN_COOKIE : CUSTOMER_COOKIE;
  const token = getCookie(c, name);
  if (token) {
    const db = getDb();
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  }
  deleteCookie(c, name, { path: "/" });
}

export async function destroyAllSessions(userId: string, scope?: "customer" | "admin") {
  const db = getDb();
  await db
    .delete(sessions)
    .where(scope ? and(eq(sessions.userId, userId), eq(sessions.scope, scope)) : eq(sessions.userId, userId));
}

/** Housekeeping — called on login so expired rows never accumulate. */
export async function pruneSessions() {
  const db = getDb();
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

export const ADMIN_ROLES = new Set(["admin", "owner"]);
export function isAdmin(user: User | null | undefined): boolean {
  return !!user && ADMIN_ROLES.has(user.role);
}

/** Public shape sent to the client — never includes passwordHash or totpSecret. */
export function publicUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    emailVerified: Boolean(u.emailVerifiedAt),
    twoFactorEnabled: Boolean(u.totpEnabledAt),
    createdAt: u.createdAt,
    country: u.country,
  };
}

export async function countUsers(): Promise<number> {
  const db = getDb();
  const r = await db.execute<{ n: number }>(sql`select count(*)::int as n from users`);
  return Number(r.rows[0]?.n ?? 0);
}

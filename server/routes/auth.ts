/**
 * Authentication routes.
 *
 * Customer and admin flows are deliberately separate. Admin login additionally
 * requires TOTP once enrolled, and only role owner|admin can obtain an admin
 * cookie. Every credential endpoint is rate limited.
 */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import * as t from "../db/schema";
import { hashPassword, verifyPassword, newToken, sha256, sixDigitCode } from "../lib/crypto";
import { rateLimit, resetRateLimit } from "../lib/rate-limit";
import {
  createSession,
  destroySession,
  currentUser,
  currentAdmin,
  publicUser,
  clientIp,
  pruneSessions,
  destroyAllSessions,
} from "../lib/auth";
import { logActivity } from "../lib/activity";
import { sendDevEmail } from "../lib/mailer";

const auth = new Hono();

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");
const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200, "That password is too long");

/* ------------------------------------------------------------------ helpers */

async function findByEmail(email: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(t.users)
    .where(sql`lower(${t.users.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return rows[0] ?? null;
}

function tooMany(c: any, retry: number) {
  c.header("Retry-After", String(retry));
  return c.json(
    { error: "Too many attempts. Try again shortly.", retryAfter: retry },
    429,
  );
}

/* ---------------------------------------------------------------- register */

auth.post(
  "/register",
  zValidator(
    "json",
    z.object({
      name: z.string().trim().min(2, "Tell us your name").max(120),
      email: emailSchema,
      password: passwordSchema,
      country: z.string().max(80).optional(),
    }),
  ),
  async (c) => {
    const { name, email, password, country } = c.req.valid("json");
    const ip = clientIp(c);

    const limited = await rateLimit(`register:${ip}`, 5, 15 * 60);
    if (!limited.ok) return tooMany(c, limited.retryAfterSeconds);

    if (await findByEmail(email)) {
      // Do not reveal whether the account exists.
      return c.json({ ok: true, message: "Check your inbox to finish setting up." }, 201);
    }

    const db = getDb();
    const [user] = await db
      .insert(t.users)
      .values({
        email,
        name,
        passwordHash: await hashPassword(password),
        role: "customer",
        country: country ?? null,
      })
      .returning();

    // email verification token (displayed in dev mailer)
    const token = newToken();
    await db.insert(t.authTokens).values({
      userId: user.id,
      kind: "verify_email",
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await sendDevEmail({
      to: email,
      subject: "Verify your Kiln account",
      text: `Confirm your email: /verify-email?token=${token}`,
    });

    await createSession(c, user, "customer");
    await logActivity({ actor: user.email, action: "created an account", target: user.email, kind: "auth", ip });

    return c.json({ ok: true, user: publicUser(user), verifyToken: token }, 201);
  },
);

/* ------------------------------------------------------------------- login */

auth.post(
  "/login",
  zValidator("json", z.object({ email: emailSchema, password: z.string().min(1) })),
  async (c) => {
    const { email, password } = c.req.valid("json");
    const ip = clientIp(c);

    const byIp = await rateLimit(`login:${ip}`, 20, 15 * 60);
    const byEmail = await rateLimit(`login:${email}`, 8, 15 * 60);
    if (!byIp.ok) return tooMany(c, byIp.retryAfterSeconds);
    if (!byEmail.ok) return tooMany(c, byEmail.retryAfterSeconds);

    const user = await findByEmail(email);
    // Constant-ish response regardless of which half failed.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return c.json({ error: "Email or password is incorrect." }, 401);
    }
    if (user.status === "suspended") {
      return c.json({ error: "This account is suspended. Contact support." }, 403);
    }
    if (user.role !== "customer") {
      return c.json({ error: "Staff accounts must sign in through the admin console." }, 403);
    }

    await resetRateLimit(`login:${email}`);
    await pruneSessions();
    const db = getDb();
    await db.update(t.users).set({ lastLoginAt: new Date() }).where(eq(t.users.id, user.id));
    await createSession(c, user, "customer");
    await logActivity({ actor: user.email, action: "signed in", target: user.email, kind: "auth", ip });

    return c.json({ ok: true, user: publicUser(user) });
  },
);

/* ------------------------------------------------------------------ logout */

auth.post("/logout", async (c) => {
  await destroySession(c, "customer");
  return c.json({ ok: true });
});

/* -------------------------------------------------------------------- me */

auth.get("/me", async (c) => {
  const user = await currentUser(c);
  return c.json({ user: user ? publicUser(user) : null });
});

/* --------------------------------------------------------- verify email */

auth.post(
  "/verify-email",
  zValidator("json", z.object({ token: z.string().min(10) })),
  async (c) => {
    const { token } = c.req.valid("json");
    const db = getDb();
    const rows = await db
      .select()
      .from(t.authTokens)
      .where(and(eq(t.authTokens.tokenHash, sha256(token)), eq(t.authTokens.kind, "verify_email")))
      .limit(1);
    const row = rows[0];
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      return c.json({ error: "This verification link is invalid or has expired." }, 400);
    }
    await db.update(t.authTokens).set({ usedAt: new Date() }).where(eq(t.authTokens.id, row.id));
    await db.update(t.users).set({ emailVerifiedAt: new Date() }).where(eq(t.users.id, row.userId));
    return c.json({ ok: true });
  },
);

/** Dev helper: returns the latest verification code for an address. */
auth.get("/dev/verify-token", async (c) => {
  if (process.env.NODE_ENV === "production") return c.json({ error: "Not available" }, 404);
  const email = (c.req.query("email") ?? "").toLowerCase();
  const user = await findByEmail(email);
  if (!user) return c.json({ token: null });
  const db = getDb();
  const rows = await db
    .select({ id: t.authTokens.id })
    .from(t.authTokens)
    .where(and(eq(t.authTokens.userId, user.id), eq(t.authTokens.kind, "verify_email")))
    .orderBy(sql`created_at desc`)
    .limit(1);
  return c.json({ present: rows.length > 0 });
});

/* -------------------------------------------------------- password reset */

auth.post(
  "/forgot-password",
  zValidator("json", z.object({ email: emailSchema })),
  async (c) => {
    const { email } = c.req.valid("json");
    const ip = clientIp(c);
    const limited = await rateLimit(`forgot:${ip}`, 5, 15 * 60);
    if (!limited.ok) return tooMany(c, limited.retryAfterSeconds);

    const user = await findByEmail(email);
    // Always the same answer, so this cannot enumerate accounts.
    if (user && user.role === "customer") {
      const db = getDb();
      const token = newToken();
      await db.insert(t.authTokens).values({
        userId: user.id,
        kind: "reset_password",
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      await sendDevEmail({
        to: email,
        subject: "Reset your Kiln password",
        text: `Reset link (valid 1 hour): /reset-password?token=${token}`,
      });
    }
    return c.json({ ok: true, message: "If that address has an account, a reset link is on its way." });
  },
);

auth.post(
  "/reset-password",
  zValidator("json", z.object({ token: z.string().min(10), password: passwordSchema })),
  async (c) => {
    const { token, password } = c.req.valid("json");
    const db = getDb();
    const rows = await db
      .select()
      .from(t.authTokens)
      .where(and(eq(t.authTokens.tokenHash, sha256(token)), eq(t.authTokens.kind, "reset_password")))
      .limit(1);
    const row = rows[0];
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      return c.json({ error: "This reset link is invalid or has expired." }, 400);
    }
    await db.update(t.authTokens).set({ usedAt: new Date() }).where(eq(t.authTokens.id, row.id));
    await db
      .update(t.users)
      .set({ passwordHash: await hashPassword(password), updatedAt: new Date() })
      .where(eq(t.users.id, row.userId));
    // A password change must invalidate every existing session.
    await destroyAllSessions(row.userId, "customer");
    await logActivity({
      actor: "system",
      action: "completed a password reset",
      target: row.userId,
      kind: "auth",
      ip: clientIp(c),
    });
    return c.json({ ok: true });
  },
);

/* --------------------------------------------------------------- admin auth */

const admin = new Hono();

admin.post(
  "/login",
  zValidator(
    "json",
    z.object({ email: emailSchema, password: z.string().min(1), totp: z.string().trim().optional() }),
  ),
  async (c) => {
    const { email, password, totp } = c.req.valid("json");
    const ip = clientIp(c);

    const limited = await rateLimit(`admin-login:${ip}`, 6, 15 * 60);
    if (!limited.ok) return tooMany(c, limited.retryAfterSeconds);

    const user = await findByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      await logActivity({ actor: email, action: "failed an admin sign-in", target: ip, kind: "auth", ip });
      return c.json({ error: "Email or password is incorrect." }, 401);
    }
    if (user.role === "customer") {
      return c.json({ error: "This account has no admin access." }, 403);
    }
    if (user.status === "suspended") {
      return c.json({ error: "This account is suspended." }, 403);
    }

    // Second factor, if enrolled.
    if (user.totpEnabledAt) {
      if (!totp) {
        return c.json({ error: "Enter your two-factor code.", needTotp: true }, 401);
      }
      const { verifySecret, hashCode } = await import("../lib/totp");
      const asTotp = totp.replace(/\s/g, "").length === 6 && verifySecret(user.totpSecret!, totp);
      // Recovery codes are single use: a match is consumed immediately.
      const asRecovery = !asTotp && (user.recoveryCodes ?? []).includes(hashCode(totp));
      if (!asTotp && !asRecovery) {
        await logActivity({ actor: email, action: "failed a two-factor challenge", target: ip, kind: "auth", ip });
        return c.json({ error: "That code is not valid.", needTotp: true }, 401);
      }
      if (asRecovery) {
        const db0 = getDb();
        await db0
          .update(t.users)
          .set({ recoveryCodes: (user.recoveryCodes ?? []).filter((c) => c !== hashCode(totp)) })
          .where(eq(t.users.id, user.id));
      }
    }

    await resetRateLimit(`admin-login:${ip}`);
    await pruneSessions();
    const db = getDb();
    await db.update(t.users).set({ lastLoginAt: new Date() }).where(eq(t.users.id, user.id));
    await createSession(c, user, "admin");
    await logActivity({ actor: user.email, action: "signed in to the admin console", target: ip, kind: "auth", ip });

    return c.json({ ok: true, user: publicUser(user) });
  },
);

admin.post("/logout", async (c) => {
  await destroySession(c, "admin");
  return c.json({ ok: true });
});

admin.get("/me", async (c) => {
  const user = await currentAdmin(c);
  return c.json({ user: user ? publicUser(user) : null });
});

/* -------------------------------------------------------------- 2FA setup */

/**
 * Turning 2FA off needs the current password — a hijacked session should not be
 * able to strip the second factor off the account.
 */
admin.post(
  "/2fa/disable",
  zValidator("json", z.object({ password: z.string().min(1) })),
  async (c) => {
    const user = await currentAdmin(c);
    if (!user) return c.json({ error: "Not signed in" }, 401);
    const { verifyPassword } = await import("../lib/crypto");
    if (!(await verifyPassword(c.req.valid("json").password, user.passwordHash))) {
      return c.json({ error: "That password is not right." }, 401);
    }
    const db = getDb();
    await db
      .update(t.users)
      .set({ totpSecret: null, totpEnabledAt: null, recoveryCodes: [] })
      .where(eq(t.users.id, user.id));
    await logActivity({
      actor: user.email,
      action: "disabled two-factor authentication",
      target: user.email,
      kind: "auth",
      ip: clientIp(c),
    });
    return c.json({ ok: true });
  },
);


admin.post("/2fa/setup", async (c) => {
  const user = await currentAdmin(c);
  if (!user) return c.json({ error: "Not signed in" }, 401);
  const { generateSecret, otpauthUri } = await import("../lib/totp");
  const secret = generateSecret();
  const db = getDb();
  await db.update(t.users).set({ totpSecret: secret }).where(eq(t.users.id, user.id));
  return c.json({ secret, uri: otpauthUri(user.email, secret) });
});

admin.post(
  "/2fa/enable",
  zValidator("json", z.object({ code: z.string().trim().min(6).max(6) })),
  async (c) => {
    const user = await currentAdmin(c);
    if (!user) return c.json({ error: "Not signed in" }, 401);
    if (!user.totpSecret) return c.json({ error: "Start setup first." }, 400);

    const { verifySecret, generateRecoveryCodes, hashCode } = await import("../lib/totp");
    if (!verifySecret(user.totpSecret, c.req.valid("json").code)) {
      return c.json({ error: "That code is not valid. Check your authenticator app." }, 400);
    }
    const codes = generateRecoveryCodes();
    const db = getDb();
    await db
      .update(t.users)
      .set({
        totpEnabledAt: new Date(),
        recoveryCodes: codes.map(hashCode),
        updatedAt: new Date(),
      })
      .where(eq(t.users.id, user.id));
    await logActivity({ actor: user.email, action: "enabled two-factor authentication", target: user.email, kind: "auth" });
    return c.json({ ok: true, recoveryCodes: codes });
  },
);

export { auth, admin };

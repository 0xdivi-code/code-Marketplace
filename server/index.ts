/**
 * Kiln API server.
 *
 * Runs the Hono app on the node adapter. In development Vite proxies `/api`
 * here (see vite.config.ts), so the browser only ever talks to one origin and
 * cookies behave exactly as they will in production.
 */
import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import { initDb, getDb } from "./db/client";
import { migrate } from "./db/migrate";
import { auth, admin as adminAuth } from "./routes/auth";
import { api } from "./routes/storefront";
import { account } from "./routes/account";
import { adminApi } from "./routes/admin";
import { adminContentApi } from "./routes/admin-content";
import { pruneSessions } from "./lib/auth";
import { UPLOAD_LIMITS } from "./lib/storage";
import { sql } from "drizzle-orm";

const app = new Hono();
const isProd = process.env.NODE_ENV === "production";

app.use("*", logger());
/**
 * Security headers, tuned for how this app is actually served.
 *
 * The storefront runs inside the preview frame in development, so framing and
 * isolation headers have to stay permissive there — a strict COOP/XFO makes the
 * browser tear down the frame on the first cross-origin-ish navigation, which
 * looks like "the login button reloads the page". In production we lock the
 * admin console down properly.
 */
app.use(
  "*",
  secureHeaders({
    crossOriginResourcePolicy: "cross-origin",
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: isProd ? "same-origin" : false,
    xFrameOptions: isProd ? "SAMEORIGIN" : false,
    strictTransportSecurity: isProd ? "max-age=15552000; includeSubDomains" : false,
  }),
);

/**
 * In development the Vite origin and the preview proxy origin both hit this
 * server. Credentials are required for the session cookies, so the origin is
 * echoed rather than wildcarded (a wildcard is illegal with credentials).
 */
app.use(
  "/api/*",
  cors({
    origin: (origin) => origin ?? "",
    credentials: true,
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "X-Filename", "X-Requested-With"],
    exposeHeaders: ["Content-Disposition"],
    maxAge: 600,
  }),
);

/**
 * Upload routes stream their body straight to disk and enforce their own byte
 * ceiling (see putStream). They must be excluded here: a JSON body guard would
 * consume the stream before the uploader could read it.
 */
const isStreamingUpload = (path: string) =>
  /\/api\/admin\/(products\/[^/]+\/files|categories\/[^/]+\/image|settings\/[^/]+\/image)$/.test(path);

app.use("/api/*", async (c, next) => {
  if (isStreamingUpload(c.req.path)) return next();
  return bodyLimit({
    maxSize: 1024 * 1024,
    onError: (c) => c.json({ error: "That request body is too large." }, 413),
  })(c, next);
});

app.get("/api/health", async (c) => {
  try {
    const db = getDb();
    const r = await db.execute(sql`select version() as v`);
    return c.json({ ok: true, database: "reachable", version: (r.rows[0] as { v: string }).v });
  } catch (err) {
    return c.json({ ok: false, error: (err as Error).message }, 503);
  }
});

app.route("/api/auth", auth);
app.route("/api/admin/auth", adminAuth);
app.route("/api", api);
app.route("/api/account", account);
app.route("/api/admin", adminApi);
app.route("/api/admin", adminContentApi);

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
  console.error("[api]", err);
  // Never leak a stack trace or SQL to the browser.
  return c.json({ error: "Something went wrong on our end." }, 500);
});

const PORT = Number(process.env.API_PORT ?? 8787);

async function main() {
  await initDb();
  await migrate({ log: false });
  await pruneSessions();

  serve({ fetch: app.fetch, port: PORT, hostname: "0.0.0.0" }, (info) => {
    console.log(`  kiln api    http://localhost:${info.port}`);
    console.log(`  uploads     zip ≤ ${Math.round(UPLOAD_LIMITS.zipBytes / 1024 / 1024)} MB · images ≤ ${Math.round(UPLOAD_LIMITS.imageBytes / 1024 / 1024)} MB`);
  });

  // Session + rate-limit housekeeping.
  setInterval(() => {
    pruneSessions().catch(() => {});
  }, 60 * 60 * 1000).unref();
}

if (!isProd || process.env.API_AUTOSTART !== "false") {
  main().catch((err) => {
    console.error("Failed to start API", err);
    process.exit(1);
  });
}

export default app;

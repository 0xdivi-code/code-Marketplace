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
import { markServing, webhooks } from "./routes/webhooks";
import { free } from "./routes/free";
import { seo } from "./routes/seo";
import { adminPayments } from "./routes/admin-payments";
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
/**
 * Allowed browser origins.
 *
 * Echoing back whatever `Origin` arrives would let any website read
 * authenticated admin responses using a logged-in owner's cookies. In
 * production only an explicit allow-list is honoured; in development the Vite
 * dev server and the preview proxy are added.
 */
const allowedOrigins = (() => {
  const list = new Set<string>();
  for (const raw of (process.env.APP_ORIGINS ?? "").split(",")) {
    const v = raw.trim().replace(/\/$/, "");
    if (v) list.add(v);
  }
  if (process.env.PUBLIC_BASE_URL) list.add(process.env.PUBLIC_BASE_URL.trim().replace(/\/$/, ""));
  if (!isProd) {
    for (const port of [5173, 5174, 5175, 4173]) list.add(`http://localhost:${port}`);
  }
  return list;
})();

/** same-origin requests send no Origin; the preview proxy sends a *.e2b.app one. */
function originAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  // Local preview hosts are only trusted outside production.
  if (!isProd && /^https:\/\/[a-z0-9-]+\.e2b\.app$/i.test(origin)) return true;
  return false;
}

app.use(
  "/api/*",
  cors({
    origin: (origin) => (originAllowed(origin) ? (origin ?? "") : ""),
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
app.route("/api/admin", adminPayments);
app.route("/api/webhooks", webhooks);
// Search-engine files are served from the API and rewritten at the edge.
app.route("/api", seo);
app.route("/api", free);

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

  markServing();
  serve({ fetch: app.fetch, port: PORT, hostname: "0.0.0.0" }, (info) => {
    console.log(`  kiln api    http://localhost:${info.port}`);
    console.log(`  uploads     zip ≤ ${Math.round(UPLOAD_LIMITS.zipBytes / 1024 / 1024)} MB · images ≤ ${Math.round(UPLOAD_LIMITS.imageBytes / 1024 / 1024)} MB`);
  });

  // Session + rate-limit housekeeping.
  setInterval(() => {
    pruneSessions().catch(() => {});
  }, 60 * 60 * 1000).unref();
}

/**
 * Tests import this module for `app` and drive their own database, so they opt
 * out with NODE_ENV=test or API_AUTOSTART=false.
 *
 * Production must start: the previous condition required `!isProd`, so a
 * `NODE_ENV=production` boot exited silently with no server and no error.
 */
const autostart = process.env.API_AUTOSTART !== "false" && process.env.NODE_ENV !== "test";
if (autostart) {
  main().catch((err) => {
    console.error("Failed to start API", err);
    process.exit(1);
  });
}

export default app;

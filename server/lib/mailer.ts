/**
 * Transactional email.
 *
 * Three transports, chosen by configuration:
 *
 *   • `resend`  — RESEND_API_KEY set. Used in production.
 *   • `smtp`    — SMTP_URL set. Understood by most providers.
 *   • `log`     — dev/test. Messages go to the console and `.data/mail.log`.
 *
 * Nothing here throws into a request: a mail provider having a bad minute must
 * never fail a purchase or a password reset. Failures are recorded on the
 * notification row instead, so the admin console can show what did not go out.
 */
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type Template =
  | "verify_email"
  | "reset_password"
  | "order_receipt"
  | "payment_confirmed"
  | "download_ready"
  | "refund_processed"
  | "product_update";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  template?: Template;
}

export interface MailResult {
  ok: boolean;
  transport: "resend" | "smtp" | "log";
  error?: string;
}

const LOG_PATH = resolve(process.env.MAIL_LOG ?? ".data/mail.log");
const FROM = process.env.MAIL_FROM ?? "Kiln <receipts@kiln.dev>";

/** Absolute URLs matter: a bare path is unclickable in every mail client. */
export function appUrl(path = "/"): string {
  const base = (process.env.PUBLIC_BASE_URL ?? "http://localhost:5175").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Plain text is the source of truth; HTML is a nicety derived from it. */
function toHtml(text: string): string {
  const body = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f4f1ea;padding:28px;font:15px/1.6 -apple-system,Segoe UI,sans-serif;color:#1d2b3a">
  <div style="max-width:560px;margin:0 auto;background:#fffdf8;border:1px solid #e2ddd1;border-radius:6px;padding:28px">
    <p style="margin:0 0 20px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#6b7280">Kiln</p>
    ${body}
    <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e2ddd1;font-size:12px;color:#8a8578">
      Kiln — source code for people who ship.
    </p>
  </div></body></html>`;
}

async function sendViaResend(msg: MailMessage): Promise<MailResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [msg.to],
      subject: msg.subject,
      text: msg.text,
      html: msg.html ?? toHtml(msg.text),
    }),
  });
  if (!res.ok) {
    return { ok: false, transport: "resend", error: `resend ${res.status}: ${await res.text()}`.slice(0, 300) };
  }
  return { ok: true, transport: "resend" };
}

/**
 * SMTP over the provider's HTTP bridge is out of scope here; this transport
 * posts to a webhook-style relay (for example a small relay worker) so the app
 * holds no SMTP socket state. Set SMTP_URL to a JSON endpoint that accepts
 * `{ from, to, subject, text }`.
 */
async function sendViaSmtpBridge(msg: MailMessage): Promise<MailResult> {
  const res = await fetch(process.env.SMTP_URL!, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.SMTP_TOKEN ? { authorization: `Bearer ${process.env.SMTP_TOKEN}` } : {}),
    },
    body: JSON.stringify({ from: FROM, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html ?? toHtml(msg.text) }),
  });
  if (!res.ok) {
    return { ok: false, transport: "smtp", error: `smtp bridge ${res.status}`.slice(0, 300) };
  }
  return { ok: true, transport: "smtp" };
}

async function sendToLog(msg: MailMessage): Promise<MailResult> {
  const entry = [
    "-----",
    `date: ${new Date().toISOString()}`,
    `to: ${msg.to}`,
    `subject: ${msg.subject}`,
    "",
    msg.text,
    "",
  ].join("\n");
  if (process.env.NODE_ENV !== "test") {
    console.log(`\n✉  ${msg.subject} → ${msg.to}\n   ${msg.text.replace(/\n/g, "\n   ")}\n`);
  }
  try {
    await mkdir(dirname(LOG_PATH), { recursive: true });
    await appendFile(LOG_PATH, entry, "utf8");
  } catch {
    /* mail logging must never break a request */
  }
  return { ok: true, transport: "log" };
}

export function activeTransport(): MailResult["transport"] {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_URL) return "smtp";
  return "log";
}

export async function sendMail(msg: MailMessage): Promise<MailResult> {
  const transport = activeTransport();
  try {
    if (transport === "resend") return await sendViaResend(msg);
    if (transport === "smtp") return await sendViaSmtpBridge(msg);
    return await sendToLog(msg);
  } catch (error) {
    return { ok: false, transport, error: (error as Error).message.slice(0, 300) };
  }
}

/**
 * Back-compat shim: older call sites import `sendDevEmail`. New code should
 * import `sendMail`, which picks a real transport in production.
 */
export const sendDevEmail = sendMail;

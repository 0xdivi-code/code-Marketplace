/**
 * Mail adapter.
 *
 * In development every message is appended to `.data/mail.log` and echoed to the
 * server console so verification and reset links are testable without SMTP.
 * Swap `sendDevEmail` for a real provider (Resend/Postmark) in step 3.
 */
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const LOG_PATH = resolve(process.env.MAIL_LOG ?? ".data/mail.log");

export async function sendDevEmail(msg: { to: string; subject: string; text: string }) {
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
}

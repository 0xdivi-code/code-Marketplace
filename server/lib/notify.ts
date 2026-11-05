/**
 * Notification orchestration.
 *
 * `notify()` is the single entry point used by auth, checkout, settlement and
 * refunds. It composes the message, sends it through the configured transport
 * and writes a `notifications` row either way. Callers never handle failures:
 * an email that cannot be sent must not undo a payment.
 *
 * Every notification is gated on a settings toggle so the owner can turn any
 * individual email off from the admin console without a deploy.
 */
import { getDb } from "../db/client";
import * as t from "../db/schema";
import { appUrl, sendMail, activeTransport, type Template } from "./mailer";
import { getSetting } from "./settings-store";

/** Cents → "$1,234.50". Kept local so notifications do not depend on pricing. */
const money = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Setting key → template. Absent or true means enabled. */
const TOGGLE: Record<Template, string> = {
  verify_email: "email.verify",
  reset_password: "email.reset",
  order_receipt: "email.receipt",
  payment_confirmed: "email.payment",
  download_ready: "email.download",
  refund_processed: "email.refund",
  product_update: "email.productUpdate",
};

async function enabled(template: Template): Promise<boolean> {
  try {
    const value = await getSetting<boolean>(TOGGLE[template]);
    return value === null ? true : Boolean(value);
  } catch {
    return true;
  }
}

export interface NotifyInput {
  to: string;
  template: Template;
  subject: string;
  text: string;
  userId?: string | null;
  orderId?: string | null;
}

export async function notify(input: NotifyInput): Promise<void> {
  let status: "sent" | "failed" | "skipped" = "sent";
  let transport = activeTransport();
  let error: string | null = null;

  if (!(await enabled(input.template))) {
    status = "skipped";
  } else {
    const result = await sendMail({
      to: input.to,
      subject: input.subject,
      text: input.text,
      template: input.template,
    });
    transport = result.transport;
    if (!result.ok) {
      status = "failed";
      error = result.error ?? "unknown error";
      console.error(`✉  ${input.template} to ${input.to} failed: ${error}`);
    }
  }

  try {
    await getDb()
      .insert(t.notifications)
      .values({
        toEmail: input.to,
        template: input.template,
        subject: input.subject,
        status,
        transport,
        error,
        userId: input.userId ?? null,
        orderId: input.orderId ?? null,
      });
  } catch (e) {
    // The log is diagnostic; never let a logging failure surface to a request.
    console.error("notification log failed:", (e as Error).message);
  }
}

/* ------------------------------------------------------------- templates */

export function verifyEmail(input: { to: string; token: string; userId: string }) {
  return notify({
    to: input.to,
    template: "verify_email",
    userId: input.userId,
    subject: "Confirm your Kiln email",
    text:
      `Welcome to Kiln.\n\n` +
      `Confirm your email address to finish setting up your account:\n${appUrl(`/verify-email?token=${input.token}`)}\n\n` +
      `That link works for 24 hours. If you did not create an account, ignore this email.`,
  });
}

export function resetPassword(input: { to: string; token: string; userId: string }) {
  return notify({
    to: input.to,
    template: "reset_password",
    userId: input.userId,
    subject: "Reset your Kiln password",
    text:
      `Someone asked to reset the password for your Kiln account.\n\n` +
      `Choose a new password here:\n${appUrl(`/reset-password?token=${input.token}`)}\n\n` +
      `The link expires in one hour and can only be used once. If this was not you, no action is needed — your password has not changed.`,
  });
}

export function paymentConfirmed(input: {
  order: { id: string; number: string; email: string; name: string | null; total: number };
  lines: { productName: string; license: string; quantity: number; unitPrice: number }[];
  payCurrency?: string | null;
}) {
  const lines = input.lines
    .map((l) => `  ${l.quantity} × ${l.productName} (${l.license}) — ${money(l.unitPrice)}`)
    .join("\n");

  return notify({
    to: input.order.email,
    template: "payment_confirmed",
    orderId: input.order.id,
    subject: `Payment received — ${input.order.number}`,
    text:
      `Hi ${input.order.name || "there"},\n\n` +
      `We have confirmed your payment of ${money(input.order.total)}.\n\n` +
      `${lines}\n\n` +
      `Total ${money(input.order.total)} paid with ${(input.payCurrency ?? "crypto").toUpperCase()}.\n\n` +
      `Your source code is ready in your library:\n${appUrl("/account/library")}\n\n` +
      `Your receipt and licence certificates are in your account:\n${appUrl("/account/orders")}\n\n` +
      `Every purchase includes lifetime updates and a 14-day refund window.`,
  });
}

export function downloadReady(input: {
  to: string;
  userId: string | null;
  productName: string;
  version: string;
  url: string;
}) {
  return notify({
    to: input.to,
    template: "download_ready",
    userId: input.userId,
    subject: `Your download — ${input.productName}`,
    text:
      `${input.productName} ${input.version} is ready.\n\n` +
      `Download it here (the link is personal, expires in 15 minutes and can be used a few times):\n` +
      `${appUrl(input.url)}\n\n` +
      `You can always mint a fresh link from your library:\n${appUrl("/account/library")}`,
  });
}

export function refundProcessed(input: {
  to: string;
  userId: string | null;
  orderId: string;
  orderNumber: string;
  amount: number;
  reason?: string | null;
}) {
  return notify({
    to: input.to,
    template: "refund_processed",
    userId: input.userId,
    orderId: input.orderId,
    subject: `Refund issued — ${input.orderNumber}`,
    text:
      `We have refunded ${money(input.amount)} for order ${input.orderNumber}.\n\n` +
      (input.reason ? `Reason: ${input.reason}\n\n` : "") +
      `Crypto refunds are sent to the address the payment came from and usually confirm within an hour.\n\n` +
      `Access to the affected products has been withdrawn. If you think this is a mistake, reply to this email.`,
  });
}

export function productUpdate(input: {
  to: string;
  userId: string;
  productName: string;
  version: string;
  notes: string;
}) {
  return notify({
    to: input.to,
    template: "product_update",
    userId: input.userId,
    subject: `${input.productName} ${input.version} is available`,
    text:
      `A new version of ${input.productName} has been published.\n\n` +
      `${input.version}\n${input.notes}\n\n` +
      `Download it from your library — the update is free, as always:\n${appUrl("/account/library")}`,
  });
}

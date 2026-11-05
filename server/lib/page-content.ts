/**
 * Default page / policy / FAQ content.
 *
 * Seeded into the `pages` table so the admin can edit it without a deploy.
 * The legal page renderer falls back to its built-in copy for anything missing,
 * so a half-seeded database still renders.
 */
import { getDb, initDb } from "../db/client";
import * as t from "../db/schema";

interface SeedPage {
  slug: string;
  title: string;
  kind: "page" | "policy" | "faq";
  category?: string;
  body: string;
  excerpt?: string;
  readMinutes?: number;
  from?: string;
  to?: string;
}

export const DEFAULT_PAGES: SeedPage[] = [
  {
    slug: "licensing",
    title: "License terms",
    kind: "policy",
    body: [
      "## Personal license",
      "For your own projects and learning. One developer, one end product. You may modify the code freely and use it in work you do not resell as source code.",
      "- 1 developer seat",
      "- 1 end product",
      "- Attribution appreciated, not required",
      "## Commercial license",
      "For client work. Up to five developers may work on one end product that you deliver to a client. The client may use the delivered product, but not redistribute the source.",
      "- Up to 5 developers",
      "- 1 client product",
      "- Attribution removal permitted",
      "## Extended license",
      "For products you sell access to. Unlimited seats, unlimited end products, including SaaS offerings where the source is not distributed. White-label rights included.",
      "- Unlimited developers",
      "- Unlimited products",
      "- White-label rights",
      "## Never permitted",
      "- Reselling, sublicensing or redistributing the source itself",
      "- Publishing the code as a template, starter or course asset",
      "- Using the files to train a model that reproduces them",
    ].join("\n\n"),
    excerpt: "What each of the three licenses lets you do — and what none of them permit.",
  },
  {
    slug: "terms",
    title: "Terms of service",
    kind: "policy",
    body: [
      "## The agreement",
      "By buying from Kiln you agree to these terms on behalf of yourself or the organisation you represent.",
      "## What you are buying",
      "A non-exclusive, non-transferable license to use the source code under the tier you selected. You are not buying the copyright.",
      "## Delivery",
      "Downloads are available immediately in your library and remain available for as long as the product is maintained. Links are personal and must not be shared.",
      "## Acceptable use",
      "- Do not redistribute the source as-is",
      "- Do not resell, sublicense or publish the files",
      "- Do not use the files to train a model that reproduces them",
    ].join("\n\n"),
    excerpt: "The rules that apply when you buy source code from us.",
  },
  {
    slug: "privacy",
    title: "Privacy policy",
    kind: "policy",
    body: [
      "## What we collect",
      "Your name, email address and billing country, plus the download activity needed to keep licenses secure.",
      "## What we never store",
      "Card numbers. Payments are processed by Stripe; card data never touches our servers.",
      "## How long we keep it",
      "Order records for seven years for tax purposes. Account data until you ask us to delete it.",
      "## Your rights",
      "Export or delete your data from account settings, or email us and we will action it within 30 days.",
    ].join("\n\n"),
    excerpt: "What we collect, why, and how to get it removed.",
  },
  {
    slug: "refunds",
    title: "Refund policy",
    kind: "policy",
    body: [
      "## The 14-day window",
      "If an item is broken or not as described, contact us within 14 days of purchase and we will fix it or refund it.",
      "## Digital goods",
      "Because source code cannot be returned, refunds are discretionary once a download has started and the item works as described.",
      "## How to ask",
      "Reply to your receipt or use the contact form. Include the order number and what went wrong — we answer within one business day.",
    ].join("\n\n"),
    excerpt: "When we refund, when we fix instead, and how to ask.",
  },
  {
    slug: "cookies",
    title: "Cookie policy",
    kind: "policy",
    body: [
      "## Essential cookies",
      "One session cookie keeps you signed in. One admin cookie is issued only after two-factor authentication.",
      "## No tracking",
      "There are no advertising or cross-site tracking cookies on this site.",
      "## Preferences",
      "Theme and cart contents are stored in your browser's local storage, not sent to us.",
    ].join("\n\n"),
    excerpt: "Session cookies only — no ad tracking.",
  },
  {
    slug: "support",
    title: "Support policy",
    kind: "page",
    body: [
      "## What is included",
      "Support covers bugs, documentation gaps and upgrade questions for every license. We answer within one business day.",
      "## What is not",
      "Custom feature development, or debugging an application you built on top of the starter.",
      "## How to reach us",
      "Email support@kiln.dev with your order number, or use the contact form.",
    ].join("\n\n"),
    excerpt: "What support covers and how quickly we reply.",
  },
  {
    slug: "faq",
    title: "Frequently asked questions",
    kind: "faq",
    body: "",
    excerpt: "Licenses, updates, refunds and how the code is maintained.",
  },
  {
    slug: "about",
    title: "About the studio",
    kind: "page",
    body: "We sell the foundations we use every day. Three people, sixteen products, one maintenance calendar.",
    excerpt: "Who writes and maintains the code.",
  },
];

export async function seedPages(log = false) {
  await initDb();
  const db = getDb();
  for (const p of DEFAULT_PAGES) {
    await db
      .insert(t.pages)
      .values({
        slug: p.slug,
        title: p.title,
        kind: p.kind,
        body: p.body,
        excerpt: p.excerpt ?? "",
        category: p.category ?? "",
        readMinutes: p.readMinutes ?? 4,
        status: "published",
        from: p.from ?? "#17392b",
        to: p.to ?? "#4b8a64",
      })
      .onConflictDoNothing();
  }
  if (log) console.log(`  ${DEFAULT_PAGES.length} pages / policies`);
}

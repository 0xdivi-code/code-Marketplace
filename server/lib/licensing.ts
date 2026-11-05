/**
 * Licences.
 *
 * Four tiers, ordered. Everything downstream (checkout gating, library badges,
 * certificate PDFs, admin screens) reads this one list so a new tier is a
 * single edit rather than a hunt through string literals.
 */
import { getDb } from "../db/client";
import * as t from "../db/schema";

export const LICENSE_TIERS = ["personal", "commercial", "extended", "developer"] as const;
export type LicenseTier = (typeof LICENSE_TIERS)[number];

/** Higher rank means broader rights. Used to refuse downgrades. */
export const RANK: Record<LicenseTier, number> = {
  personal: 1,
  commercial: 2,
  extended: 3,
  developer: 4,
};

export const DEFAULT_TERMS: Record<LicenseTier, { name: string; summary: string; seats: string; terms: string }> = {
  personal: {
    name: "Personal",
    summary: "For your own projects. Not for client work or resale.",
    seats: "1 developer",
    terms:
      "Use the source in unlimited personal and hobby projects, including commercial products you own and operate yourself. You may not resell, redistribute or sublicense the source, nor hand it to a client as a deliverable.",
  },
  commercial: {
    name: "Commercial",
    summary: "Ship it in products you sell, including client work.",
    seats: "Up to 5 developers",
    terms:
      "Use the source in commercial products and client deliverables you build, including paid SaaS and apps. You may not redistribute the source as a template, boilerplate or competing product, and you may not sublicense it.",
  },
  extended: {
    name: "Extended",
    summary: "Unlimited projects, unlimited seats, one team.",
    seats: "Unlimited, one company",
    terms:
      "Everything in Commercial, with no project or seat limit for a single legal entity. Includes priority support. Redistribution of the source as a downloadable product remains prohibited.",
  },
  developer: {
    name: "Developer / Agency",
    summary: "Use it across every client project your studio ships.",
    seats: "Unlimited seats, unlimited client sites",
    terms:
      "For agencies and freelancers: deploy the source in an unlimited number of client projects, each under its own end-product. You may charge clients for the work built on top. You may not resell or publish the source itself.",
  },
};

export type LicenseInfo = { license: LicenseTier; name: string; summary: string; seats: string; terms: string };

/** Terms as stored by the admin, falling back to the built-in copy. */
export async function licenseTerms(): Promise<LicenseInfo[]> {
  const db = getDb();
  const rows = await db.select().from(t.licenseTerms).orderBy(t.licenseTerms.position);
  return LICENSE_TIERS.map((tier, i) => {
    const row = rows.find((r) => r.license === tier);
    const fallback = DEFAULT_TERMS[tier];
    return {
      license: tier,
      name: row?.name || fallback.name,
      summary: row?.summary || fallback.summary,
      seats: row?.seats || fallback.seats,
      terms: row?.terms || fallback.terms,
      ...(i === 0 && !rows.length ? {} : {}),
    };
  });
}

export function licenseName(tier: string): string {
  return DEFAULT_TERMS[tier as LicenseTier]?.name ?? tier;
}

/**
 * Human-facing certificate id, e.g. KL-P-7H2K-9QX4.
 *
 * The order number already identifies the sale; this adds the tier and a
 * checksum-looking tail so two licences on one order are distinguishable.
 */
export function certificateNumber(orderNumber: string, tier: LicenseTier, seed = randomSeed()): string {
  const initial = tier[0].toUpperCase();
  return `${orderNumber}-${initial}${seed.slice(0, 4)}-${seed.slice(4, 8)}`.toUpperCase();
}

function randomSeed(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid dictation errors
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Deterministic, printable certificate body — also used for the PDF-ish view. */
export function certificateText(input: {
  number: string;
  orderNumber: string;
  holder: string;
  product: string;
  tier: LicenseTier;
  issuedAt: Date;
  seats: string;
}): string {
  return [
    "KILN SOURCE CODE — LICENCE CERTIFICATE",
    "",
    `Certificate    ${input.number}`,
    `Order          ${input.orderNumber}`,
    `Licensee       ${input.holder}`,
    `Product        ${input.product}`,
    `Licence        ${DEFAULT_TERMS[input.tier]?.name ?? input.tier} (${input.tier})`,
    `Seats          ${input.seats || DEFAULT_TERMS[input.tier]?.seats || "—"}`,
    `Issued         ${input.issuedAt.toISOString().slice(0, 10)}`,
    "",
  ].join("\n");
}

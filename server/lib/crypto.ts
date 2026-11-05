/**
 * Password hashing and token helpers.
 *
 * scrypt from node:crypto — no native module to compile, and memory-hard by
 * design. Format: scrypt$N$r$p$salt$hash so parameters can be raised later
 * without invalidating existing hashes.
 */
import { randomBytes, scrypt, timingSafeEqual, createHash, randomInt } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

const N = 16384; // CPU/memory cost
const R = 8;
const P = 1;
const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await scryptAsync(password, salt, KEYLEN);
  return `scrypt$${N}$${R}$${P}$${salt}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, , , , salt, hex] = parts;
  const expected = Buffer.from(hex, "hex");
  const actual = await scryptAsync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Opaque token handed to the client. Only its hash is ever stored. */
export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Human-friendly order reference, e.g. KL-10482. */
export function orderNumber(): string {
  return `KL-${10000 + randomInt(9000)}`;
}

/** Six-digit code for email verification screens in development. */
export function sixDigitCode(): string {
  return String(randomInt(100000, 999999));
}

/** Timing-safe string comparison for tokens/codes. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

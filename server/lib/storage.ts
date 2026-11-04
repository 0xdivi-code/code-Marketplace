/**
 * Private object storage.
 *
 * Local filesystem implementation with a storage abstraction, so an S3/R2
 * backend can be dropped in for production. Two rules are enforced here:
 *
 *  1. Nothing under this root is ever served by the web server. Files live
 *     outside `public/` and are only reachable through a signed, expiring URL.
 *  2. A URL is signed over (key, expiry) with HMAC-SHA256. Changing the key or
 *     extending the expiry invalidates the signature.
 */
import { createHmac, randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile, readFile, rm, stat } from "node:fs/promises";
import { dirname, join, resolve, extname } from "node:path";

const ROOT = resolve(process.env.STORAGE_DIR ?? join(process.cwd(), ".data/storage"));
const SECRET = process.env.STORAGE_SECRET ?? "dev-only-insecure-storage-secret-change-me";

export const UPLOAD_LIMITS = {
  /** max size for a source-code ZIP */
  zipBytes: Number(process.env.UPLOAD_MAX_ZIP_BYTES ?? 200 * 1024 * 1024),
  /** max size for an image */
  imageBytes: Number(process.env.UPLOAD_MAX_IMAGE_BYTES ?? 8 * 1024 * 1024),
  /** max size for a document */
  docBytes: Number(process.env.UPLOAD_MAX_DOC_BYTES ?? 25 * 1024 * 1024),
};

const ZIP_MIME = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
  "multipart/x-zip",
]);
const IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/avif", "image/gif", "image/svg+xml"]);
const DOC_MIME = new Set([
  "application/pdf",
  "text/markdown",
  "text/plain",
  "application/json",
]);

export type UploadKind = "source_zip" | "image" | "document";

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * Validate by both filename and magic bytes. A .zip that is really an HTML file
 * (a common trick) is rejected.
 */
export function validateUpload(
  kind: UploadKind,
  filename: string,
  mime: string,
  bytes: Buffer,
): ValidationResult {
  const ext = extname(filename).toLowerCase();

  if (kind === "source_zip") {
    if (![".zip"].includes(ext)) return { ok: false, error: "Source packages must be .zip files" };
    if (!ZIP_MIME.has(mime)) return { ok: false, error: `Unexpected content type ${mime}` };
    // ZIP local file header "PK\x03\x04"
    if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) return { ok: false, error: "File is not a valid ZIP archive" };
    if (bytes.length > UPLOAD_LIMITS.zipBytes)
      return { ok: false, error: `ZIP exceeds ${Math.round(UPLOAD_LIMITS.zipBytes / 1024 / 1024)} MB limit` };
    return { ok: true };
  }

  if (kind === "image") {
    if (![".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg"].includes(ext))
      return { ok: false, error: "Unsupported image type" };
    if (!IMAGE_MIME.has(mime)) return { ok: false, error: `Unexpected content type ${mime}` };
    if (bytes.length > UPLOAD_LIMITS.imageBytes)
      return { ok: false, error: `Image exceeds ${Math.round(UPLOAD_LIMITS.imageBytes / 1024 / 1024)} MB limit` };
    return { ok: true };
  }

  if (![".pdf", ".md", ".txt", ".json"].includes(ext))
    return { ok: false, error: "Unsupported document type" };
  if (!DOC_MIME.has(mime)) return { ok: false, error: `Unexpected content type ${mime}` };
  if (bytes.length > UPLOAD_LIMITS.docBytes) return { ok: false, error: "Document is too large" };
  return { ok: true };
}

/** Random storage key — never derived from user input, so no traversal. */
export function storageKey(kind: UploadKind, filename: string, productId: string): string {
  const ext = extname(filename).toLowerCase().replace(/[^a-z0-9.]/g, "");
  const stamp = new Date().toISOString().slice(0, 10);
  return `${kind}/${productId}/${stamp}/${randomBytes(12).toString("hex")}${ext}`;
}

/** Reject any key that escapes the storage root. */
function safePath(key: string): string {
  const p = resolve(join(ROOT, key));
  if (!p.startsWith(ROOT + "/")) throw new Error("Invalid storage key");
  return p;
}

export async function put(key: string, bytes: Buffer): Promise<{ checksum: string; bytes: number }> {
  const path = safePath(key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes, { mode: 0o600 });
  return { checksum: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length };
}

/**
 * Stream a request body straight to disk with a hard byte ceiling.
 *
 * Used for uploads so a 200 MB ZIP never has to sit in memory. The first bytes
 * are returned so the caller can sniff magic numbers, and the checksum is
 * computed as the stream is written.
 */
export async function putStream(
  key: string,
  body: AsyncIterable<Uint8Array>,
  maxBytes: number,
): Promise<{ checksum: string; bytes: number; head: Buffer }> {
  const path = safePath(key);
  await mkdir(dirname(path), { recursive: true });

  const { createWriteStream } = await import("node:fs");
  const out = createWriteStream(path, { mode: 0o600 });
  const hash = createHash("sha256");
  let total = 0;
  let head = Buffer.alloc(0);

  try {
    for await (const chunk of body) {
      const buf = Buffer.from(chunk);
      total += buf.length;
      if (total > maxBytes) throw new Error(`PAYLOAD_TOO_LARGE:${maxBytes}`);
      if (head.length < 16) head = Buffer.concat([head, buf]).subarray(0, 16);
      hash.update(buf);
      if (!out.write(buf)) await new Promise((r) => out.once("drain", r));
    }
  } catch (err) {
    out.destroy();
    await rm(path, { force: true });
    throw err;
  }

  await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
  return { checksum: hash.digest("hex"), bytes: total, head };
}

/** True when the first bytes look like a ZIP local file header. */
export function looksLikeZip(head: Buffer): boolean {
  return (
    head.length >= 4 &&
    head[0] === 0x50 &&
    head[1] === 0x4b &&
    ((head[2] === 0x03 && head[3] === 0x04) || (head[2] === 0x05 && head[3] === 0x06))
  );
}

export async function get(key: string): Promise<Buffer> {
  return readFile(safePath(key));
}

export async function size(key: string): Promise<number> {
  const s = await stat(safePath(key));
  return s.size;
}

export async function remove(key: string): Promise<void> {
  await rm(safePath(key), { force: true });
}

/* ------------------------------------------------------------- signed URLs */

export const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes

function sign(key: string, expires: number): string {
  return createHmac("sha256", SECRET).update(`${key}:${expires}`).digest("base64url");
}

export interface SignedUrlOptions {
  ttlSeconds?: number;
  /** download name offered to the browser */
  filename?: string;
  mime?: string;
}

/** Build a short-lived URL. This is the ONLY way a source file is reachable. */
export function signedUrl(key: string, options: SignedUrlOptions = {}): string {
  const { ttlSeconds = SIGNED_URL_TTL_SECONDS, filename, mime } = options;
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const params = new URLSearchParams({ expires: String(expires), signature: sign(key, expires) });
  if (filename) params.set("name", filename);
  if (mime) params.set("mime", mime);
  return `/api/files/${encodeURIComponent(key)}?${params.toString()}`;
}

/** Boolean form used by the download route. Constant-time comparison. */
export function verifySignature(key: string, expires: number, signature: string): boolean {
  if (!Number.isFinite(expires) || expires <= 0) return false;
  if (expires * 1000 < Date.now()) return false;
  const a = Buffer.from(sign(key, expires));
  const b = Buffer.from(String(signature));
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ---------------------------------------------------------- public assets */

/**
 * Marketing assets (product covers, category images, avatars) are meant to be
 * seen, so they get a plain stable path. Source archives never do: the asset
 * route refuses anything that is not an image.
 */
export function publicAssetUrl(key: string): string {
  return `/api/assets/${key}`;
}

export function isPublicAsset(key: string): boolean {
  return key.startsWith("image/") && /\.(png|jpe?g|webp|avif|gif|svg)$/i.test(key);
}

export const STORAGE_ROOT = ROOT;

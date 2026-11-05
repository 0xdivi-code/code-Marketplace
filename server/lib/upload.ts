/**
 * Multipart upload helper for admin endpoints.
 *
 * `readUpload` buffers small files (images, documents) via busboy.
 * `readStreamUpload` takes a raw request body and pipes a ZIP straight to disk,
 * so a 200 MB archive never occupies memory. Both write to private storage and
 * return the metadata the caller persists in the DB.
 */
import Busboy from "busboy";
import type { IncomingMessage } from "node:http";
import { randomBytes } from "node:crypto";
import { UPLOAD_LIMITS, put, looksLikeZip, type UploadKind } from "./storage";

export interface UploadedFile {
  storageKey: string;
  originalName: string;
  mimeType: string;
  bytes: number;
  checksum: string;
}

export class UploadError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const MAX_BY_KIND: Record<UploadKind, number> = {
  source_zip: UPLOAD_LIMITS.zipBytes,
  image: UPLOAD_LIMITS.imageBytes,
  document: UPLOAD_LIMITS.docBytes,
};

const ZIP_MIME = new Set(["application/zip", "application/x-zip-compressed", "application/octet-stream", "multipart/x-zip"]);
const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg"];
const IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/avif", "image/gif", "image/svg+xml"]);
const DOC_EXT = [".pdf", ".md", ".txt", ".json", ".zip"];
const DOC_MIME = new Set(["application/pdf", "text/markdown", "text/plain", "application/json", "application/zip", "application/x-zip-compressed"]);

function extension(name: string) {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

/**
 * Parse one multipart file from the request.
 *
 * `kindHint` decides which rules apply. When it is `image` we also require the
 * filename extension to agree with the reported MIME type, which blocks the
 * "rename anything to .png" trick.
 */
export async function readUpload(
  req: Request,
  nodeRequest: IncomingMessage,
  opts: { kind: "image" | "document"; productId?: string; field?: string },
): Promise<UploadedFile> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    throw new UploadError("Expected a multipart/form-data upload", 415);
  }

  const maxBytes = MAX_BY_KIND[opts.kind];
  const field = opts.field ?? "file";

  return new Promise<UploadedFile>((resolve, reject) => {
    let settled = false;
    const fail = (err: Error) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    };

    let bb: Busboy.Busboy;
    try {
      bb = Busboy({
        headers: { ...nodeRequest.headers, "content-type": contentType } as never,
        limits: {
          files: 1,
          fileSize: maxBytes,
          fields: 8,
          fieldSize: 1024 * 64,
        },
      });
    } catch {
      return fail(new UploadError("Malformed upload request", 400));
    }

    let seen = false;

    bb.on("file", (name, stream, info) => {
      if (seen || name !== field) {
        stream.resume();
        return;
      }
      seen = true;

      const originalName = (info.filename ?? "upload.bin").replace(/[^\w.\- ()]/g, "_").slice(0, 180);
      const mime = (info.mimeType ?? "application/octet-stream").toLowerCase();
      const ext = extension(originalName);

      if (opts.kind === "image") {
        if (!IMAGE_EXT.includes(ext)) return fail(new UploadError("Images must be PNG, JPG, WEBP, AVIF, GIF or SVG"));
        if (!IMAGE_MIME.has(mime)) return fail(new UploadError(`Unexpected image type: ${mime}`));
      } else {
        if (!DOC_EXT.includes(ext)) return fail(new UploadError("Documents must be PDF, MD, TXT or JSON"));
        if (!DOC_MIME.has(mime)) return fail(new UploadError(`Unexpected document type: ${mime}`));
      }

      const chunks: Buffer[] = [];
      let size = 0;
      let truncated = false;

      stream.on("data", (chunk: Buffer) => {
        // Images and documents are small enough to buffer; archives never come
        // through here.
        size += chunk.length;
        chunks.push(chunk);
      });

      stream.on("limit", () => {
        truncated = true;
        fail(new UploadError(`File exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit`, 413));
      });

      stream.on("end", async () => {
        if (settled) return;
        if (truncated) return;
        try {
          const date = new Date().toISOString().slice(0, 10);
          const scope = opts.productId ?? "shared";
          const key = `${opts.kind}/${scope}/${date}/${randomBytes(12).toString("hex")}${ext}`;

          const bytesBuf = Buffer.concat(chunks);
          if (opts.kind === "image" && bytesBuf.length === 0) {
            throw new UploadError("That image is empty");
          }
          const res = await put(key, bytesBuf);
          settled = true;
          resolve({
            storageKey: key,
            originalName,
            mimeType: mime,
            bytes: res.bytes,
            checksum: res.checksum,
          });
        } catch (err) {
          fail(err instanceof Error ? err : new UploadError("Upload failed", 500));
        }
      });

      stream.on("error", () => fail(new UploadError("Upload was interrupted", 400)));
    });

    bb.on("error", () => fail(new UploadError("Malformed upload request", 400)));
    bb.on("finish", () => {
      if (!seen) fail(new UploadError("No file was included in the request"));
    });

    nodeRequest.pipe(bb);
  });
}

/**
 * Archive uploads: stream to disk with a byte ceiling, then verify the ZIP magic
 * bytes before accepting. Invalid archives are deleted immediately.
 */
export async function readStreamUpload(
  req: Request,
  body: AsyncIterable<Uint8Array>,
  opts: { kind: UploadKind; productId?: string },
): Promise<UploadedFile> {
  const contentType = req.headers.get("content-type") ?? "";
  const name = decodeURIComponent(req.headers.get("x-filename") ?? "source.zip").replace(/[^\w.\- ()]/g, "_").slice(0, 180);
  const maxBytes = MAX_BY_KIND[opts.kind];

  const { storageKey, putStream, remove } = await import("./storage");
  const ext = extension(name);
  if (ext !== ".zip") throw new UploadError("Source packages must be .zip files");

  const key = storageKey("source_zip", name, opts.productId ?? "shared");
  const mime = (req.headers.get("content-type") ?? "application/zip").split(";")[0];

  let result: { checksum: string; bytes: number; head: Buffer };
  try {
    result = await putStream(key, body, maxBytes);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("PAYLOAD_TOO_LARGE")) {
      throw new UploadError(`File exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit`, 413);
    }
    throw new UploadError("Upload was interrupted", 400);
  }

  if (!looksLikeZip(result.head)) {
    await remove(key);
    throw new UploadError("File is not a valid ZIP archive");
  }
  if (result.bytes === 0) {
    await remove(key);
    throw new UploadError("That archive is empty");
  }

  return {
    storageKey: key,
    originalName: name,
    mimeType: ZIP_MIME.has(mime) ? mime : "application/zip",
    bytes: result.bytes,
    checksum: result.checksum,
  };
}

export { MAX_BY_KIND };

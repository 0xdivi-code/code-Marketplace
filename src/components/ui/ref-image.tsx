import * as React from "react";
import { cn } from "@/lib/utils";
import { ARTWORK } from "@/data/artwork";

/**
 * Image that removes itself if the file is missing, revealing whatever sits
 * behind it (a gradient, usually). Keeps the layout intact while the reference
 * asset set is still being dropped in, instead of showing a broken-image icon.
 *
 * It also resolves artwork at render time. The database stores whatever path
 * was current when the row was seeded, so a product row can keep pointing at a
 * reference capture long after real artwork for it was imported. Rather than
 * require a reseed for new images to appear, a stored path is translated back
 * to its artwork key and re-resolved here: a matching entry in ARTWORK wins,
 * otherwise the stored path is used as-is.
 */
export function RefImage({
  src,
  alt = "",
  className,
  hover = false,
}: {
  src?: string;
  alt?: string;
  className?: string;
  /** subtle zoom on card hover */
  hover?: boolean;
}) {
  const [ok, setOk] = React.useState(true);
  const resolved = React.useMemo(() => resolveArtwork(src), [src]);

  // a different image is a different element: clear the error state, or one
  // 404 would keep a product blank after its artwork was replaced
  React.useEffect(() => setOk(true), [resolved]);

  if (!resolved || !ok) return null;
  return (
    <img
      src={resolved}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setOk(false)}
      className={cn(
        "absolute inset-0 size-full object-cover",
        hover && "transition-transform duration-700 group-hover:scale-[1.04] group-hover/card:scale-[1.03]",
        className,
      )}
    />
  );
}

/**
 * Map a stored path back to its artwork key and prefer imported artwork.
 *
 * Stored paths are one of:
 *   /img/ref/<key>.webp                    — a reference capture
 *   /img/art/<key>.<ext>                   — artwork from an earlier import
 *   https://<uploads>/.../<random>.webp     — an admin-uploaded original
 * The last kind has no artwork key and is passed through untouched, so an
 * owner's upload is never overridden by a bulk import.
 */
export function resolveArtwork(src?: string): string | undefined {
  if (!src) return undefined;
  const m = /^\/img\/(?:ref|art)\/([A-Za-z0-9._-]+?)(?:\.[a-z0-9]+)?$/i.exec(src);
  const key = m?.[1];
  return (key && ARTWORK[key]) || src;
}

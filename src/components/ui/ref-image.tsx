import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Image that removes itself if the file is missing, revealing whatever sits
 * behind it (a gradient, usually). Keeps the layout intact while the reference
 * asset set is still being dropped in, instead of showing a broken-image icon.
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
  if (!src || !ok) return null;
  return (
    <img
      src={src}
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

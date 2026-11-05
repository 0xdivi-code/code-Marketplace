import { Link } from "react-router-dom";
import type { Category } from "@/data/types";
import { RefImage } from "@/components/ui/ref-image";
import { cn } from "@/lib/utils";

/**
 * A category shelf.
 *
 * Portrait on purpose: eight of them sit in one row on a wide screen, and 3/4
 * reads as a poster wall rather than a strip of banners. The caption is layered
 * over a scrim because the photography behind it is arbitrary — a light frame
 * would otherwise swallow white text.
 */
export function CategoryTile({
  category,
  count,
  index = 0,
}: {
  category: Category;
  count: number;
  index?: number;
}) {
  return (
    <div
      style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
      className="animate-rise min-w-0"
    >
      <Link
        to={`/category/${category.slug}`}
        className={cn(
          "group relative block aspect-[3/4] overflow-hidden rounded-xl bg-surface-sunken text-white",
          "lift",
          "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none",
        )}
      >
        {/*
         * The gradient is the base layer, never a branch of the image. RefImage
         * renders nothing when a file is missing, so making the two exclusive
         * left a bare beige tile whenever an image failed to load.
         */}
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${category.from}, ${category.to})` }}
        >
          <svg
            viewBox="0 0 300 400"
            className="absolute inset-0 size-full opacity-40 transition-transform duration-700 group-hover:scale-105"
            aria-hidden
          >
            <circle cx="240" cy="70" r="70" fill="white" opacity="0.08" />
            <circle cx="70" cy="320" r="54" fill="white" opacity="0.06" />
            <path
              d="M0 300 Q 75 260 150 300 T 300 280"
              stroke="white"
              strokeWidth="1"
              fill="none"
              opacity="0.25"
            />
          </svg>
        </div>
        {category.src && <RefImage src={category.src} alt="" hover />}

        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />

        <span className="absolute inset-x-3 bottom-3 block">
          <span className="line-clamp-2 block text-[0.8125rem] font-semibold leading-tight sm:text-[0.875rem]">
            {category.name}
          </span>
          <span className="mt-0.5 block text-[0.6875rem] opacity-80">
            {count} item{count === 1 ? "" : "s"}
          </span>
        </span>
      </Link>
    </div>
  );
}

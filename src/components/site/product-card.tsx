import * as React from "react";
import { Link } from "react-router-dom";
import { Check, Heart, ShoppingCart, Star } from "lucide-react";
import type { Product } from "@/data/types";
import { ProductArt } from "@/components/ui/product-art";
import { Badge } from "@/components/ui/badge";
import { cn, money } from "@/lib/utils";
import { useCart, useWishlist } from "@/lib/store";
import { authorBySlug, categoryBySlug } from "@/data/catalog";

/**
 * The catalogue card.
 *
 * Two things drive the design here. First, the card needs to read as an object
 * sitting on the page: a real surface, a hairline border and a shadow that
 * deepens on hover, rather than artwork floating on the background. Second, it
 * has to work at the five-up density the storefront uses, so the meta block is
 * compact and the actions collapse to icons.
 *
 * Nothing about the hover state moves the layout — the lift is a transform, so
 * neighbouring cards never shift as the pointer travels across a row.
 */
export function ProductCard({
  product,
  index = 0,
  variant = "default",
}: {
  product: Product;
  index?: number;
  variant?: "default" | "compact" | "spotlight";
}) {
  const wishlist = useWishlist();
  const { add, lines } = useCart();
  const author = authorBySlug(product.author);
  const category = categoryBySlug(product.category);
  const isWished = wishlist.slugs.includes(product.slug);
  const inCart = lines.some((l) => l.productSlug === product.slug);

  if (variant === "compact") {
    return (
      <Link
        to={`/item/${product.slug}`}
        className="group flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-surface-2"
      >
        <ProductArt
          {...product.art}
          kind={product.art.kind}
          className="h-14 w-16 shrink-0 rounded-sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8125rem] font-medium">{product.name}</p>
          <p className="truncate text-[0.6875rem] text-ink-3">{author?.name}</p>
        </div>
        <span className="font-mono text-[0.75rem] text-ink-2">{money(product.price)}</span>
      </Link>
    );
  }

  return (
    <article
      // CSS entrance, not framer: framer leaves an inline transform behind, and
      // an inline transform outranks the hover translate — the card could never
      // lift. A keyframe that ends at `none` leaves nothing to fight.
      style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
      className={cn(
        "animate-rise",
        "group/card relative flex h-full min-w-0 flex-col overflow-hidden rounded-md",
        "border border-line bg-surface shadow-[var(--shadow-card)]",
        // plain-CSS lift: works against framer's inline transform and in engines
        // that ignore the `translate` property Tailwind v4 emits
        "lift",
        variant === "spotlight" && "col-span-full",
      )}
    >
      <Link
        to={`/item/${product.slug}`}
        tabIndex={-1}
        aria-hidden
        className="relative block overflow-hidden bg-surface-2"
      >
        <ProductArt
          {...product.art}
          kind={product.art.kind}
          className={cn(
            "w-full transition-transform duration-500 ease-out group-hover/card:scale-[1.03]",
            variant === "spotlight" ? "aspect-[16/7]" : "aspect-[4/3]",
          )}
        />

        {/*
         * A soft inner rim over the artwork. Photography clashes with the page
         * when it meets the border edge-on; this keeps the card reading as a
         * framed object in both light and dark themes.
         */}
        <span className="pointer-events-none absolute inset-0 rounded-t-md ring-1 ring-inset ring-black/5 dark:ring-white/10" />

        <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          {product.free && (
            <Badge variant="solid" size="sm" className="bg-white text-[#171717] shadow-sm">
              Free
            </Badge>
          )}
          {product.new && !product.free && (
            <Badge variant="glass" size="sm" className="backdrop-blur-md">
              New
            </Badge>
          )}
          {product.bestseller && (
            <Badge variant="glass" size="sm" className="backdrop-blur-md">
              Bestseller
            </Badge>
          )}
        </div>
      </Link>

      {/* wishlist sits above the image link, so it must be a sibling not a child */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          wishlist.toggle(product.slug);
        }}
        aria-label={isWished ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
        aria-pressed={isWished}
        className={cn(
          "absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full",
          "bg-white/85 text-ink shadow-sm backdrop-blur transition-all duration-300",
          "hover:bg-white focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
          /*
           * Always visible on touch. Tailwind v4 wraps `hover:` in
           * `@media (hover: hover)`, so on any finger-driven device the button
           * below would otherwise never appear — `pointer-coarse` is the escape
           * hatch, and it is why the save action is reachable on a phone at all.
           */
          "opacity-0 pointer-fine:opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100",
          "pointer-coarse:opacity-100",
          isWished && "bg-accent text-accent-fg opacity-100 hover:bg-accent",
        )}
      >
        <Heart className={cn("size-3.5", isWished && "fill-current")} />
      </button>

      <div className="flex flex-1 flex-col p-3.5">
        <p className="truncate text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-ink-3">
          {category?.name}
        </p>

        <h3 className="mt-1 line-clamp-2 text-[0.875rem] font-semibold leading-snug">
          <Link
            to={`/item/${product.slug}`}
            className="transition-colors hover:text-accent-ink focus-visible:text-accent-ink dark:hover:text-accent"
          >
            {product.name}
          </Link>
        </h3>

        <p className="mt-0.5 truncate text-xs text-ink-3">
          by <span className="text-ink-2">{author?.name}</span>
        </p>

        {product.rating > 0 && (
          <div className="mt-1.5">
            <span
              className="inline-flex items-center gap-1 text-xs text-ink-3"
              aria-label={`${product.rating.toFixed(1)} out of 5`}
            >
              <Star className="size-3.5 fill-gold text-gold" />
              <span className="font-medium text-ink-2">{product.rating.toFixed(1)}</span>
              <span>({product.reviews})</span>
            </span>
          </div>
        )}

        {/* mt-auto keeps prices on one line across a row of uneven titles */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <div className="min-w-0">
            <span className="inline-flex items-baseline gap-1.5 tabular-nums">
              <span className="font-mono text-[0.8125rem] font-semibold text-ink">
                {money(product.price)}
              </span>
              {product.compareAt && (
                <span className="font-mono text-[0.6875rem] text-ink-3 line-through">
                  {money(product.compareAt)}
                </span>
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (!inCart) add(product.slug);
            }}
            aria-label={inCart ? `${product.name} is in the cart` : `Add ${product.name} to cart`}
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-full transition-all duration-200",
              "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none",
              inCart
                ? "bg-brand-soft text-brand dark:bg-brand-soft dark:text-brand"
                : "bg-brand text-brand-ink hover:brightness-110 active:scale-95",
            )}
          >
            {inCart ? <Check className="size-4" /> : <ShoppingCart className="size-4" />}
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProductRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}

import * as React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, Star, Download } from "lucide-react";
import type { Product } from "@/data/types";
import { ProductArt } from "@/components/ui/product-art";
import { Badge } from "@/components/ui/badge";
import { cn, compact, money } from "@/lib/utils";
import { useCart, useWishlist } from "@/lib/store";
import { authorBySlug, categoryBySlug } from "@/data/catalog";

const ease = [0.22, 1, 0.36, 1] as const;

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
  const { add } = useCart();
  const author = authorBySlug(product.author);
  const category = categoryBySlug(product.category);
  const isWished = wishlist.slugs.includes(product.slug);

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
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.04, 0.24), ease }}
      className={cn("group relative", variant === "spotlight" && "col-span-full")}
    >
      <Link to={`/item/${product.slug}`} className="block">
        <div className="relative overflow-hidden rounded-md bg-surface-2">
          <ProductArt
            {...product.art}
            kind={product.art.kind}
            className={cn(
              "w-full transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.035]",
              variant === "spotlight" ? "aspect-[16/7]" : "aspect-[4/3]",
            )}
          />

          <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
            {product.free && (
              <Badge variant="solid" size="sm" className="bg-white text-[#17392b]">
                Free
              </Badge>
            )}
            {product.new && !product.free && (
              <Badge variant="glass" size="sm">
                New
              </Badge>
            )}
            {product.bestseller && (
              <Badge variant="glass" size="sm">
                Bestseller
              </Badge>
            )}
          </div>

          <div className="absolute inset-x-2.5 bottom-2.5 flex translate-y-2 items-center justify-between gap-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <span className="rounded-full bg-white/92 px-2.5 py-1 font-mono text-[0.625rem] font-medium text-[#17392b] backdrop-blur">
              {product.stack.slice(0, 2).join(" · ")}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-[#17392b] px-2.5 py-1 text-[0.625rem] font-medium text-white">
              <Download className="size-3" /> {compact(product.sales)}
            </span>
          </div>
        </div>
      </Link>

      <button
        onClick={(e) => {
          e.preventDefault();
          wishlist.toggle(product.slug);
        }}
        aria-label={isWished ? "Remove from wishlist" : "Save to wishlist"}
        aria-pressed={isWished}
        className={cn(
          "absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full bg-white/85 text-[#17392b] opacity-0 backdrop-blur transition-all duration-300 hover:bg-white group-hover:opacity-100",
          isWished && "opacity-100",
          isWished && "bg-accent text-white hover:bg-accent",
        )}
      >
        <Heart className={cn("size-3.5", isWished && "fill-current")} />
      </button>

      <div className="mt-3">
        <div className="flex items-center gap-1.5">
          <span className="label-mono text-[0.5625rem] text-ink-3">{category?.name}</span>
          {product.rating > 0 && (
            <>
              <span className="text-ink-3/60">·</span>
              <span className="flex items-center gap-0.5 text-[0.625rem] text-ink-2">
                <Star className="size-2.5 fill-gold text-gold" />
                <span className="font-medium">{product.rating.toFixed(1)}</span>
                <span className="text-ink-3">({product.reviews})</span>
              </span>
            </>
          )}
        </div>
        <h3 className="mt-1 line-clamp-1 font-display text-[1.0625rem] leading-snug tracking-[-0.01em]">
          <Link to={`/item/${product.slug}`} className="hover:text-accent-ink dark:hover:text-accent">
            {product.name}
          </Link>
        </h3>
        <p className="mt-0.5 line-clamp-1 text-[0.75rem] text-ink-2">{product.tagline}</p>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-[0.6875rem] text-ink-3">by {author?.name}</span>
          <span className="flex items-baseline gap-1.5">
            {product.compareAt && (
              <span className="font-mono text-[0.6875rem] text-ink-3 line-through">
                {money(product.compareAt)}
              </span>
            )}
            <span className="font-mono text-[0.8125rem] font-medium text-ink">
              {money(product.price)}
            </span>
          </span>
        </div>
      </div>
    </motion.article>
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


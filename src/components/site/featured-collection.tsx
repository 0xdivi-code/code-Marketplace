import { Link } from "react-router-dom";
import { ArrowRight, Quote } from "lucide-react";
import { ProductArt } from "@/components/ui/product-art";
import { RefImage } from "@/components/ui/ref-image";
import type { Product } from "@/data/types";
import { cn } from "@/lib/utils";

/**
 * "The creator's toolkit" — an editorial band that sits between catalogue
 * sections and gives the page a beat of contrast.
 *
 * Three columns on a wide screen: the pitch, a mosaic built from real catalogue
 * covers, and a pull quote. The mosaic is deliberately not a uniform grid — a
 * hero tile across two rows beside three stacked ones is what makes the block
 * read as an editorial spread rather than more product listings.
 */
export function FeaturedCollection({
  items,
  eyebrow = "Featured collection",
  title,
  accent,
  body,
  href,
  cta = "Explore collections",
  quote,
}: {
  items: Product[];
  eyebrow?: string;
  title: string;
  accent?: string;
  body: string;
  href: string;
  cta?: string;
  quote?: string;
}) {
  // Four tiles: one hero (spans two rows) and three supporting.
  const [hero, ...rest] = items;
  if (!hero) return null;
  const support = rest.slice(0, 3);

  return (
    <section
      /*
       * The reference marks this band `data-scheme="brand"`, which in StoreKitt
       * means the deep brand canvas with light text — not another white
       * section. It is the page's one saturated beat between catalogue rows, so
       * it is worth honouring exactly.
       */
      className="bg-brand text-brand-ink"
      style={{
        paddingTop: "calc(var(--tk-section-space) * 0.75)",
        paddingBottom: "calc(var(--tk-section-space) * 0.75)",
      }}
    >
      <div className="container-x grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)_minmax(0,0.45fr)] lg:gap-12">
        <div>
          <p className="tk-eyebrow mb-4 text-brand-ink/75">{eyebrow}</p>
          <h2 className="text-[clamp(2rem,3.6vw,3rem)] leading-[1.05]">
            {title}
            {accent && <span className="text-accent"> {accent}</span>}
          </h2>
          <p className="mt-5 max-w-sm text-[0.9375rem] leading-relaxed text-brand-ink/70">{body}</p>
          <Link
            to={href}
            className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-brand-ink px-6 text-[0.9375rem] font-medium text-brand transition-transform hover:-translate-y-0.5"
          >
            {cta}
            <ArrowRight className="size-[18px]" />
          </Link>
        </div>

        {/* Mosaic. Explicit placement rather than col-span guesses: a hero
            across two rows on the left, two stacked beside it, one underneath.
            Heights come from the parent's two fixed rows, so every tile shares
            one plane. */}
        <div className="grid h-[22rem] grid-cols-6 grid-rows-2 gap-3 sm:h-[26rem]">
          <Link
            to={`/item/${hero.slug}`}
            className="group col-span-3 row-span-2 overflow-hidden rounded-xl"
            aria-label={hero.name}
          >
            <Tile product={hero} />
          </Link>
          {support[0] && (
            <Link
              to={`/item/${support[0].slug}`}
              className="group col-span-3 overflow-hidden rounded-xl"
              aria-label={support[0].name}
            >
              <Tile product={support[0]} />
            </Link>
          )}
          {support[1] && (
            <Link
              to={`/item/${support[1].slug}`}
              className="group col-span-3 overflow-hidden rounded-xl"
              aria-label={support[1].name}
            >
              <Tile product={support[1]} />
            </Link>
          )}
        </div>

        {quote && (
          <blockquote className="hidden lg:block">
            <Quote className="mb-3 size-7 text-brand-ink/40" aria-hidden />
            <p className="font-display text-2xl leading-snug text-brand-ink/90">{quote}</p>
          </blockquote>
        )}
      </div>
    </section>
  );
}

function Tile({ product, className }: { product: Product; className?: string }) {
  return (
    <span className={cn("relative block size-full overflow-hidden", className)}>
      {/*
       * Gradient underneath, real cover on top — never a branch. RefImage
       * renders nothing when its file is missing, and the reference art set is
       * fetched rather than committed, so branching on `art.src` left the whole
       * mosaic blank. The generated art is the floor.
       */}
      <ProductArt
        {...product.art}
        kind={product.art.kind}
        className="size-full transition-transform duration-700 group-hover:scale-[1.03]"
      />
      {product.art.src && <RefImage src={product.art.src} alt={product.name} hover />}
    </span>
  );
}

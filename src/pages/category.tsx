import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { CategoryGlyph } from "@/lib/category-icons";
import { RefImage } from "@/components/ui/ref-image";
import { ProductCard } from "@/components/site/product-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { categories, categoryBySlug, products } from "@/data/catalog";
import { SortMenu } from "@/components/site/sort-menu";
import { sortProducts } from "@/components/site/filter-rail";
import NotFoundPage from "./not-found";

export default function CategoryPage() {
  const { slug = "" } = useParams();
  const category = categoryBySlug(slug);
  const [sort, setSort] = React.useState("popular");

  if (!category) return <NotFoundPage />;

  const list = sortProducts(
    products.filter((p) => p.category === category.slug),
    sort,
  );
  const others = categories.filter((c) => c.slug !== category.slug).slice(0, 4);

  return (
    <div>
      <section
        className="relative overflow-hidden border-b border-line"
        style={{ background: `linear-gradient(120deg, ${category.from} 0%, ${category.to} 100%)` }}
      >
        {/* The owner's thumbnail, when there is one. The gradient above stays
            underneath, so a missing or broken file degrades to the flat colour
            rather than a hole, and the scrim keeps the white copy readable over
            an arbitrary photo. */}
        {category.src && <RefImage src={category.src} alt="" className="object-cover opacity-90" />}
        {category.src && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.72), rgba(0,0,0,0.28))" }}
          />
        )}
        <div className="container-x relative py-12 text-white sm:py-16">
          <nav className="label-mono mb-5 flex items-center gap-2 text-[0.5625rem] text-white/60">
            <Link to="/" className="hover:text-white">
              Home
            </Link>
            <span>/</span>
            <Link to="/browse" className="hover:text-white">
              Browse
            </Link>
            <span>/</span>
            <span className="text-white/85">{category.name}</span>
          </nav>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl text-[2.2rem] leading-[1.02] sm:text-[3rem]"
          >
            {category.name}
          </motion.h1>
          <p className="mt-3 max-w-lg text-[0.9375rem] leading-relaxed text-white/70">
            {category.blurb}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Badge variant="glass" size="lg">
              {list.length} item{list.length === 1 ? "" : "s"}
            </Badge>
            <Badge variant="glass" size="lg">
              Lifetime updates
            </Badge>
            <Badge variant="glass" size="lg">
              Readable source
            </Badge>
          </div>
          <svg
            viewBox="0 0 600 200"
            className="pointer-events-none absolute -right-10 top-0 h-full w-1/2 opacity-40"
            aria-hidden
          >
            <circle cx="480" cy="40" r="90" fill="white" opacity="0.07" />
            <circle cx="380" cy="170" r="60" fill="white" opacity="0.05" />
            <path d="M0 150 Q150 90 300 140 T600 110" stroke="white" strokeWidth="1" fill="none" opacity="0.2" />
          </svg>
        </div>
      </section>

      <div className="container-x py-10">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-ink-2">
            Showing <span className="font-medium text-ink">{list.length}</span> items
          </p>
          <SortMenu value={sort} onChange={setSort} />
        </div>

        {list.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line-strong py-20 text-center">
            <p className="font-display text-xl">Nothing here yet</p>
            <p className="mt-1.5 text-sm text-ink-2">This shelf is being restocked.</p>
            <Button asChild variant="outline" size="sm" className="mt-5">
              <Link to="/browse">Browse everything</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {list.map((p, i) => (
              <ProductCard key={p.slug} product={p} index={i} />
            ))}
          </div>
        )}

        <div className="mt-16 border-t border-line pt-8">
          <h2 className="label-mono mb-4 text-[0.5625rem] text-ink-3">Other shelves</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {others.map((c) => (
              <Link
                key={c.slug}
                to={`/category/${c.slug}`}
                className="group flex items-center justify-between rounded-md border border-line p-3.5 transition-colors hover:bg-surface-2"
              >
                <span className="flex items-center gap-2.5">
                  <span className="grid size-7 place-items-center rounded border border-line bg-surface-2 text-ink-2">
                    <CategoryGlyph glyph={c.glyph} className="size-3.5" />
                  </span>
                  <span className="text-[0.8125rem] font-medium">{c.name}</span>
                </span>
                <ArrowUpRight className="size-3.5 text-ink-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-lg border border-line bg-surface p-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-display text-xl">Not sure which item fits?</p>
            <p className="mt-1 text-sm text-ink-2">
              Tell us the stack and the deadline — we’ll point at the smallest thing that works.
            </p>
          </div>
          <Button asChild>
            <Link to="/contact">
              Ask the studio <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

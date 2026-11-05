import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { Product } from "@/data/types";
import { ProductCard } from "@/components/site/product-card";
import { cn } from "@/lib/utils";

/**
 * "Explore the marketplace" — four tabs over the catalogue.
 *
 * The reference switches the whole grid rather than paginating one list, so
 * each tab is a different sort of the same catalogue. Tabs are hand-rolled
 * instead of reusing the Radix pill group for one reason: the reference puts
 * the selected pill in the brand fill and the rest in plain bordered chips,
 * which is the opposite emphasis of the pill group we use elsewhere.
 */

type Sort = "newest" | "bestselling" | "rating";

const TABS: { value: Sort; label: string }[] = [
  { value: "newest", label: "New releases" },
  { value: "bestselling", label: "Best sellers" },
  { value: "rating", label: "Top rated" },
];

/** Newest first, but "new" badges before merely-recent — that is the ordering
 *  the reference implies, and it keeps the tab from looking shuffled. */
function sortFor(products: Product[], sort: Sort): Product[] {
  const copy = [...products];
  if (sort === "rating") {
    return copy.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
  }
  if (sort === "bestselling") {
    return copy.sort((a, b) => b.sales - a.sales);
  }
  return copy.sort((a, b) => +new Date(b.released) - +new Date(a.released));
}

export function ProductShowcase({
  products,
  limit = 8,
}: {
  products: Product[];
  limit?: number;
}) {
  const [sort, setSort] = React.useState<Sort>("newest");

  /*
   * Deliberately not memoised.
   *
   * `products` is a module-level array that the catalogue store mutates in
   * place when it hydrates (saveCatalog rewrites it with length = 0 / push).
   * The array identity never changes, so a useMemo keyed on it would keep the
   * first render's result — which, before hydration, is an empty list. Sorting
   * a few dozen rows per render costs nothing; rendering a permanently empty
   * grid costs the whole section.
   */
  const shown = sortFor(products, sort).slice(0, limit);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.value === sort);
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = e.key === "ArrowRight" ? (i + 1) % TABS.length : (i - 1 + TABS.length) % TABS.length;
    setSort(TABS[next].value);
    const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons[next]?.focus();
  };

  return (
    <section
      className="container-x"
      style={{
        paddingTop: "calc(var(--tk-section-space) * 0.5)",
        paddingBottom: "calc(var(--tk-section-space) * 0.5)",
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="tk-eyebrow mb-2.5 text-accent-ink dark:text-accent">Discover</p>
          <h2 className="text-[clamp(1.6rem,2.6vw,2.25rem)] leading-[1.1]">
            Explore the marketplace
          </h2>
        </div>
        <Link
          to="/browse"
          className="inline-flex h-9 shrink-0 items-center gap-2 self-start rounded-full border border-line bg-surface px-4 text-[0.8125rem] font-medium text-fg transition-colors hover:border-line-strong hover:text-primary"
        >
          All items
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div
        role="tablist"
        aria-label="Sort the marketplace"
        onKeyDown={onKeyDown}
        className="no-scrollbar mt-6 mb-6 flex gap-2 overflow-x-auto pb-1"
      >
        {TABS.map((t) => {
          const active = t.value === sort;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSort(t.value)}
              className={cn(
                "h-9 shrink-0 rounded-full border px-4 text-[0.8125rem] font-medium transition-colors",
                /*
                 * The selected chip is the brand fill in light mode. In dark
                 * mode --tk-primary inverts to near-white (that is what the
                 * reference does for primary actions there), and a near-white
                 * chip with a near-white label is invisible — so the selected
                 * state falls back to the accent colour, which keeps its
                 * contrast against the dark canvas.
                 */
                active
                  ? "border-primary bg-primary text-primary-fg dark:border-accent dark:bg-accent dark:text-white"
                  : "border-line bg-surface text-fg-muted hover:border-line-strong hover:text-fg",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4"
      >
        {shown.map((p, i) => (
          <ProductCard key={p.slug} product={p} index={i} />
        ))}
      </div>
    </section>
  );
}

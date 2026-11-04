import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, X, LayoutGrid, Rows3, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/site/product-card";
import {
  FilterRail,
  applyFilters,
  initialFilters,
  sortProducts,
  type Filters,
} from "@/components/site/filter-rail";
import { ProductGridSkeleton } from "@/components/ui/skeletons";
import { SortMenu } from "@/components/site/sort-menu";
import { products, categories } from "@/data/catalog";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/disclosure";

const PER_PAGE = 9;

export default function BrowsePage() {
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = React.useState<Filters>(initialFilters);
  const [sort, setSort] = React.useState(params.get("sort") ?? "popular");
  const [query, setQuery] = React.useState(params.get("q") ?? "");
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [mobileFilters, setMobileFilters] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    const id = window.setTimeout(() => setLoading(false), 420);
    return () => window.clearTimeout(id);
  }, [filters, sort, query, page]);

  React.useEffect(() => {
    const next = new URLSearchParams(params);
    if (sort !== "popular") next.set("sort", sort);
    else next.delete("sort");
    if (query) next.set("q", query);
    else next.delete("q");
    setParams(next, { replace: true });
    setPage(1);
  }, [sort, query]);

  const filtered = React.useMemo(
    () => sortProducts(applyFilters(products, filters, query), sort),
    [filters, sort, query],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const visible = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const activeChips = [
    ...filters.categories.map((c) => ({
      key: `c-${c}`,
      label: categories.find((x) => x.slug === c)?.name ?? c,
      clear: () => setFilters((f) => ({ ...f, categories: f.categories.filter((v) => v !== c) })),
    })),
    ...filters.stacks.map((s) => ({
      key: `s-${s}`,
      label: s,
      clear: () => setFilters((f) => ({ ...f, stacks: f.stacks.filter((v) => v !== s) })),
    })),
    ...(filters.freeOnly
      ? [{ key: "free", label: "Free only", clear: () => setFilters((f) => ({ ...f, freeOnly: false })) }]
      : []),
    ...(filters.minRating
      ? [
          {
            key: "rating",
            label: `${filters.minRating}+ stars`,
            clear: () => setFilters((f) => ({ ...f, minRating: 0 })),
          },
        ]
      : []),
  ];

  return (
    <div>
      <div className="border-b border-line bg-surface-2/50">
        <div className="container-x py-8 sm:py-10">
          <nav className="label-mono mb-4 flex items-center gap-2 text-[0.5625rem] text-ink-3">
            <Link to="/" className="hover:text-ink">
              Home
            </Link>
            <span>/</span>
            <span className="text-ink-2">Browse</span>
          </nav>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-[2rem] leading-tight sm:text-[2.5rem]">
                {query ? `Results for “${query}”` : "All source code"}
              </h1>
              <p className="mt-1.5 text-sm text-ink-2">
                {filtered.length} item{filtered.length === 1 ? "" : "s"} · maintained by the studio
              </p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by name or stack"
                className="h-11 w-full rounded-full border border-line-strong bg-surface pl-9 pr-9 text-[0.8125rem] placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="no-scrollbar mt-5 flex items-center gap-1.5 overflow-x-auto pb-1">
            <Link
              to="/browse"
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-[0.75rem] transition-colors",
                filters.categories.length === 0
                  ? "border-brand bg-brand text-brand-ink"
                  : "border-line text-ink-2 hover:text-ink",
              )}
            >
              All
            </Link>
            {categories.map((c) => (
              <Link
                key={c.slug}
                to={`/category/${c.slug}`}
                className="shrink-0 rounded-full border border-line px-3 py-1.5 text-[0.75rem] text-ink-2 transition-colors hover:text-ink"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="container-x py-8">
        <div className="grid gap-8 lg:grid-cols-[220px_1fr] xl:grid-cols-[240px_1fr]">
          <FilterRail
            filters={filters}
            setFilters={setFilters}
            onClear={() => setFilters(initialFilters)}
            className="hidden lg:block"
          />

          <div>
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={() => setMobileFilters(true)}
              >
                <SlidersHorizontal className="size-3.5" /> Filters
                {activeChips.length > 0 && (
                  <span className="ml-0.5 grid size-4 place-items-center rounded-full bg-brand text-[0.5625rem] text-brand-ink">
                    {activeChips.length}
                  </span>
                )}
              </Button>

              <div className="hidden items-center gap-1 rounded-full border border-line p-0.5 sm:flex">
                {(
                  [
                    { id: "grid", icon: LayoutGrid },
                    { id: "list", icon: Rows3 },
                  ] as const
                ).map(({ id, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setView(id)}
                    aria-label={`${id} view`}
                    aria-pressed={view === id}
                    className={cn(
                      "grid size-7 place-items-center rounded-full transition-colors",
                      view === id ? "bg-surface-2 text-ink" : "text-ink-3 hover:text-ink",
                    )}
                  >
                    <Icon className="size-3.5" />
                  </button>
                ))}
              </div>

              {activeChips.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {activeChips.map((chip) => (
                    <Badge key={chip.key} variant="neutral" size="md" className="gap-1 pr-1.5">
                      {chip.label}
                      <button
                        onClick={chip.clear}
                        aria-label={`Remove ${chip.label}`}
                        className="grid size-4 place-items-center rounded-full hover:bg-line-strong"
                      >
                        <X className="size-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="ml-auto flex items-center gap-2">
                <span className="hidden text-[0.6875rem] text-ink-3 sm:block">Sort</span>
                <SortMenu value={sort} onChange={setSort} />
              </div>
            </div>

            {loading ? (
              <ProductGridSkeleton count={6} />
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong py-20 text-center">
                <div className="grid size-14 place-items-center rounded-full bg-surface-2">
                  <SlidersHorizontal className="size-5 text-ink-3" />
                </div>
                <h2 className="mt-4 font-display text-xl">No items match those filters</h2>
                <p className="mt-1.5 max-w-sm text-sm text-ink-2">
                  Try removing a stack filter or widening the price range.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-5"
                  onClick={() => {
                    setFilters(initialFilters);
                    setQuery("");
                  }}
                >
                  Clear all filters
                </Button>
              </div>
            ) : view === "grid" ? (
              <motion.div
                layout
                className="grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 xl:grid-cols-3"
              >
                <AnimatePresence mode="popLayout">
                  {visible.map((p, i) => (
                    <ProductCard key={p.slug} product={p} index={i} />
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              <div className="divide-y divide-line border-y border-line">
                {visible.map((p) => (
                  <ListRow key={p.slug} slug={p.slug} />
                ))}
              </div>
            )}

            {filtered.length > PER_PAGE && (
              <Pagination page={page} pages={pages} onChange={setPage} className="mt-10 justify-center" />
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileFilters && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileFilters(false)}
              className="fixed inset-0 z-50 bg-[#141210]/45 backdrop-blur-[2px] lg:hidden"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-xl bg-paper lg:hidden"
            >
              <div className="sticky top-0 flex items-center justify-between border-b border-line bg-paper px-5 py-4">
                <h2 className="font-display text-lg">Filters</h2>
                <button
                  onClick={() => setMobileFilters(false)}
                  className="grid size-8 place-items-center rounded-full hover:bg-surface-2"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="px-5 pb-28">
                <FilterRail filters={filters} setFilters={setFilters} onClear={() => setFilters(initialFilters)} />
              </div>
              <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper p-4">
                <Button className="w-full" onClick={() => setMobileFilters(false)}>
                  Show {filtered.length} items
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function ListRow({ slug }: { slug: string }) {
  const p = products.find((x) => x.slug === slug)!;
  return (
    <Link to={`/item/${slug}`} className="group flex items-center gap-4 py-4">
      <div className="h-16 w-24 shrink-0 overflow-hidden rounded-sm">
        <ProductArtInline product={p} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] font-medium group-hover:text-accent-ink dark:group-hover:text-accent">
          {p.name}
        </p>
        <p className="truncate text-xs text-ink-2">{p.tagline}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {p.stack.slice(0, 4).map((s) => (
            <span key={s} className="rounded border border-line px-1.5 py-0.5 font-mono text-[0.5625rem] text-ink-3">
              {s}
            </span>
          ))}
        </div>
      </div>
      <div className="hidden text-right sm:block">
        <p className="font-mono text-sm font-medium">{p.price === 0 ? "Free" : `$${p.price / 100}`}</p>
        <p className="text-[0.625rem] text-ink-3">{p.sales.toLocaleString()} sales</p>
      </div>
    </Link>
  );
}

function ProductArtInline({ product }: { product: (typeof products)[number] }) {
  return (
    <div
      className="size-full"
      style={{ background: `linear-gradient(135deg, ${product.art.from}, ${product.art.to})` }}
    />
  );
}

import * as React from "react";
import { Star, X } from "lucide-react";
import { Checkbox } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import { cn, money } from "@/lib/utils";
import { categories, products } from "@/data/catalog";

export interface Filters {
  categories: string[];
  stacks: string[];
  price: [number, number];
  minRating: number;
  licenses: string[];
  freeOnly: boolean;
}

/** Highest price in the catalogue, rounded up to a clean slider bound. */
export const PRICE_MAX = Math.ceil(Math.max(...products.map((p) => p.price)) / 1000) * 1000;

export const initialFilters: Filters = {
  categories: [],
  stacks: [],
  price: [0, PRICE_MAX],
  minRating: 0,
  licenses: [],
  freeOnly: false,
};

const allStacks = Array.from(new Set(products.flatMap((p) => p.stack))).sort();

export function FilterRail({
  filters,
  setFilters,
  onClear,
  className,
}: {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  onClear: () => void;
  className?: string;
}) {
  const toggle = (key: "categories" | "stacks" | "licenses", value: string) =>
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value],
    }));

  const activeCount =
    filters.categories.length +
    filters.stacks.length +
    filters.licenses.length +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.freeOnly ? 1 : 0) +
    (filters.price[0] > 0 || filters.price[1] < PRICE_MAX ? 1 : 0);

  return (
    <aside className={cn("text-sm", className)}>
      <div className="flex items-center justify-between pb-3">
        <h2 className="text-[0.8125rem] font-medium">Filters</h2>
        {activeCount > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 text-[0.6875rem] text-ink-3 transition-colors hover:text-ink"
          >
            <X className="size-3" /> Clear ({activeCount})
          </button>
        )}
      </div>

      <FilterGroup title="Category">
        <div className="space-y-2">
          {categories.map((c) => {
            const count = products.filter((p) => p.category === c.slug).length;
            return (
              <label
                key={c.slug}
                className="flex cursor-pointer items-center gap-2.5 text-[0.8125rem] text-ink-2 hover:text-ink"
              >
                <Checkbox
                  checked={filters.categories.includes(c.slug)}
                  onCheckedChange={() => toggle("categories", c.slug)}
                />
                <span className="flex-1">{c.name}</span>
                <span className="font-mono text-[0.625rem] text-ink-3">{count}</span>
              </label>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup title="Price">
        <Slider
          value={filters.price}
          min={0}
          max={PRICE_MAX}
          step={10}
          onValueChange={(v) => setFilters((f) => ({ ...f, price: v as [number, number] }))}
        />
        <div className="mt-3 flex items-center justify-between font-mono text-[0.6875rem] text-ink-2">
          <span>${filters.price[0]}</span>
          <span>${filters.price[1]}</span>
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-[0.8125rem] text-ink-2">
          <Checkbox
            checked={filters.freeOnly}
            onCheckedChange={() => setFilters((f) => ({ ...f, freeOnly: !f.freeOnly }))}
          />
          Free items only
        </label>
      </FilterGroup>

      <FilterGroup title="Stack">
        <div className="flex flex-wrap gap-1.5">
          {allStacks.map((s) => {
            const on = filters.stacks.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggle("stacks", s)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[0.6875rem] transition-colors",
                  on
                    ? "border-brand bg-brand text-brand-ink"
                    : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
                )}
              >
                {s}
              </button>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup title="Rating">
        <div className="space-y-1.5">
          {[4.5, 4, 3.5].map((r) => (
            <button
              key={r}
              onClick={() =>
                setFilters((f) => ({ ...f, minRating: f.minRating === r ? 0 : r }))
              }
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-[0.8125rem] transition-colors",
                filters.minRating === r ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2/60",
              )}
            >
              <span className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "size-3",
                      i < Math.floor(r) ? "fill-gold text-gold" : "text-line-strong",
                    )}
                  />
                ))}
              </span>
              <span>{r}+</span>
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="License">
        <div className="space-y-2">
          {[
            { id: "personal", label: "Personal" },
            { id: "commercial", label: "Commercial" },
            { id: "extended", label: "Extended" },
          ].map((l) => (
            <label
              key={l.id}
              className="flex cursor-pointer items-center gap-2.5 text-[0.8125rem] text-ink-2 hover:text-ink"
            >
              <Checkbox
                checked={filters.licenses.includes(l.id)}
                onCheckedChange={() => toggle("licenses", l.id)}
              />
              {l.label}
            </label>
          ))}
        </div>
      </FilterGroup>
    </aside>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line py-4">
      <h3 className="label-mono mb-2.5 text-[0.5625rem] text-ink-3">{title}</h3>
      {children}
    </div>
  );
}

export function applyFilters(list: typeof products, f: Filters, query = "") {
  const q = query.trim().toLowerCase();
  return list.filter((p) => {
    if (f.categories.length && !f.categories.includes(p.category)) return false;
    if (f.stacks.length && !f.stacks.some((s) => p.stack.includes(s))) return false;
    if (f.freeOnly && !p.free) return false;
    if (f.minRating && p.rating < f.minRating) return false;
    if (p.price / 100 < f.price[0] || p.price / 100 > f.price[1]) return false;
    if (f.licenses.length && !p.tiers.some((t) => f.licenses.includes(t.license))) return false;
    if (q) {
      const hay = `${p.name} ${p.tagline} ${p.stack.join(" ")} ${p.description}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function sortProducts(list: typeof products, sort: string) {
  const copy = [...list];
  switch (sort) {
    case "newest":
      return copy.sort((a, b) => +new Date(b.released) - +new Date(a.released));
    case "rating":
      return copy.sort((a, b) => b.rating - a.rating);
    case "price-asc":
      return copy.sort((a, b) => a.price - b.price);
    case "price-desc":
      return copy.sort((a, b) => b.price - a.price);
    case "trending":
      return copy.sort((a, b) => b.views - a.views);
    default:
      return copy.sort((a, b) => b.sales - a.sales);
  }
}

export { money };

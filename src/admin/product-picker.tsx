import * as React from "react";
import { Check, Search } from "lucide-react";
import { Input } from "@/components/ui/field";
import { cn, money } from "@/lib/utils";

export interface PickerProduct {
  slug: string;
  name: string;
  price: number;
  status?: string;
}

/**
 * A searchable multi-select over the catalogue.
 *
 * Deliberately not a `<select multiple>`: pickers over 16+ products need a
 * filter, and the chosen set has to stay visible while looking for the next
 * one. Selection order is preserved because it becomes the bundle's order.
 */
export function ProductPicker({
  products,
  value,
  onChange,
}: {
  products: PickerProduct[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = React.useState("");
  const filtered = products.filter(
    (p) =>
      !query ||
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.slug.includes(query.toLowerCase()),
  );

  const toggle = (slug: string) =>
    onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug]);

  return (
    <div className="rounded-sm border border-line">
      <div className="relative border-b border-line">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter products…"
          className="h-10 border-0 bg-transparent pl-8 text-[0.8125rem] focus-visible:ring-0"
        />
      </div>
      <ul className="max-h-56 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <li className="px-2 py-3 text-[0.75rem] text-ink-3">No products match.</li>
        ) : (
          filtered.map((p) => {
            const chosen = value.includes(p.slug);
            const rank = value.indexOf(p.slug);
            return (
              <li key={p.slug}>
                <button
                  type="button"
                  onClick={() => toggle(p.slug)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-[0.8125rem] transition-colors hover:bg-surface-2",
                    chosen && "text-ink",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded border",
                      chosen ? "border-accent bg-accent text-brand-ink" : "border-line",
                    )}
                  >
                    {chosen && <Check className="size-3" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="font-mono text-[0.6875rem] text-ink-3">{money(p.price)}</span>
                  {chosen && (
                    <span className="font-mono text-[0.625rem] text-ink-3">{rank + 1}</span>
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>
      {value.length > 0 && (
        <div className="flex items-center justify-between border-t border-line px-2 py-1.5">
          <span className="text-[0.6875rem] text-ink-3">{value.length} selected</span>
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[0.6875rem] text-ink-2 hover:text-ink"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

import * as React from "react";
import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import { Search, CornerDownLeft, TrendingUp, Clock, Package } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useUi, useRecent, useSearchHistory } from "@/lib/store";
import { products, categories } from "@/data/catalog";
import { money } from "@/lib/utils";
import { ProductArt } from "@/components/ui/product-art";

const suggestions = ["dashboard", "auth", "stripe", "tables", "free", "next.js"];

export function SearchDialog() {
  const { searchOpen, setSearch } = useUi();
  const [query, setQuery] = React.useState("");
  const navigate = useNavigate();
  const recent = useRecent();
  const { items: history, push: pushHistory, clear: clearHistory } = useSearchHistory();

  React.useEffect(() => {
    if (!searchOpen) setQuery("");
  }, [searchOpen]);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { products: products.slice(0, 4), categories: categories.slice(0, 4) };
    const scored = products
      .map((p) => {
        const hay = `${p.name} ${p.tagline} ${p.stack.join(" ")} ${p.category}`.toLowerCase();
        let score = 0;
        if (p.name.toLowerCase().includes(q)) score += 6;
        if (hay.includes(q)) score += 3;
        if (p.stack.some((s) => s.toLowerCase().includes(q))) score += 2;
        return { p, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((x) => x.p);
    return {
      products: scored,
      categories: categories.filter((c) => c.name.toLowerCase().includes(q) || c.blurb.toLowerCase().includes(q)).slice(0, 3),
    };
  }, [query]);

  const go = (path: string) => {
    if (query.trim()) pushHistory(query.trim());
    setSearch(false);
    navigate(path);
  };

  return (
    <Dialog open={searchOpen} onOpenChange={setSearch}>
      <DialogContent className="top-[12%] max-w-2xl translate-y-0 overflow-hidden p-0" showClose={false}>
        <DialogTitle className="sr-only">Search products</DialogTitle>
        <Command shouldFilter={false} className="flex max-h-[70vh] flex-col">
          <div className="flex items-center gap-3 border-b border-line px-5">
            <Search className="size-4 shrink-0 text-ink-3" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search source code, stacks, categories…"
              className="h-14 w-full bg-transparent text-[0.9375rem] text-ink outline-none placeholder:text-ink-3"
            />
            <kbd className="hidden rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[0.625rem] text-ink-3 sm:block">
              ESC
            </kbd>
          </div>

          <Command.List className="flex-1 overflow-y-auto overscroll-contain p-2">
            {!query && (
              <Command.Group className="px-2 py-1.5">
                <div className="label-mono mb-2 flex items-center gap-2 px-1 text-[0.5625rem] text-ink-3">
                  <TrendingUp className="size-3" /> Try
                </div>
                <div className="flex flex-wrap gap-1.5 pb-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setQuery(s)}
                      className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </Command.Group>
            )}

            {!query && history.length > 0 && (
              <Command.Group className="px-2 py-1.5">
                <div className="label-mono mb-2 flex items-center justify-between px-1 text-[0.5625rem] text-ink-3">
                  <span className="flex items-center gap-2">
                    <Clock className="size-3" /> Recent searches
                  </span>
                  <button onClick={clearHistory} className="normal-case tracking-normal hover:text-ink">
                    Clear
                  </button>
                </div>
                {history.slice(0, 4).map((h) => (
                  <Command.Item
                    key={h}
                    value={`history-${h}`}
                    onSelect={() => setQuery(h)}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-[0.8125rem] text-ink-2 data-[selected=true]:bg-surface-2 data-[selected=true]:text-ink"
                  >
                    {h}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {results.products.length > 0 && (
              <Command.Group className="px-2 py-1.5">
                <div className="label-mono mb-1 px-1 text-[0.5625rem] text-ink-3">
                  {query ? "Products" : "Popular now"}
                </div>
                {results.products.map((p) => (
                  <Command.Item
                    key={p.slug}
                    value={p.slug}
                    onSelect={() => go(`/item/${p.slug}`)}
                    className="group flex cursor-pointer items-center gap-3 rounded-sm p-2 data-[selected=true]:bg-surface-2"
                  >
                    <ProductArt
                      from={p.art.from}
                      to={p.art.to}
                      ink={p.art.ink}
                      kind={p.art.kind}
                      className="size-10 shrink-0 rounded-[6px]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.8125rem] font-medium text-ink">{p.name}</span>
                      <span className="block truncate text-[0.6875rem] text-ink-3">
                        {p.stack.slice(0, 3).join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[0.6875rem] text-ink-2">{money(p.price)}</span>
                    <CornerDownLeft className="size-3.5 shrink-0 text-ink-3 opacity-0 transition-opacity group-data-[selected=true]:opacity-100" />
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {query && results.categories.length > 0 && (
              <Command.Group className="px-2 py-1.5">
                <div className="label-mono mb-1 px-1 text-[0.5625rem] text-ink-3">Categories</div>
                {results.categories.map((c) => (
                  <Command.Item
                    key={c.slug}
                    value={`cat-${c.slug}`}
                    onSelect={() => go(`/category/${c.slug}`)}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-[0.8125rem] text-ink-2 data-[selected=true]:bg-surface-2 data-[selected=true]:text-ink"
                  >
                    <Package className="size-3.5 text-ink-3" />
                    {c.name}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {query && results.products.length === 0 && results.categories.length === 0 && (
              <Command.Empty className="px-4 py-14 text-center">
                <p className="font-display text-lg">No matches for “{query}”</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-ink-2">
                  Try a stack like “react” or browse everything.
                </p>
                <button
                  onClick={() => go("/browse")}
                  className="mt-4 rounded-full border border-line-strong px-4 py-1.5 text-xs font-medium hover:bg-surface-2"
                >
                  Browse all items
                </button>
              </Command.Empty>
            )}

            {query && results.products.length > 0 && (
              <div className="px-2 pb-1 pt-2">
                <button
                  onClick={() => go(`/browse?q=${encodeURIComponent(query)}`)}
                  className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-[0.8125rem] text-accent-ink transition-colors hover:bg-surface-2 dark:text-accent"
                >
                  <span>See all results for “{query}”</span>
                  <CornerDownLeft className="size-3.5" />
                </button>
              </div>
            )}
          </Command.List>

          <div className="flex items-center justify-between border-t border-line bg-surface-2/60 px-5 py-2.5">
            <span className="label-mono text-[0.5625rem] text-ink-3">Kiln search</span>
            <div className="flex items-center gap-3 text-[0.625rem] text-ink-3">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-line bg-surface px-1 font-mono">↵</kbd> open
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-line bg-surface px-1 font-mono">esc</kbd> close
              </span>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

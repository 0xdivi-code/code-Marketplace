import * as React from "react";
import { Link } from "react-router-dom";
import { Download, Code2, KeyRound, RefreshCw, Search, FileArchive, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductArt } from "@/components/ui/product-art";
import { Input, NativeSelect } from "@/components/ui/field";
import { orders, productBySlug, products } from "@/data/catalog";
import { money } from "@/lib/utils";
import { toast } from "sonner";

export default function LibraryPage() {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState("all");
  const [versions, setVersions] = React.useState<Record<string, string>>({});

  const owned = orders
    .filter((o) => o.status === "completed")
    .flatMap((o) => o.items.map((i) => ({ ...i, order: o.id, date: o.date })));

  const filtered = owned.filter((i) => {
    const p = productBySlug(i.productSlug);
    if (!p) return false;
    if (!p.name.toLowerCase().includes(query.toLowerCase()) && !p.stack.join(" ").toLowerCase().includes(query.toLowerCase()))
      return false;
    if (filter === "updates") return p.changelog.length > 1;
    if (filter === "recent") return new Date(i.date) > new Date("2026-09-01");
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[1.35rem]">Download library</h2>
          <p className="mt-0.5 text-[0.8125rem] text-ink-2">
            {owned.length} files · every version you’ve owned, forever
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search library"
              className="h-9 w-44 pl-8 text-[0.75rem]"
            />
          </div>
          <NativeSelect value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 w-auto">
            <option value="all">All files</option>
            <option value="updates">Updates available</option>
            <option value="recent">Bought recently</option>
          </NativeSelect>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong py-16 text-center">
          <FileArchive className="mx-auto size-5 text-ink-3" />
          <p className="mt-2 font-display text-lg">Nothing matches</p>
          <p className="mt-1 text-sm text-ink-2">Try a different search or clear the filter.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((item) => {
            const p = productBySlug(item.productSlug)!;
            const current = versions[p.slug] ?? p.version;
            const hasUpdate = p.changelog.length > 1;
            return (
              <li key={`${item.productSlug}-${item.order}`} className="surface-card rounded-lg p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <ProductArt {...p.art} kind={p.art.kind} className="h-20 w-full shrink-0 rounded-sm sm:h-16 sm:w-24" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/item/${p.slug}`}
                        className="text-[0.9375rem] font-medium hover:text-accent-ink dark:hover:text-accent"
                      >
                        {p.name}
                      </Link>
                      {hasUpdate && (
                        <Badge variant="accent" size="sm" className="gap-1">
                          <RefreshCw className="size-2.5" /> Update available
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-[0.6875rem] text-ink-3">
                      Order {item.order} ·{" "}
                      {new Date(item.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                      {item.license} license
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {p.stack.slice(0, 4).map((s) => (
                        <span
                          key={s}
                          className="rounded border border-line px-1.5 py-0.5 font-mono text-[0.5625rem] text-ink-3"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    <NativeSelect
                      aria-label="Version"
                      value={current}
                      onChange={(e) => setVersions((v) => ({ ...v, [p.slug]: e.target.value }))}
                      className="h-9 w-auto text-[0.75rem]"
                    >
                      {p.changelog.map((c, i) => (
                        <option key={c.version} value={c.version}>
                          v{c.version} {i === 0 ? "(latest)" : ""}
                        </option>
                      ))}
                    </NativeSelect>
                    <Button
                      size="sm"
                      onClick={() =>
                        toast.success(`Downloading ${p.name} v${current}`, {
                          description: "Source · docs · zip archive",
                        })
                      }
                    >
                      <Download className="size-3.5" /> Download
                    </Button>
                    <Button variant="outline" size="sm">
                      <Code2 className="size-3.5" /> Git
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-line pt-2.5 text-[0.625rem] text-ink-3">
                  <span className="flex items-center gap-1">
                    <KeyRound className="size-3" /> License key{" "}
                    <code className="font-mono text-ink-2">KLN-{p.slug.slice(0, 4).toUpperCase()}-8F2A</code>
                  </span>
                  <span className="flex items-center gap-1">
                    <Check className="size-3 text-emerald-600" /> Lifetime updates
                  </span>
                  <span>{money(item.price)} paid</span>
                  <Link to="/account/orders" className="ml-auto hover:text-ink">
                    Invoice
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-md border border-line bg-surface-2/50 p-4">
        <p className="text-[0.75rem] font-medium">Also worth downloading</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {products.filter((p) => p.free).slice(0, 3).map((p) => (
            <Link
              key={p.slug}
              to={`/item/${p.slug}`}
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-[0.6875rem] transition-colors hover:border-line-strong"
            >
              {p.name} · free
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

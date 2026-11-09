import * as React from "react";
import { Link } from "react-router-dom";
import { Download, Code2, KeyRound, RefreshCw, Search, FileArchive, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductArt } from "@/components/ui/product-art";
import { Input, NativeSelect } from "@/components/ui/field";
import { productBySlug } from "@/data/catalog";
import { usePublished } from "@/lib/catalog-store";
import { money } from "@/lib/utils";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";

/** An order that exists but has not been confirmed on-chain yet. */
interface PendingItem {
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  slug: string;
  name: string;
  license: string;
}

interface LibraryEntry {
  slug: string;
  name: string;
  tagline: string;
  version: string;
  license: string;
  grantedBy: "purchase" | "manual" | "free";
  grantedAt: string;
  price: number;
  art: { from: string; to: string; ink: string; kind: string; src?: string };
  hasFile: boolean;
  sizeBytes: number;
}

export default function LibraryPage() {
  const freePicks = usePublished().filter((p) => p.free);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState("all");
  const [versions, setVersions] = React.useState<Record<string, string>>({});
  const [owned, setOwned] = React.useState<LibraryEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [downloading, setDownloading] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<PendingItem[]>([]);

  // Licences come from the authenticated endpoint — never from the public
  // catalogue, which knows nothing about who owns what.
  React.useEffect(() => {
    let alive = true;
    api
      .get<{ library: LibraryEntry[]; pending?: PendingItem[] }>("/account/library")
      .then((res) => {
        if (!alive) return;
        setOwned(res.library);
        setPending(res.pending ?? []);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  async function download(entry: LibraryEntry) {
    setDownloading(entry.slug);
    try {
      const res = await api.post<{ url: string; filename: string; expiresAt: string; maxUses: number }>(
        `/account/download/${entry.slug}`,
        {},
      );
      // The token is short lived and use capped; hand it straight to the browser.
      window.location.href = res.url;
      toast.success(`Downloading ${entry.name}`, {
        description: `${res.filename} · link valid 15 minutes`,
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Download failed.");
    } finally {
      setDownloading(null);
    }
  }

  const filtered = owned.filter((i) => {
    const q = query.toLowerCase();
    if (!i.name.toLowerCase().includes(q) && !i.tagline.toLowerCase().includes(q)) return false;
    if (filter === "recent") return Date.now() - new Date(i.grantedAt).getTime() < 30 * 864e5;
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

      {/* Orders in flight: visible, but explicitly not downloadable yet. */}
      {pending.length > 0 && (
        <div className="rounded-lg border border-line bg-surface">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <RefreshCw className="size-3.5 text-ink-3" />
            <p className="text-[0.8125rem] font-medium">Awaiting payment confirmation</p>
            <Badge variant="warn" size="sm" className="ml-auto">
              {pending.length}
            </Badge>
          </div>
          <ul className="divide-y divide-line">
            {pending.map((p) => (
              <li key={`${p.orderNumber}-${p.slug}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[0.8125rem]">{p.name}</p>
                  <p className="text-[0.6875rem] capitalize text-ink-3">
                    {p.license} licence · {p.orderNumber} · {money(p.total)}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/order/${p.orderNumber}`}>View invoice</Link>
                </Button>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-4 py-2.5 text-[0.6875rem] text-ink-3">
            Downloads unlock by themselves the moment the network confirms. This page updates when you reload it.
          </p>
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-line py-16 text-center text-sm text-ink-3">Loading your library…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong py-16 text-center">
          <FileArchive className="mx-auto size-5 text-ink-3" />
          <p className="mt-2 font-display text-lg">{owned.length ? "Nothing matches" : "Your library is empty"}</p>
          <p className="mt-1 text-sm text-ink-2">
            {owned.length ? (
              "Try a different search or clear the filter."
            ) : (
              <>
                Anything you buy appears here forever.{" "}
                <Link to="/browse" className="underline underline-offset-2 hover:text-ink">
                  Browse the catalogue
                </Link>
                .
              </>
            )}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((item) => {
            const p = productBySlug(item.slug);
            const current = versions[item.slug] ?? item.version;
            const hasUpdate = (p?.changelog.length ?? 0) > 1;
            return (
              <li key={item.slug} className="surface-card rounded-lg p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <ProductArt {...item.art} kind={item.art.kind as "window"} className="h-20 w-full shrink-0 rounded-sm sm:h-16 sm:w-24" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/item/${item.slug}`}
                        className="text-[0.9375rem] font-medium hover:text-accent-ink dark:hover:text-accent"
                      >
                        {item.name}
                      </Link>
                      {hasUpdate && (
                        <Badge variant="accent" size="sm" className="gap-1">
                          <RefreshCw className="size-2.5" /> Update available
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-[0.6875rem] text-ink-3">
                      {item.grantedBy === "purchase" ? "Purchased" : item.grantedBy === "free" ? "Free licence" : "Granted by the studio"} ·{" "}
                      {new Date(item.grantedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                      {item.license} license
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {(p?.stack ?? []).slice(0, 4).map((s) => (
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
                      onChange={(e) => setVersions((v) => ({ ...v, [item.slug]: e.target.value }))}
                      className="h-9 w-auto text-[0.75rem]"
                    >
                      {(p?.changelog ?? [{ version: item.version, date: "", notes: [] }]).map((c, i) => (
                        <option key={c.version} value={c.version}>
                          v{c.version} {i === 0 ? "(latest)" : ""}
                        </option>
                      ))}
                    </NativeSelect>
                    <Button
                      size="sm"
                      disabled={!item.hasFile || downloading === item.slug}
                      onClick={() => void download(item)}
                      title={item.hasFile ? undefined : "The studio has not uploaded this package yet"}
                    >
                      <Download className="size-3.5" /> {downloading === item.slug ? "Preparing…" : "Download"}
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-line pt-2.5 text-[0.625rem] text-ink-3">
                  <span className="flex items-center gap-1">
                    <KeyRound className="size-3" /> License key{" "}
                    <code className="font-mono text-ink-2">KLN-{item.slug.slice(0, 4).toUpperCase()}-8F2A</code>
                  </span>
                  <span className="flex items-center gap-1">
                    <Check className="size-3 text-positive" /> Lifetime updates
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
          {freePicks.slice(0, 3).map((p) => (
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

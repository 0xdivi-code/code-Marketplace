import * as React from "react";
import { Activity, Download, Filter, Search, ShieldCheck, User, Package, CreditCard, Settings2 } from "lucide-react";
import { PageHeader } from "./admin-layout";
import { Panel } from "./ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { activity } from "@/data/catalog";
import { cn } from "@/lib/utils";
import { NativeSelect } from "@/components/ui/field";

const kindMeta = {
  product: { icon: Package, label: "Product", color: "text-accent" },
  order: { icon: CreditCard, label: "Order", color: "text-emerald-600" },
  customer: { icon: User, label: "Customer", color: "text-[#2c4a6e]" },
  content: { icon: Activity, label: "Content", color: "text-[#7c3517]" },
  promo: { icon: Filter, label: "Promotion", color: "text-[#b0842f]" },
  settings: { icon: Settings2, label: "Settings", color: "text-ink-3" },
} as const;

const extended = [
  ...activity,
  { id: "a11", actor: "Kiln Studio", action: "updated product pricing", target: "Kiln UI Kit · $79 → $89", at: "3 days ago", kind: "product" as const },
  { id: "a12", actor: "System", action: "sent review request", target: "KL-10450 · Priya Raman", at: "4 days ago", kind: "customer" as const },
  { id: "a13", actor: "Kiln Studio", action: "enabled gateway", target: "PayPal", at: "5 days ago", kind: "settings" as const },
  { id: "a14", actor: "System", action: "invoice generated", target: "KL-10471 · PDF", at: "6 days ago", kind: "order" as const },
  { id: "a15", actor: "Kiln Studio", action: "published blog post", target: "Upgrading a template without breaking 6,000 apps", at: "2 weeks ago", kind: "content" as const },
];

export default function AdminActivity() {
  const [kind, setKind] = React.useState("all");
  const [query, setQuery] = React.useState("");

  const rows = extended.filter((a) => {
    if (kind !== "all" && a.kind !== kind) return false;
    if (query && !`${a.actor} ${a.action} ${a.target}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Activity log"
        subtitle="Every privileged action, append-only"
        actions={
          <>
            <Button variant="outline" size="xs" className="h-8">
              <Download className="size-3.5" /> Export
            </Button>
            <Button variant="outline" size="xs" className="h-8">
              <ShieldCheck className="size-3.5" /> Retention: 24 months
            </Button>
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search log"
                className="h-8 w-52 rounded-sm border border-line bg-surface pl-7 pr-2 text-[0.75rem] placeholder:text-ink-3 focus:border-accent focus:outline-none"
              />
            </div>
            <NativeSelect value={kind} onChange={(e) => setKind(e.target.value)} className="h-8 w-auto">
              <option value="all">All events</option>
              {Object.entries(kindMeta).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </NativeSelect>
            <span className="ml-auto text-[0.625rem] text-ink-3">{rows.length} events</span>
          </div>

          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <ol className="divide-y divide-line">
              {rows.map((a, i) => {
                const meta = kindMeta[a.kind] ?? kindMeta.settings;
                return (
                  <li key={a.id} className="flex gap-3 px-4 py-3 hover:bg-surface-2/40">
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-line bg-surface-2">
                      <meta.icon className={cn("size-3.5", meta.color)} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.75rem] leading-snug text-ink-2">
                        <span className="font-medium text-ink">{a.actor}</span> {a.action}{" "}
                        <span className="text-ink">{a.target}</span>
                      </p>
                      <p className="mt-0.5 flex items-center gap-2 text-[0.5625rem] text-ink-3">
                        <span>{a.at}</span>
                        <span>·</span>
                        <span className="font-mono">EVT-{String(10492 - i)}</span>
                      </p>
                    </div>
                    <Badge variant="neutral" size="sm" className="h-5 shrink-0 capitalize">
                      {meta.label}
                    </Badge>
                  </li>
                );
              })}
            </ol>
            {rows.length === 0 && (
              <div className="py-16 text-center">
                <p className="text-[0.8125rem] font-medium">No events match</p>
                <p className="mt-1 text-[0.6875rem] text-ink-3">Try clearing the filters.</p>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-3">
          <Panel title="Actors" bodyClassName="divide-y divide-line">
            {[
              { n: "Kiln Studio", i: "KS", c: 12 },
              { n: "System", i: "SY", c: 9 },
              { n: "Support", i: "SU", c: 3 },
            ].map((a) => (
              <div key={a.n} className="flex items-center gap-2 px-3 py-2">
                <Avatar initials={a.i} size="sm" />
                <span className="flex-1 truncate text-[0.6875rem]">{a.n}</span>
                <span className="font-mono text-[0.5625rem] text-ink-3">{a.c}</span>
              </div>
            ))}
          </Panel>

          <Panel title="Event mix" bodyClassName="space-y-2 p-4">
            {Object.entries(kindMeta).map(([k, v]) => {
              const count = extended.filter((a) => a.kind === k).length;
              return (
                <div key={k} className="flex items-center gap-2">
                  <v.icon className={cn("size-3 shrink-0", v.color)} />
                  <span className="w-16 text-[0.625rem] text-ink-2">{v.label}</span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-brand/70"
                      style={{ width: `${(count / extended.length) * 100}%` }}
                    />
                  </div>
                  <span className="w-3 text-right font-mono text-[0.5rem] text-ink-3">{count}</span>
                </div>
              );
            })}
          </Panel>

          <Panel title="Integrity" bodyClassName="p-4">
            <p className="text-[0.625rem] leading-relaxed text-ink-2">
              Log entries are append-only and hash-chained. Each row carries the digest of the previous
              entry, so tampering breaks the chain.
            </p>
            <p className="mt-2 rounded bg-surface-2 px-2 py-1 font-mono text-[0.5rem] text-ink-3 break-all">
              sha256:8f2a…c91d
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

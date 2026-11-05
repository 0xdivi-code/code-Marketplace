import * as React from "react";
import { Activity, Download, Filter, Search, ShieldCheck, User, Package, CreditCard, Settings2 } from "lucide-react";
import { PageHeader } from "./admin-layout";
import { Panel } from "./ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { NativeSelect } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

const kindMeta = {
  product: { icon: Package, label: "Product", color: "text-accent" },
  order: { icon: CreditCard, label: "Order", color: "text-emerald-600" },
  customer: { icon: User, label: "Customer", color: "text-[#2c4a6e]" },
  content: { icon: Activity, label: "Content", color: "text-[#7c3517]" },
  promo: { icon: Filter, label: "Promotion", color: "text-[#b0842f]" },
  settings: { icon: Settings2, label: "Settings", color: "text-ink-3" },
  auth: { icon: ShieldCheck, label: "Auth", color: "text-[#2c4a6e]" },
  license: { icon: Package, label: "Licence", color: "text-emerald-600" },
} as const;

type KindMeta = typeof kindMeta;

interface ActivityRecord {
  id: string;
  actor: string;
  action: string;
  target: string;
  kind: string;
  ip: string;
  createdAt: string;
}

/** Human "3 hours ago" without pulling in a date library. */
function ago(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminActivity() {
  const [kind, setKind] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [log, setLog] = React.useState<ActivityRecord[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    api
      .get<{ activity: ActivityRecord[] }>("/admin/activity")
      .then((res) => alive && setLog(res.activity))
      .catch((err) => {
        if (alive) toast.error(err instanceof ApiError ? err.message : "Could not load the log.");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const rows = log.filter((a) => {
    if (kind !== "all" && a.kind !== kind) return false;
    if (query && !`${a.actor} ${a.action} ${a.target}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const actors = Object.entries(
    log.reduce<Record<string, number>>((acc, a) => {
      acc[a.actor] = (acc[a.actor] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div>
      <PageHeader
        title="Activity log"
        subtitle={loading ? "Loading…" : `${log.length} recorded events`}
        actions={
          <>
            <Button
              variant="outline"
              size="xs"
              className="h-8"
              onClick={() => {
                const csv = [
                  "at,actor,kind,action,target",
                  ...log.map((a) =>
                    [a.createdAt, a.actor, a.kind, a.action, a.target]
                      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
                      .join(","),
                  ),
                ].join("\n");
                const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                const a = document.createElement("a");
                a.href = url;
                a.download = "kiln-activity.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="size-3.5" /> Export
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
                const meta = kindMeta[a.kind as keyof KindMeta] ?? kindMeta.settings;
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
                        <span>{ago(a.createdAt)}</span>
                        <span>·</span>
                        <span className="font-mono" title={a.createdAt}>
                          {a.ip && a.ip !== "unknown" ? a.ip : "local"}
                        </span>
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
            {actors.length === 0 && <p className="px-3 py-2 text-[0.6875rem] text-ink-3">No activity yet.</p>}
            {actors.map(([name, count]) => (
              <div key={name} className="flex items-center gap-2 px-3 py-2">
                <Avatar
                  initials={name
                    .split(/[@\s.]/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase())
                    .join("")}
                  size="sm"
                />
                <span className="flex-1 truncate text-[0.6875rem]">{name}</span>
                <span className="font-mono text-[0.5625rem] text-ink-3">{count}</span>
              </div>
            ))}
          </Panel>

          <Panel title="Event mix" bodyClassName="space-y-2 p-4">
            {Object.entries(kindMeta).map(([k, v]) => {
              const count = log.filter((a) => a.kind === k).length;
              return (
                <div key={k} className="flex items-center gap-2">
                  <v.icon className={cn("size-3 shrink-0", v.color)} />
                  <span className="w-16 text-[0.625rem] text-ink-2">{v.label}</span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-brand/70"
                      style={{ width: `${log.length ? (count / log.length) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-3 text-right font-mono text-[0.5rem] text-ink-3">{count}</span>
                </div>
              );
            })}
          </Panel>

          <Panel title="What gets recorded" bodyClassName="p-4 space-y-1.5">
            {[
              "Every admin sign-in, with the IP",
              "Product, category and coupon changes",
              "Order refunds and customer suspensions",
              "Content and settings edits",
              "Customer sign-ins and purchases",
            ].map((line) => (
              <p key={line} className="flex items-start gap-2 text-[0.625rem] leading-relaxed text-ink-2">
                <ShieldCheck className="mt-0.5 size-3 shrink-0 text-ink-3" />
                {line}
              </p>
            ))}
            <p className="pt-1 text-[0.5625rem] leading-relaxed text-ink-3">
              Entries are written by the API as actions happen. This table is the record — there is no
              separate audit store to drift from it.
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

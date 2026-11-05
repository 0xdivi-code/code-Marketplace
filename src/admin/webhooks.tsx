import * as React from "react";
import { Webhook, ShieldAlert, ShieldCheck, RefreshCw, ChevronDown, Copy } from "lucide-react";
import { PageHeader } from "./admin-layout";
import { Panel, Stat } from "./ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

interface HookEvent {
  id: string;
  provider: string;
  signatureOk: boolean;
  status: string | null;
  orderNumber: string | null;
  paymentRef: string | null;
  note: string | null;
  createdAt: string;
  payload: unknown;
}

interface Overview {
  webhookStats: { total: number; rejected: number; duplicates: number };
  recentHooks: { id: string; provider: string; signatureOk: boolean; status: string | null; orderNumber: string | null; note: string | null; createdAt: string }[];
  provider: { active: string; mode: string; configured: boolean };
}

/**
 * Webhook diagnostics.
 *
 * When a payment "didn't go through", the answer is almost always here: a wrong
 * secret, a callback URL pointing at the wrong host, or a gateway retry that was
 * correctly ignored as a duplicate. The payload is kept verbatim so it can be
 * compared against what the gateway says it sent.
 */
export default function AdminWebhooks() {
  const [events, setEvents] = React.useState<HookEvent[] | null>(null);
  const [overview, setOverview] = React.useState<Overview | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "rejected" | "accepted">("all");

  const load = React.useCallback(async () => {
    try {
      const [hooks, ov] = await Promise.all([
        api.get<{ events: HookEvent[] }>("/admin/payments/webhooks"),
        api.get<Overview>("/admin/payments/overview"),
      ]);
      setEvents(hooks.events);
      setOverview(ov);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load webhook events.");
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const visible = (events ?? []).filter((e) =>
    filter === "all" ? true : filter === "rejected" ? !e.signatureOk : e.signatureOk,
  );

  const stats = overview?.webhookStats;

  return (
    <div>
      <PageHeader
        title="Webhooks"
        subtitle="Every callback the gateway sent, including the ones we refused"
        actions={
          <Button variant="outline" size="xs" className="h-8" onClick={() => void load()}>
            <RefreshCw className="size-3.5" /> Reload
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Deliveries"
          value={String(stats?.total ?? 0)}
          hint="all time"
          icon={Webhook}
        />
        <Stat
          label="Signature rejected"
          value={String(stats?.rejected ?? 0)}
          hint={stats?.rejected ? "check the IPN secret" : "none — secret matches"}
          icon={ShieldAlert}
          tone={stats?.rejected ? "warn" : "good"}
        />
        <Stat
          label="Duplicates ignored"
          value={String(stats?.duplicates ?? 0)}
          hint="gateway retries, handled once"
          icon={ShieldCheck}
          tone="good"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(["all", "rejected", "accepted"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              filter === f
                ? "rounded-full border border-ink bg-ink px-3 py-1 text-[0.6875rem] text-paper"
                : "rounded-full border border-line px-3 py-1 text-[0.6875rem] text-ink-2 hover:bg-surface-2"
            }
          >
            {f === "all" ? "Everything" : f === "rejected" ? "Rejected" : "Accepted"}
          </button>
        ))}
        <span className="ml-auto text-[0.625rem] text-ink-3">
          {visible.length} event{visible.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-3">
        <Panel bodyClassName="divide-y divide-line">
          {!events ? (
            <p className="px-4 py-10 text-center text-[0.75rem] text-ink-3">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="px-4 py-10 text-center text-[0.75rem] text-ink-3">
              No deliveries yet. They appear the moment the gateway calls us — or when someone tries to.
            </p>
          ) : (
            visible.map((e) => (
              <div key={e.id}>
                <button
                  onClick={() => setOpen(open === e.id ? null : e.id)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2/40"
                >
                  <span
                    className={
                      e.signatureOk
                        ? "grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2"
                        : "grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2"
                    }
                  >
                    {e.signatureOk ? <ShieldCheck className="size-3" /> : <ShieldAlert className="size-3" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.6875rem]">
                      <span className="font-mono">{e.orderNumber ?? "—"}</span>
                      <span className="text-ink-3"> · {e.status ?? "no status"}</span>
                      <span className="text-ink-3"> · {e.provider}</span>
                    </p>
                    <p className="truncate text-[0.5625rem] text-ink-3">
                      {e.note ?? "no note"} · {new Date(e.createdAt).toLocaleString("en-GB")}
                    </p>
                  </div>
                  <Badge variant={e.signatureOk ? "success" : "danger"} size="sm">
                    {e.signatureOk ? "verified" : "rejected"}
                  </Badge>
                  <ChevronDown
                    className={`size-3 shrink-0 text-ink-3 transition-transform ${open === e.id ? "rotate-180" : ""}`}
                  />
                </button>
                {open === e.id && (
                  <div className="border-t border-line bg-surface-2/40 px-4 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[0.625rem] font-medium">Payload</p>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="h-6"
                        onClick={() => {
                          void navigator.clipboard.writeText(JSON.stringify(e.payload, null, 2));
                          toast.success("Payload copied");
                        }}
                      >
                        <Copy className="size-3" /> Copy
                      </Button>
                    </div>
                    <pre className="max-h-72 overflow-auto rounded bg-surface p-2 font-mono text-[0.5625rem] leading-relaxed text-ink-2">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                    {e.paymentRef && (
                      <p className="mt-2 font-mono text-[0.5625rem] text-ink-3">payment ref {e.paymentRef}</p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </Panel>
      </div>
    </div>
  );
}

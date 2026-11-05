import * as React from "react";
import { ArrowDownToLine, RefreshCcw, Wallet, Percent, Receipt } from "lucide-react";
import { PageHeader } from "./admin-layout";
import { Panel, Stat, MoneyCell, StatusBadge } from "./ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { money } from "@/lib/utils";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";

interface PaymentRow {
  id: string;
  orderId: string;
  provider: string;
  mode: string;
  status: string;
  amount: number;
  fee: number;
  reference: string;
  createdAt: string;
  number: string;
  email: string;
  name: string;
}

interface PaymentsResponse {
  payments: PaymentRow[];
  totals: {
    gross: number;
    fees: number;
    net: number;
    count: number;
    refunded: number;
    avgOrder: number;
  };
  daily: { day: string; gross: number; fees: number; count: number }[];
}

export default function AdminPayments() {
  const [data, setData] = React.useState<PaymentsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    api
      .get<PaymentsResponse>("/admin/payments")
      .then((res) => alive && setData(res))
      .catch((err) => {
        if (alive) toast.error(err instanceof ApiError ? err.message : "Could not load the ledger.");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const totals = data?.totals;
  const captured = data?.payments.filter((p) => p.status === "succeeded") ?? [];
  const feeRate = totals && totals.gross > 0 ? ((totals.fees / totals.gross) * 100).toFixed(1) : "0.0";

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle={
          loading
            ? "Loading the ledger…"
            : `${totals?.count ?? 0} captured payments · ${money(totals?.gross ?? 0, { free: false })} gross`
        }
        actions={
          <Button variant="outline" size="xs" className="h-8" asChild>
            <a href="/api/admin/export/orders" download>
              <ArrowDownToLine className="size-3.5" /> Export ledger
            </a>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Gross captured"
          value={money(totals?.gross ?? 0, { free: false })}
          hint={`${totals?.count ?? 0} payments`}
          icon={Wallet}
          tone="good"
        />
        <Stat
          label="Gateway fees"
          value={money(totals?.fees ?? 0, { free: false })}
          hint={`${feeRate}% effective`}
          icon={Percent}
        />
        <Stat
          label="Net settled"
          value={money(totals?.net ?? 0, { free: false })}
          hint="after fees"
          icon={RefreshCcw}
        />
        <Stat
          label="Average order"
          value={money(totals?.avgOrder ?? 0, { free: false })}
          hint={`${totals?.refunded ?? 0} refunded`}
          icon={Receipt}
        />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.35fr_1fr]">
        <Panel
          title="Daily settlement"
          description="Every day the gateway captured money"
          bodyClassName=""
        >
          {loading ? (
            <p className="px-4 py-8 text-center text-[0.75rem] text-ink-3">Loading…</p>
          ) : (data?.daily.length ?? 0) === 0 ? (
            <p className="px-4 py-8 text-center text-[0.75rem] text-ink-3">No payments captured yet.</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line bg-surface-2/50">
                  {["Day", "Payments", "Gross", "Fees", "Net"].map((h, i) => (
                    <th
                      key={h}
                      className={`label-mono px-3 py-1.5 text-[0.4375rem] text-ink-3 ${i > 1 ? "text-right" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data!.daily.map((d) => (
                  <tr key={d.day} className="border-b border-line/60 last:border-0 hover:bg-surface-2/40">
                    <td className="px-3 py-2.5 font-mono text-[0.6875rem] text-ink">
                      {new Date(d.day).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-3 py-2.5 text-[0.6875rem] text-ink-3">{d.count}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[0.6875rem] text-ink-2">
                      {money(d.gross, { free: false })}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[0.6875rem] text-ink-3">
                      −{money(d.fees, { free: false })}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <MoneyCell cents={d.gross - d.fees} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <CryptoPanel />
      </div>

      <div className="mt-3">
        <Panel title="Transactions" description="Newest first" bodyClassName="divide-y divide-line">
          {loading ? (
            <p className="px-4 py-8 text-center text-[0.75rem] text-ink-3">Loading…</p>
          ) : (
            data?.payments.slice(0, 12).map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[0.6875rem]">
                    {p.number} <span className="text-ink-3">· {p.reference}</span>
                  </p>
                  <p className="truncate text-[0.5625rem] text-ink-3">
                    {p.name} · {p.email}
                  </p>
                </div>
                <StatusBadge status={p.status} />
                <span className="w-20 shrink-0 text-right font-mono text-[0.6875rem]">
                  {money(p.amount, { free: false })}
                </span>
              </div>
            ))
          )}
        </Panel>
      </div>
    </div>
  );
}

/**
 * Crypto provider status.
 *
 * Reads the real configuration — which implementation is active, whether the
 * key works, and where the webhook should point. Nothing here shows a secret;
 * the API returns masked hints only.
 */
function CryptoPanel() {
  const [info, setInfo] = React.useState<{
    provider: string;
    mode: string;
    configured: boolean;
    baseUrl: string;
    apiKeyHint: string;
    ipnSecretHint: string;
    webhookUrls: { nowpayments: string; sandbox: string };
    currencies: { code: string; ticker: string; network: string; note: string; cheap: boolean }[];
    envOverride: Record<string, boolean>;
  } | null>(null);
  const [test, setTest] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [showKey, setShowKey] = React.useState(false);
  const [form, setForm] = React.useState({ apiKey: "", ipnSecret: "", payoutWallet: "", mode: "test" });

  React.useEffect(() => {
    api
      .get<NonNullable<typeof info>>("/admin/payments/settings")
      .then((r) => {
        setInfo(r);
        setForm((f) => ({ ...f, payoutWallet: "", mode: r.mode }));
      })
      .catch(() => {});
  }, []);

  async function save() {
    setBusy(true);
    try {
      await api.patch("/admin/payments/settings", {
        apiKey: form.apiKey || undefined,
        ipnSecret: form.ipnSecret || undefined,
        payoutWallet: form.payoutWallet || undefined,
        mode: form.mode,
      });
      const fresh = await api.get<NonNullable<typeof info>>("/admin/payments/settings");
      setInfo(fresh);
      setForm((f) => ({ ...f, apiKey: "", ipnSecret: "" }));
      toast.success("Payment settings saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save settings.");
    } finally {
      setBusy(false);
    }
  }

  async function checkConnection() {
    setBusy(true);
    try {
      const r = await api.post<{ ok: boolean; provider: string; message: string }>(
        "/admin/payments/test-connection",
      );
      setTest(`${r.ok ? "✓" : "✕"} ${r.provider}: ${r.message}`);
    } catch {
      setTest("✕ Could not reach the provider.");
    } finally {
      setBusy(false);
    }
  }

  if (!info) return <Panel title="Crypto gateway"><p className="px-4 py-8 text-center text-[0.75rem] text-ink-3">Loading…</p></Panel>;

  return (
    <Panel title="Crypto gateway" description="How this store takes money" bodyClassName="divide-y divide-line">
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.75rem] font-medium">
            {info.provider === "nowpayments" ? "NOWPayments" : "Local sandbox"}
            <span className="ml-2 font-normal text-ink-3">{info.mode} mode</span>
          </p>
          <p className="text-[0.5625rem] leading-relaxed text-ink-3">
            {info.provider === "nowpayments"
              ? "Hosted invoices, USDT/USDC/BTC, signed IPNs verified server-side."
              : "No API key set — invoices settle locally so the pipeline can be tested offline."}
          </p>
          <p className="mt-1 font-mono text-[0.5625rem] text-ink-3">
            key {info.apiKeyHint || "—"} · ipn {info.ipnSecretHint || "—"}
          </p>
        </div>
        <Badge variant={info.provider === "nowpayments" ? "success" : "warn"} size="sm" className="shrink-0">
          {info.provider === "nowpayments" ? "Live key" : "Sandbox"}
        </Badge>
      </div>

      <div className="space-y-2 px-4 py-3">
        <p className="text-[0.6875rem] font-medium">Accepted coins</p>
        <div className="flex flex-wrap gap-1">
          {Array.from(new Set(info.currencies.map((c) => c.ticker))).map((t) => (
            <span key={t} className="rounded border border-line px-1.5 py-0.5 font-mono text-[0.5rem] text-ink-2">
              {t}
            </span>
          ))}
        </div>
        <p className="text-[0.5625rem] leading-relaxed text-ink-3">
          {info.currencies.filter((c) => c.cheap).length} low-fee networks enabled. USDT on Polygon moves for
          cents, which is what small software purchases need.
        </p>
      </div>

      <div className="space-y-2 px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-[0.6875rem] font-medium">Webhook endpoint</p>
          <Button variant="ghost" size="xs" className="h-6" onClick={() => { void navigator.clipboard.writeText(info.webhookUrls[info.provider === "nowpayments" ? "nowpayments" : "sandbox"]); toast.success("Copied"); }}>
            Copy
          </Button>
        </div>
        <code className="block break-all rounded bg-surface-2 px-2 py-1.5 font-mono text-[0.5rem] text-ink-2">
          {info.webhookUrls[info.provider === "nowpayments" ? "nowpayments" : "sandbox"]}
        </code>
        <p className="text-[0.5625rem] leading-relaxed text-ink-3">
          Paste this into the gateway dashboard's IPN field. It must match the configured secret or every
          callback is rejected.
        </p>
      </div>

      <div className="space-y-2 px-4 py-3">
        <p className="text-[0.6875rem] font-medium">Credentials</p>
        {info.envOverride.apiKey && (
          <p className="rounded border border-line bg-surface-2 px-2 py-1 text-[0.5rem] text-ink-2">
            An environment variable is set and takes precedence over anything saved here.
          </p>
        )}
        <input
          value={form.apiKey}
          onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
          type={showKey ? "text" : "password"}
          placeholder={info.configured ? "Replace API key (leave blank to keep)" : "Paste API key"}
          className="h-8 w-full rounded-sm border border-line bg-surface px-2 font-mono text-[0.625rem]"
        />
        <input
          value={form.ipnSecret}
          onChange={(e) => setForm((f) => ({ ...f, ipnSecret: e.target.value }))}
          type={showKey ? "text" : "password"}
          placeholder="IPN secret (leave blank to keep)"
          className="h-8 w-full rounded-sm border border-line bg-surface px-2 font-mono text-[0.625rem]"
        />
        <input
          value={form.payoutWallet}
          onChange={(e) => setForm((f) => ({ ...f, payoutWallet: e.target.value }))}
          placeholder="Payout wallet (for reconciliation)"
          className="h-8 w-full rounded-sm border border-line bg-surface px-2 font-mono text-[0.625rem]"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={form.mode}
            onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}
            className="h-8 rounded-sm border border-line bg-surface px-2 text-[0.6875rem]"
          >
            <option value="test">Test mode</option>
            <option value="live">Live mode</option>
          </select>
          <Button size="xs" className="h-8" onClick={() => void save()} disabled={busy}>
            Save
          </Button>
          <Button size="xs" variant="outline" className="h-8" onClick={() => void checkConnection()} disabled={busy}>
            <RefreshCcw className="size-3" /> Test
          </Button>
          <label className="ml-auto flex items-center gap-1 text-[0.5625rem] text-ink-3">
            <input type="checkbox" checked={showKey} onChange={(e) => setShowKey(e.target.checked)} /> show
          </label>
        </div>
        {test && <p className="font-mono text-[0.5625rem] text-ink-2">{test}</p>}
      </div>
    </Panel>
  );
}

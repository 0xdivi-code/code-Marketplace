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

        <Panel title="Gateway" description="How this store takes money" bodyClassName="divide-y divide-line">
          <div className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[0.75rem] font-medium">Stripe (demo mode)</p>
              <p className="text-[0.5625rem] text-ink-3">
                Orders are captured through the demo gateway. No card data reaches this server.
              </p>
              <p className="mt-1 font-mono text-[0.5625rem] text-ink-3">
                {(feeRate as string)}% effective · {captured.length} settled
              </p>
            </div>
            <Badge variant="success" size="sm" className="shrink-0">
              Live
            </Badge>
          </div>
          <div className="space-y-2 px-4 py-3">
            <p className="text-[0.6875rem] font-medium">To take real money</p>
            <p className="text-[0.5625rem] leading-relaxed text-ink-3">
              Set <code className="font-mono">STRIPE_SECRET_KEY</code> and switch{" "}
              <code className="font-mono">payments.mode</code> from <code className="font-mono">demo</code> to{" "}
              <code className="font-mono">live</code>. The order and licence flow stays exactly the same —
              only the capture call changes.
            </p>
          </div>
        </Panel>
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

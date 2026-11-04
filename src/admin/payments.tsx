import * as React from "react";
import { CreditCard, ArrowDownToLine, RefreshCcw, Wallet, Check, Percent } from "lucide-react";
import { PageHeader } from "./admin-layout";
import { Panel, Stat, MoneyCell, StatusBadge, Sparkline } from "./ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/field";
import { orders } from "@/data/catalog";
import { money, cn } from "@/lib/utils";
import { toast } from "sonner";

const payouts = [
  { id: "PO-2841", date: "2026-10-31", gross: 842000, fees: 25100, net: 816900, status: "completed", bank: "•••• 4821" },
  { id: "PO-2790", date: "2026-10-17", gross: 714800, fees: 21240, net: 693560, status: "completed", bank: "•••• 4821" },
  { id: "PO-2744", date: "2026-10-03", gross: 693200, fees: 20680, net: 672520, status: "completed", bank: "•••• 4821" },
  { id: "PO-2698", date: "2026-09-19", gross: 581400, fees: 17420, net: 563980, status: "completed", bank: "•••• 4821" },
  { id: "PO-2860", date: "2026-11-14", gross: 412000, fees: 12360, net: 399640, status: "pending", bank: "•••• 4821" },
];

const gateways = [
  { name: "Stripe", desc: "Cards, Apple Pay, Google Pay", enabled: true, fee: "2.9% + 30¢", volume: 3184000 },
  { name: "PayPal", desc: "PayPal balance and cards", enabled: true, fee: "3.4% + 35¢", volume: 482000 },
  { name: "Bank transfer", desc: "Manual invoice clearance", enabled: false, fee: "Free", volume: 198000 },
  { name: "Lemon Squeezy", desc: "Merchant of record (VAT)", enabled: false, fee: "5% + 50¢", volume: 0 },
];

export default function AdminPayments() {
  const [config, setConfig] = React.useState(() => Object.fromEntries(gateways.map((g) => [g.name, g.enabled])));

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Balances, payouts and gateway configuration"
        actions={
          <>
            <Button variant="outline" size="xs" className="h-8">
              View ledger
            </Button>
            <Button size="xs" className="h-8" onClick={() => toast.success("Payout requested")}>
              <ArrowDownToLine className="size-3.5" /> Request payout
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Available balance" value={money(1284200, { free: false })} delta={12.8} hint="ready to pay out" icon={Wallet} tone="good" spark={[8, 10, 9, 12, 11, 14, 13, 16]} />
        <Stat label="Pending clearance" value={money(412000, { free: false })} hint="clears 14 Nov" icon={RefreshCcw} spark={[4, 5, 4, 6, 5, 7, 6, 8]} />
        <Stat label="Fees this month" value={money(123600, { free: false })} delta={-3.2} hint="2.7% effective" icon={Percent} />
        <Stat label="Lifetime payouts" value={money(18426000, { free: false })} delta={9.1} hint="42 payouts" icon={ArrowDownToLine} tone="good" />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.35fr_1fr]">
        <Panel title="Payout history" description="Two settlements per month" bodyClassName="">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line bg-surface-2/50">
                {["Payout", "Date", "Gross", "Fees", "Net", "Status"].map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      "label-mono px-3 py-1.5 text-[0.4375rem] text-ink-3",
                      i > 1 && "text-right",
                      i === 5 && "text-right",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2/40">
                  <td className="px-3 py-2.5">
                    <p className="font-mono text-[0.6875rem] text-ink">{p.id}</p>
                    <p className="text-[0.5625rem] text-ink-3">to {p.bank}</p>
                  </td>
                  <td className="px-3 py-2.5 text-[0.6875rem] text-ink-3">
                    {new Date(p.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[0.6875rem] text-ink-2">{money(p.gross, { free: false })}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[0.6875rem] text-ink-3">−{money(p.fees, { free: false })}</td>
                  <td className="px-3 py-2.5 text-right">
                    <MoneyCell cents={p.net} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <StatusBadge status={p.status === "completed" ? "completed" : "pending"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Payment methods" description="Enable what your buyers can use" bodyClassName="divide-y divide-line">
          {gateways.map((g) => (
            <div key={g.name} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded border border-line bg-surface-2">
                <CreditCard className="size-3.5 text-ink-2" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.75rem] font-medium">{g.name}</p>
                <p className="text-[0.5625rem] text-ink-3">{g.desc}</p>
                <p className="mt-1 font-mono text-[0.5625rem] text-ink-3">
                  {g.fee} · {money(g.volume, { free: false })} volume
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {config[g.name] && (
                  <Badge variant="success" size="sm" className="gap-1">
                    <Check className="size-2.5" /> Live
                  </Badge>
                )}
                <Switch
                  checked={config[g.name]}
                  onCheckedChange={(v) => {
                    setConfig((c) => ({ ...c, [g.name]: v }));
                    toast.success(`${g.name} ${v ? "enabled" : "disabled"}`);
                  }}
                />
              </div>
            </div>
          ))}
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Panel title="Tax settings" bodyClassName="space-y-2.5 p-4 text-[0.6875rem]">
          {[
            ["EU VAT", "Reverse charge for valid VIES numbers"],
            ["UK VAT", "20% applied at checkout"],
            ["US sales tax", "Nexus-based, 4 states"],
            ["Invoice PDFs", "Generated automatically"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-ink">{k}</p>
                <p className="text-[0.5625rem] text-ink-3">{v}</p>
              </div>
              <Badge variant="sage" size="sm">
                On
              </Badge>
            </div>
          ))}
        </Panel>

        <Panel title="Revenue split" description="Last 30 days" bodyClassName="p-4">
          <div className="space-y-3">
            {[
              { l: "Products", v: 3184000, c: "#17392b" },
              { l: "Bundles", v: 482000, c: "#c0592b" },
              { l: "Extended licenses", v: 198000, c: "#b0842f" },
            ].map((s) => (
              <div key={s.l}>
                <div className="flex justify-between text-[0.6875rem]">
                  <span className="text-ink-2">{s.l}</span>
                  <span className="font-mono text-ink-3">{money(s.v, { free: false })}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(s.v / 3864000) * 100}%`, background: s.c }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-end justify-between border-t border-line pt-3">
            <div>
              <p className="label-mono text-[0.4375rem] text-ink-3">Net revenue</p>
              <p className="font-display text-[1.3rem] leading-none">{money(3740400, { free: false })}</p>
            </div>
            <Sparkline data={[10, 14, 12, 18, 16, 21, 24]} tone="good" />
          </div>
        </Panel>

        <Panel title="Recent transactions" bodyClassName="divide-y divide-line">
          {orders.slice(0, 5).map((o) => (
            <div key={o.id} className="flex items-center gap-2 px-4 py-2">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[0.625rem]">{o.id}</p>
                <p className="truncate text-[0.5625rem] text-ink-3">{o.payment}</p>
              </div>
              <span className="font-mono text-[0.6875rem]">{money(o.total)}</span>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

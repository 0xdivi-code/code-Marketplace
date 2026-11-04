import * as React from "react";
import { Plus, Ticket, Copy, Trash2, Percent, CircleDollarSign, CalendarClock } from "lucide-react";
import { PageHeader } from "./admin-layout";
import { Panel, DataTable, StatusBadge, RowActions, type Column } from "./ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, NativeSelect, Switch } from "@/components/ui/field";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { coupons } from "@/data/catalog";
import type { Coupon } from "@/data/types";
import { money, cn } from "@/lib/utils";
import { toast } from "sonner";

export default function AdminPromotions() {
  const [open, setOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [kind, setKind] = React.useState("percent");
  const [value, setValue] = React.useState("20");

  const columns: Column<Coupon>[] = [
    {
      key: "code",
      header: "Code",
      render: (c) => (
        <div className="flex items-center gap-2">
          <span className="rounded border border-dashed border-line-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[0.6875rem] font-medium tracking-wide">
            {c.code}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toast.success(`${c.code} copied`);
            }}
            className="text-ink-3 hover:text-ink"
            aria-label={`Copy ${c.code}`}
          >
            <Copy className="size-3" />
          </button>
        </div>
      ),
      sortValue: (c) => c.code,
    },
    {
      key: "value",
      header: "Discount",
      render: (c) => (
        <span className="flex items-center gap-1 font-mono text-[0.75rem]">
          {c.kind === "percent" ? (
            <Percent className="size-3 text-ink-3" />
          ) : (
            <CircleDollarSign className="size-3 text-ink-3" />
          )}
          {c.kind === "percent" ? `${c.value}%` : money(c.value)}
        </span>
      ),
      sortValue: (c) => c.value,
    },
    {
      key: "uses",
      header: "Usage",
      render: (c) => (
        <div className="w-28">
          <div className="flex justify-between font-mono text-[0.5625rem] text-ink-3">
            <span>
              {c.uses}/{c.limit}
            </span>
            <span>{Math.round((c.uses / c.limit) * 100)}%</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${Math.min(100, (c.uses / c.limit) * 100)}%` }}
            />
          </div>
        </div>
      ),
      sortValue: (c) => c.uses / c.limit,
    },
    {
      key: "expires",
      header: "Expires",
      render: (c) => (
        <span className="text-[0.6875rem] text-ink-3">
          {new Date(c.expires).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      ),
      sortValue: (c) => c.expires,
    },
    { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (c) => (
        <RowActions
          items={[
            { label: "Edit coupon", onClick: () => toast.success("Editing") },
            { label: "Copy code", onClick: () => toast.success(`${c.code} copied`) },
            { label: "Deactivate", danger: true, onClick: () => toast.success("Coupon deactivated") },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Promotions"
        subtitle="Discount codes, automatic offers and bundle pricing"
        actions={
          <Button size="xs" className="h-8" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" /> New coupon
          </Button>
        }
      />

      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        {[
          { l: "Active coupons", v: "2", i: Ticket },
          { l: "Redemptions", v: "1,024", i: Percent },
          { l: "Revenue from codes", v: money(842000, { free: false }), i: CircleDollarSign },
        ].map((s) => (
          <div key={s.l} className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3">
            <span className="grid size-8 place-items-center rounded-full bg-surface-2">
              <s.i className="size-3.5 text-ink-2" />
            </span>
            <div>
              <p className="label-mono text-[0.4375rem] text-ink-3">{s.l}</p>
              <p className="font-mono text-[0.875rem]">{s.v}</p>
            </div>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={coupons}
        rowKey={(c) => c.code}
        footer={<div className="text-[0.625rem] text-ink-3">{coupons.length} codes total</div>}
      />

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Panel title="Automatic offers" description="No code needed" bodyClassName="divide-y divide-line">
          {[
            { l: "Bundle — Launch Stack", v: "20% off", on: true },
            { l: "Second item — 15% off", v: "15% off", on: true },
            { l: "First order — 10% off", v: "10% off", on: false },
          ].map((o) => (
            <div key={o.l} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className="text-[0.75rem]">{o.l}</p>
                <p className="text-[0.5625rem] text-ink-3">{o.v}</p>
              </div>
              <Switch defaultChecked={o.on} />
            </div>
          ))}
        </Panel>

        <Panel title="Scheduled" description="Starts automatically" bodyClassName="p-4 space-y-2">
          <div className="rounded-sm border border-line p-3">
            <div className="flex items-center justify-between">
              <Badge variant="accent" size="sm">
                BLACKFRIDAY
              </Badge>
              <span className="font-mono text-[0.5625rem] text-ink-3">40%</span>
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-[0.625rem] text-ink-3">
              <CalendarClock className="size-3" /> Starts 28 Nov 2026 · 48 hours
            </p>
          </div>
          <div className="rounded-sm border border-dashed border-line-strong p-3 text-center">
            <p className="text-[0.625rem] text-ink-3">Add a seasonal window</p>
          </div>
        </Panel>

        <Panel title="Coupon performance" bodyClassName="p-4">
          <div className="space-y-2.5">
            {[
              { c: "WELCOME10", v: 94 },
              { c: "LAUNCH25", v: 62 },
              { c: "FREESHIP", v: 18 },
            ].map((x) => (
              <div key={x.c}>
                <div className="flex justify-between text-[0.6875rem]">
                  <span className="font-mono text-ink-2">{x.c}</span>
                  <span className="text-ink-3">{x.v}% of codes</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className={cn("h-full rounded-full bg-accent")} style={{ width: `${x.v}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New coupon</DialogTitle>
            <DialogDescription>Percentage or fixed discount, with usage limits and an expiry.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-6 pb-2">
            <Field label="Code" htmlFor="code" hint="Uppercase, no spaces">
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="SPRING20"
                className="font-mono tracking-wide"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type" htmlFor="kind">
                <NativeSelect id="kind" className="h-11 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="percent">Percentage</option>
                  <option value="fixed">Fixed amount</option>
                </NativeSelect>
              </Field>
              <Field label={kind === "percent" ? "Percent off" : "Amount off (cents)"} htmlFor="val">
                <Input id="val" value={value} onChange={(e) => setValue(e.target.value)} className="font-mono" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Usage limit" htmlFor="limit">
                <Input id="limit" defaultValue="500" className="font-mono" />
              </Field>
              <Field label="Expires" htmlFor="exp">
                <Input id="exp" type="date" defaultValue="2026-12-31" />
              </Field>
            </div>
            <div className="flex items-center justify-between rounded-sm border border-line px-3 py-2.5">
              <span className="text-[0.75rem]">Limit to selected products</span>
              <Switch />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setOpen(false);
                toast.success(`Coupon ${code || "SPRING20"} created`);
              }}
            >
              Create coupon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

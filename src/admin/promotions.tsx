import * as React from "react";
import { Plus, Ticket, Copy, Percent, CircleDollarSign, CalendarClock } from "lucide-react";
import { PageHeader } from "./admin-layout";
import { Panel, DataTable, StatusBadge, RowActions, type Column } from "./ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, NativeSelect } from "@/components/ui/field";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { Coupon } from "@/data/types";
import { money } from "@/lib/utils";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";

export default function AdminPromotions() {
  const [open, setOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [kind, setKind] = React.useState("percent");
  const [value, setValue] = React.useState("20");
  const [limitInput, setLimitInput] = React.useState("500");
  const [expires, setExpires] = React.useState("");
  const [coupons, setCoupons] = React.useState<Coupon[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await api.get<{ coupons: Coupon[] }>("/admin/coupons");
      setCoupons(res.coupons);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load coupons.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 2) return toast.error("Give the code at least two characters.");
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter a discount amount.");
    if (kind === "percent" && amount > 100) return toast.error("A percentage cannot exceed 100.");
    setBusy(true);
    try {
      await api.post("/admin/coupons", {
        code: trimmed,
        kind,
        value: Math.round(amount),
        limit: Number(limitInput) || 500,
        expires: expires || undefined,
      });
      toast.success(`${trimmed} is live`, { description: "It can be redeemed at checkout right now." });
      setOpen(false);
      setCode("");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create that coupon.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(c: Coupon) {
    try {
      await api.patch(`/admin/coupons/${c.code}`, { active: c.status !== "active" });
      toast.success(c.status === "active" ? `${c.code} paused` : `${c.code} reactivated`);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That change did not stick.");
    }
  }

  async function remove(c: Coupon) {
    if (!window.confirm(`Delete ${c.code}? Anyone holding it loses the discount.`)) return;
    try {
      await api.del(`/admin/coupons/${c.code}`);
      toast.success(`${c.code} deleted`);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete that coupon.");
    }
  }

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
              void navigator.clipboard?.writeText(c.code);
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
            {
              label: "Copy code",
              onClick: () => {
                void navigator.clipboard?.writeText(c.code);
                toast.success(`${c.code} copied`);
              },
            },
            {
              label: c.status === "active" ? "Pause coupon" : "Reactivate",
              onClick: () => void toggle(c),
            },
            { label: "Delete", danger: true, onClick: () => void remove(c) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Promotions"
        subtitle={loading ? "Loading promotions…" : "Discount codes the checkout API validates live"}
        actions={
          <Button size="xs" className="h-8" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" /> New coupon
          </Button>
        }
      />

      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        {[
          {
            l: "Active coupons",
            v: String(coupons.filter((c) => c.status === "active").length),
            i: Ticket,
          },
          {
            l: "Redemptions",
            v: String(coupons.reduce((n, c) => n + c.uses, 0)),
            i: Percent,
          },
          {
            l: "Codes in the database",
            v: String(coupons.length),
            i: CircleDollarSign,
          },
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

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel title="Scheduled" description="Codes with an expiry date" bodyClassName="p-4 space-y-2">
          {coupons.filter((c) => c.status !== "active").length === 0 ? (
            <p className="text-[0.6875rem] text-ink-3">No paused or expired codes.</p>
          ) : (
            coupons
              .filter((c) => c.status !== "active")
              .slice(0, 4)
              .map((c) => (
                <div key={c.code} className="flex items-center justify-between rounded-sm border border-line p-3">
                  <div>
                    <Badge variant={c.status === "expired" ? "neutral" : "accent"} size="sm">
                      {c.code}
                    </Badge>
                    <p className="mt-1.5 flex items-center gap-1.5 text-[0.625rem] text-ink-3">
                      <CalendarClock className="size-3" />
                      {c.status === "expired" ? `Expired ${c.expires}` : "Paused by you"}
                    </p>
                  </div>
                  <span className="font-mono text-[0.625rem] text-ink-3">
                    {c.kind === "percent" ? `${c.value}%` : money(c.value)}
                  </span>
                </div>
              ))
          )}
        </Panel>

        <Panel title="Redemptions per code" bodyClassName="p-4">
          {coupons.length === 0 ? (
            <p className="text-[0.6875rem] text-ink-3">No codes yet.</p>
          ) : (
            <div className="space-y-2.5">
              {[...coupons]
                .sort((a, b) => b.uses - a.uses)
                .slice(0, 4)
                .map((c) => {
                  const pct = c.limit ? Math.round((c.uses / c.limit) * 100) : 0;
                  return (
                    <div key={c.code}>
                      <div className="flex justify-between text-[0.6875rem]">
                        <span className="font-mono text-ink-2">{c.code}</span>
                        <span className="text-ink-3">
                          {c.uses}/{c.limit}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
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
                <Input
                  id="limit"
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  className="font-mono"
                />
              </Field>
              <Field label="Expires" htmlFor="exp">
                <Input id="exp" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void create()}>
              {busy ? "Creating…" : "Create coupon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

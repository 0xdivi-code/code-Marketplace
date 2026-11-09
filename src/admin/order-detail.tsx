import * as React from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Mail,
  MapPin,
  CreditCard,
  Clock,
  RefreshCcw,
  FileText,
  Download,
} from "lucide-react";
import { PageHeader } from "./admin-layout";
import { Panel, StatusBadge } from "./ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { money, cn } from "@/lib/utils";
import { toast } from "sonner";
import NotFoundPage from "@/pages/not-found";
import { api, ApiError } from "@/lib/api";

interface OrderItem {
  id: string;
  productSlug: string;
  productName: string;
  license: string;
  unitPrice: number;
  quantity: number;
}

interface DetailResponse {
  order: {
    id: string;
    number: string;
    email: string;
    name: string;
    status: "pending" | "paid" | "refunded" | "cancelled";
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    currency: string;
    couponCode: string | null;
    country: string | null;
    vatNumber: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    items: OrderItem[];
    payments: {
      provider: string;
      mode: string;
      status: string;
      amount: number;
      fee: number;
      reference: string;
      createdAt: string;
      /** crypto rail details — the evidence an operator reconciles against */
      network?: string | null;
      payCurrency?: string | null;
      payAmount?: string | null;
      payAddress?: string | null;
      payinHash?: string | null;
      expiresAt?: string | null;
    }[];
  };
  customer: {
    id: string;
    email: string;
    name: string;
    country: string | null;
    createdAt: string;
    orders?: number;
    spent?: number;
  } | null;
  availableFiles: number;
}

const statusLabel = {
  pending: "Pending",
  paid: "Paid",
  refunded: "Refunded",
  cancelled: "Cancelled",
} as const;

export default function AdminOrderDetail() {
  const { id = "" } = useParams();
  const [data, setData] = React.useState<DetailResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [missing, setMissing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setData(await api.get<DetailResponse>(`/admin/orders/${encodeURIComponent(id)}`));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setMissing(true);
      else toast.error(err instanceof ApiError ? err.message : "Could not load the order.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(status: "paid" | "refunded" | "cancelled") {
    if (!data) return;
    setBusy(true);
    try {
      await api.patch(`/admin/orders/${data.order.number}`, { status });
      toast.success(`Order marked ${statusLabel[status].toLowerCase()}`, {
        description: status === "refunded" ? "The licence was revoked." : undefined,
      });
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That change did not stick.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="py-20 text-center text-sm text-ink-3">Loading order…</div>;
  if (missing || !data) return <NotFoundPage />;

  const { order, customer } = data;
  const payment = order.payments[0];
  const paid = order.status === "paid";

  // Real events, in the order they happened. No invented timeline.
  const timeline = [
    { label: "Order placed", at: order.createdAt, done: true },
    {
      label: payment ? `Payment ${payment.status}` : "Awaiting payment",
      at: payment?.createdAt ?? order.createdAt,
      done: Boolean(payment),
    },
    {
      label: "Licences issued",
      at: order.createdAt,
      done: order.status === "paid" || order.status === "refunded",
    },
    ...(order.status === "refunded"
      ? [{ label: "Refunded — access revoked", at: order.updatedAt, done: true }]
      : []),
  ];

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div>
      <PageHeader
        title={order.number}
        subtitle={`Placed ${fmt(order.createdAt)} · ${order.items.length} item${order.items.length === 1 ? "" : "s"}`}
        actions={
          <>
            <Button asChild variant="ghost" size="xs" className="h-8">
              <Link to="/admin/orders">
                <ArrowLeft className="size-3.5" /> Orders
              </Link>
            </Button>
            <Button
              variant="outline"
              size="xs"
              className="h-8"
              onClick={() => {
                void navigator.clipboard?.writeText(customer?.email ?? order.email);
                toast.success("Customer email copied");
              }}
            >
              <Mail className="size-3.5" /> Copy email
            </Button>
            {paid && (
              <Button size="xs" className="h-8" disabled={busy} onClick={() => void setStatus("refunded")}>
                <RefreshCcw className="size-3.5" /> Refund {money(order.total, { free: false })}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3">
            <StatusBadge status={order.status} />
            <span className="text-[0.6875rem] text-ink-3">
              {payment ? `${payment.provider} · ${payment.mode} · ${payment.reference}` : "No payment recorded"}
            </span>
            <span className="ml-auto font-mono text-[0.9375rem] font-medium">{money(order.total, { free: false })}</span>
          </div>

          <Panel title="Items" bodyClassName="divide-y divide-line">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div className="grid size-12 shrink-0 place-items-center rounded-sm bg-surface-3 font-display text-lg text-ink-2">
                  {item.productName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/admin/products/${item.productSlug}`}
                    className="block truncate text-[0.8125rem] font-medium hover:text-accent-ink dark:hover:text-accent"
                  >
                    {item.productName}
                  </Link>
                  <p className="text-[0.625rem] capitalize text-ink-3">{item.license} license</p>
                </div>
                <Badge variant="neutral" size="sm">
                  Digital
                </Badge>
                <span className="w-16 shrink-0 text-right font-mono text-[0.75rem]">
                  {money(item.unitPrice, { free: false })}
                </span>
              </div>
            ))}
            <div className="space-y-1.5 px-4 py-3 text-[0.75rem]">
              <div className="flex justify-between text-ink-2">
                <span>Subtotal</span>
                <span className="font-mono">{money(order.subtotal, { free: false })}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-ink-2">
                  <span>Discount{order.couponCode ? ` · ${order.couponCode}` : ""}</span>
                  <span className="font-mono">−{money(order.discount, { free: false })}</span>
                </div>
              )}
              {order.tax > 0 && (
                <div className="flex justify-between text-ink-2">
                  <span>Tax</span>
                  <span className="font-mono">{money(order.tax, { free: false })}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-line pt-1.5 font-medium text-ink">
                <span>Total</span>
                <span className="font-mono">{money(order.total, { free: false })}</span>
              </div>
            </div>
          </Panel>

          <Panel title="Timeline" bodyClassName="p-4">
            <ol className="relative border-l border-line pl-5">
              {timeline.map((t) => (
                <li key={t.label} className="relative pb-4 last:pb-0">
                  <span
                    className={cn(
                      "absolute -left-[23px] top-0.5 grid size-4 place-items-center rounded-full border-2 border-surface",
                      t.done ? "bg-brand" : "bg-line-strong",
                    )}
                  >
                    {t.done && <Check className="size-2 text-brand-ink" strokeWidth={4} />}
                  </span>
                  <p className="text-[0.75rem] font-medium text-ink">{t.label}</p>
                  <p className="text-[0.625rem] text-ink-3">{fmt(t.at)}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <aside className="space-y-3">
          <Panel title="Customer" bodyClassName="p-4">
            <div className="flex items-center gap-2.5">
              <Avatar
                initials={order.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
                size="lg"
              />
              <div className="min-w-0">
                <p className="truncate text-[0.8125rem] font-medium">{order.name}</p>
                <p className="truncate text-[0.625rem] text-ink-3">{order.email}</p>
              </div>
            </div>
            <div className="mt-3 space-y-2 border-t border-line pt-3 text-[0.6875rem] text-ink-2">
              {order.country && (
                <p className="flex items-center gap-2">
                  <MapPin className="size-3.5 text-ink-3" /> {order.country}
                  {order.vatNumber ? ` · ${order.vatNumber}` : ""}
                </p>
              )}
              <p className="flex items-center gap-2">
                <Clock className="size-3.5 text-ink-3" />
                {customer
                  ? `Customer since ${new Date(customer.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}`
                  : "Guest checkout — no account"}
              </p>
            </div>
            {customer && (
              <Button asChild variant="outline" size="xs" className="mt-3 h-7 w-full">
                <Link to="/admin/customers">View customers</Link>
              </Button>
            )}
          </Panel>

          <Panel title="Payment" bodyClassName="p-4 text-[0.6875rem]">
            {payment ? (
              <>
                <div className="flex items-center gap-2">
                  <CreditCard className="size-3.5 text-ink-3" />
                  <span className="font-mono">{payment.reference}</span>
                </div>
                <dl className="mt-3 space-y-1.5">
                  {[
                    ["Provider", payment.provider],
                    ["Status", payment.status],
                    ["Captured", money(payment.amount, { free: false })],
                    ["Fee", money(payment.fee, { free: false })],
                    ["Net", money(payment.amount - payment.fee, { free: false })],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <dt className="text-ink-3">{k}</dt>
                      <dd className="font-mono capitalize text-ink-2">{v}</dd>
                    </div>
                  ))}
                </dl>
                <dl className="mt-2 space-y-1.5 border-t border-line pt-2">
                  {[
                    ["Mode", payment.mode],
                    ["Network", payment.network ?? "—"],
                    ["Coin", payment.payCurrency ?? "—"],
                    [
                      "Amount in coin",
                      payment.payAmount
                        ? `${Number(payment.payAmount).toFixed(/^usdt|^usdc/i.test(payment.payCurrency ?? "") ? 2 : 6)} ${(
                            payment.payCurrency ?? ""
                          ).toUpperCase()}`
                        : "—",
                    ],
                    ["Pay to", payment.payAddress ?? "—"],
                    ["Chain tx", payment.payinHash ?? "—"],
                    ["Expires", payment.expiresAt ? new Date(payment.expiresAt).toLocaleString() : "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <dt className="shrink-0 text-ink-3">{k}</dt>
                      <dd className="truncate font-mono text-ink-2" title={String(v)}>
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 border-t border-line pt-2 text-[0.625rem] leading-relaxed text-ink-3">
                  {payment.mode === "live"
                    ? "Live payment — settle only against a confirmed on-chain transaction."
                    : "Test mode — this invoice never moved real funds."}
                </p>
              </>
            ) : (
              <p className="text-ink-3">This order has no payment record.</p>
            )}
          </Panel>

          <Panel title="Actions" bodyClassName="space-y-1.5 p-4">
            <Button asChild variant="outline" size="xs" className="h-8 w-full justify-start">
              <a href={`/api/admin/export/orders`} download>
                <Download className="size-3.5" /> Export orders CSV
              </a>
            </Button>
            <Button
              variant="outline"
              size="xs"
              className="h-8 w-full justify-start"
              disabled={busy || order.status === "cancelled"}
              onClick={() => void setStatus("cancelled")}
            >
              <FileText className="size-3.5" /> Mark cancelled
            </Button>
            <Button
              variant="outline"
              size="xs"
              className="h-8 w-full justify-start text-negative"
              disabled={busy || order.status === "refunded"}
              onClick={() => void setStatus("refunded")}
            >
              <RefreshCcw className="size-3.5" />{" "}
              {order.status === "refunded" ? "Already refunded" : `Refund ${money(order.total, { free: false })}`}
            </Button>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

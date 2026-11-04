import * as React from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Download,
  Mail,
  MapPin,
  CreditCard,
  Clock,
  RefreshCcw,
  FileText,
  Truck,
} from "lucide-react";
import { PageHeader } from "./admin-layout";
import { Panel } from "./ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ProductArt } from "@/components/ui/product-art";
import { StatusBadge } from "./ui";
import { orders, productBySlug, customers } from "@/data/catalog";
import { money, cn } from "@/lib/utils";
import { toast } from "sonner";
import NotFoundPage from "@/pages/not-found";

const timeline = [
  { label: "Order placed", at: "30 Oct 2026, 09:14", done: true },
  { label: "Payment captured", at: "30 Oct 2026, 09:14", done: true },
  { label: "License issued", at: "30 Oct 2026, 09:15", done: true },
  { label: "Receipt emailed", at: "30 Oct 2026, 09:15", done: true },
  { label: "Downloaded by customer", at: "30 Oct 2026, 11:02", done: true },
];

export default function AdminOrderDetail() {
  const { id = "" } = useParams();
  const order = orders.find((o) => o.id === id) ?? orders[0];
  const customer = customers[orders.indexOf(order)] ?? customers[0];
  const subtotal = order.items.reduce((n, i) => n + i.price, 0);

  if (!order) return <NotFoundPage />;

  return (
    <div>
      <PageHeader
        title={order.id}
        subtitle={`Placed ${new Date(order.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · ${order.items.length} item${order.items.length === 1 ? "" : "s"}`}
        actions={
          <>
            <Button asChild variant="ghost" size="xs" className="h-8">
              <Link to="/admin/orders">
                <ArrowLeft className="size-3.5" /> Orders
              </Link>
            </Button>
            <Button variant="outline" size="xs" className="h-8" onClick={() => toast.success("Receipt re-sent")}>
              <Mail className="size-3.5" /> Resend receipt
            </Button>
            <Button size="xs" className="h-8" onClick={() => toast.success("Order marked fulfilled")}>
              <Check className="size-3.5" /> Mark fulfilled
            </Button>
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3">
            <StatusBadge status={order.status} />
            <span className="text-[0.6875rem] text-ink-3">
              Payment captured · {order.payment}
            </span>
            <span className="ml-auto font-mono text-[0.9375rem] font-medium">{money(order.total)}</span>
          </div>

          <Panel title="Items" bodyClassName="divide-y divide-line">
            {order.items.map((item) => {
              const p = productBySlug(item.productSlug);
              if (!p) return null;
              return (
                <div key={item.productSlug} className="flex items-center gap-3 px-4 py-3">
                  <ProductArt {...p.art} kind={p.art.kind} className="size-12 shrink-0 rounded-sm" />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/admin/products/${p.slug}`}
                      className="block truncate text-[0.8125rem] font-medium hover:text-accent-ink dark:hover:text-accent"
                    >
                      {p.name}
                    </Link>
                    <p className="text-[0.625rem] text-ink-3">
                      {item.license} license · v{p.version} · SKU KLN-{p.slug.slice(0, 4).toUpperCase()}
                    </p>
                  </div>
                  <Badge variant="neutral" size="sm">
                    Digital
                  </Badge>
                  <span className="w-16 shrink-0 text-right font-mono text-[0.75rem]">{money(item.price)}</span>
                </div>
              );
            })}
            <div className="space-y-1.5 px-4 py-3 text-[0.75rem]">
              <div className="flex justify-between text-ink-2">
                <span>Subtotal</span>
                <span className="font-mono">{money(subtotal)}</span>
              </div>
              <div className="flex justify-between text-ink-2">
                <span>Discount</span>
                <span className="font-mono">−{money(0)}</span>
              </div>
              <div className="flex justify-between text-ink-2">
                <span>VAT (7.5%)</span>
                <span className="font-mono">{money(order.total - subtotal)}</span>
              </div>
              <div className="flex justify-between border-t border-line pt-1.5 font-medium text-ink">
                <span>Total</span>
                <span className="font-mono">{money(order.total)}</span>
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
                  <p className="text-[0.625rem] text-ink-3">{t.at}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <aside className="space-y-3">
          <Panel title="Customer" bodyClassName="p-4">
            <div className="flex items-center gap-2.5">
              <Avatar initials={customer.initials} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-[0.8125rem] font-medium">{customer.name}</p>
                <p className="truncate text-[0.625rem] text-ink-3">{customer.email}</p>
              </div>
            </div>
            <div className="mt-3 space-y-2 border-t border-line pt-3 text-[0.6875rem] text-ink-2">
              <p className="flex items-center gap-2">
                <MapPin className="size-3.5 text-ink-3" /> {customer.country}
              </p>
              <p className="flex items-center gap-2">
                <FileText className="size-3.5 text-ink-3" /> {customer.orders} lifetime orders ·{" "}
                {money(customer.spent, { free: false })}
              </p>
              <p className="flex items-center gap-2">
                <Clock className="size-3.5 text-ink-3" /> Customer since {customer.joined}
              </p>
            </div>
            <Button asChild variant="outline" size="xs" className="mt-3 h-7 w-full">
              <Link to="/admin/customers">View profile</Link>
            </Button>
          </Panel>

          <Panel title="Payment" bodyClassName="p-4 text-[0.6875rem]">
            <div className="flex items-center gap-2">
              <CreditCard className="size-3.5 text-ink-3" />
              <span className="font-mono">{order.payment}</span>
            </div>
            <dl className="mt-3 space-y-1.5">
              {[
                ["Method", "Stripe"],
                ["Captured", money(order.total)],
                ["Fee", money(Math.round(order.total * 0.029 + 30))],
                ["Net", money(order.total - Math.round(order.total * 0.029 + 30))],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="font-mono text-ink-2">{v}</dd>
                </div>
              ))}
            </dl>
            <Button variant="ghost" size="xs" className="mt-2 h-7 w-full">
              View in Stripe
            </Button>
          </Panel>

          <Panel title="Actions" bodyClassName="space-y-1.5 p-4">
            <Button variant="outline" size="xs" className="h-8 w-full justify-start">
              <Download className="size-3.5" /> Reissue download links
            </Button>
            <Button variant="outline" size="xs" className="h-8 w-full justify-start">
              <Truck className="size-3.5" /> Mark as delivered
            </Button>
            <Button variant="outline" size="xs" className="h-8 w-full justify-start">
              <FileText className="size-3.5" /> Download invoice PDF
            </Button>
            <Button
              variant="outline"
              size="xs"
              className="h-8 w-full justify-start text-red-600 dark:text-red-400"
              onClick={() => toast.success("Refund initiated")}
            >
              <RefreshCcw className="size-3.5" /> Refund {money(order.total)}
            </Button>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

import * as React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DollarSign,
  ShoppingBag,
  Users,
  TrendingUp,
  ArrowUpRight,
  Download,
  Star,
  Package,
  CircleDollarSign,
} from "lucide-react";
import { PageHeader } from "./admin-layout";
import { Panel, Stat, MoneyCell, StatusBadge, MetricRow, Sparkline } from "./ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ProductArt } from "@/components/ui/product-art";
import { activity, categories, customers, orders, productBySlug, products } from "@/data/catalog";
import { compact, money } from "@/lib/utils";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/** One palette shared by every breakdown, indexed so colours stay stable. */
const PALETTE = ["#17392b", "#c0592b", "#2c4a6e", "#56682e", "#b0842f", "#6b4a7a"];

interface Analytics {
  range: string;
  series: { day: string; revenue: number; orders: number }[];
  byLicense: { name: string; revenue: number; n: number }[];
  byCategory: { name: string; revenue: number }[];
  topProducts: {
    name: string;
    slug: string;
    units: number;
    revenue: number;
    art_from: string;
    art_to: string;
    art_kind: string;
  }[];
  downloads: { total: number; unique_users: number; last_24h: number };
  customers: { total: number; new_in_range: number; active_buyers: number };
  paymentStatus: { status: string; n: number }[];
  quality: { aov: number; refundRate: number; repeatRate: number };
}

/** Recent orders as the table expects them. */
interface RecentOrder {
  id: string;
  number: string;
  createdAt: string;
  status: string;
  total: number;
  email: string | null;
  name: string | null;
}

function initialsOf(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.split("@")[0] || "?";
  return source
    .split(/[\s._-]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

const chartAxis = {
  stroke: "var(--ink-3)",
  fontSize: 10,
  fontFamily: "JetBrains Mono, monospace",
};

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm border border-line bg-surface px-2.5 py-1.5 shadow-pop">
      <p className="label-mono text-[0.5rem] text-ink-3">{label}</p>
      {payload.map((p: any) => {
        const k = String(p.dataKey);
        const label =
          k === "revenue" ? "Revenue"
          : k === "orders" ? "Orders"
          : k.charAt(0).toUpperCase() + k.slice(1);
        const value = k === "revenue" ? money(p.value, { free: false }) : p.value.toLocaleString();
        return (
          <p key={k} className="mt-0.5 flex items-center gap-2 font-mono text-[0.6875rem] text-ink">
            <span className="size-1.5 rounded-full" style={{ background: p.color ?? p.stroke ?? p.fill }} />
            <span className="text-ink-3">{label}</span> {value}
          </p>
        );
      })}
    </div>
  );
}

interface Overview {
  revenue: number;
  orders: number;
  customers: number;
  products: number;
  downloads: number;
  pendingReviews: number;
  monthly: { month: string; total: number }[];
  byCategory: { name: string; n: number }[];
  recentOrders: RecentOrder[];
  activity: {
    id: string;
    kind: string;
    action: string;
    actor: string;
    target: string;
    createdAt: string;
  }[];
}

export default function AdminDashboard() {
  const [range, setRange] = React.useState("30d");
  const [overview, setOverview] = React.useState<Overview | null>(null);
  const [analytics, setAnalytics] = React.useState<Analytics | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    api
      .get<Overview>("/admin/overview")
      .then((data) => alive && setOverview(data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Charts follow the range control; everything below is real order history.
  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .get<Analytics>(`/admin/analytics?range=${range}`)
      .then((data) => alive && setAnalytics(data))
      .catch(() => alive && setAnalytics(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [range]);

  const revenueSeries = analytics?.series ?? [];
  const categoryRevenue = (analytics?.byCategory ?? []).slice(0, 5).map((c, i) => ({
    name: c.name,
    value: c.revenue,
    color: PALETTE[i % PALETTE.length],
  }));
  const licenseRevenue = analytics?.byLicense ?? [];

  /** The KPI sparklines are the real series, thinned to ten points. */
  const sparkOf = (key: "revenue" | "orders"): number[] => {
    const all = analytics?.series ?? [];
    if (all.length <= 10) return all.map((p) => p[key]);
    const step = all.length / 10;
    return Array.from({ length: 10 }, (_, i) => all[Math.min(all.length - 1, Math.round(i * step))][key]);
  };

  const topProducts = analytics?.topProducts ?? [];
  const recentOrders = overview?.recentOrders ?? [];
  const activity = overview?.activity ?? [];
  const revenue = overview?.revenue ?? 0;
  const orderCount = overview?.orders ?? 0;
  const avgOrder = orderCount ? Math.round(revenue / orderCount) : 0;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Live figures from the store database."
        actions={
          <>
            <div className="flex items-center gap-0.5 rounded-sm border border-line bg-surface p-0.5">
              {["24h", "7d", "30d", "90d"].map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    "rounded px-2 py-1 font-mono text-[0.625rem] transition-colors",
                    range === r ? "bg-surface-2 text-ink" : "text-ink-3 hover:text-ink",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <Button
              size="xs"
              variant="outline"
              className="h-8"
              onClick={() => {
                const rows = [
                  ["day", "revenue_usd", "orders"],
                  ...revenueSeries.map((p) => [p.day, (p.revenue / 100).toFixed(2), String(p.orders)]),
                ];
                const csv = rows.map((r) => r.join(",")).join("\n");
                const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                const a = document.createElement("a");
                a.href = url;
                a.download = `kiln-revenue-${range}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="size-3" /> Export CSV
            </Button>
            <Button asChild size="xs" className="h-8">
              <Link to="/admin/products/new">New product</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Gross revenue"
          value={money(revenue, { free: false })}
          hint="all-time, paid orders"
          spark={sparkOf("revenue")}
          icon={DollarSign}
          tone="good"
        />
        <Stat
          label="Orders"
          value={orderCount.toLocaleString()}
          hint={`${money(avgOrder, { free: false })} average, all-time`}
          spark={sparkOf("orders")}
          icon={ShoppingBag}
        />
        <Stat
          label="Customers"
          value={(overview?.customers ?? 0).toLocaleString()}
          hint={`${(overview?.downloads ?? 0).toLocaleString()} downloads`}
          spark={sparkOf("orders")}
          icon={Users}
        />
        <Stat
          label="Catalogue"
          value={(overview?.products ?? products.length).toLocaleString()}
          hint={`${overview?.pendingReviews ?? 0} reviews awaiting moderation`}
          spark={sparkOf("revenue")}
          icon={TrendingUp}
          tone={overview?.pendingReviews ? "warn" : undefined}
        />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Revenue"
          description="Gross, net of refunds · USD"
          action={
            <div className="flex items-center gap-3 text-[0.625rem] text-ink-3">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-accent" /> Revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-brand" /> Orders
              </span>
            </div>
          }
          bodyClassName="p-2 pt-4"
        >
          <div className="h-[248px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="day" tick={chartAxis} axisLine={false} tickLine={false} dy={6} />
                <YAxis
                  yAxisId="rev"
                  tick={chartAxis}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                  tickFormatter={(v) => `$${v / 1000}k`}
                />
                <YAxis yAxisId="ord" orientation="right" hide />
                <ReTooltip content={<ChartTip />} cursor={{ stroke: "var(--line-strong)" }} />
                <Area
                  yAxisId="rev"
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--accent)"
                  strokeWidth={1.8}
                  fill="url(#rev)"
                  dot={false}
                  activeDot={{ r: 3.5, strokeWidth: 2, stroke: "var(--surface)" }}
                />
                <Area
                  yAxisId="ord"
                  type="monotone"
                  dataKey="orders"
                  stroke="var(--brand)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  fill="none"
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 2, stroke: "var(--surface)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Revenue by category" description="Top five shelves" bodyClassName="p-4">
          <div className="flex items-center gap-3">
            <div className="relative h-[132px] w-[132px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryRevenue}
                    dataKey="value"
                    innerRadius={44}
                    outerRadius={64}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {categoryRevenue.map((c) => (
                      <Cell key={c.name} fill={c.color} />
                    ))}
                  </Pie>
                  <ReTooltip content={<ChartTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <p className="font-display text-[1.1rem] leading-none">
                    {money(
                      categoryRevenue.reduce((n, x) => n + x.value, 0),
                      { free: false },
                    )}
                  </p>
                  <p className="label-mono mt-1 text-[0.4375rem] text-ink-3">total</p>
                </div>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              {categoryRevenue.map((c) => (
                <MetricRow
                  key={c.name}
                  label={c.name}
                  value={c.value}
                  total={categoryRevenue.reduce((n, x) => n + x.value, 0)}
                  tone="sage"
                />
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3">
            {[
              { l: `AOV ${range}`, v: money(analytics?.quality.aov ?? 0, { free: false }) },
              { l: "Refund rate", v: `${((analytics?.quality.refundRate ?? 0) * 100).toFixed(1)}%` },
              { l: "Repeat", v: `${((analytics?.quality.repeatRate ?? 0) * 100).toFixed(0)}%` },
            ].map((s) => (
              <div key={s.l}>
                <p className="label-mono text-[0.4375rem] text-ink-3">{s.l}</p>
                <p className="mt-0.5 font-mono text-[0.8125rem]">{s.v}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_1.15fr]">
        <Panel
          title="Revenue by licence"
          description={`${range} · ticket size where the money is`}
          action={
            <div className="flex items-center gap-3 text-[0.625rem] text-ink-3">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-[1px] bg-brand" /> Revenue
              </span>
            </div>
          }
          bodyClassName="p-2 pt-4"
        >
          {licenseRevenue.length === 0 ? (
            <div className="grid h-[200px] place-items-center px-6 text-center text-[0.75rem] text-ink-3">
              {loading ? "Loading…" : "No paid orders in this range yet."}
            </div>
          ) : (
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={licenseRevenue} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="name" tick={chartAxis} axisLine={false} tickLine={false} dy={4} />
                  <YAxis
                    tick={chartAxis}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    tickFormatter={(v) => `$${Math.round(v / 100)}`}
                  />
                  <ReTooltip content={<ChartTip />} cursor={{ fill: "var(--surface-2)" }} />
                  <Bar dataKey="revenue" fill="var(--brand)" radius={[2, 2, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel
          title="Top sellers"
          description="By units sold, all time"
          action={
            <Button asChild variant="ghost" size="xs" className="h-7">
              <Link to="/admin/products">
                All products <ArrowUpRight className="size-3" />
              </Link>
            </Button>
          }
          bodyClassName=""
        >
          <ul className="divide-y divide-line">
            {topProducts.map((p, i) => (
              <li key={p.slug} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-4 shrink-0 font-mono text-[0.625rem] text-ink-3">{i + 1}</span>
                <ProductArt
                  from={p.art_from}
                  to={p.art_to}
                  ink="#eef4e9"
                  kind={p.art_kind as never}
                  className="size-9 shrink-0 rounded-[5px]"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/admin/products/${p.slug}`}
                    className="block truncate text-[0.75rem] font-medium hover:text-accent-ink dark:hover:text-accent"
                  >
                    {p.name}
                  </Link>
                  <p className="truncate text-[0.5625rem] text-ink-3">
                    {p.units} {p.units === 1 ? "licence" : "licences"} sold
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-[0.6875rem]">{compact(p.units)}</p>
                  <p className="text-[0.5625rem] text-ink-3">{money(p.revenue, { free: false })}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Recent orders"
          description="Latest transactions"
          action={
            <Button asChild variant="ghost" size="xs" className="h-7">
              <Link to="/admin/orders">
                All orders <ArrowUpRight className="size-3" />
              </Link>
            </Button>
          }
          bodyClassName=""
        >
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line bg-surface-2/50">
                {["Order", "Customer", "Status", "Total"].map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      "label-mono px-4 py-1.5 text-[0.4375rem] text-ink-3",
                      i === 3 && "text-right",
                      i === 2 && "hidden sm:table-cell",
                      i === 1 && "hidden md:table-cell",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => {
                return (
                  <tr key={o.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2/40">
                    <td className="px-4 py-2.5">
                      <Link to={`/admin/orders/${o.number}`} className="font-mono text-[0.6875rem] hover:text-accent-ink dark:hover:text-accent">
                        {o.number}
                      </Link>
                      <p className="text-[0.5625rem] text-ink-3">
                        {new Date(o.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </p>
                    </td>
                    <td className="hidden px-4 py-2.5 md:table-cell">
                      <div className="flex items-center gap-2">
                        <Avatar initials={initialsOf(o.name, o.email)} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-[0.6875rem]">{o.name ?? "Guest"}</p>
                          <p className="truncate text-[0.5625rem] text-ink-3">{o.email ?? "no account"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-2.5 sm:table-cell">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <MoneyCell cents={o.total} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <Panel
          title="Activity"
          description="Store events"
          action={
            <Button asChild variant="ghost" size="xs" className="h-7">
              <Link to="/admin/activity">Log</Link>
            </Button>
          }
          bodyClassName="divide-y divide-line"
        >
          {activity.slice(0, 6).map((a) => (
            <div key={a.id} className="flex gap-2.5 px-4 py-2.5">
              <span
                className={cn(
                  "mt-1 size-1.5 shrink-0 rounded-full",
                  a.kind === "product"
                    ? "bg-accent"
                    : a.kind === "order"
                      ? "bg-emerald-500"
                      : a.kind === "promo"
                        ? "bg-[#b0842f]"
                        : "bg-ink-3",
                )}
              />
              <div className="min-w-0">
                <p className="text-[0.6875rem] leading-snug text-ink-2">
                  <span className="font-medium text-ink">{a.actor}</span> {a.action}{" "}
                  <span className="text-ink-3">{a.target}</span>
                </p>
                <p className="text-[0.5625rem] text-ink-3">
                  {new Date(a.createdAt).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            l: "Downloads",
            v: (analytics?.downloads.total ?? 0).toLocaleString(),
            icon: Download,
            spark: sparkOf("orders"),
          },
          {
            l: "Unique downloaders",
            v: (analytics?.downloads.unique_users ?? 0).toLocaleString(),
            icon: Users,
            spark: sparkOf("orders"),
          },
          { l: "Active products", v: (overview?.products ?? 0).toLocaleString(), icon: Package, spark: sparkOf("revenue") },
          {
            l: "Paid buyers",
            v: (analytics?.customers.active_buyers ?? 0).toLocaleString(),
            icon: CircleDollarSign,
            spark: sparkOf("revenue"),
          },
        ].map((s) => (
          <motion.div
            key={s.l}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3"
          >
            <span className="grid size-8 place-items-center rounded-full bg-surface-2">
              <s.icon className="size-3.5 text-ink-2" />
            </span>
            <div>
              <p className="label-mono text-[0.4375rem] text-ink-3">{s.l}</p>
              <p className="font-mono text-[0.875rem]">{s.v}</p>
            </div>
            <Sparkline data={s.spark.length ? s.spark : [0, 0]} tone="good" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

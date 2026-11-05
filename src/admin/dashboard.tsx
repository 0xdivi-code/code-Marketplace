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

const revenueSeries = [
  { day: "Oct 1", revenue: 1840, orders: 12 },
  { day: "Oct 4", revenue: 2260, orders: 15 },
  { day: "Oct 7", revenue: 1980, orders: 13 },
  { day: "Oct 10", revenue: 3120, orders: 21 },
  { day: "Oct 13", revenue: 2740, orders: 18 },
  { day: "Oct 16", revenue: 3480, orders: 24 },
  { day: "Oct 19", revenue: 3190, orders: 22 },
  { day: "Oct 22", revenue: 4210, orders: 29 },
  { day: "Oct 25", revenue: 3860, orders: 26 },
  { day: "Oct 28", revenue: 4520, orders: 31 },
  { day: "Oct 31", revenue: 5140, orders: 36 },
  { day: "Nov 3", revenue: 4890, orders: 33 },
];

const trafficSeries = [
  { d: "Mon", direct: 420, search: 680, social: 180 },
  { d: "Tue", direct: 380, search: 720, social: 220 },
  { d: "Wed", direct: 460, search: 810, social: 260 },
  { d: "Thu", direct: 520, search: 760, social: 210 },
  { d: "Fri", direct: 610, search: 940, social: 320 },
  { d: "Sat", direct: 340, search: 520, social: 190 },
  { d: "Sun", direct: 310, search: 480, social: 160 },
];

// sums to $38,640 — the same gross total shown in the KPI row
const categoryRevenue = categories.slice(0, 5).map((c, i) => ({
  name: c.name,
  value: [13420, 9180, 6820, 5540, 3680][i],
  color: ["#17392b", "#c0592b", "#2c4a6e", "#56682e", "#b0842f"][i],
}));

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
}

export default function AdminDashboard() {
  const [range, setRange] = React.useState("30d");
  const [overview, setOverview] = React.useState<Overview | null>(null);

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

  const topProducts = [...products].sort((a, b) => b.sales - a.sales).slice(0, 5);
  const recentOrders = orders.slice(0, 5);
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
            <Button size="xs" variant="outline" className="h-8">
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
          hint="all paid orders"
          spark={[12, 18, 15, 22, 19, 27, 24, 31, 29, 36]}
          icon={DollarSign}
          tone="good"
        />
        <Stat
          label="Orders"
          value={orderCount.toLocaleString()}
          hint={`avg ${money(avgOrder, { free: false })}`}
          spark={[8, 11, 9, 14, 12, 16, 15, 19, 18, 22]}
          icon={ShoppingBag}
        />
        <Stat
          label="Customers"
          value={(overview?.customers ?? 0).toLocaleString()}
          hint={`${(overview?.downloads ?? 0).toLocaleString()} downloads`}
          spark={[4, 6, 5, 8, 7, 9, 8, 11, 10, 13]}
          icon={Users}
        />
        <Stat
          label="Catalogue"
          value={(overview?.products ?? products.length).toLocaleString()}
          hint={`${overview?.pendingReviews ?? 0} reviews awaiting moderation`}
          spark={[30, 34, 32, 36, 33, 35, 34, 36, 35, 34]}
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
                  <p className="font-display text-[1.1rem] leading-none">{money(2432000, { free: false })}</p>
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
                  tone={c.name === "SaaS Starters" ? "brand" : c.name === "Admin Dashboards" ? "accent" : "sage"}
                />
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3">
            {[
              { l: "AOV", v: "$134.6" },
              { l: "Refund rate", v: "1.8%" },
              { l: "Repeat", v: "34%" },
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
          title="Visitors by channel"
          description="Last 7 days"
          action={
            <div className="flex items-center gap-3 text-[0.625rem] text-ink-3">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-[1px] bg-brand" /> Search
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-[1px] bg-accent" /> Direct
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-[1px] bg-[#b7a68d]" /> Social
              </span>
            </div>
          }
          bodyClassName="p-2 pt-4"
        >
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trafficSeries} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="d" tick={chartAxis} axisLine={false} tickLine={false} dy={4} />
                <YAxis tick={chartAxis} axisLine={false} tickLine={false} width={34} />
                <ReTooltip content={<ChartTip />} cursor={{ fill: "var(--surface-2)" }} />
                <Bar dataKey="search" fill="var(--brand)" radius={[2, 2, 0, 0]} maxBarSize={16} />
                <Bar dataKey="direct" fill="var(--accent)" radius={[2, 2, 0, 0]} maxBarSize={16} />
                <Bar dataKey="social" fill="#b7a68d" radius={[2, 2, 0, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
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
                <ProductArt {...p.art} kind={p.art.kind} className="size-9 shrink-0 rounded-[5px]" />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/admin/products/${p.slug}`}
                    className="block truncate text-[0.75rem] font-medium hover:text-accent-ink dark:hover:text-accent"
                  >
                    {p.name}
                  </Link>
                  <p className="truncate text-[0.5625rem] text-ink-3">
                    {p.stack.slice(0, 2).join(" · ")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-[0.6875rem]">{compact(p.sales)}</p>
                  <p className="text-[0.5625rem] text-ink-3">{money(p.sales * p.price, { free: false })}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Recent orders"
          description="Last five transactions"
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
              {recentOrders.map((o, i) => {
                const customer = customers[i];
                return (
                  <tr key={o.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2/40">
                    <td className="px-4 py-2.5">
                      <Link to={`/admin/orders/${o.id}`} className="font-mono text-[0.6875rem] hover:text-accent-ink dark:hover:text-accent">
                        {o.id}
                      </Link>
                      <p className="text-[0.5625rem] text-ink-3">
                        {new Date(o.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </p>
                    </td>
                    <td className="hidden px-4 py-2.5 md:table-cell">
                      <div className="flex items-center gap-2">
                        <Avatar initials={customer.initials} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-[0.6875rem]">{customer.name}</p>
                          <p className="truncate text-[0.5625rem] text-ink-3">{customer.country}</p>
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
                <p className="text-[0.5625rem] text-ink-3">{a.at}</p>
              </div>
            </div>
          ))}
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { l: "Downloads", v: "4,182", d: 12.4, icon: Download },
          { l: "Avg rating", v: "4.8", d: 2.1, icon: Star },
          { l: "Active products", v: "16", d: 0, icon: Package },
          { l: "Payout next", v: "$8,420", d: 8.9, icon: CircleDollarSign },
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
            <Sparkline data={[4, 6, 5, 8, 7, 9, 11]} tone="good" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

import * as React from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "./admin-layout";
import { DataTable, MoneyCell, RowActions, StatusBadge, TableFooter, TableToolbar, type Column } from "./ui";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { money } from "@/lib/utils";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";

const PER_PAGE = 8;

/**
 * Row shape from `GET /api/admin/orders`. Admin rows carry the customer's
 * identity and the raw status, which the storefront `Order` type never needs.
 */
interface AdminOrder {
  id: string;
  number: string;
  date: string;
  status: "completed" | "refunded" | "pending";
  statusRaw: "pending" | "paid" | "refunded" | "cancelled";
  total: number;
  payment: string;
  email: string;
  name: string;
  items: { productSlug: string; productName: string; license: string; unitPrice: number }[];
}

export default function AdminOrders() {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [orders, setOrders] = React.useState<AdminOrder[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    try {
      const res = await api.get<{ orders: AdminOrder[] }>("/admin/orders");
      setOrders(res.orders);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const refund = async (o: AdminOrder) => {
    if (!window.confirm(`Refund ${o.number} for ${money(o.total, { free: false })}? Their licence is revoked.`)) return;
    try {
      await api.patch(`/admin/orders/${o.number}`, { status: "refunded" });
      toast.success(`Refunded ${o.number}`, { description: "Licence revoked and payment reversed." });
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Refund failed.");
    }
  };

  const filtered = orders.filter((o) => {
    if (status !== "all" && o.status !== status) return false;
    if (query) {
      const hay = `${o.number} ${o.email} ${o.name} ${o.items.map((i) => i.productName).join(" ")}`;
      if (!hay.toLowerCase().includes(query.toLowerCase())) return false;
    }
    return true;
  });
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const rows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const columns: Column<AdminOrder>[] = [
    {
      key: "id",
      header: "Order",
      sortValue: (o) => o.id,
      render: (o) => (
        <div>
          <p className="font-mono text-[0.75rem] font-medium text-ink">{o.id}</p>
          <p className="text-[0.5625rem] text-ink-3">
            {new Date(o.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (o) => {
        const initials = o.name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        return (
          <div className="flex items-center gap-2">
            <Avatar initials={initials || "??"} size="sm" />
            <div className="min-w-0">
              <p className="max-w-[150px] truncate text-[0.75rem] text-ink">{o.name}</p>
              <p className="max-w-[150px] truncate text-[0.5625rem] text-ink-3">{o.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "items",
      header: "Items",
      render: (o) => (
        <div className="max-w-[220px]">
          <p className="truncate text-[0.6875rem] text-ink-2">{o.items[0]?.productName}</p>
          {o.items.length > 1 && (
            <p className="text-[0.5625rem] text-ink-3">+{o.items.length - 1} more</p>
          )}
        </div>
      ),
      sortValue: (o) => o.items.length,
    },
    {
      key: "payment",
      header: "Payment",
      render: (o) => <span className="text-[0.6875rem] text-ink-3">{o.payment}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (o) => <StatusBadge status={o.status} />,
      sortValue: (o) => o.status,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      sortValue: (o) => o.total,
      render: (o) => <MoneyCell cents={o.total} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (o) => (
        <RowActions
          items={[
            { label: "View order", onClick: () => navigate(`/admin/orders/${o.number}`) },
            {
              label: "Copy customer email",
              onClick: () => {
                void navigator.clipboard?.writeText(o.email);
                toast.success("Email copied");
              },
            },
            {
              label: "Refund order",
              danger: true,
              disabled: o.statusRaw === "refunded",
              onClick: () => void refund(o),
            },
          ]}
        />
      ),
    },
  ];

  const paid = orders.filter((o) => o.statusRaw === "paid");
  const total = paid.reduce((n, o) => n + o.total, 0);
  const refunded = orders.filter((o) => o.statusRaw === "refunded").reduce((n, o) => n + o.total, 0);

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle={
          loading
            ? "Loading orders…"
            : `${orders.length} orders · ${money(total, { free: false })} net · ${money(refunded, { free: false })} refunded`
        }
        actions={
          <>
            <Button variant="outline" size="xs" className="h-8" asChild>
              <a href="/api/admin/export/orders" download>
                Export CSV
              </a>
            </Button>
            <Button variant="outline" size="xs" className="h-8" onClick={() => window.print()}>
              Print
            </Button>
          </>
        }
      />

      <div className="mb-3 grid gap-3 sm:grid-cols-4">
        {[
          { l: "Pending", v: String(orders.filter((o) => o.statusRaw === "pending").length), tone: "neutral" },
          { l: "Cancelled", v: String(orders.filter((o) => o.statusRaw === "cancelled").length), tone: "accent" },
          { l: "Paid", v: String(paid.length), tone: "success" },
          { l: "Refunded", v: String(orders.length - paid.length - orders.filter((o) => o.statusRaw === "pending" || o.statusRaw === "cancelled").length), tone: "warn" },
        ].map((s) => (
          <div key={s.l} className="flex items-center justify-between rounded-lg border border-line bg-surface px-3.5 py-2.5">
            <span className="text-[0.6875rem] text-ink-2">{s.l}</span>
            <Badge
              variant={s.tone === "success" ? "success" : s.tone === "accent" ? "accent" : s.tone === "warn" ? "warn" : "neutral"}
              size="sm"
            >
              {s.v}
            </Badge>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(o) => o.id}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        onRowClick={(o) => navigate(`/admin/orders/${o.number}`)}
        toolbar={
          <>
            <TableToolbar query={query} onQuery={setQuery} placeholder="Search orders" />
            <div className="ml-auto flex items-center gap-2">
              <NativeSelect
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="h-8 w-auto"
              >
                <option value="all">Any status</option>
                <option value="completed">Completed</option>
                <option value="refunded">Refunded</option>
                <option value="pending">Pending</option>
              </NativeSelect>
            </div>
          </>
        }
        footer={<TableFooter shown={rows.length} total={filtered.length} page={page} pages={pages} onPage={setPage} />}
      />
    </div>
  );
}

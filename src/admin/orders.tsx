import * as React from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "./admin-layout";
import { DataTable, MoneyCell, RowActions, StatusBadge, TableFooter, TableToolbar, type Column } from "./ui";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { customers, orders, productBySlug } from "@/data/catalog";
import type { Order } from "@/data/types";
import { money } from "@/lib/utils";
import { toast } from "sonner";

const PER_PAGE = 6;

export default function AdminOrders() {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<string[]>([]);

  const filtered = orders.filter((o) => {
    if (status !== "all" && o.status !== status) return false;
    if (query) {
      const hay = `${o.id} ${o.payment} ${o.items.map((i) => productBySlug(i.productSlug)?.name).join(" ")}`;
      if (!hay.toLowerCase().includes(query.toLowerCase())) return false;
    }
    return true;
  });
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const rows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const columns: Column<Order>[] = [
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
        const c = customers[orders.indexOf(o)] ?? customers[0];  // empty until the API hydrates
        return (
          <div className="flex items-center gap-2">
            <Avatar initials={c.initials} size="sm" />
            <div className="min-w-0">
              <p className="max-w-[150px] truncate text-[0.75rem] text-ink">{c.name}</p>
              <p className="max-w-[150px] truncate text-[0.5625rem] text-ink-3">{c.email}</p>
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
          <p className="truncate text-[0.6875rem] text-ink-2">
            {productBySlug(o.items[0].productSlug)?.name}
          </p>
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
            { label: "View order", onClick: () => navigate(`/admin/orders/${o.id}`) },
            { label: "Resend receipt", onClick: () => toast.success("Receipt re-sent") },
            { label: "Mark fulfilled", onClick: () => toast.success("Marked fulfilled") },
            { label: "Refund order", danger: true, onClick: () => toast.success("Refund initiated") },
          ]}
        />
      ),
    },
  ];

  const total = orders.reduce((n, o) => n + o.total, 0);
  const refunded = orders.filter((o) => o.status === "refunded").reduce((n, o) => n + o.total, 0);

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle={`${orders.length} orders · ${money(total, { free: false })} gross · ${money(refunded, { free: false })} refunded`}
        actions={
          <>
            <Button variant="outline" size="xs" className="h-8">
              Export CSV
            </Button>
            <Button variant="outline" size="xs" className="h-8">
              Print packing slips
            </Button>
          </>
        }
      />

      <div className="mb-3 grid gap-3 sm:grid-cols-4">
        {[
          { l: "Awaiting payment", v: "0", tone: "neutral" },
          { l: "To deliver", v: "2", tone: "accent" },
          { l: "Completed", v: "4", tone: "success" },
          { l: "Refund requests", v: "1", tone: "warn" },
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
        onRowClick={(o) => navigate(`/admin/orders/${o.id}`)}
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

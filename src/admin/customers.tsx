import * as React from "react";
import { PageHeader } from "./admin-layout";
import { DataTable, MoneyCell, RowActions, StatusBadge, TableFooter, TableToolbar, type Column } from "./ui";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { NativeSelect } from "@/components/ui/field";
import { Panel } from "./ui";
import { customers } from "@/data/catalog";
import type { Customer } from "@/data/types";
import { money, compact } from "@/lib/utils";
import { toast } from "sonner";
import { UserPlus, Download } from "lucide-react";

const PER_PAGE = 8;

export default function AdminCustomers() {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [page, setPage] = React.useState(1);

  const filtered = customers.filter((c) => {
    if (status !== "all" && c.status !== status) return false;
    if (query && !`${c.name} ${c.email} ${c.country}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const rows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const columns: Column<Customer>[] = [
    {
      key: "name",
      header: "Customer",
      sortValue: (c) => c.name,
      render: (c) => (
        <div className="flex items-center gap-2.5">
          <Avatar initials={c.initials} size="md" />
          <div className="min-w-0">
            <p className="truncate text-[0.8125rem] font-medium text-ink">{c.name}</p>
            <p className="max-w-[180px] truncate text-[0.5625rem] text-ink-3">{c.email}</p>
          </div>
        </div>
      ),
    },
    { key: "country", header: "Country", render: (c) => <span className="text-[0.6875rem] text-ink-3">{c.country}</span> },
    {
      key: "orders",
      header: "Orders",
      align: "right",
      sortValue: (c) => c.orders,
      render: (c) => <span className="font-mono text-[0.75rem]">{c.orders}</span>,
    },
    {
      key: "spent",
      header: "Lifetime value",
      align: "right",
      sortValue: (c) => c.spent,
      render: (c) => <MoneyCell cents={c.spent} muted={c.spent === 0} />,
    },
    {
      key: "joined",
      header: "Joined",
      sortValue: (c) => c.joined,
      render: (c) => (
        <span className="text-[0.6875rem] text-ink-3">
          {new Date(c.joined).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      ),
    },
    { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} />, sortValue: (c) => c.status },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (c) => (
        <RowActions
          items={[
            { label: "View profile", onClick: () => toast.success(`Opening ${c.name}`) },
            { label: "Email customer", onClick: () => toast.success("Email composer opened") },
            { label: "Resend invite", onClick: () => toast.success("Invite sent") },
            { label: "Block account", danger: true, onClick: () => toast.success("Account blocked") },
          ]}
        />
      ),
    },
  ];

  const totalSpent = customers.reduce((n, c) => n + c.spent, 0);

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} accounts · ${compact(totalSpent)} lifetime revenue`}
        actions={
          <>
            <Button variant="outline" size="xs" className="h-8">
              <Download className="size-3.5" /> Export
            </Button>
            <Button size="xs" className="h-8" onClick={() => toast.success("Invitation sent")}>
              <UserPlus className="size-3.5" /> Invite customer
            </Button>
          </>
        }
      />

      <div className="mb-3 grid gap-3 lg:grid-cols-[1fr_300px]">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { l: "New this month", v: "11", s: "+24% vs Sep" },
            { l: "Repeat buyers", v: "34%", s: "8 of 14 accounts" },
            { l: "Avg lifetime value", v: money(Math.round(totalSpent / customers.length), { free: false }), s: "across all accounts" },
          ].map((s) => (
            <div key={s.l} className="rounded-lg border border-line bg-surface px-4 py-3">
              <p className="label-mono text-[0.4375rem] text-ink-3">{s.l}</p>
              <p className="mt-1 font-display text-[1.3rem] leading-none">{s.v}</p>
              <p className="mt-1 text-[0.5625rem] text-ink-3">{s.s}</p>
            </div>
          ))}
        </div>
        <Panel title="Top customers" bodyClassName="divide-y divide-line">
          {[...customers].sort((a, b) => b.spent - a.spent).slice(0, 3).map((c) => (
            <div key={c.id} className="flex items-center gap-2 px-3 py-1.5">
              <Avatar initials={c.initials} size="sm" />
              <span className="min-w-0 flex-1 truncate text-[0.6875rem]">{c.name}</span>
              <span className="font-mono text-[0.625rem] text-ink-3">{money(c.spent, { free: false })}</span>
            </div>
          ))}
        </Panel>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(c) => c.id}
        toolbar={
          <>
            <TableToolbar query={query} onQuery={setQuery} placeholder="Search name or email" />
            <div className="ml-auto">
              <NativeSelect
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="h-8 w-auto"
              >
                <option value="all">Any status</option>
                <option value="active">Active</option>
                <option value="invited">Invited</option>
                <option value="blocked">Blocked</option>
              </NativeSelect>
            </div>
          </>
        }
        footer={<TableFooter shown={rows.length} total={filtered.length} page={page} pages={pages} onPage={setPage} />}
      />
    </div>
  );
}

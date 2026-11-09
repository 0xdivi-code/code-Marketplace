import * as React from "react";
import { ChevronDown, ChevronUp, MoreHorizontal, Search, Download, Filter } from "lucide-react";
import { cn, compact, money, pct } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

/* ------------------------------------------------------------------ stat card */
export function Stat({
  label,
  value,
  delta,
  hint,
  spark,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  delta?: number;
  hint?: string;
  spark?: number[];
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "good" | "warn";
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="surface-card rounded-lg p-4">
      <div className="flex items-start justify-between">
        <span className="label-mono text-[0.5rem] text-ink-3">{label}</span>
        {Icon && <Icon className="size-3.5 text-ink-3" />}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-[1.65rem] leading-none tracking-[-0.02em]">{value}</p>
          <div className="mt-1.5 flex items-center gap-1.5 text-[0.625rem]">
            {delta !== undefined && (
              <span
                className={cn(
                  "flex items-center gap-0.5 font-medium",
                  up ? "text-positive" : "text-negative",
                )}
              >
                {up ? <ChevronUp className="size-2.5" /> : <ChevronDown className="size-2.5" />}
                {pct(delta)}
              </span>
            )}
            {hint && <span className="text-ink-3">{hint}</span>}
          </div>
        </div>
        {spark && <Sparkline data={spark} tone={tone} />}
      </div>
    </div>
  );
}

export function Sparkline({
  data,
  tone = "neutral",
}: {
  data: number[];
  tone?: "neutral" | "good" | "warn";
}) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const color =
    tone === "good" ? "var(--chart-1)" : tone === "warn" ? "var(--chart-4)" : "var(--chart-2)";
  return (
    <svg viewBox="0 0 80 28" className="h-7 w-20 shrink-0" aria-hidden>
      <polyline
        points={data
          .map((d, i) => {
            const x = (i / (data.length - 1)) * 78 + 1;
            const y = 26 - ((d - min) / Math.max(1, max - min)) * 22;
            return `${x},${y}`;
          })
          .join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ panel */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  footer,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  footer?: React.ReactNode;
}) {
  return (
    <section className={cn("surface-card rounded-lg", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            {title && <h2 className="text-[0.875rem] font-medium">{title}</h2>}
            {description && <p className="mt-0.5 text-[0.6875rem] text-ink-3">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
      {footer && <div className="border-t border-line px-4 py-2.5">{footer}</div>}
    </section>
  );
}

/* ------------------------------------------------------------------ data table */
export interface Column<T> {
  key: string;
  header: string;
  className?: string;
  align?: "left" | "right" | "center";
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  selectable,
  selected,
  onSelectedChange,
  onRowClick,
  toolbar,
  empty,
  footer,
  dense,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  selectable?: boolean;
  selected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  onRowClick?: (row: T) => void;
  toolbar?: React.ReactNode;
  empty?: React.ReactNode;
  footer?: React.ReactNode;
  dense?: boolean;
}) {
  const [sort, setSort] = React.useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  const allSelected = selectable && rows.length > 0 && selected?.length === rows.length;

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      {toolbar && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">{toolbar}</div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-surface-2/60">
              {selectable && (
                <th className="w-9 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={!!allSelected}
                    onChange={(e) =>
                      onSelectedChange?.(e.target.checked ? rows.map(rowKey) : [])
                    }
                    className="size-3.5 accent-[var(--brand)]"
                    aria-label="Select all"
                  />
                </th>
              )}
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "label-mono whitespace-nowrap px-3 py-2 text-[0.5rem] text-ink-3",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                    c.className,
                  )}
                >
                  {c.sortValue ? (
                    <button
                      onClick={() =>
                        setSort((s) =>
                          s?.key === c.key
                            ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" }
                            : { key: c.key, dir: "desc" },
                        )
                      }
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      {c.header}
                      {sort?.key === c.key ? (
                        sort.dir === "asc" ? (
                          <ChevronUp className="size-2.5" />
                        ) : (
                          <ChevronDown className="size-2.5" />
                        )
                      ) : null}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-16 text-center">
                  {empty ?? <span className="text-[0.8125rem] text-ink-3">Nothing here yet.</span>}
                </td>
              </tr>
            )}
            {sorted.map((row) => {
              const key = rowKey(row);
              const isSel = selected?.includes(key);
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "border-b border-line/70 last:border-b-0 transition-colors",
                    onRowClick && "cursor-pointer",
                    isSel ? "bg-brand-soft/50" : "hover:bg-surface-2/50",
                  )}
                >
                  {selectable && (
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={!!isSel}
                        onChange={(e) =>
                          onSelectedChange?.(
                            e.target.checked
                              ? [...(selected ?? []), key]
                              : (selected ?? []).filter((s) => s !== key),
                          )
                        }
                        className="size-3.5 accent-[var(--brand)]"
                        aria-label={`Select row`}
                      />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        dense ? "px-3 py-2" : "px-3 py-3",
                        "text-[0.8125rem] text-ink-2 align-middle",
                        c.align === "right" && "text-right",
                        c.align === "center" && "text-center",
                        c.className,
                      )}
                    >
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {footer && <div className="border-t border-line px-3 py-2">{footer}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ toolbar bits */
export function TableToolbar({
  query,
  onQuery,
  placeholder,
  children,
}: {
  query?: string;
  onQuery?: (v: string) => void;
  placeholder?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      {onQuery && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={placeholder ?? "Search"}
            className="h-8 w-48 rounded-sm border border-line bg-surface pl-7 pr-2 text-[0.75rem] placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
        </div>
      )}
      {children}
    </div>
  );
}

export function TableFooter({
  shown,
  total,
  page,
  pages,
  onPage,
  note,
}: {
  shown: number;
  total: number;
  page: number;
  pages: number;
  onPage: (p: number) => void;
  /** Spoken when the table is a window onto a larger set. */
  note?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-[0.6875rem] text-ink-3">
      <span>
        Showing <strong className="font-medium text-ink-2">{shown}</strong> of {total}
        {note && <span className="ml-2 text-ink-3">· {note}</span>}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="rounded border border-line px-2 py-1 transition-colors hover:bg-surface-2 disabled:opacity-40"
        >
          Prev
        </button>
        <span className="px-1.5 font-mono">
          {page}/{pages}
        </span>
        <button
          onClick={() => onPage(Math.min(pages, page + 1))}
          disabled={page === pages}
          className="rounded border border-line px-2 py-1 transition-colors hover:bg-surface-2 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function RowActions({
  items,
}: {
  items: { label: string; onClick?: () => void; danger?: boolean; disabled?: boolean }[];
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="grid size-7 place-items-center rounded text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label="Row actions"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          onClick={(e) => e.stopPropagation()}
          className="z-50 w-44 rounded-md border border-line bg-surface p-1 shadow-pop"
        >
          {items.map((i) => (
            <DropdownMenu.Item
              key={i.label}
              onSelect={i.onClick}
              disabled={i.disabled}
              className={cn(
                "cursor-pointer rounded-sm px-2 py-1.5 text-[0.75rem] outline-none hover:bg-surface-2",
                i.danger ? "text-negative" : "text-ink-2 hover:text-ink",
                i.disabled && "pointer-events-none opacity-40",
              )}
            >
              {i.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function ExportButton({ label = "Export" }: { label?: string }) {
  return (
    <Button variant="outline" size="xs" className="h-8">
      <Download className="size-3" /> {label}
    </Button>
  );
}

export function FilterButton({ children }: { children?: React.ReactNode }) {
  return (
    <Button variant="outline" size="xs" className="h-8">
      <Filter className="size-3" /> {children ?? "Filter"}
    </Button>
  );
}

/* ------------------------------------------------------------------ misc */
export function MoneyCell({ cents, muted }: { cents: number; muted?: boolean }) {
  return (
    <span className={cn("font-mono text-[0.8125rem]", muted ? "text-ink-3" : "font-medium text-ink")}>
      {money(cents)}
    </span>
  );
}

export function DeltaCell({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span
      className={cn(
        "font-mono text-[0.6875rem]",
        up ? "text-positive" : "text-negative",
      )}
    >
      {pct(value)}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: "success" | "warn" | "danger" | "neutral" | "accent" | "sage"; label: string }> = {
    published: { variant: "success", label: "Published" },
    draft: { variant: "neutral", label: "Draft" },
    review: { variant: "warn", label: "In review" },
    archived: { variant: "neutral", label: "Archived" },
    completed: { variant: "success", label: "Completed" },
    refunded: { variant: "warn", label: "Refunded" },
    pending: { variant: "neutral", label: "Pending" },
    paid: { variant: "success", label: "Paid" },
    cancelled: { variant: "neutral", label: "Cancelled" },
    revoked: { variant: "danger", label: "Revoked" },
    active: { variant: "success", label: "Active" },
    invited: { variant: "accent", label: "Invited" },
    suspended: { variant: "danger", label: "Suspended" },
    blocked: { variant: "danger", label: "Blocked" },
    scheduled: { variant: "accent", label: "Scheduled" },
    expired: { variant: "neutral", label: "Expired" },
  };
  const cfg = map[status] ?? { variant: "neutral" as const, label: status };
  return (
    <Badge variant={cfg.variant} size="sm">
      {cfg.label}
    </Badge>
  );
}

export function MetricRow({
  label,
  value,
  total,
  tone = "brand",
}: {
  label: string;
  value: number;
  total: number;
  tone?: "brand" | "accent" | "sage" | "gold";
}) {
  const colors = {
    brand: "bg-chart-2",
    accent: "bg-chart-1",
    sage: "bg-chart-3",
    gold: "bg-chart-4",
  } as const;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[0.75rem]">
        <span className="text-ink-2">{label}</span>
        <span className="font-mono text-[0.6875rem] text-ink-3">{compact(value)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn("h-full rounded-full", colors[tone])}
          style={{ width: `${Math.min(100, (value / Math.max(1, total)) * 100)}%` }}
        />
      </div>
    </div>
  );
}

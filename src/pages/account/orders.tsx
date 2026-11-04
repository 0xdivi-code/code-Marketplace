import * as React from "react";
import { Link } from "react-router-dom";
import { Download, Receipt, RotateCcw, FileText, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/field";
import { orders, productBySlug } from "@/data/catalog";
import { money } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

const statusTone = {
  completed: "success",
  refunded: "warn",
  pending: "neutral",
} as const;

export default function OrdersPage() {
  const [filter, setFilter] = React.useState("all");
  const [open, setOpen] = React.useState<string | null>(orders[0]?.id ?? null);

  const list = orders.filter((o) => (filter === "all" ? true : o.status === filter));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[1.35rem]">Orders & invoices</h2>
          <p className="mt-0.5 text-[0.8125rem] text-ink-2">
            {orders.length} orders · {money(orders.reduce((n, o) => n + o.total, 0))} lifetime
          </p>
        </div>
        <NativeSelect value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 w-auto">
          <option value="all">All orders</option>
          <option value="completed">Completed</option>
          <option value="refunded">Refunded</option>
        </NativeSelect>
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong py-16 text-center">
          <Receipt className="mx-auto size-5 text-ink-3" />
          <p className="mt-2 font-display text-lg">No orders in this view</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {list.map((o) => {
            const expanded = open === o.id;
            return (
              <div key={o.id} className="surface-card overflow-hidden rounded-lg">
                <button
                  onClick={() => setOpen(expanded ? null : o.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[0.8125rem] font-medium">{o.id}</span>
                      <Badge variant={statusTone[o.status]} size="sm" className="capitalize">
                        {o.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[0.6875rem] text-ink-3">
                      {new Date(o.date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}{" "}
                      · {o.items.length} item{o.items.length === 1 ? "" : "s"} · {o.payment}
                    </p>
                  </div>
                  <span className="font-mono text-[0.875rem] font-medium">{money(o.total)}</span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-ink-3 transition-transform",
                      expanded && "rotate-180",
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden border-t border-line"
                    >
                      <ul className="divide-y divide-line">
                        {o.items.map((it) => {
                          const p = productBySlug(it.productSlug);
                          if (!p) return null;
                          return (
                            <li key={it.productSlug} className="flex items-center gap-3 px-4 py-3">
                              <div className="min-w-0 flex-1">
                                <Link
                                  to={`/item/${p.slug}`}
                                  className="block truncate text-[0.8125rem] font-medium hover:text-accent-ink dark:hover:text-accent"
                                >
                                  {p.name}
                                </Link>
                                <p className="text-[0.625rem] text-ink-3">
                                  {it.license} license · v{p.version}
                                </p>
                              </div>
                              <span className="font-mono text-[0.75rem] text-ink-2">{money(it.price)}</span>
                              {o.status === "completed" && (
                                <Button size="sm" variant="soft">
                                  <Download className="size-3.5" />
                                </Button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/50 px-4 py-2.5">
                        <Button size="sm" variant="outline">
                          <FileText className="size-3.5" /> Invoice PDF
                        </Button>
                        {o.status === "completed" ? (
                          <Button size="sm" variant="ghost">
                            <RotateCcw className="size-3.5" /> Request refund
                          </Button>
                        ) : (
                          <span className="text-[0.6875rem] text-ink-3">
                            Refunded {money(o.total)} on{" "}
                            {new Date(o.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </span>
                        )}
                        <Link
                          to={`/order/${o.id}`}
                          className="ml-auto text-[0.6875rem] text-ink-3 hover:text-ink"
                        >
                          Order details
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

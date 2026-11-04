import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Star, MoreHorizontal } from "lucide-react";
import { PageHeader } from "./admin-layout";
import { DataTable, RowActions, StatusBadge, TableFooter, TableToolbar, type Column } from "./ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/field";
import { ProductArt } from "@/components/ui/product-art";
import { products, categoryBySlug, authorBySlug } from "@/data/catalog";
import type { Product } from "@/data/types";
import { compact, money, cn } from "@/lib/utils";
import { toast } from "sonner";

const PER_PAGE = 8;

export default function AdminProducts() {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [category, setCategory] = React.useState("all");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [page, setPage] = React.useState(1);

  const filtered = products.filter((p) => {
    if (query && !`${p.name} ${p.stack.join(" ")}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (status !== "all" && p.status !== status) return false;
    if (category !== "all" && p.category !== category) return false;
    return true;
  });

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const rows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const columns: Column<Product>[] = [
    {
      key: "product",
      header: "Product",
      sortValue: (p) => p.name,
      render: (p) => (
        <div className="flex items-center gap-2.5">
          <ProductArt {...p.art} kind={p.art.kind} className="size-9 shrink-0 rounded-[5px]" />
          <div className="min-w-0">
            <Link
              to={`/admin/products/${p.slug}`}
              className="block max-w-[240px] truncate text-[0.8125rem] font-medium text-ink hover:text-accent-ink dark:hover:text-accent"
            >
              {p.name}
            </Link>
            <p className="max-w-[240px] truncate text-[0.5625rem] text-ink-3">
              {p.stack.slice(0, 3).join(" · ")}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (p) => (
        <span className="text-[0.6875rem] text-ink-2">{categoryBySlug(p.category)?.name}</span>
      ),
      sortValue: (p) => categoryBySlug(p.category)?.name ?? "",
    },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusBadge status={p.status} />,
      sortValue: (p) => p.status,
    },
    {
      key: "price",
      header: "Price",
      align: "right",
      sortValue: (p) => p.price,
      render: (p) => (
        <span className={cn("font-mono text-[0.75rem]", p.free && "text-[#56682e] dark:text-[#a3b46b]")}>
          {money(p.price)}
        </span>
      ),
    },
    {
      key: "sales",
      header: "Sales",
      align: "right",
      sortValue: (p) => p.sales,
      render: (p) => (
        <div className="text-right">
          <p className="font-mono text-[0.75rem]">{compact(p.sales)}</p>
          <p className="text-[0.5625rem] text-ink-3">{money(p.sales * p.price, { free: false })}</p>
        </div>
      ),
    },
    {
      key: "rating",
      header: "Rating",
      align: "right",
      sortValue: (p) => p.rating,
      render: (p) => (
        <span className="inline-flex items-center gap-1 font-mono text-[0.6875rem]">
          <Star className="size-2.5 fill-gold text-gold" />
          {p.rating.toFixed(1)}
          <span className="text-ink-3">({p.reviews})</span>
        </span>
      ),
    },
    {
      key: "version",
      header: "Version",
      align: "right",
      render: (p) => (
        <div className="text-right">
          <p className="font-mono text-[0.6875rem]">v{p.version}</p>
          <p className="text-[0.5625rem] text-ink-3">
            {new Date(p.updated).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </p>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (p) => (
        <RowActions
          items={[
            { label: "Edit product", onClick: () => navigate(`/admin/products/${p.slug}`) },
            { label: "View in store", onClick: () => navigate(`/item/${p.slug}`) },
            {
              label: p.status === "published" ? "Unpublish" : "Publish",
              onClick: () => toast.success(`${p.name} ${p.status === "published" ? "unpublished" : "published"}`),
            },
            { label: "Duplicate", onClick: () => toast.success("Draft copy created") },
            { label: "Archive", danger: true, onClick: () => toast.success("Product archived") },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={`${products.length} items · ${products.filter((p) => p.status === "published").length} published`}
        actions={
          <>
            <Button variant="outline" size="xs" className="h-8">
              <MoreHorizontal className="size-3.5" /> Bulk edit
            </Button>
            <Button asChild size="xs" className="h-8">
              <Link to="/admin/products/new">
                <Plus className="size-3.5" /> New product
              </Link>
            </Button>
          </>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(p) => p.slug}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        onRowClick={(p) => navigate(`/admin/products/${p.slug}`)}
        toolbar={
          <>
            <TableToolbar query={query} onQuery={setQuery} placeholder="Search products" />
            <div className="ml-auto flex items-center gap-2">
              {selected.length > 0 && (
                <Badge variant="brand" size="sm">
                  {selected.length} selected
                </Badge>
              )}
              <NativeSelect
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
                className="h-8 w-auto"
              >
                <option value="all">All categories</option>
                {[...new Set(products.map((p) => p.category))].map((c) => (
                  <option key={c} value={c}>
                    {categoryBySlug(c)?.name}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="h-8 w-auto"
              >
                <option value="all">Any status</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="review">In review</option>
                <option value="archived">Archived</option>
              </NativeSelect>
            </div>
          </>
        }
        footer={
          <TableFooter
            shown={rows.length}
            total={filtered.length}
            page={page}
            pages={pages}
            onPage={setPage}
          />
        }
        empty={
          <div className="text-center">
            <p className="text-[0.8125rem] font-medium">No products match</p>
            <p className="mt-1 text-[0.6875rem] text-ink-3">Adjust the filters or add a new item.</p>
          </div>
        }
      />

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {[
          { l: "Avg price", v: money(Math.round(products.reduce((n, p) => n + p.price, 0) / products.length)) },
          { l: "Free items", v: String(products.filter((p) => p.free).length) },
          { l: "Needs review", v: String(products.filter((p) => p.status !== "published").length) },
        ].map((s) => (
          <div key={s.l} className="rounded-lg border border-line bg-surface px-4 py-3">
            <p className="label-mono text-[0.4375rem] text-ink-3">{s.l}</p>
            <p className="mt-0.5 font-mono text-[0.9375rem]">{s.v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

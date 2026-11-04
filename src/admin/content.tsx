import * as React from "react";
import { Plus, FileText, Globe, BookOpen, PenLine, Eye, MoreHorizontal } from "lucide-react";
import { PageHeader } from "./admin-layout";
import { Panel, DataTable, StatusBadge, RowActions, type Column } from "./ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { posts } from "@/data/catalog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/disclosure";

type Row = {
  id: string;
  title: string;
  type: "post" | "page" | "faq";
  status: "published" | "draft" | "review";
  author: string;
  updated: string;
  views: number;
};

const pages: Row[] = [
  { id: "p1", title: "About the studio", type: "page", status: "published", author: "Kiln Studio", updated: "2026-10-02", views: 8420 },
  { id: "p2", title: "License terms", type: "page", status: "published", author: "Kiln Studio", updated: "2026-10-01", views: 12400 },
  { id: "p3", title: "Terms of service", type: "page", status: "published", author: "Kiln Studio", updated: "2026-10-01", views: 6100 },
  { id: "p4", title: "Privacy policy", type: "page", status: "published", author: "Kiln Studio", updated: "2026-10-01", views: 4980 },
  { id: "p5", title: "Refund policy", type: "page", status: "published", author: "Kiln Studio", updated: "2026-10-01", views: 5120 },
  { id: "p6", title: "Support policy", type: "page", status: "draft", author: "Kiln Studio", updated: "2026-10-28", views: 0 },
  { id: "p7", title: "Frequently asked questions", type: "faq", status: "published", author: "Kiln Studio", updated: "2026-10-21", views: 9840 },
];

const postRows: Row[] = posts.map((p, i) => ({
  id: p.slug,
  title: p.title,
  type: "post",
  status: i === 2 ? "review" : "published",
  author: "Kiln Studio",
  updated: p.date,
  views: 4200 - i * 720,
}));

const all = [...postRows, ...pages];

export default function AdminContent() {
  const columns: Column<Row>[] = [
    {
      key: "title",
      header: "Title",
      sortValue: (r) => r.title,
      render: (r) => (
        <div className="flex items-center gap-2">
          {r.type === "post" ? (
            <BookOpen className="size-3.5 shrink-0 text-ink-3" />
          ) : r.type === "faq" ? (
            <FileText className="size-3.5 shrink-0 text-ink-3" />
          ) : (
            <Globe className="size-3.5 shrink-0 text-ink-3" />
          )}
          <span className="max-w-[280px] truncate text-[0.8125rem] font-medium text-ink">{r.title}</span>
        </div>
      ),
    },
    { key: "type", header: "Type", render: (r) => <Badge variant="neutral" size="sm" className="capitalize">{r.type}</Badge> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} />, sortValue: (r) => r.status },
    { key: "author", header: "Author", render: (r) => <span className="text-[0.6875rem] text-ink-3">{r.author}</span> },
    {
      key: "views",
      header: "Views",
      align: "right",
      sortValue: (r) => r.views,
      render: (r) => <span className="font-mono text-[0.6875rem]">{r.views.toLocaleString()}</span>,
    },
    {
      key: "updated",
      header: "Updated",
      align: "right",
      sortValue: (r) => r.updated,
      render: (r) => (
        <span className="text-[0.6875rem] text-ink-3">
          {new Date(r.updated).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <RowActions
          items={[
            { label: "Edit", onClick: () => toast.success(`Editing “${r.title}”`) },
            { label: "Preview", onClick: () => toast.success("Preview opened") },
            { label: "Publish", onClick: () => toast.success("Published") },
            { label: "Delete", danger: true, onClick: () => toast.success("Deleted") },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Content"
        subtitle="Journal posts, static pages and help content"
        actions={
          <Button size="xs" className="h-8" onClick={() => toast.success("New draft created")}>
            <Plus className="size-3.5" /> New entry
          </Button>
        }
      />

      <div className="mb-3 grid gap-3 sm:grid-cols-4">
        {[
          { l: "Published", v: String(all.filter((r) => r.status === "published").length), i: Globe },
          { l: "Drafts", v: String(all.filter((r) => r.status === "draft").length), i: PenLine },
          { l: "In review", v: String(all.filter((r) => r.status === "review").length), i: Eye },
          { l: "Total views", v: all.reduce((n, r) => n + r.views, 0).toLocaleString(), i: FileText },
        ].map((s) => (
          <div key={s.l} className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2.5">
            <s.i className="size-3.5 text-ink-3" />
            <div>
              <p className="label-mono text-[0.4375rem] text-ink-3">{s.l}</p>
              <p className="font-mono text-[0.8125rem]">{s.v}</p>
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="all">
        <TabsList className="w-fit">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="post">Journal</TabsTrigger>
          <TabsTrigger value="page">Pages</TabsTrigger>
          <TabsTrigger value="faq">Help</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-3">
          <DataTable columns={columns} rows={all} rowKey={(r) => r.id} />
        </TabsContent>
        {(["post", "page", "faq"] as const).map((t) => (
          <TabsContent key={t} value={t} className="mt-3">
            <DataTable columns={columns} rows={all.filter((r) => r.type === t)} rowKey={(r) => r.id} />
          </TabsContent>
        ))}
      </Tabs>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
        <Panel title="Journal pipeline" description="What’s next" bodyClassName="divide-y divide-line">
          {[
            { t: "Pricing a bundle without devaluing the parts", s: "Draft · 60% written" },
            { t: "Our four-tier deprecation ladder, revisited", s: "Outline · assigned" },
            { t: "What we removed from Forge 4", s: "Published · 11 Sep" },
          ].map((p) => (
            <div key={p.t} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-[0.75rem]">{p.t}</p>
                <p className="text-[0.5625rem] text-ink-3">{p.s}</p>
              </div>
              <Button variant="ghost" size="xs" className="h-6">
                <MoreHorizontal className="size-3" />
              </Button>
            </div>
          ))}
        </Panel>

        <Panel title="SEO health" bodyClassName="p-4 space-y-2.5">
          {[
            { l: "Meta descriptions", v: 100, ok: true },
            { l: "Titles under 60 chars", v: 88, ok: true },
            { l: "Internal links", v: 72, ok: true },
            { l: "Alt text coverage", v: 64, ok: false },
          ].map((s) => (
            <div key={s.l}>
              <div className="flex justify-between text-[0.6875rem]">
                <span className="text-ink-2">{s.l}</span>
                <span className={cn("font-mono", s.ok ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
                  {s.v}%
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={cn("h-full rounded-full", s.ok ? "bg-brand" : "bg-amber-500")}
                  style={{ width: `${s.v}%` }}
                />
              </div>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

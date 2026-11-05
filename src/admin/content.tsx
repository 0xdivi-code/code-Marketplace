import * as React from "react";
import { Plus, FileText, Globe, BookOpen, PenLine, Eye } from "lucide-react";
import { PageHeader } from "./admin-layout";
import { Panel, DataTable, StatusBadge, RowActions, type Column } from "./ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/disclosure";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";

/** Row shape from `GET /api/admin/pages` — the CMS table behind every policy page. */
interface PageRow {
  id: string;
  slug: string;
  title: string;
  kind: string;
  body: string;
  excerpt: string;
  category: string;
  status: "published" | "draft";
  position: number;
  updatedAt: string;
}

type Row = {
  id: string;
  slug: string;
  title: string;
  type: "page" | "faq";
  status: "published" | "draft";
  excerpt: string;
  words: number;
  updated: string;
};

export default function AdminContent() {
  const [pages, setPages] = React.useState<PageRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PageRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState({ title: "", slug: "", body: "", excerpt: "" });

  const load = React.useCallback(async () => {
    try {
      const res = await api.get<{ pages: PageRow[] }>("/admin/pages");
      setPages(res.pages);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load content.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const all: Row[] = pages.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    type: p.kind === "help" ? "faq" : "page",
    status: p.status,
    excerpt: p.excerpt,
    words: p.body.trim() ? p.body.trim().split(/\s+/).length : 0,
    updated: p.updatedAt,
  }));

  function startCreate() {
    setEditing(null);
    setForm({ title: "", slug: "", body: "", excerpt: "" });
    setOpen(true);
  }

  function startEdit(slug: string) {
    const page = pages.find((p) => p.slug === slug);
    if (!page) return;
    setEditing(page);
    setForm({ title: page.title, slug: page.slug, body: page.body, excerpt: page.excerpt });
    setOpen(true);
  }

  async function save() {
    if (form.title.trim().length < 2) return toast.error("Give the page a title.");
    setCreating(true);
    try {
      if (editing) {
        await api.patch(`/admin/pages/${editing.slug}`, {
          title: form.title.trim(),
          body: form.body,
          excerpt: form.excerpt,
        });
        toast.success(`“${form.title}” saved`, { description: "The storefront renders it on next load." });
      } else {
        await api.post("/admin/pages", {
          title: form.title.trim(),
          slug: form.slug.trim() || undefined,
          body: form.body,
        });
        toast.success(`“${form.title}” created as a draft`);
      }
      setOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save that page.");
    } finally {
      setCreating(false);
    }
  }

  async function setStatus(row: Row, status: "published" | "draft") {
    try {
      await api.patch(`/admin/pages/${row.slug}`, { status });
      toast.success(status === "published" ? `“${row.title}” is live` : `“${row.title}” unpublished`);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That change did not stick.");
    }
  }

  const columns: Column<Row>[] = [
    {
      key: "title",
      header: "Title",
      sortValue: (r) => r.title,
      render: (r) => (
        <div className="flex items-center gap-2">
          {r.type === "faq" ? (
            <FileText className="size-3.5 shrink-0 text-ink-3" />
          ) : (
            <Globe className="size-3.5 shrink-0 text-ink-3" />
          )}
          <div className="min-w-0">
            <span className="block max-w-[280px] truncate text-[0.8125rem] font-medium text-ink">{r.title}</span>
            <span className="block max-w-[280px] truncate font-mono text-[0.5625rem] text-ink-3">/{r.slug}</span>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (r) => (
        <Badge variant="neutral" size="sm" className="capitalize">
          {r.type === "faq" ? "help" : r.type}
        </Badge>
      ),
    },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} />, sortValue: (r) => r.status },
    {
      key: "words",
      header: "Length",
      align: "right",
      sortValue: (r) => r.words,
      render: (r) => <span className="font-mono text-[0.6875rem]">{r.words.toLocaleString()} words</span>,
    },
    {
      key: "updated",
      header: "Updated",
      align: "right",
      sortValue: (r) => r.updated,
      render: (r) => (
        <span className="text-[0.6875rem] text-ink-3">
          {new Date(r.updated).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
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
            { label: "Edit", onClick: () => startEdit(r.slug) },
            {
              label: r.status === "published" ? "Unpublish" : "Publish",
              onClick: () => void setStatus(r, r.status === "published" ? "draft" : "published"),
            },
            {
              label: "Copy public link",
              onClick: () => {
                void navigator.clipboard?.writeText(`${window.location.origin}/page/${r.slug}`);
                toast.success("Link copied");
              },
            },
          ]}
        />
      ),
    },
  ];

  const published = all.filter((r) => r.status === "published").length;
  const drafts = all.filter((r) => r.status === "draft").length;

  return (
    <div>
      <PageHeader
        title="Content"
        subtitle={loading ? "Loading content…" : "Policy pages and help content, served from the database"}
        actions={
          <Button size="xs" className="h-8" onClick={startCreate}>
            <Plus className="size-3.5" /> New page
          </Button>
        }
      />

      <div className="mb-3 grid gap-3 sm:grid-cols-4">
        {[
          { l: "Published", v: String(published), i: Globe },
          { l: "Drafts", v: String(drafts), i: PenLine },
          { l: "Live pages", v: String(all.filter((r) => r.type === "page").length), i: FileText },
          { l: "Total words", v: all.reduce((n, r) => n + r.words, 0).toLocaleString(), i: BookOpen },
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
          <TabsTrigger value="page">Pages</TabsTrigger>
          <TabsTrigger value="faq">Help</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-3">
          <DataTable columns={columns} rows={all} rowKey={(r) => r.id} onRowClick={(r) => startEdit(r.slug)} />
        </TabsContent>
        {(["page", "faq"] as const).map((t) => (
          <TabsContent key={t} value={t} className="mt-3">
            <DataTable
              columns={columns}
              rows={all.filter((r) => r.type === t)}
              rowKey={(r) => r.id}
              onRowClick={(r) => startEdit(r.slug)}
            />
          </TabsContent>
        ))}
      </Tabs>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel title="Drafts waiting" description="Not visible on the storefront" bodyClassName="divide-y divide-line">
          {all.filter((r) => r.status === "draft").length === 0 ? (
            <p className="px-4 py-3 text-[0.6875rem] text-ink-3">Nothing in draft.</p>
          ) : (
            all
              .filter((r) => r.status === "draft")
              .map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[0.75rem]">{r.title}</p>
                    <p className="font-mono text-[0.5625rem] text-ink-3">/{r.slug}</p>
                  </div>
                  <Button variant="ghost" size="xs" className="h-6" onClick={() => void setStatus(r, "published")}>
                    <Eye className="size-3" /> Publish
                  </Button>
                </div>
              ))
          )}
        </Panel>

        <Panel title="Longest pages" description="By word count" bodyClassName="p-4 space-y-2.5">
          {[...all]
            .sort((a, b) => b.words - a.words)
            .slice(0, 4)
            .map((r) => {
              const max = Math.max(1, ...all.map((x) => x.words));
              return (
                <div key={r.id}>
                  <div className="flex justify-between text-[0.6875rem]">
                    <span className="truncate text-ink-2">{r.title}</span>
                    <span className="ml-2 shrink-0 font-mono text-ink-3">{r.words}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${(r.words / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
        </Panel>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit “${editing.title}”` : "New page"}</DialogTitle>
            <DialogDescription>
              Markdown body. Drafts stay off the storefront until you publish them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-6 pb-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title" htmlFor="ptitle">
                <Input
                  id="ptitle"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Refund policy"
                />
              </Field>
              <Field label="Slug" htmlFor="pslug" hint={editing ? "Locked once published" : "Generated from the title"}>
                <Input
                  id="pslug"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  readOnly={Boolean(editing)}
                  placeholder="refund-policy"
                  className="font-mono text-[0.8125rem]"
                />
              </Field>
            </div>
            <Field label="Excerpt" htmlFor="pex">
              <Input
                id="pex"
                value={form.excerpt}
                onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                placeholder="One line the listing shows"
              />
            </Field>
            <Field label="Body (markdown)" htmlFor="pbody">
              <Textarea
                id="pbody"
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                className="min-h-48 font-mono text-[0.75rem]"
                placeholder="## Section heading&#10;&#10;Paragraph text…"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={creating} onClick={() => void save()}>
              {creating ? "Saving…" : editing ? "Save changes" : "Create draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

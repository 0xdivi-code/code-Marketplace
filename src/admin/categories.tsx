import * as React from "react";
import { Plus, GripVertical, Pencil, Trash2, Package } from "lucide-react";
import { PageHeader } from "./admin-layout";
import { Panel } from "./ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Textarea, Switch } from "@/components/ui/field";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { categories, products } from "@/data/catalog";
import { money } from "@/lib/utils";
import { toast } from "sonner";

export default function AdminCategories() {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<string | null>(null);
  const cat = categories.find((c) => c.slug === editing);

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Shelves shown in navigation, the mega menu and the homepage grid"
        actions={
          <Button size="xs" className="h-8" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="size-3.5" /> New category
          </Button>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="All categories" description="Drag to reorder" bodyClassName="divide-y divide-line">
          {categories.map((c, i) => {
            const items = products.filter((p) => p.category === c.slug);
            const revenue = items.reduce((n, p) => n + p.sales * p.price, 0);
            return (
              <div key={c.slug} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/40">
                <GripVertical className="size-3.5 shrink-0 cursor-grab text-ink-3" />
                <span
                  className="size-8 shrink-0 rounded-[6px]"
                  style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-medium">{c.name}</p>
                  <p className="truncate text-[0.5625rem] text-ink-3">{c.blurb}</p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="font-mono text-[0.6875rem]">{items.length} items</p>
                  <p className="text-[0.5625rem] text-ink-3">{money(revenue, { free: false })}</p>
                </div>
                <Badge variant={i === 0 ? "brand" : "neutral"} size="sm" className="hidden sm:inline-flex">
                  #{i + 1}
                </Badge>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    onClick={() => { setEditing(c.slug); setOpen(true); }}
                    className="grid size-7 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink"
                    aria-label={`Edit ${c.name}`}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => toast.success("Category deleted")}
                    className="grid size-7 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-red-600"
                    aria-label={`Delete ${c.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </Panel>

        <div className="space-y-3">
          <Panel title="Distribution" description="Items per category" bodyClassName="space-y-2.5 p-4">
            {categories.map((c) => {
              const count = products.filter((p) => p.category === c.slug).length;
              return (
                <div key={c.slug} className="flex items-center gap-2">
                  <span className="w-28 shrink-0 truncate text-[0.6875rem] text-ink-2">{c.name}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(count / products.length) * 100}%`,
                        background: `linear-gradient(90deg, ${c.from}, ${c.to})`,
                      }}
                    />
                  </div>
                  <span className="w-4 shrink-0 text-right font-mono text-[0.5625rem] text-ink-3">{count}</span>
                </div>
              );
            })}
          </Panel>

          <Panel title="Navigation preview" bodyClassName="p-4">
            <div className="rounded-md border border-line bg-surface-2/40 p-3">
              <p className="label-mono mb-2 text-[0.5rem] text-ink-3">Mega menu</p>
              <div className="grid grid-cols-2 gap-1.5">
                {categories.slice(0, 6).map((c) => (
                  <div key={c.slug} className="flex items-center gap-1.5">
                    <span className="size-4 rounded" style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }} />
                    <span className="truncate text-[0.625rem]">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="Uncategorised" description="Items without a shelf" bodyClassName="p-4">
            <div className="flex items-center gap-2 text-[0.75rem] text-ink-2">
              <Package className="size-3.5 text-ink-3" />
              No uncategorised products
            </div>
          </Panel>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{cat ? "Edit category" : "New category"}</DialogTitle>
            <DialogDescription>
              Categories appear in the mega menu, homepage grid and footer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-6 pb-2">
            <Field label="Name" htmlFor="cname">
              <Input id="cname" defaultValue={cat?.name} placeholder="UI Kits" />
            </Field>
            <Field label="Slug" htmlFor="cslug">
              <Input id="cslug" defaultValue={cat?.slug} className="font-mono text-[0.8125rem]" />
            </Field>
            <Field label="Blurb" htmlFor="cblurb">
              <Textarea id="cblurb" defaultValue={cat?.blurb} className="min-h-16" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Gradient start" htmlFor="cfrom">
                <div className="flex gap-2">
                  <input id="cfrom" type="color" defaultValue={cat?.from ?? "#17392b"} className="h-11 w-12 rounded-sm border border-line" />
                  <Input defaultValue={cat?.from ?? "#17392b"} className="font-mono" />
                </div>
              </Field>
              <Field label="Gradient end" htmlFor="cto">
                <div className="flex gap-2">
                  <input id="cto" type="color" defaultValue={cat?.to ?? "#4d8a68"} className="h-11 w-12 rounded-sm border border-line" />
                  <Input defaultValue={cat?.to ?? "#4d8a68"} className="font-mono" />
                </div>
              </Field>
            </div>
            <div className="flex items-center justify-between rounded-sm border border-line px-3 py-2.5">
              <span className="text-[0.75rem]">Show in main navigation</span>
              <Switch defaultChecked />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => { setOpen(false); toast.success(cat ? "Category updated" : "Category created"); }}>
              {cat ? "Save changes" : "Create category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import * as React from "react";
import { Plus, GripVertical, Pencil, Trash2, Package, ImagePlus, ImageOff, Loader2, Upload } from "lucide-react";
import { PageHeader } from "./admin-layout";
import { Panel } from "./ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { CATEGORY_GLYPHS, categoryIcon, CategoryGlyph } from "@/lib/category-icons";

interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  blurb: string;
  from: string;
  to: string;
  glyph: string;
  position: number;
  products: number;
  /** uploaded thumbnail URL, or a bundled /img/... path; null = gradient only */
  imagePath?: string | null;
}

export default function AdminCategories() {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [categories, setCategories] = React.useState<AdminCategory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const thumbInput = React.useRef<HTMLInputElement>(null);
  const [form, setForm] = React.useState({
    name: "",
    slug: "",
    blurb: "",
    from: "#171717",
    to: "#4a453c",
    glyph: "layers",
    imagePath: null as string | null,
  });
  const cat = categories.find((c) => c.slug === editing);

  const load = React.useCallback(async () => {
    try {
      const res = await api.get<{ categories: AdminCategory[] }>("/admin/categories");
      setCategories(res.categories);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load categories.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Fill the dialog whenever it opens, so editing and creating never share stale values.
  React.useEffect(() => {
    if (!open) return;
    setForm({
      name: cat?.name ?? "",
      slug: cat?.slug ?? "",
      blurb: cat?.blurb ?? "",
      from: cat?.from ?? "#171717",
      to: cat?.to ?? "#4a453c",
      glyph: cat?.glyph ?? "layers",
      imagePath: cat?.imagePath ?? null,
    });
  }, [open, cat?.slug]);

  /**
   * Upload the thumbnail.
   *
   * An existing category has a slug, so the image is attached straight away and
   * the PATCH that follows keeps it. A new category does not exist yet, so the
   * file goes to the draft slot (`/categories/uploads/image`) and the returned
   * URL is sent with the create request — otherwise the picture would have to be
   * uploaded twice, or the owner would have to save, reopen and upload.
   */
  async function uploadThumb(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("That is not an image.");
    if (file.size > 8 * 1024 * 1024) return toast.error("Images are capped at 8 MB.");

    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file, file.name);
      const target = cat ? `/admin/categories/${cat.slug}/image` : "/admin/categories/uploads/image";
      const res = await api.form<{ imagePath: string }>(target, body);
      setForm((f) => ({ ...f, imagePath: res.imagePath }));
      toast.success("Thumbnail ready", {
        description: cat ? "Saved to this category." : "It will be attached when you create the category.",
      });
      // An existing category is already saved; refresh the list so the row shows it.
      if (cat) await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function clearThumb() {
    if (!form.imagePath) return;
    // Nothing to delete server-side for a draft — the URL travels with the create.
    if (!cat) {
      setForm((f) => ({ ...f, imagePath: null }));
      return;
    }
    setUploading(true);
    try {
      await api.del(`/admin/categories/${cat.slug}/image`);
      setForm((f) => ({ ...f, imagePath: null }));
      toast.success("Thumbnail removed", { description: "The gradient shows instead." });
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not remove that image.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (form.name.trim().length < 2) return toast.error("Give the category a name.");
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        blurb: form.blurb.trim(),
        from: form.from,
        to: form.to,
        glyph: form.glyph,
        ...(form.imagePath ? { imagePath: form.imagePath } : {}),
      };
      if (cat) {
        await api.patch(`/admin/categories/${cat.slug}`, body);
        toast.success(`${form.name} updated`);
      } else {
        await api.post("/admin/categories", body);
        toast.success(`${form.name} created`, { description: "It appears in the menu immediately." });
      }
      setOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save that category.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: AdminCategory) {
    if (c.products > 0) {
      return toast.error(`${c.name} still holds ${c.products} product${c.products === 1 ? "" : "s"}.`, {
        description: "Move them to another shelf first.",
      });
    }
    if (!window.confirm(`Delete ${c.name}?`)) return;
    try {
      await api.del(`/admin/categories/${c.slug}`);
      toast.success(`${c.name} deleted`);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete that category.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle={
          loading ? "Loading categories…" : "Shelves shown in navigation, the mega menu and the homepage grid"
        }
        actions={
          <Button size="xs" className="h-8" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="size-3.5" /> New category
          </Button>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="All categories" description="Drag to reorder" bodyClassName="divide-y divide-line">
          {categories.map((c, i) => {
            const items = Array.from({ length: c.products });
            return (
              <div key={c.slug} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/40">
                <GripVertical className="size-3.5 shrink-0 cursor-grab text-ink-3" />
                <span
                  className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-[6px] border border-line bg-surface-2 text-ink-2"
                  style={c.imagePath ? undefined : { background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
                >
                  {c.imagePath ? (
                    <img src={c.imagePath} alt="" className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <CategoryGlyph glyph={c.glyph} className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-medium">{c.name}</p>
                  <p className="truncate text-[0.5625rem] text-ink-3">
                    {c.imagePath ? "Custom thumbnail · " : "Gradient tile · "}
                    {c.blurb}
                  </p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="font-mono text-[0.6875rem]">{items.length} items</p>
                  <p className="text-[0.5625rem] text-ink-3">position {c.position + 1}</p>
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
                    onClick={() => void remove(c)}
                    className="grid size-7 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-negative"
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
              const count = c.products;
              return (
                <div key={c.slug} className="flex items-center gap-2">
                  <span className="w-28 shrink-0 truncate text-[0.6875rem] text-ink-2">{c.name}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(count / Math.max(1, categories.reduce((n, x) => n + x.products, 0))) * 100}%`,
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
                    <span className="grid size-4 shrink-0 place-items-center rounded bg-surface text-ink-2">
                      <CategoryGlyph glyph={c.glyph} className="size-2.5" />
                    </span>
                    <span className="truncate text-[0.625rem]">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="Uncategorised" description="Items without a shelf" bodyClassName="p-4">
            <div className="flex items-center gap-2 text-[0.75rem] text-ink-2">
              <Package className="size-3.5 text-ink-3" />
              {categories.reduce((n, c) => n + c.products, 0)} categorised · every product has a shelf
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
              <Input
                id="cname"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="UI Kits"
              />
            </Field>
            <Field label="Slug" htmlFor="cslug" hint={cat ? "Changing this breaks old links" : "Generated from the name if left blank"}>
              <Input
                id="cslug"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="ui-kits"
                className="font-mono text-[0.8125rem]"
              />
            </Field>
            <Field label="Blurb" htmlFor="cblurb">
              <Textarea
                id="cblurb"
                value={form.blurb}
                onChange={(e) => setForm((f) => ({ ...f, blurb: e.target.value }))}
                className="min-h-16"
              />
            </Field>
            {/* Thumbnail: the picture the storefront tile shows, at its real 3:4
                ratio, so what the owner picks is what the homepage renders. */}
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="text-[0.75rem] font-medium">Thumbnail</p>
                <p className="text-[0.625rem] text-ink-3">Shown on the homepage tile · 3:4</p>
              </div>
              <div className="flex gap-3">
                <div className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-md border border-line bg-surface-sunken">
                  <div
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(135deg, ${form.from}, ${form.to})` }}
                  />
                  {form.imagePath && (
                    <img src={form.imagePath} alt="" className="absolute inset-0 size-full object-cover" />
                  )}
                  {uploading && (
                    <span className="absolute inset-0 grid place-items-center bg-black/45 text-white">
                      <Loader2 className="size-4 animate-spin" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    ref={thumbInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/avif"
                    className="hidden"
                    onChange={(e) => {
                      void uploadThumb(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      onClick={() => thumbInput.current?.click()}
                    >
                      {form.imagePath ? <ImagePlus className="size-3.5" /> : <Upload className="size-3.5" />}
                      {form.imagePath ? "Replace image" : "Upload image"}
                    </Button>
                    {form.imagePath && (
                      <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={() => void clearThumb()}>
                        <ImageOff className="size-3.5" /> Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-[0.6875rem] leading-snug text-ink-3">
                    PNG, JPG, WEBP or AVIF up to 8 MB. Without an image the tile uses the gradient below.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Gradient start" htmlFor="cfrom">
                <div className="flex gap-2">
                  <input
                    id="cfrom"
                    type="color"
                    value={form.from}
                    onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
                    className="h-11 w-12 rounded-sm border border-line"
                  />
                  <Input
                    value={form.from}
                    onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
                    className="font-mono"
                  />
                </div>
              </Field>
              <Field label="Gradient end" htmlFor="cto">
                <div className="flex gap-2">
                  <input
                    id="cto"
                    type="color"
                    value={form.to}
                    onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
                    className="h-11 w-12 rounded-sm border border-line"
                  />
                  <Input
                    value={form.to}
                    onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
                    className="font-mono"
                  />
                </div>
              </Field>
            </div>

            <div>
              <p className="mb-2 text-[0.75rem] font-medium">Menu icon</p>
              <div
                role="radiogroup"
                aria-label="Menu icon"
                className="grid max-h-40 grid-cols-8 gap-1.5 overflow-y-auto rounded-md border border-line p-2"
              >
                {CATEGORY_GLYPHS.map((name) => {
                  const Icon = categoryIcon(name);
                  const active = form.glyph === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={name}
                      title={name}
                      onClick={() => setForm((f) => ({ ...f, glyph: name }))}
                      className={
                        active
                          ? "grid size-8 place-items-center rounded-md border border-ink bg-ink text-paper"
                          : "grid size-8 place-items-center rounded-md border border-line text-ink-2 transition-colors hover:border-line-strong hover:bg-surface-2 hover:text-ink"
                      }
                    >
                      <Icon className="size-4" strokeWidth={1.7} />
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[0.6875rem] text-ink-3">
                Shown beside the name in the storefront menu. Currently{" "}
                <span className="font-mono">{form.glyph}</span>.
              </p>
            </div>

          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : cat ? "Save changes" : "Create category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

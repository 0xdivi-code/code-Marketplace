import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Eye,
  Trash2,
  Plus,
  GripVertical,
  Image as ImageIcon,
  Check,
  AlertTriangle,
  Upload,
} from "lucide-react";
import { PageHeader } from "./admin-layout";
import { Panel } from "./ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Textarea, NativeSelect, Switch, Checkbox } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/disclosure";
import { ProductArt } from "@/components/ui/product-art";
import { categories, productBySlug } from "@/data/catalog";
import { api, ApiError } from "@/lib/api";
import type { Product } from "@/data/types";
import { loadCatalog } from "@/lib/catalog-store";
import { useCatalog } from "@/lib/catalog-store";
import { money, cn } from "@/lib/utils";
import { toast } from "sonner";

export default function AdminProductEditor() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const catalog = useCatalog();

  const [record, setRecord] = React.useState<Product | undefined>(() => (slug ? productBySlug(slug) : undefined));

  // Drafts never reach the public catalogue endpoint, so a product being edited
  // is always (re)fetched from the admin endpoint — which sees every status.
  React.useEffect(() => {
    if (!slug) return;
    let alive = true;
    api
      .get<{ product: Product }>(`/admin/products/${slug}`)
      .then((res) => alive && setRecord(res.product))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [slug]);

  const existing = record;
  const isNew = !existing;

  const [form, setForm] = React.useState({
    slug: existing?.slug ?? "",
    name: existing?.name ?? "",
    tagline: existing?.tagline ?? "",
    description: existing?.description ?? "",
    category: existing?.category ?? categories[0]?.slug ?? "",
    stack: (existing?.stack ?? []).join(", "),
    price: ((existing?.price ?? 9900) / 100).toFixed(2),
    compareAt: existing?.compareAt ? (existing.compareAt / 100).toFixed(2) : "",
    salePrice: existing?.salePrice ? (existing.salePrice / 100).toFixed(2) : "",
    saleEndsAt: existing?.saleEndsAt ? new Date(existing.saleEndsAt).toISOString().slice(0, 10) : "",
    version: existing?.version ?? "1.0.0",
    status: existing?.status ?? "draft",
    featured: existing?.featured ?? false,
    trending: existing?.trending ?? false,
    free: existing?.free ?? false,
    license: "regular",
    seoTitle: existing?.name ?? "",
    seoDescription: existing?.tagline ?? "",
  });

  const set = (k: keyof typeof form, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  // The catalogue arrives asynchronously; the form must be (re)filled once the
  // real row exists, otherwise the editor thinks it is creating a new product.
  React.useEffect(() => {
    if (!existing) return;
    setForm((f) => ({
      ...f,
      slug: existing.slug,
      name: existing.name,
      tagline: existing.tagline,
      description: existing.description,
      category: existing.category || f.category,
      stack: existing.stack.join(", "),
      price: (existing.price / 100).toFixed(2),
      compareAt: existing.compareAt ? (existing.compareAt / 100).toFixed(2) : "",
      salePrice: existing.salePrice ? (existing.salePrice / 100).toFixed(2) : "",
      saleEndsAt: existing.saleEndsAt ? new Date(existing.saleEndsAt).toISOString().slice(0, 10) : "",
      version: existing.version,
      status: existing.status,
      featured: existing.featured,
      trending: existing.trending,
      free: existing.free,
      seoTitle: existing.name,
      seoDescription: existing.tagline,
    }));
    setSavedSlug(existing.slug);
  }, [existing?.slug]);
  const [busy, setBusy] = React.useState(false);
  const [files, setFiles] = React.useState<{ id: string; originalName: string; bytes: number; kind: string }[]>([]);
  const [savedSlug, setSavedSlug] = React.useState<string | null>(existing?.slug ?? null);
  const zipInput = React.useRef<HTMLInputElement>(null);
  const coverInput = React.useRef<HTMLInputElement>(null);

  // Keep the local form in step once the catalogue hydrates from the API.
  React.useEffect(() => {
    if (!slug || existing) return;
    if (catalog.status !== "ready") return;
    const fresh = productBySlug(slug);
    if (fresh) setSavedSlug(fresh.slug);
  }, [catalog.status, existing, slug]);

  /** Everything the API accepts, built from the form. */
  const payload = () => {
    const priceCents = Math.round((Number(form.price) || 0) * 100);
    const compareCents = form.compareAt ? Math.round(Number(form.compareAt) * 100) : null;
    return {
      name: form.name.trim(),
      slug: form.slug || undefined,
      tagline: form.tagline,
      description: form.description,
      categorySlug: form.category || undefined,
      stack: form.stack.split(",").map((s) => s.trim()).filter(Boolean),
      status: form.status as "published" | "draft" | "review" | "archived",
      price: priceCents,
      compareAt: compareCents,
      // A time-boxed sale is the real price the server charges, so it is not
      // merely presentational like compareAt.
      salePrice: form.salePrice ? Math.round(Number(form.salePrice) * 100) : null,
      saleEndsAt: form.saleEndsAt ? new Date(`${form.saleEndsAt}T23:59:59Z`).toISOString() : null,
      free: form.free,
      featured: form.featured,
      trending: form.trending,
      version: form.version,
      seoTitle: form.seoTitle || undefined,
      seoDescription: form.seoDescription || undefined,
      tiers: [
        { license: "personal" as const, name: "Personal", price: priceCents, compareAt: compareCents, popular: false },
        { license: "commercial" as const, name: "Commercial", price: Math.round(priceCents * 2.4), popular: true },
        { license: "extended" as const, name: "Extended", price: Math.round(priceCents * 5) },
      ],
      art: {
        from: art.from,
        to: art.to,
        ink: art.ink,
        kind: art.kind,
      },
    };
  };

  async function save(nextStatus?: string) {
    if (busy) return;
    if (!form.name.trim()) {
      toast.error("Give the product a name first.");
      return;
    }
    setBusy(true);
    try {
      const body = { ...payload(), ...(nextStatus ? { status: nextStatus } : {}) };
      if (savedSlug) {
        await api.patch(`/admin/products/${savedSlug}`, body);
        toast.success("Changes saved", { description: `${form.name} · ${body.status}` });
      } else {
        const res = await api.post<{ product: { slug: string } }>("/admin/products", body);
        setSavedSlug(res.product.slug);
        toast.success("Product created", { description: `${form.name} · ${body.status}` });
      }
      await loadCatalog(true);
      if (!slug) navigate("/admin/products");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save the product.");
    } finally {
      setBusy(false);
    }
  }

  async function upload(kind: "source" | "image" | "document", file: File | undefined) {
    if (!file || !savedSlug) {
      if (!savedSlug) toast.error("Save the product first, then upload files.");
      return;
    }
    const limit = kind === "source" ? 200 : kind === "image" ? 8 : 25;
    if (file.size > limit * 1024 * 1024) {
      toast.error(`That file is over the ${limit} MB limit.`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/products/${savedSlug}/files?kind=${kind}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-Filename": encodeURIComponent(file.name),
        },
        body: file,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setFiles((prev) => [{ ...data.file }, ...prev]);
      toast.success("Uploaded", { description: `${file.name} · ${(file.size / 1024).toFixed(0)} KB` });
      await loadCatalog(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  const art = existing?.art ?? { from: "#17392b", to: "#4d8a68", ink: "#eef4e9", kind: "window" as const };

  return (
    <div>
      <PageHeader
        title={isNew ? "New product" : existing!.name}
        subtitle={isNew ? "Create a listing — saves as a draft first" : `v${existing!.version} · last updated ${existing!.updated}`}
        actions={
          <>
            <Button asChild variant="ghost" size="xs" className="h-8">
              <Link to="/admin/products">
                <ArrowLeft className="size-3.5" /> Back
              </Link>
            </Button>
            {!isNew && (
              <Button variant="outline" size="xs" className="h-8" asChild>
                <Link to={`/item/${existing!.slug}`}>
                  <Eye className="size-3.5" /> Preview
                </Link>
              </Button>
            )}
            {savedSlug && (
              <Button
                size="xs"
                variant="outline"
                className="h-8"
                disabled={busy}
                onClick={() => save(form.status === "published" ? "draft" : "published")}
              >
                <Check className="size-3.5" />
                {form.status === "published" ? "Unpublish" : "Publish"}
              </Button>
            )}
            <Button size="xs" className="h-8" disabled={busy} onClick={() => save()}>
              <Save className="size-3.5" /> {isNew ? "Create draft" : "Save changes"}
            </Button>
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-[1fr_320px]">
        <div>
          <Tabs defaultValue="content">
            <TabsList variant="line">
              <TabsTrigger variant="line" value="content">
                Content
              </TabsTrigger>
              <TabsTrigger variant="line" value="media">
                Media
              </TabsTrigger>
              <TabsTrigger variant="line" value="pricing">
                Pricing
              </TabsTrigger>
              <TabsTrigger variant="line" value="seo">
                SEO
              </TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="pt-4">
              <div className="space-y-3">
                <Panel title="Basics" bodyClassName="space-y-3 p-4">
                  <Field label="Product name" htmlFor="name">
                    <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Forge — SaaS Starter" />
                  </Field>
                  <Field label="Tagline" htmlFor="tagline" hint="One line, shown on cards. Under 70 characters.">
                    <Input id="tagline" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
                  </Field>
                  <Field label="Description" htmlFor="desc">
                    <Textarea
                      id="desc"
                      value={form.description}
                      onChange={(e) => set("description", e.target.value)}
                      className="min-h-36"
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Category" htmlFor="cat">
                      <NativeSelect id="cat" className="h-11 text-sm" value={form.category} onChange={(e) => set("category", e.target.value)}>
                        {categories.map((c) => (
                          <option key={c.slug} value={c.slug}>
                            {c.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                    <Field label="Tech stack" htmlFor="stack" hint="Comma separated">
                      <Input id="stack" value={form.stack} onChange={(e) => set("stack", e.target.value)} />
                    </Field>
                  </div>
                </Panel>

                <Panel
                  title="Features"
                  description="Shown as numbered cards on the product page"
                  action={
                    <Button variant="outline" size="xs" className="h-7">
                      <Plus className="size-3" /> Add
                    </Button>
                  }
                  bodyClassName="divide-y divide-line"
                >
                  {(existing?.features ?? [{ title: "First feature", body: "Describe what it does." }]).map((f, i) => (
                    <div key={i} className="flex items-start gap-2 px-4 py-3">
                      <GripVertical className="mt-2 size-3.5 shrink-0 cursor-grab text-ink-3" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Input defaultValue={f.title} className="h-9 text-[0.8125rem]" />
                        <Textarea defaultValue={f.body} className="min-h-16 text-[0.8125rem]" />
                      </div>
                      <button className="mt-1 text-ink-3 hover:text-red-600" aria-label="Remove feature">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </Panel>

                <Panel title="Changelog" bodyClassName="divide-y divide-line">
                  {(existing?.changelog ?? []).map((c) => (
                    <div key={c.version} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="font-mono text-[0.75rem]">v{c.version}</p>
                        <p className="truncate text-[0.625rem] text-ink-3">{c.notes.join(" · ")}</p>
                      </div>
                      <span className="shrink-0 text-[0.625rem] text-ink-3">{c.date}</span>
                    </div>
                  ))}
                  <div className="px-4 py-3">
                    <Button variant="outline" size="xs" className="h-7">
                      <Plus className="size-3" /> Add release
                    </Button>
                  </div>
                </Panel>
              </div>
            </TabsContent>

            <TabsContent value="media" className="pt-4">
              <Panel
                title="Source package"
                description="Private storage · never served from a public URL"
                bodyClassName="p-4"
              >
                <input
                  ref={zipInput}
                  type="file"
                  accept=".zip,application/zip"
                  className="hidden"
                  onChange={(e) => {
                    void upload("source", e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => zipInput.current?.click()}>
                    <Upload className="size-3.5" /> Upload .zip
                  </Button>
                  <span className="text-[0.625rem] text-ink-3">Max 200 MB · validated as a real archive</span>
                </div>
                {files.length > 0 && (
                  <ul className="mt-3 divide-y divide-line rounded-sm border border-line">
                    {files.map((f) => (
                      <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <span className="truncate font-mono text-[0.6875rem]">{f.originalName}</span>
                        <span className="shrink-0 text-[0.625rem] text-ink-3">{(f.bytes / 1024).toFixed(0)} KB</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Cover & gallery" description="First image is the cover" bodyClassName="p-4">
                <input
                  ref={coverInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  className="hidden"
                  onChange={(e) => {
                    void upload("image", e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="relative col-span-2 row-span-2 overflow-hidden rounded-md border border-line">
                    {existing?.art?.src ? (
                      <img src={existing.art.src} alt="" className="aspect-[16/10] w-full object-cover" />
                    ) : (
                      <ProductArt {...art} className="aspect-[16/10] w-full" />
                    )}
                    <span className="absolute left-2 top-2">
                      <Badge variant="solid" size="sm">
                        Cover
                      </Badge>
                    </span>
                  </div>
                  {(existing?.gallery ?? []).slice(0, 4).map((g) => (
                    <div key={g.id} className="relative overflow-hidden rounded-md border border-line">
                      <ProductArt {...g} className="aspect-square w-full" />
                      <button className="absolute right-1 top-1 grid size-5 place-items-center rounded bg-black/40 text-white">
                        <Trash2 className="size-2.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => coverInput.current?.click()}
                    className="grid aspect-square place-items-center rounded-md border border-dashed border-line-strong text-ink-3 transition-colors hover:border-accent hover:text-accent"
                  >
                    <div className="text-center">
                      <ImageIcon className="mx-auto size-4" />
                      <span className="mt-1 block text-[0.5625rem]">Upload</span>
                    </div>
                  </button>
                </div>
                <p className="mt-3 text-[0.625rem] text-ink-3">
                  Recommended 1600×1000 WebP. Max 5 MB per file, 12 files total.
                </p>
              </Panel>
            </TabsContent>

            <TabsContent value="pricing" className="pt-4">
              <Panel title="License pricing" bodyClassName="p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Price (USD)" htmlFor="price">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[0.8125rem] text-ink-3">$</span>
                      <Input id="price" value={form.price} onChange={(e) => set("price", e.target.value)} className="pl-7 font-mono" />
                    </div>
                  </Field>
                  <Field label="Compare-at price" htmlFor="compare">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[0.8125rem] text-ink-3">$</span>
                      <Input id="compare" value={form.compareAt} onChange={(e) => set("compareAt", e.target.value)} className="pl-7 font-mono" />
                    </div>
                  </Field>
                </div>
                {/* A real, time-boxed sale: the server charges this price while
                    it is live, unlike compare-at which is presentational. */}
                <div className="mt-4 grid gap-3 rounded-sm border border-line bg-surface-2/40 p-3 sm:grid-cols-2">
                  <Field label="Sale price (USD)" htmlFor="sale" hint="Charged while live">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[0.8125rem] text-ink-3">$</span>
                      <Input
                        id="sale"
                        value={form.salePrice}
                        onChange={(e) => set("salePrice", e.target.value)}
                        placeholder="none"
                        className="pl-7 font-mono"
                      />
                    </div>
                  </Field>
                  <Field label="Sale ends" htmlFor="sale-end" hint="Leave blank to run until cleared">
                    <Input
                      id="sale-end"
                      type="date"
                      value={form.saleEndsAt}
                      onChange={(e) => set("saleEndsAt", e.target.value)}
                    />
                  </Field>
                </div>

                <div className="mt-4 space-y-2">
                  {[
                    { name: "Commercial", mult: 2.4 },
                    { name: "Extended", mult: 5 },
                  ].map((t) => (
                    <div key={t.name} className="flex items-center justify-between rounded-sm border border-line px-3 py-2">
                      <div>
                        <p className="text-[0.75rem] font-medium">{t.name} license</p>
                        <p className="text-[0.5625rem] text-ink-3">Auto-calculated at {t.mult}× base</p>
                      </div>
                      <span className="font-mono text-[0.75rem]">
                        {money(Math.round((Number(form.price) || 0) * 100 * t.mult), { free: false })}
                      </span>
                    </div>
                  ))}
                </div>
                <label className="mt-4 flex items-center gap-2.5 rounded-sm bg-surface-2/60 px-3 py-2.5">
                  <Checkbox checked={form.free} onCheckedChange={(v) => set("free", v === true)} />
                  <span className="text-[0.75rem]">Publish as a free item (MIT license)</span>
                </label>
              </Panel>
            </TabsContent>

            <TabsContent value="seo" className="pt-4">
              <Panel title="Search preview" bodyClassName="p-4">
                <div className="rounded-md border border-line p-3">
                  <p className="text-[0.6875rem] text-emerald-700 dark:text-emerald-400">
                    kiln.dev › item › {existing?.slug ?? "new-product"}
                  </p>
                  <p className="mt-0.5 text-[0.875rem] text-[#1a0dab] dark:text-[#8ab4f8]">
                    {form.seoTitle || form.name || "Product title"}
                  </p>
                  <p className="mt-0.5 text-[0.6875rem] text-ink-2">
                    {form.seoDescription || form.tagline || "Meta description appears here."}
                  </p>
                </div>
                <div className="mt-3 space-y-3">
                  <Field label="Meta title" htmlFor="seot" hint={`${form.seoTitle.length}/60 characters`}>
                    <Input id="seot" value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} />
                  </Field>
                  <Field label="Meta description" htmlFor="seod" hint={`${form.seoDescription.length}/160 characters`}>
                    <Textarea id="seod" value={form.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} className="min-h-20" />
                  </Field>
                </div>
              </Panel>
            </TabsContent>
          </Tabs>
        </div>

        {/* right rail */}
        <aside className="space-y-3">
          <Panel title="Publish" bodyClassName="space-y-3 p-4">
            <Field label="Status" htmlFor="status">
              <NativeSelect id="status" className="h-10" value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="draft">Draft</option>
                <option value="review">In review</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </NativeSelect>
            </Field>
            <Field label="Version" htmlFor="ver">
              <Input id="ver" value={form.version} onChange={(e) => set("version", e.target.value)} className="font-mono" />
            </Field>
            <div className="space-y-2 border-t border-line pt-3">
              {[
                { k: "featured" as const, l: "Featured on homepage" },
                { k: "trending" as const, l: "Show in trending" },
              ].map((t) => (
                <div key={t.k} className="flex items-center justify-between">
                  <span className="text-[0.75rem] text-ink-2">{t.l}</span>
                  <Switch checked={form[t.k] as boolean} onCheckedChange={(v) => set(t.k, v)} />
                </div>
              ))}
            </div>
            <div className="rounded-sm bg-sage/50 px-2.5 py-2 text-[0.625rem] leading-relaxed text-[#2c4331] dark:bg-brand-soft dark:text-sage">
              <Check className="mr-1 inline size-3" />
              All required fields complete.
            </div>
          </Panel>

          <Panel title="At a glance" bodyClassName="divide-y divide-line text-[0.75rem]">
            {[
              ["Sales", existing ? existing.sales.toLocaleString() : "—"],
              ["Revenue", existing ? money(existing.sales * existing.price, { free: false }) : "—"],
              ["Rating", existing ? `${existing.rating} (${existing.reviews})` : "—"],
              ["Downloads", existing ? existing.views.toLocaleString() : "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-4 py-2">
                <span className="text-ink-3">{k}</span>
                <span className="font-mono text-ink">{v}</span>
              </div>
            ))}
          </Panel>

          {!isNew && (
            <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 dark:border-red-950 dark:bg-red-950/20">
              <p className="flex items-center gap-1.5 text-[0.75rem] font-medium text-red-800 dark:text-red-300">
                <AlertTriangle className="size-3.5" /> Danger zone
              </p>
              <p className="mt-1 text-[0.625rem] leading-relaxed text-red-800/80 dark:text-red-300/70">
                Archiving hides the item from the store. Existing licenses stay valid.
              </p>
              <Button
                variant="danger"
                size="xs"
                className="mt-2.5 h-7"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm("Archive this product? It leaves the storefront; existing licences stay valid."))
                    return;
                  void save("archived");
                }}
              >
                Archive product
              </Button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

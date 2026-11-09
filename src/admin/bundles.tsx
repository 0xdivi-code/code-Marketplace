import * as React from "react";
import { Link } from "react-router-dom";
import { Boxes, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "./admin-layout";
import { Panel } from "./ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Textarea, Checkbox } from "@/components/ui/field";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/utils";
import { toast } from "sonner";
import { ProductPicker } from "./product-picker";

interface BundleRow {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  price: number;
  compareAt: number | null;
  license: string;
  active: boolean;
  featured: boolean;
  items: { slug: string; name: string; price: number }[];
  separateTotal: number;
}

interface ProductOption {
  slug: string;
  name: string;
  price: number;
  status: string;
}

export default function AdminBundles() {
  const [rows, setRows] = React.useState<BundleRow[]>([]);
  const [products, setProducts] = React.useState<ProductOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<BundleRow | null>(null);
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [slug, setSlug] = React.useState("");
  const [name, setName] = React.useState("");
  const [tagline, setTagline] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [license, setLicense] = React.useState("personal");
  const [active, setActive] = React.useState(true);
  const [featured, setFeatured] = React.useState(false);
  const [picked, setPicked] = React.useState<string[]>([]);

  const load = React.useCallback(async () => {
    try {
      const [b, p] = await Promise.all([
        api.get<{ bundles: BundleRow[] }>("/admin/bundles"),
        api.get<{ products: ProductOption[] }>("/admin/products"),
      ]);
      setRows(b.bundles);
      setProducts(p.products);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load bundles.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const reset = (b: BundleRow | null) => {
    setEditing(b);
    setSlug(b?.slug ?? "");
    setName(b?.name ?? "");
    setTagline(b?.tagline ?? "");
    setDescription(b?.description ?? "");
    setPrice(b ? (b.price / 100).toFixed(2) : "");
    setLicense(b?.license ?? "personal");
    setActive(b?.active ?? true);
    setFeatured(b?.featured ?? false);
    setPicked(b?.items.map((i) => i.slug) ?? []);
  };

  const save = async () => {
    if (name.trim().length < 2) return toast.error("Give the bundle a name.");
    if (!picked.length) return toast.error("Pick at least one product.");
    const amount = Number(price);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter a bundle price.");
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        tagline: tagline.trim(),
        description: description.trim(),
        price: amount,
        license,
        active,
        featured,
        products: picked,
      };
      if (editing) {
        await api.patch(`/admin/bundles/${encodeURIComponent(editing.slug)}`, body);
        toast.success("Bundle updated");
      } else {
        await api.post("/admin/bundles", { ...body, slug: slug.trim() || name.trim() });
        toast.success("Bundle created", { description: "It is on sale as soon as it is active." });
      }
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save the bundle.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (b: BundleRow) => {
    if (!window.confirm(`Delete ${b.name}? Orders that already bought it keep their licences.`)) return;
    try {
      await api.del(`/admin/bundles/${encodeURIComponent(b.slug)}`);
      toast.success("Bundle deleted");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete the bundle.");
    }
  };

  const editTotal = picked.reduce(
    (n, s) => n + (products.find((p) => p.slug === s)?.price ?? 0),
    0,
  );
  const saving_ = Number(price) || 0;

  return (
    <div>
      <PageHeader
        title="Bundles"
        subtitle="Sell several products as one, at a price you set."
        actions={
          <Button
            size="sm"
            onClick={() => {
              reset(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> New bundle
          </Button>
        }
      />

      {loading ? (
        <div className="rounded-lg border border-line py-16 text-center text-sm text-ink-3">Loading bundles…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong py-16 text-center">
          <Boxes className="mx-auto size-5 text-ink-3" />
          <p className="mt-3 text-sm font-medium">No bundles yet</p>
          <p className="mt-1 text-[0.8125rem] text-ink-3">
            A bundle is the easiest discount to explain: three products, one lower price.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((b) => {
            const off = b.separateTotal > 0 ? Math.round((1 - b.price / b.separateTotal) * 100) : 0;
            return (
              /* min-w-0: a grid item defaults to min-content width, so the
                 nowrap product names pushed the card 100px past the phone. */
              <Panel key={b.id} bodyClassName="p-4" className="min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[0.9375rem] font-medium">{b.name}</p>
                      <Badge variant={b.active ? "accent" : "neutral"} size="sm">
                        {b.active ? "live" : "hidden"}
                      </Badge>
                      {b.featured && <Badge variant="warn" size="sm">featured</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-[0.75rem] text-ink-3">{b.tagline || b.slug}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${b.name}`}
                      onClick={() => {
                        reset(b);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Delete ${b.name}`} onClick={() => void remove(b)}>
                      <Trash2 className="size-4 text-negative" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-mono text-lg">{money(b.price)}</span>
                  {b.separateTotal > b.price && (
                    <>
                      <span className="font-mono text-[0.75rem] text-ink-3 line-through">{money(b.separateTotal)}</span>
                      <Badge variant="accent" size="sm">
                        −{off}%
                      </Badge>
                    </>
                  )}
                </div>

                <ul className="mt-3 space-y-1 border-t border-line pt-2">
                  {b.items.map((i) => (
                    <li key={i.slug} className="flex justify-between text-[0.75rem]">
                      <Link to={`/admin/products/${i.slug}`} className="truncate text-ink-2 hover:text-ink">
                        {i.name}
                      </Link>
                      <span className="font-mono text-[0.6875rem] text-ink-3">{money(i.price)}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "New bundle"}</DialogTitle>
            <DialogDescription>
              Buyers get one licence per product, at a single lower price.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-6 pb-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" htmlFor="bname">
                <Input id="bname" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Slug" htmlFor="bslug" hint={editing ? "Cannot be changed" : "URL-friendly"}>
                <Input
                  id="bslug"
                  value={slug}
                  disabled={Boolean(editing)}
                  onChange={(e) => setSlug(e.target.value)}
                  className="font-mono"
                />
              </Field>
            </div>
            <Field label="Tagline" htmlFor="btag">
              <Input id="btag" value={tagline} onChange={(e) => setTagline(e.target.value)} />
            </Field>
            <Field label="Description" htmlFor="bdesc">
              <Textarea id="bdesc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Bundle price (USD)"
                htmlFor="bprice"
                hint={
                  editTotal > 0
                    ? `Separately ${money(editTotal)}${saving_ > 0 ? ` · saves ${money(Math.max(0, editTotal - saving_ * 100))}` : ""}`
                    : undefined
                }
              >
                <Input
                  id="bprice"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="font-mono"
                />
              </Field>
              <Field label="Licence granted" htmlFor="blic">
                <select
                  id="blic"
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  className="h-11 w-full rounded-sm border border-line bg-surface px-3 text-sm"
                >
                  <option value="personal">Personal</option>
                  <option value="commercial">Commercial</option>
                  <option value="extended">Extended</option>
                  <option value="developer">Developer / Agency</option>
                </select>
              </Field>
            </div>

            <Field label="Products in this bundle" hint={`${picked.length} selected`}>
              <ProductPicker products={products} value={picked} onChange={setPicked} />
            </Field>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-[0.8125rem]">
                <Checkbox checked={active} onCheckedChange={(v) => setActive(v === true)} /> On sale
              </label>
              <label className="flex items-center gap-2 text-[0.8125rem]">
                <Checkbox checked={featured} onCheckedChange={(v) => setFeatured(v === true)} /> Feature on the storefront
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-line pt-3">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Create bundle"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

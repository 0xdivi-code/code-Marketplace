import * as React from "react";
import { Plus, GripVertical, Eye, Pencil, Trash2, Monitor, Tablet, Smartphone, Image as ImageIcon } from "lucide-react";
import { PageHeader } from "./admin-layout";
import { Panel } from "./ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Textarea, Switch, NativeSelect } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/disclosure";
import { ProductArt } from "@/components/ui/product-art";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const blocks = [
  { id: "hero", name: "Hero banner", type: "Hero", status: "live", note: "Headline, search, product preview" },
  { id: "promise", name: "Promise strip", type: "Features", status: "live", note: "4 value props" },
  { id: "cats", name: "Category grid", type: "Categories", status: "live", note: "8 tiles" },
  { id: "trending", name: "Trending row", type: "Products", status: "live", note: "8 products · auto" },
  { id: "promo", name: "Promo pair", type: "Banners", status: "live", note: "New drops + free" },
  { id: "collection", name: "Featured collection", type: "Collection", status: "live", note: "The Launch Stack" },
  { id: "free", name: "Free collection", type: "Products", status: "live", note: "3 items" },
  { id: "studio", name: "Studio editorial", type: "Editorial", status: "live", note: "Image + stats" },
  { id: "journal", name: "Journal", type: "Blog", status: "live", note: "3 posts" },
  { id: "faq", name: "FAQ + newsletter", type: "Custom", status: "draft", note: "Newsletter capture" },
];

const announcements = [
  { text: "New drop: Ledger — Billing Engine v1.1", active: true, link: "/item/ledger-billing" },
  { text: "Black Friday: 40% off with BLACKFRIDAY", active: false, link: "/browse" },
];

export default function AdminBanners() {
  const [device, setDevice] = React.useState("desktop");
  const [headline, setHeadline] = React.useState("Production-ready code you can read.");
  const [sub, setSub] = React.useState(
    "Starters, dashboards and developer tools from a three-person studio.",
  );

  return (
    <div>
      <PageHeader
        title="Homepage & banners"
        subtitle="Compose the storefront — blocks, hero copy and announcements"
        actions={
          <>
            <Button variant="outline" size="xs" className="h-8" asChild>
              <a href="/" target="_blank" rel="noreferrer">
                <Eye className="size-3.5" /> View live
              </a>
            </Button>
            <Button size="xs" className="h-8" onClick={() => toast.success("Homepage published")}>
              Publish changes
            </Button>
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-[360px_1fr]">
        <div className="space-y-3">
          <Panel
            title="Sections"
            description="Drag to reorder the homepage"
            action={
              <Button variant="outline" size="xs" className="h-7">
                <Plus className="size-3" /> Add
              </Button>
            }
            bodyClassName="divide-y divide-line"
          >
            {blocks.map((b) => (
              <div key={b.id} className="flex items-center gap-2 px-3 py-2 hover:bg-surface-2/40">
                <GripVertical className="size-3.5 shrink-0 cursor-grab text-ink-3" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.75rem] font-medium">{b.name}</p>
                  <p className="truncate text-[0.5625rem] text-ink-3">{b.note}</p>
                </div>
                <Badge variant={b.status === "live" ? "success" : "neutral"} size="sm">
                  {b.status}
                </Badge>
                <div className="flex shrink-0 items-center">
                  <button className="grid size-6 place-items-center rounded text-ink-3 hover:text-ink" aria-label="Edit">
                    <Pencil className="size-3" />
                  </button>
                  <button className="grid size-6 place-items-center rounded text-ink-3 hover:text-red-600" aria-label="Delete">
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </Panel>

          <Panel title="Announcement bar" bodyClassName="space-y-3 p-4">
            {announcements.map((a) => (
              <div key={a.text} className="rounded-sm border border-line p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[0.6875rem] leading-snug">{a.text}</p>
                  <Switch defaultChecked={a.active} />
                </div>
                <p className="mt-1 font-mono text-[0.5625rem] text-ink-3">{a.link}</p>
              </div>
            ))}
            <Button variant="outline" size="xs" className="h-7 w-full">
              <Plus className="size-3" /> New announcement
            </Button>
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel
            title="Live preview"
            action={
              <div className="flex items-center gap-0.5 rounded-sm border border-line p-0.5">
                {[
                  { id: "desktop", icon: Monitor },
                  { id: "tablet", icon: Tablet },
                  { id: "mobile", icon: Smartphone },
                ].map(({ id, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setDevice(id)}
                    className={cn(
                      "grid size-6 place-items-center rounded transition-colors",
                      device === id ? "bg-surface-2 text-ink" : "text-ink-3 hover:text-ink",
                    )}
                    aria-label={`${id} preview`}
                  >
                    <Icon className="size-3.5" />
                  </button>
                ))}
              </div>
            }
            bodyClassName="bg-surface-2/40 p-4"
          >
            <div
              className={cn(
                "mx-auto overflow-hidden rounded-md border border-line bg-paper shadow-card transition-all",
                device === "desktop" && "w-full",
                device === "tablet" && "w-[70%]",
                device === "mobile" && "w-[42%]",
              )}
            >
              <div className="flex items-center gap-1 overflow-hidden border-b border-line bg-brand px-2 py-1">
                <span className="min-w-0 flex-1 truncate text-[0.4375rem] text-brand-ink">
                  {announcements[0].text}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-line px-2 py-1.5">
                <span className="font-display text-[0.5625rem]">Kiln</span>
                <div className="hidden gap-1.5 sm:flex">
                  {["Browse", "Collections", "Free", "Journal"].map((n) => (
                    <span key={n} className="text-[0.375rem] text-ink-3">
                      {n}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid gap-2 p-2.5 sm:grid-cols-2">
                <div>
                  <p className="font-display text-[0.75rem] leading-tight">{headline}</p>
                  <p className="mt-0.5 text-[0.4375rem] leading-snug text-ink-2">{sub}</p>
                  <div className="mt-1.5 flex gap-1">
                    <span className="rounded-full bg-brand px-1.5 py-0.5 text-[0.375rem] text-brand-ink">
                      Browse
                    </span>
                    <span className="rounded-full border border-line px-1.5 py-0.5 text-[0.375rem]">
                      Free
                    </span>
                  </div>
                </div>
                <div className="overflow-hidden rounded-sm">
                  <ProductArt from="#17392b" to="#4d8a68" ink="#eef4e9" kind="window" className="aspect-[4/3] w-full" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 border-t border-line bg-surface p-2 sm:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-0.5">
                    <div className="aspect-[4/3] rounded-sm bg-surface-2" />
                    <div className="h-0.5 w-3/4 rounded bg-surface-2" />
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-2 text-center text-[0.5625rem] text-ink-3">
              Preview approximates the storefront · edits are local until published
            </p>
          </Panel>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="Hero copy" bodyClassName="space-y-3 p-4">
              <Field label="Headline" htmlFor="hl">
                <Input id="hl" value={headline} onChange={(e) => setHeadline(e.target.value)} />
              </Field>
              <Field label="Subheadline" htmlFor="sub">
                <Textarea id="sub" value={sub} onChange={(e) => setSub(e.target.value)} className="min-h-16" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Primary CTA" htmlFor="cta1">
                  <Input id="cta1" defaultValue="Browse all code" />
                </Field>
                <Field label="Secondary CTA" htmlFor="cta2">
                  <Input id="cta2" defaultValue="See free items" />
                </Field>
              </div>
            </Panel>

            <Panel title="Banner slots" bodyClassName="space-y-2 p-4">
              {[
                { l: "Leaderboard", s: "728×90 · above footer" },
                { l: "Feature card A", s: "640×420 · promo pair" },
                { l: "Feature card B", s: "640×420 · promo pair" },
              ].map((b) => (
                <div key={b.l} className="flex items-center gap-2 rounded-sm border border-line p-2">
                  <span className="grid size-8 place-items-center rounded bg-surface-2">
                    <ImageIcon className="size-3.5 text-ink-3" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.6875rem] font-medium">{b.l}</p>
                    <p className="text-[0.5625rem] text-ink-3">{b.s}</p>
                  </div>
                  <Button variant="ghost" size="xs" className="h-6">
                    Replace
                  </Button>
                </div>
              ))}
              <Field label="Theme preset" htmlFor="theme">
                <NativeSelect id="theme" className="h-9">
                  <option>Kiln editorial (warm)</option>
                  <option>Kiln night (deep green)</option>
                  <option>Kiln print (paper)</option>
                </NativeSelect>
              </Field>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

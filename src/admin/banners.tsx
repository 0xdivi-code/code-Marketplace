import * as React from "react";
import { Plus, Eye, Trash2, Monitor, Tablet, Smartphone } from "lucide-react";
import { PageHeader } from "./admin-layout";
import { Panel } from "./ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Textarea, Switch } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/disclosure";
import { ProductArt } from "@/components/ui/product-art";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";

interface Section {
  id: string;
  key: string;
  label: string;
  enabled: boolean;
  position: number;
}

interface Announcement {
  id: string;
  text: string;
  href: string | null;
  active: boolean;
  position: number;
}

interface HeroCopy {
  headline: string;
  sub: string;
}

export default function AdminBanners() {
  const [device, setDevice] = React.useState("desktop");
  const [sections, setSections] = React.useState<Section[]>([]);
  const [announcements, setAnnouncements] = React.useState<Announcement[]>([]);
  const [hero, setHero] = React.useState<HeroCopy>({ headline: "", sub: "" });
  const [loading, setLoading] = React.useState(true);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [newText, setNewText] = React.useState("");
  const headline = hero.headline;
  const sub = hero.sub;

  const load = React.useCallback(async () => {
    try {
      const res = await api.get<{
        sections: Section[];
        announcements: Announcement[];
        settings: Record<string, unknown>;
      }>("/admin/homepage");
      setSections(res.sections);
      setAnnouncements(res.announcements);
      const stored = (res.settings.hero ?? {}) as Partial<HeroCopy>;
      setHero({
        headline: stored.headline ?? "Production-ready code you can read.",
        sub: stored.sub ?? "",
      });
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load the homepage.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function toggleSection(section: Section) {
    try {
      await api.patch(`/admin/homepage/sections/${section.key}`, { enabled: !section.enabled });
      toast.success(section.enabled ? `“${section.label}” hidden` : `“${section.label}” shown`, {
        description: "The storefront reflects this on the next load.",
      });
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That change did not stick.");
    }
  }

  async function saveHero() {
    setSaving(true);
    try {
      await api.patch("/admin/settings", { values: { hero: { ...hero } } });
      setDirty(false);
      toast.success("Hero copy saved", { description: "Live on the storefront now." });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save the hero copy.");
    } finally {
      setSaving(false);
    }
  }

  async function activateAnnouncement(a: Announcement) {
    try {
      await api.patch(`/admin/announcements/${a.id}`, { active: !a.active });
      await load();
      toast.success(a.active ? "Announcement hidden" : "Announcement live");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That change did not stick.");
    }
  }

  async function addAnnouncement() {
    if (newText.trim().length < 4) return toast.error("Write the announcement first.");
    try {
      await api.post("/admin/announcements", { text: newText.trim(), active: true });
      setNewText("");
      await load();
      toast.success("Announcement published");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not publish that.");
    }
  }

  async function removeAnnouncement(a: Announcement) {
    try {
      await api.del(`/admin/announcements/${a.id}`);
      await load();
      toast.success("Announcement removed");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not remove that.");
    }
  }

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
            <Button size="xs" className="h-8" disabled={saving || !dirty} onClick={() => void saveHero()}>
              {saving ? "Saving…" : dirty ? "Publish changes" : "Published"}
            </Button>
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-[360px_1fr]">
        <div className="space-y-3">
          <Panel
            title="Sections"
            description={loading ? "Loading…" : `${sections.filter((x) => x.enabled).length} of ${sections.length} shown`}
            bodyClassName="divide-y divide-line"
          >
            {sections.map((b) => (
              <div key={b.id} className="flex items-center gap-2 px-3 py-2 hover:bg-surface-2/40">
                <span className="w-4 shrink-0 font-mono text-[0.5625rem] text-ink-3">{b.position + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.75rem] font-medium">{b.label}</p>
                  <p className="truncate font-mono text-[0.5625rem] text-ink-3">{b.key}</p>
                </div>
                <Badge variant={b.enabled ? "success" : "neutral"} size="sm">
                  {b.enabled ? "live" : "hidden"}
                </Badge>
                <Switch checked={b.enabled} onCheckedChange={() => void toggleSection(b)} />
              </div>
            ))}
          </Panel>

          <Panel title="Announcement bar" bodyClassName="space-y-3 p-4">
            {announcements.length === 0 && (
              <p className="text-[0.6875rem] text-ink-3">No announcements. The bar is hidden.</p>
            )}
            {announcements.map((a) => (
              <div key={a.id} className="rounded-sm border border-line p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[0.6875rem] leading-snug">{a.text}</p>
                  <Switch checked={a.active} onCheckedChange={() => void activateAnnouncement(a)} />
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <p className="font-mono text-[0.5625rem] text-ink-3">{a.href ?? "no link"}</p>
                  <button
                    onClick={() => void removeAnnouncement(a)}
                    className="ml-auto text-ink-3 hover:text-red-600"
                    aria-label="Delete announcement"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="New drop: …"
                className="h-8 text-[0.75rem]"
              />
              <Button variant="outline" size="xs" className="h-8 shrink-0" onClick={() => void addAnnouncement()}>
                <Plus className="size-3" /> Add
              </Button>
            </div>
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
                  {announcements.find((a) => a.active)?.text ?? announcements[0]?.text ?? "Announcement bar"}
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
                <Input
                  id="hl"
                  value={headline}
                  onChange={(e) => {
                    setHero((h) => ({ ...h, headline: e.target.value }));
                    setDirty(true);
                  }}
                />
              </Field>
              <Field label="Subheadline" htmlFor="sub">
                <Textarea
                  id="sub"
                  value={sub}
                  onChange={(e) => {
                    setHero((h) => ({ ...h, sub: e.target.value }));
                    setDirty(true);
                  }}
                  className="min-h-16"
                />
              </Field>
            </Panel>

            <Panel title="How this works" bodyClassName="space-y-2 p-4 text-[0.6875rem] leading-relaxed text-ink-2">
              <p>
                Each section below is a real block on the homepage. Switching one off removes it for every
                visitor — the page reads this list on load.
              </p>
              <p>
                Hero copy saves to the <code className="font-mono text-[0.625rem]">hero</code> store setting
                the homepage renders, so a sentence change goes live without a deploy.
              </p>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

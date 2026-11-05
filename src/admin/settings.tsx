import * as React from "react";
import { Save, Store, Palette, Receipt, Globe2, ShieldCheck, CreditCard, Mail, Check } from "lucide-react";
import { PageHeader } from "./admin-layout";
import { Panel } from "./ui";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, NativeSelect, Switch, Checkbox } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/disclosure";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";

const sections = [
  { id: "store", label: "Store", icon: Store },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "tax", label: "Tax & invoices", icon: Receipt },
  { id: "shipping", label: "Regions", icon: Globe2 },
  { id: "checkout", label: "Checkout", icon: CreditCard },
  { id: "email", label: "Email", icon: Mail },
  { id: "security", label: "Security", icon: ShieldCheck },
];

interface StoreValues {
  name: string;
  tagline: string;
  supportEmail: string;
  currency: string;
  vatRate: number;
}

interface AdminMe {
  user: { id: string; email: string; name: string; totpEnabledAt: string | null } | null;
}

export default function AdminSettings() {
  const [tab, setTab] = React.useState("store");
  const [values, setValues] = React.useState<StoreValues | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [me, setMe] = React.useState<AdminMe["user"]>(null);
  const [twoFactor, setTwoFactor] = React.useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = React.useState("");
  const [enrolling, setEnrolling] = React.useState(false);

  React.useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<{ values: Record<string, unknown> }>("/admin/settings");
        const store = (res.values.store ?? {}) as Partial<StoreValues>;
        setValues({
          name: store.name ?? "Kiln",
          tagline: store.tagline ?? "",
          supportEmail: store.supportEmail ?? "",
          currency: store.currency ?? "USD",
          vatRate: store.vatRate ?? 0,
        });
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not load settings.");
      }
      try {
        const auth = await api.get<AdminMe>("/admin/auth/me");
        setMe(auth.user);
      } catch {
        /* the console gate already guarantees a session */
      }
    })();
  }, []);

  function update<K extends keyof StoreValues>(key: K, value: StoreValues[K]) {
    setValues((v) => (v ? { ...v, [key]: value } : v));
    setDirty(true);
  }

  async function save() {
    if (!values) return;
    setSaving(true);
    try {
      await api.patch("/admin/settings", { values: { store: values } });
      setDirty(false);
      toast.success("Settings saved", { description: "The storefront reads these on next load." });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save your changes.");
    } finally {
      setSaving(false);
    }
  }

  async function beginTwoFactor() {
    setEnrolling(true);
    try {
      const res = await api.post<{ secret: string; uri: string }>("/admin/auth/2fa/setup", {});
      setTwoFactor(res);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not start 2FA setup.");
    } finally {
      setEnrolling(false);
    }
  }

  async function confirmTwoFactor() {
    setEnrolling(true);
    try {
      await api.post("/admin/auth/2fa/enable", { code: code.trim() });
      toast.success("Two-factor enabled", { description: "Your next sign-in will ask for a code." });
      setTwoFactor(null);
      setCode("");
      const auth = await api.get<AdminMe>("/admin/auth/me");
      setMe(auth.user);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That code did not match.");
    } finally {
      setEnrolling(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Store settings"
        subtitle="Everything that affects the storefront and checkout"
        actions={
          <Button size="xs" className="h-8" disabled={saving || !dirty} onClick={() => void save()}>
            <Save className="size-3.5" /> {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </Button>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[200px_1fr]">
        <nav className="space-y-0.5">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setTab(s.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-[0.8125rem] transition-colors",
                tab === s.id
                  ? "bg-surface font-medium text-ink shadow-[inset_2px_0_0_var(--accent)]"
                  : "text-ink-2 hover:bg-surface-2/60 hover:text-ink",
              )}
            >
              <s.icon className="size-3.5 text-ink-3" />
              {s.label}
            </button>
          ))}
        </nav>

        <div className="space-y-3">
          {tab === "store" && (
            <>
              <Panel title="Store identity" bodyClassName="space-y-3 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Store name" htmlFor="sname">
                    <Input
                      id="sname"
                      value={values?.name ?? ""}
                      onChange={(e) => update("name", e.target.value)}
                    />
                  </Field>
                  <Field label="Store URL" htmlFor="surl" hint="Set by your deployment">
                    <Input
                      id="surl"
                      value={typeof window !== "undefined" ? window.location.origin : ""}
                      readOnly
                      className="font-mono text-[0.8125rem] opacity-70"
                    />
                  </Field>
                </div>
                <Field label="Tagline" htmlFor="stag">
                  <Input
                    id="stag"
                    value={values?.tagline ?? ""}
                    onChange={(e) => update("tagline", e.target.value)}
                  />
                </Field>
                <Field label="About the store" htmlFor="sabout" hint="Shown on the footer and about page">
                  <Textarea
                    id="sabout"
                    defaultValue="A small studio selling the code we use ourselves — starters, dashboards and tools with upgrade paths we actually maintain."
                    className="min-h-24"
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Support email" htmlFor="semail">
                    <Input
                      id="semail"
                      value={values?.supportEmail ?? ""}
                      onChange={(e) => update("supportEmail", e.target.value)}
                    />
                  </Field>
                  <Field label="Currency" htmlFor="scur">
                    <NativeSelect id="scur" className="h-11 text-sm">
                      <option>USD — US Dollar</option>
                      <option>EUR — Euro</option>
                      <option>GBP — Pound Sterling</option>
                    </NativeSelect>
                  </Field>
                </div>
              </Panel>

              <Panel title="Store visibility" bodyClassName="divide-y divide-line">
                {[
                  { l: "Public storefront", d: "Visitors can browse without signing in", on: true },
                  { l: "Accept new customers", d: "Turn off to pause checkout", on: true },
                  { l: "Show sales counts", d: "Display download numbers on cards", on: true },
                  { l: "Show review counts", d: "Requires at least 3 reviews", on: true },
                  { l: "Maintenance mode", d: "Show a holding page to everyone", on: false },
                ].map((s) => (
                  <div key={s.l} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div>
                      <p className="text-[0.75rem] font-medium">{s.l}</p>
                      <p className="text-[0.5625rem] text-ink-3">{s.d}</p>
                    </div>
                    <Switch defaultChecked={s.on} />
                  </div>
                ))}
              </Panel>
            </>
          )}

          {tab === "appearance" && (
            <>
              <Panel title="Brand" bodyClassName="space-y-3 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Primary colour (forest)" htmlFor="c1">
                    <div className="flex gap-2">
                      <input type="color" defaultValue="#17392b" className="h-11 w-12 rounded-sm border border-line" />
                      <Input defaultValue="#17392B" className="font-mono" />
                    </div>
                  </Field>
                  <Field label="Accent colour (terracotta)" htmlFor="c2">
                    <div className="flex gap-2">
                      <input type="color" defaultValue="#c0592b" className="h-11 w-12 rounded-sm border border-line" />
                      <Input defaultValue="#C0592B" className="font-mono" />
                    </div>
                  </Field>
                  <Field label="Paper tone" htmlFor="c3">
                    <div className="flex gap-2">
                      <input type="color" defaultValue="#fbf7f0" className="h-11 w-12 rounded-sm border border-line" />
                      <Input defaultValue="#FBF7F0" className="font-mono" />
                    </div>
                  </Field>
                  <Field label="Heading font" htmlFor="f1">
                    <NativeSelect id="f1" className="h-11 text-sm">
                      <option>Fraunces (editorial serif)</option>
                      <option>Instrument Serif</option>
                      <option>Inter Tight</option>
                    </NativeSelect>
                  </Field>
                </div>
                <Field label="Body font" htmlFor="f2">
                  <NativeSelect id="f2" className="h-11 text-sm">
                    <option>Inter (UI sans)</option>
                    <option>Geist</option>
                    <option>IBM Plex Sans</option>
                  </NativeSelect>
                </Field>
              </Panel>

              <Panel title="Theme defaults" bodyClassName="divide-y divide-line">
                {[
                  { l: "Light theme default", on: true },
                  { l: "Follow system preference", on: false },
                  { l: "Allow visitors to switch", on: true },
                  { l: "Grain overlay on hero", on: true },
                  { l: "Reduced motion respect", on: true },
                ].map((s) => (
                  <div key={s.l} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[0.75rem]">{s.l}</span>
                    <Switch defaultChecked={s.on} />
                  </div>
                ))}
              </Panel>
            </>
          )}

          {tab === "tax" && (
            <>
              <Panel title="Tax rates" bodyClassName="p-0">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-line bg-surface-2/50">
                      {["Region", "Rate", "Inclusive", "Status"].map((h, i) => (
                        <th key={h} className={cn("label-mono px-4 py-1.5 text-[0.4375rem] text-ink-3", i > 0 && "text-right")}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["European Union", "VAT 21%", "Yes", true],
                      ["United Kingdom", "VAT 20%", "Yes", true],
                      ["United States", "0% (nexus)", "No", false],
                      ["Nigeria", "VAT 7.5%", "Yes", true],
                      ["Rest of world", "0%", "No", true],
                    ].map(([r, rate, inc, on]) => (
                      <tr key={r as string} className="border-b border-line/60 last:border-0">
                        <td className="px-4 py-2 text-[0.75rem]">{r}</td>
                        <td className="px-4 py-2 text-right font-mono text-[0.6875rem] text-ink-2">{rate}</td>
                        <td className="px-4 py-2 text-right text-[0.6875rem] text-ink-3">{inc}</td>
                        <td className="px-4 py-2 text-right">
                          <Switch defaultChecked={Boolean(on)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
              <Panel title="Invoices" bodyClassName="space-y-3 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Invoice prefix" htmlFor="ip">
                    <Input id="ip" value="KL-" readOnly className="font-mono opacity-70" />
                  </Field>
                  <Field label="Currency" htmlFor="inn" hint="Orders store integer cents">
                    <Input id="inn" value={values?.currency ?? "USD"} readOnly className="font-mono opacity-70" />
                  </Field>
                </div>
                <Field label="Legal entity" htmlFor="le">
                  <Input id="le" value={`${values?.name ?? "Kiln"} — legal entity on invoices`} readOnly className="opacity-70" />
                </Field>
                <Field label="Registered address" htmlFor="ra">
                  <Textarea id="ra" value={values?.tagline ?? ""} readOnly className="min-h-16 opacity-70" />
                </Field>
                <div className="flex items-center gap-2 rounded-sm bg-sage/50 px-3 py-2 text-[0.625rem] text-[#2c4331] dark:bg-brand-soft dark:text-sage">
                  <ShieldCheck className="size-3.5" /> VIES validation enabled — reverse charge applies for valid EU VAT numbers.
                </div>
              </Panel>
            </>
          )}

          {tab === "shipping" && (
            <Panel title="Selling regions" description="Digital goods — no shipping, just availability" bodyClassName="divide-y divide-line">
              {["Europe", "North America", "Africa", "Asia", "South America", "Oceania"].map((r, i) => (
                <div key={r} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="text-[0.75rem]">{r}</p>
                    <p className="text-[0.5625rem] text-ink-3">
                      {i === 1 ? "USD pricing · sales tax where required" : "Local currency shown at checkout"}
                    </p>
                  </div>
                  <Switch defaultChecked={i !== 5} />
                </div>
              ))}
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 text-[0.6875rem] text-ink-2">
                  <Globe2 className="size-3.5 text-ink-3" /> 148 countries supported · 7 currencies
                </div>
              </div>
            </Panel>
          )}

          {tab === "checkout" && (
            <>
              <Panel title="Checkout options" bodyClassName="divide-y divide-line">
                {[
                  { l: "Guest checkout", d: "Allow purchase without an account", on: true },
                  { l: "Require account", d: "Force sign-up before purchase", on: false },
                  { l: "Collect company details", d: "Optional at checkout", on: true },
                  { l: "Show express pay", d: "Apple Pay / Google Pay on cart", on: true },
                  { l: "Order notes", d: "Free-text field for buyers", on: false },
                ].map((s) => (
                  <div key={s.l} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div>
                      <p className="text-[0.75rem] font-medium">{s.l}</p>
                      <p className="text-[0.5625rem] text-ink-3">{s.d}</p>
                    </div>
                    <Switch defaultChecked={s.on} />
                  </div>
                ))}
              </Panel>
              <Panel title="Order flow" bodyClassName="space-y-3 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Auto-complete orders" htmlFor="ac">
                    <NativeSelect id="ac" className="h-11 text-sm">
                      <option>Immediately after payment</option>
                      <option>After 15 minutes</option>
                      <option>Manually</option>
                    </NativeSelect>
                  </Field>
                  <Field label="Download expiry" htmlFor="de">
                    <NativeSelect id="de" className="h-11 text-sm">
                      <option>Never</option>
                      <option>1 year</option>
                      <option>30 days</option>
                    </NativeSelect>
                  </Field>
                </div>
                <label className="flex items-start gap-2.5 rounded-sm border border-line px-3 py-2.5 text-[0.75rem] text-ink-2">
                  <Checkbox defaultChecked className="mt-0.5" />
                  <span>Require terms acceptance at checkout (recommended for EU compliance)</span>
                </label>
              </Panel>
            </>
          )}

          {tab === "email" && (
            <>
              <Panel title="Transactional email" bodyClassName="space-y-3 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="From name" htmlFor="fn">
                    <Input id="fn" value={`${values?.name ?? "Kiln"} Studio`} readOnly className="opacity-70" />
                  </Field>
                  <Field label="Reply-to" htmlFor="fr">
                    <Input id="fr" value={values?.supportEmail ?? ""} readOnly className="font-mono text-[0.8125rem] opacity-70" />
                  </Field>
                </div>
                <div className="rounded-sm border border-line">
                  {[
                    "Order confirmation",
                    "Download links",
                    "Receipt / invoice",
                    "Refund processed",
                    "Password reset",
                    "Review request (14 days)",
                  ].map((t) => (
                    <div key={t} className="flex items-center justify-between border-b border-line px-3 py-2 last:border-0">
                      <span className="text-[0.6875rem]">{t}</span>
                      <Badge variant="success" size="sm" className="gap-1">
                        <Check className="size-2.5" /> Active
                      </Badge>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title="Marketing" bodyClassName="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[0.75rem] font-medium">Newsletter capture</p>
                    <p className="text-[0.5625rem] text-ink-3">Footer and homepage blocks</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Field label="Double opt-in" htmlFor="dopt">
                  <NativeSelect id="dopt" className="h-11 text-sm">
                    <option>Enabled (GDPR-friendly)</option>
                    <option>Disabled</option>
                  </NativeSelect>
                </Field>
                <p className="text-[0.625rem] text-ink-3">4,182 subscribers · 42.1% open rate</p>
              </Panel>
            </>
          )}

          {tab === "security" && (
            <>
              <Panel
                title="Two-factor authentication"
                description="Required before this console is exposed to the internet"
                bodyClassName="space-y-3 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[0.75rem] font-medium">
                      {me?.totpEnabledAt ? "Enabled on your account" : "Not enabled"}
                    </p>
                    <p className="text-[0.5625rem] text-ink-3">
                      {me?.totpEnabledAt
                        ? `Since ${new Date(me.totpEnabledAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })} · a 6-digit code is asked for at every admin sign-in`
                        : "Admin sign-in accepts a password alone right now."}
                    </p>
                  </div>
                  <Badge variant={me?.totpEnabledAt ? "success" : "warn"} size="sm">
                    {me?.totpEnabledAt ? "On" : "Off"}
                  </Badge>
                </div>

                {!me?.totpEnabledAt && !twoFactor && (
                  <Button size="xs" variant="outline" className="h-8" disabled={enrolling} onClick={() => void beginTwoFactor()}>
                    {enrolling ? "Preparing…" : "Set up an authenticator"}
                  </Button>
                )}

                {twoFactor && (
                  <div className="space-y-2 rounded-sm border border-line bg-surface-2/50 p-3">
                    <p className="text-[0.625rem] text-ink-2">
                      Add this key to any TOTP app (1Password, Authy, Google Authenticator), then enter the
                      code it shows.
                    </p>
                    <code className="block break-all rounded-sm bg-surface px-2 py-1.5 font-mono text-[0.6875rem] tracking-wider">
                      {twoFactor.secret}
                    </code>
                    <div className="flex gap-2">
                      <Input
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="123456"
                        inputMode="numeric"
                        className="h-9 w-28 font-mono"
                      />
                      <Button size="sm" disabled={enrolling || code.length !== 6} onClick={() => void confirmTwoFactor()}>
                        Verify and enable
                      </Button>
                    </div>
                  </div>
                )}
              </Panel>

              <Panel title="Enforced by the server" bodyClassName="divide-y divide-line">
                {[
                  { l: "Admin sessions expire", d: "8 hours, signed httpOnly cookie", on: true },
                  { l: "Sign-in rate limit", d: "6 attempts per 15 minutes, per IP", on: true },
                  { l: "Download links", d: "Signed, expire 5 minutes after issue", on: true },
                  { l: "Suspended accounts", d: "Every session revoked the moment you suspend", on: true },
                ].map((s2) => (
                  <div key={s2.l} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div>
                      <p className="text-[0.75rem] font-medium">{s2.l}</p>
                      <p className="text-[0.5625rem] text-ink-3">{s2.d}</p>
                    </div>
                    <Badge variant="sage" size="sm">
                      <Check className="size-2.5" /> On
                    </Badge>
                  </div>
                ))}
              </Panel>

              <Panel title="Compliance" bodyClassName="space-y-2 p-4">
                {[
                  ["GDPR data export", "Every customer's orders and licences export as CSV"],
                  ["Right to erasure", "Suspending an account revokes access immediately"],
                  ["PCI scope", "No card data is stored — the demo gateway never sees a PAN"],
                  ["Backups", "PGlite data directory under .data/ — copy it to back up"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.6875rem] font-medium">{k}</p>
                      <p className="text-[0.5625rem] text-ink-3">{v}</p>
                    </div>
                    <Badge variant="sage" size="sm">
                      <Check className="size-2.5" />
                    </Badge>
                  </div>
                ))}
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

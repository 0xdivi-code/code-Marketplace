import * as React from "react";
import { User, Lock, Bell, CreditCard, Trash2, Check, Sun, Moon, Laptop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch, Checkbox, NativeSelect } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/disclosure";
import { Badge } from "@/components/ui/badge";
import { useSession, useTheme } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { api, ApiError, authApi, refreshAuth } from "@/lib/api";

const COUNTRIES = ["Nigeria", "Portugal", "United Kingdom", "Germany", "United States"];

export default function SettingsPage() {
  const { user } = useSession();
  const { theme, set } = useTheme();
  const [prefs, setPrefs] = React.useState({
    productUpdates: true,
    receipts: true,
    journal: true,
    promotions: false,
    commentReplies: true,
  });
  const [name, setName] = React.useState(user?.name ?? "");
  const [country, setCountry] = React.useState("Nigeria");
  const [company, setCompany] = React.useState("");
  const [vat, setVat] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // The session resolves after first paint; fill the form once it does.
  React.useEffect(() => {
    if (!user) return;
    setName((n) => n || user.name);
    setCountry((c) => user.country || c);
  }, [user?.name, user?.country]);

  async function saveProfile() {
    if (name.trim().length < 2) return toast.error("Your name needs at least two characters.");
    setSaving(true);
    try {
      await api.patch("/account/me", { name: name.trim(), country });
      await refreshAuth(true);
      toast.success("Profile saved", { description: "Shown on invoices and receipts." });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  /** Password changes go through the same reset mail the login page uses. */
  async function changePassword() {
    if (!user?.email) return;
    try {
      await authApi.forgot(user.email);
      toast.success("Reset link sent", { description: `Check ${user.email} — the link expires in an hour.` });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send the reset link.");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[1.35rem]">Settings</h2>
        <p className="mt-0.5 text-[0.8125rem] text-ink-2">Profile, security and notification preferences.</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList variant="line">
          <TabsTrigger variant="line" value="profile">
            <User className="size-3.5" /> Profile
          </TabsTrigger>
          <TabsTrigger variant="line" value="security">
            <Lock className="size-3.5" /> Security
          </TabsTrigger>
          <TabsTrigger variant="line" value="notifications">
            <Bell className="size-3.5" /> Notifications
          </TabsTrigger>
          <TabsTrigger variant="line" value="billing">
            <CreditCard className="size-3.5" /> Billing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="pt-5">
          <div className="surface-card rounded-lg p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="n">
                <Input id="n" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Email" htmlFor="e" hint="Contact support to change your sign-in address">
                <Input id="e" type="email" value={user?.email ?? ""} readOnly className="opacity-70" />
              </Field>
              <Field label="Company" htmlFor="c" optional>
                <Input
                  id="c"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Studio name"
                />
              </Field>
              <Field label="Country" htmlFor="co" hint="Used on invoices">
                <NativeSelect
                  id="co"
                  className="h-11 text-sm"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  {[...new Set([country, ...COUNTRIES])].filter(Boolean).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field label="VAT number" htmlFor="vat" optional hint="Entered at checkout on EU purchases">
              <Input
                id="vat"
                value={vat}
                onChange={(e) => setVat(e.target.value)}
                placeholder="PT123456789"
              />
            </Field>
            <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
              <div>
                <p className="text-[0.8125rem] font-medium">Appearance</p>
                <p className="text-[0.6875rem] text-ink-3">Applies to this browser</p>
              </div>
              <div className="flex gap-1 rounded-full border border-line p-0.5">
                {[
                  { id: "light", icon: Sun },
                  { id: "dark", icon: Moon },
                  { id: "system", icon: Laptop },
                ].map(({ id, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => (id === "system" ? set("light") : set(id as "light" | "dark"))}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[0.6875rem] capitalize transition-colors",
                      theme === id ? "bg-surface-2 text-ink" : "text-ink-3 hover:text-ink",
                    )}
                  >
                    <Icon className="size-3.5" /> {id}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button size="sm" disabled={saving} onClick={() => void saveProfile()}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="security" className="pt-5 space-y-5">
          <div className="surface-card rounded-lg p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[0.9375rem] font-medium">Password</h3>
                <p className="mt-0.5 text-[0.75rem] text-ink-2">
                  We email a one-hour reset link to {user?.email ?? "your address"}.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void changePassword()}>
                Change password
              </Button>
            </div>
          </div>

          <div className="surface-card rounded-lg p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[0.9375rem] font-medium">Two-factor authentication</h3>
                <p className="mt-0.5 text-[0.75rem] text-ink-2">
                  Add a passkey or authenticator app for logins on new devices.
                </p>
              </div>
              <Badge variant="warn" size="md">
                Not enabled
              </Badge>
            </div>
            <Button size="sm" className="mt-3">
              Enable 2FA
            </Button>
          </div>

          <div className="surface-card rounded-lg">
            <div className="border-b border-line px-5 py-3.5">
              <h3 className="text-[0.9375rem] font-medium">Active sessions</h3>
              <p className="text-[0.6875rem] text-ink-3">Sign out devices you don’t recognise</p>
            </div>
            <ul className="divide-y divide-line">
              <li className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.8125rem] font-medium">This browser</p>
                  <p className="text-[0.625rem] text-ink-3">
                    {typeof navigator !== "undefined" ? navigator.userAgent.split(") ")[0].split(" (").pop() : "Unknown"} ·
                    signed in {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }) : "recently"}
                  </p>
                </div>
                <Badge variant="success" size="sm">
                  <Check className="size-2.5" /> This device
                </Badge>
              </li>
            </ul>
            <p className="border-t border-line px-5 py-2.5 text-[0.625rem] text-ink-3">
              Sessions last 30 days. Suspending an account or changing a password signs every device out.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="pt-5">
          <div className="surface-card divide-y divide-line rounded-lg">
            {[
              { key: "productUpdates", label: "Product updates", desc: "When an item you own gets a new version" },
              { key: "receipts", label: "Receipts and invoices", desc: "Purchase confirmations and annual summaries" },
              { key: "commentReplies", label: "Author replies", desc: "When a studio replies to your review or message" },
              { key: "journal", label: "Journal posts", desc: "Roughly twice a month, never more" },
              { key: "promotions", label: "Promotions", desc: "Occasional discounts and bundle offers" },
            ].map((n) => (
              <div key={n.key} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div>
                  <p className="text-[0.8125rem] font-medium">{n.label}</p>
                  <p className="text-[0.6875rem] text-ink-3">{n.desc}</p>
                </div>
                <Switch
                  checked={prefs[n.key as keyof typeof prefs]}
                  onCheckedChange={(v) => setPrefs((p) => ({ ...p, [n.key]: v }))}
                />
              </div>
            ))}
          </div>
          <p className="mt-3 text-[0.6875rem] text-ink-3">
            Transactional email (receipts, license keys) can’t be turned off.
          </p>
        </TabsContent>

        <TabsContent value="billing" className="pt-5 space-y-5">
          <div className="surface-card rounded-lg p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-13 place-items-center rounded border border-line bg-surface-2 font-mono text-[0.5625rem]">
                  VISA
                </span>
                <div>
                  <p className="text-[0.8125rem] font-medium">Visa •••• 4242</p>
                  <p className="text-[0.625rem] text-ink-3">Expires 09/29 · default payment method</p>
                </div>
              </div>
              <Button size="sm" variant="outline">
                Update
              </Button>
            </div>
            <Button size="sm" variant="ghost" className="mt-3">
              + Add payment method
            </Button>
          </div>

          <div className="rounded-lg border border-red-200 bg-red-50/60 p-5 dark:border-red-950 dark:bg-red-950/20">
            <h3 className="flex items-center gap-2 text-[0.9375rem] font-medium text-red-800 dark:text-red-300">
              <Trash2 className="size-4" /> Delete account
            </h3>
            <p className="mt-1 text-[0.75rem] leading-relaxed text-red-800/80 dark:text-red-300/70">
              Licenses stay valid, but you lose access to downloads and invoices. This can’t be undone.
            </p>
            <Button size="sm" variant="danger" className="mt-3">
              Request deletion
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

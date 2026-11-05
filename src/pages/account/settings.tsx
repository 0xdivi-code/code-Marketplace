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

  // Password change happens in place; the server needs the current password.
  const [pwOpen, setPwOpen] = React.useState(false);
  const [pw, setPw] = React.useState({ current: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy] = React.useState(false);

  const pwRules = [
    { label: "At least 10 characters", ok: pw.next.length >= 10 },
    { label: "One uppercase letter", ok: /[A-Z]/.test(pw.next) },
    { label: "One number", ok: /\d/.test(pw.next) },
    { label: "New passwords match", ok: pw.next.length > 0 && pw.next === pw.confirm },
  ];
  const pwValid = pwRules.every((r) => r.ok) && pw.current.length > 0;

  function resetPwForm() {
    setPw({ current: "", next: "", confirm: "" });
    setPwOpen(false);
  }

  async function savePassword() {
    if (!pwValid || pwBusy) return;
    setPwBusy(true);
    try {
      await authApi.changePassword(pw.current, pw.next);
      toast.success("Password changed", { description: "Every other device has been signed out." });
      resetPwForm();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not change your password.");
    } finally {
      setPwBusy(false);
    }
  }

  // Two-factor: enrol with an authenticator app, or turn it back off.
  const [tf, setTf] = React.useState<{
    enabled: boolean;
    recoveryCodesLeft: number;
  } | null>(null);
  const [tfSetup, setTfSetup] = React.useState<{ secret: string; uri: string } | null>(null);
  const [tfCode, setTfCode] = React.useState("");
  const [tfBusy, setTfBusy] = React.useState(false);
  const [tfOff, setTfOff] = React.useState(false);
  const [tfPassword, setTfPassword] = React.useState("");
  const [recovery, setRecovery] = React.useState<string[] | null>(null);

  React.useEffect(() => {
    let live = true;
    api
      .get<{ enabled: boolean; enabledAt: string | null; recoveryCodesLeft: number }>("/auth/2fa")
      .then((r) => live && setTf({ enabled: r.enabled, recoveryCodesLeft: r.recoveryCodesLeft }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  async function startTwoFactor() {
    setTfBusy(true);
    try {
      const r = await api.post<{ secret: string; uri: string }>("/auth/2fa/setup");
      setTfSetup(r);
      setTfCode("");
      setRecovery(null);
      setTfOff(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not start two-factor setup.");
    } finally {
      setTfBusy(false);
    }
  }

  async function confirmTwoFactor() {
    if (tfCode.trim().length !== 6 || tfBusy) {
      toast.error("Enter the six-digit code your app shows.");
      return;
    }
    setTfBusy(true);
    try {
      const r = await api.post<{ recoveryCodes: string[] }>("/auth/2fa/enable", {
        code: tfCode.trim(),
      });
      setRecovery(r.recoveryCodes);
      setTfSetup(null);
      setTfCode("");
      setTf({ enabled: true, recoveryCodesLeft: r.recoveryCodes.length });
      toast.success("Two-factor is on", { description: "Save your recovery codes somewhere safe." });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That code did not work.");
    } finally {
      setTfBusy(false);
    }
  }

  async function disableTwoFactor() {
    if (!tfPassword || tfBusy) return;
    setTfBusy(true);
    try {
      await api.post("/auth/2fa/disable", { password: tfPassword });
      setTf({ enabled: false, recoveryCodesLeft: 0 });
      setTfOff(false);
      setTfPassword("");
      setRecovery(null);
      setTfSetup(null);
      toast.success("Two-factor is off");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not turn two-factor off.");
    } finally {
      setTfBusy(false);
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
                  {pwOpen
                    ? "Enter your current password, then choose a new one."
                    : "Changing it signs you out everywhere else."}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => (pwOpen ? resetPwForm() : setPwOpen(true))}
              >
                {pwOpen ? "Cancel" : "Change password"}
              </Button>
            </div>

            {pwOpen && (
              <div className="mt-4 space-y-3 border-t border-line pt-4">
                <Field label="Current password" htmlFor="pw-current">
                  <Input
                    id="pw-current"
                    type="password"
                    autoComplete="current-password"
                    value={pw.current}
                    onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
                  />
                </Field>
                <Field label="New password" htmlFor="pw-next">
                  <Input
                    id="pw-next"
                    type="password"
                    autoComplete="new-password"
                    value={pw.next}
                    onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                  />
                </Field>
                <Field label="Repeat new password" htmlFor="pw-confirm">
                  <Input
                    id="pw-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={pw.confirm}
                    onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                  />
                </Field>
                {pw.next.length > 0 && (
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {pwRules.map((r) => (
                      <li
                        key={r.label}
                        className={cn(
                          "flex items-center gap-1.5 text-[0.6875rem]",
                          r.ok ? "text-ink-2" : "text-ink-3",
                        )}
                      >
                        <Check
                          className={cn("size-3", r.ok ? "text-ink" : "text-ink-3/40")}
                          strokeWidth={3}
                        />
                        {r.label}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" onClick={() => void savePassword()} disabled={!pwValid || pwBusy}>
                    {pwBusy ? "Saving…" : "Save new password"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      resetPwForm();
                      if (user?.email) void authApi.forgot(user.email).then(
                        () => toast.success("Reset link sent", { description: `Check ${user.email}.` }),
                        () => toast.error("Could not send the reset link."),
                      );
                    }}
                    className="text-[0.75rem] text-ink-2 underline-offset-2 hover:text-ink hover:underline"
                  >
                    Email me a reset link instead
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="surface-card rounded-lg p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[0.9375rem] font-medium">Two-factor authentication</h3>
                <p className="mt-0.5 text-[0.75rem] text-ink-2">
                  {tf?.enabled
                    ? `On. ${tf.recoveryCodesLeft} recovery code${tf.recoveryCodesLeft === 1 ? "" : "s"} left.`
                    : "Ask for a code from your authenticator app at sign-in."}
                </p>
              </div>
              <Badge variant={tf?.enabled ? "brand" : "warn"} size="md">
                {tf?.enabled ? "Enabled" : "Not enabled"}
              </Badge>
            </div>

            {recovery && (
              <div className="mt-4 rounded-md border border-line bg-surface-2 p-4">
                <p className="text-[0.75rem] font-medium">Your recovery codes</p>
                <p className="mt-0.5 text-[0.6875rem] text-ink-2">
                  Each one works once if you lose your phone. They will not be shown again.
                </p>
                <ul className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-[0.75rem] tracking-wider">
                  {recovery.map((code) => (
                    <li key={code} className="rounded-sm bg-surface px-2 py-1 text-center">
                      {code}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setRecovery(null)}
                  className="mt-3 text-[0.75rem] text-ink-2 underline underline-offset-2 hover:text-ink"
                >
                  I have saved them
                </button>
              </div>
            )}

            {tfSetup && !recovery && (
              <div className="mt-4 space-y-3 border-t border-line pt-4">
                <p className="text-[0.75rem] text-ink-2">
                  Add this key to your authenticator app, then enter the code it shows.
                </p>
                <div className="rounded-md border border-line bg-surface-2 px-3 py-2">
                  <p className="text-[0.625rem] uppercase tracking-[0.16em] text-ink-3">Setup key</p>
                  <p className="mt-0.5 break-all font-mono text-[0.8125rem] tracking-wider">
                    {tfSetup.secret}
                  </p>
                </div>
                <Field label="Six-digit code" htmlFor="tf-code">
                  <Input
                    id="tf-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={tfCode}
                    onChange={(e) => setTfCode(e.target.value)}
                    placeholder="123456"
                    className="font-mono tracking-[0.2em]"
                  />
                </Field>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => void confirmTwoFactor()} disabled={tfBusy}>
                    {tfBusy ? "Checking…" : "Turn on two-factor"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setTfSetup(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {tfOff && (
              <div className="mt-4 space-y-3 border-t border-line pt-4">
                <Field label="Confirm your password" htmlFor="tf-password">
                  <Input
                    id="tf-password"
                    type="password"
                    autoComplete="current-password"
                    value={tfPassword}
                    onChange={(e) => setTfPassword(e.target.value)}
                  />
                </Field>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => void disableTwoFactor()}
                    disabled={tfBusy || !tfPassword}
                  >
                    {tfBusy ? "Turning off…" : "Turn off two-factor"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setTfOff(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {!tfSetup && !tfOff && !recovery && (
              <Button
                size="sm"
                className="mt-3"
                variant={tf?.enabled ? "ghost" : "primary"}
                onClick={() => (tf?.enabled ? setTfOff(true) : void startTwoFactor())}
                disabled={tfBusy || tf === null}
              >
                {tf?.enabled ? "Turn off two-factor" : "Enable 2FA"}
              </Button>
            )}
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

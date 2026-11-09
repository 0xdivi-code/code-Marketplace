import * as React from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field, Checkbox } from "@/components/ui/field";
import { KilnMark } from "@/components/site/logo";
import { authApi, ApiError } from "@/lib/api";
import { toast } from "sonner";

/**
 * Staff sign-in.
 *
 * The password and the second factor are checked in the same request: when 2FA
 * is enrolled the server answers `needTotp` and no session cookie is minted
 * until a valid code arrives.
 */
export function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const next = (location.state as { from?: string } | null)?.from ?? "/admin";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [totp, setTotp] = React.useState("");
  const [needTotp, setNeedTotp] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [remember, setRemember] = React.useState(true);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const user = await authApi.adminLogin(email.trim(), password, needTotp ? totp.trim() : undefined);
      toast.success(`Welcome back, ${user.name.split(" ")[0]}`);
      navigate(next, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401 && /two-factor|code/i.test(err.message)) {
          setNeedTotp(true);
          toast.error(err.message);
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error("Could not reach the server.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh bg-paper text-ink lg:grid-cols-[1fr_480px]">
      {/* left: quiet brand panel, matching the storefront's editorial voice */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand p-10 text-brand-ink lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 15%, #DFE9DC 0, transparent 45%), radial-gradient(circle at 85% 80%, #C0592B 0, transparent 40%)",
          }}
        />
        <Link to="/" className="relative flex items-center gap-2.5 text-brand-ink">
          <KilnMark className="size-5" />
          <span className="font-display text-lg tracking-tight">Kiln</span>
          <span className="ml-2 rounded-sm border border-brand-ink/25 px-1.5 py-0.5 text-[0.5625rem] uppercase tracking-[0.18em] text-brand-ink/70">
            Console
          </span>
        </Link>

        <div className="relative max-w-sm">
          <p className="font-display text-3xl leading-[1.15] tracking-tight">
            One studio. One catalogue. Everything published from here.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-brand-ink/70">
            Source packages, versions and licences are served only through short-lived signed links. This console is
            restricted to the studio owner.
          </p>
        </div>

        <div className="relative flex items-center gap-2 text-[0.6875rem] text-brand-ink/55">
          <ShieldCheck className="size-3.5" />
          Admin sessions expire after 8 hours. Two-factor is required once enrolled.
        </div>
      </div>

      {/* right: the form */}
      <div className="flex flex-col justify-center px-6 py-14 sm:px-12">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32 }}>
          <Link
            to="/"
            className="mb-10 inline-flex items-center gap-1.5 text-[0.75rem] text-ink-3 transition-colors hover:text-ink lg:hidden"
          >
            <ArrowLeft className="size-3.5" /> Back to store
          </Link>

          <h1 className="font-display text-[1.75rem] leading-tight tracking-tight">Sign in to the console</h1>
          <p className="mt-2 text-sm text-ink-3">
            Staff access only. Customers sign in{" "}
            <Link to="/login" className="text-accent-ink underline decoration-accent/30 underline-offset-2 hover:decoration-accent">
              here
            </Link>
            .
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Email" htmlFor="admin-email">
              <Input
                id="admin-email"
                type="email"
                autoComplete="username"
                required
                placeholder="owner@kiln.dev"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>

            <Field label="Password" htmlFor="admin-password">
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            {needTotp && (
              <Field label="Two-factor code" htmlFor="admin-totp" hint="Six digits from your authenticator, or a recovery code.">
                <Input
                  id="admin-totp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  placeholder="000000"
                  value={totp}
                  onChange={(e) => setTotp(e.target.value)}
                  className="font-mono tracking-[0.3em]"
                />
              </Field>
            )}

            <label className="flex items-center gap-2 text-[0.8125rem] text-ink-2">
              <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
              Keep me signed in on this device
            </label>

            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              {needTotp ? "Verify and continue" : "Sign in"}
            </Button>
          </form>

          <div className="mt-8 rounded-md border border-line bg-surface p-3.5">
            <p className="text-[0.6875rem] uppercase tracking-[0.16em] text-ink-3">Demo owner account</p>
            <p className="mt-1.5 font-mono text-[0.75rem] text-ink-2">owner@kiln.dev</p>
            <p className="font-mono text-[0.75rem] text-ink-2">kiln-owner-demo-2026</p>
            <p className="mt-1.5 text-[0.6875rem] text-ink-3">
              Two-factor is set up on first sign-in from Settings → Security.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default AdminLogin;

import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Check, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { AuthShell } from "./auth-shell";
import { cn } from "@/lib/utils";
import { authApi, ApiError } from "@/lib/api";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [done, setDone] = React.useState(false);

  // Keep these in step with the server rule (10 characters minimum).
  const rules = [
    { label: "At least 10 characters", ok: password.length >= 10 },
    { label: "One uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "One number", ok: /\d/.test(password) },
    { label: "Passwords match", ok: password.length > 0 && password === confirm },
  ];
  const valid = rules.every((r) => r.ok);

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Your reset link is valid for 30 minutes. After saving you’ll be signed in on this device."
      footer={
        <Link to="/login" className="hover:text-ink">
          Return to sign in
        </Link>
      }
    >
      {done ? (
        <div className="rounded-md border border-line bg-surface p-5 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-brand text-brand-ink">
            <Check className="size-5" strokeWidth={3} />
          </div>
          <p className="mt-3 font-display text-lg">Password updated</p>
          <p className="mt-1 text-[0.8125rem] text-ink-2">Other sessions have been signed out.</p>
          <Button size="sm" className="mt-4" onClick={() => navigate("/account")}>
            Go to your library
          </Button>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid || busy) return;
            if (!token) {
              setError("This page needs a reset link. Request a new one from the sign-in screen.");
              return;
            }
            setBusy(true);
            setError(null);
            try {
              await authApi.reset(token, password);
              setDone(true);
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "Could not reach the server.");
            } finally {
              setBusy(false);
            }
          }}
          className="space-y-4"
        >
          <Field label="New password" htmlFor="password">
            <div className="relative">
              <Input
                id="password"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
                aria-label="Toggle password"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          <Field label="Confirm password" htmlFor="confirm">
            <Input
              id="confirm"
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <ul className="space-y-1.5 rounded-sm bg-surface-2/60 p-3">
            {rules.map((r) => (
              <li
                key={r.label}
                className={cn(
                  "flex items-center gap-2 text-[0.6875rem] transition-colors",
                  r.ok ? "text-positive" : "text-ink-3",
                )}
              >
                <Check className={cn("size-3", !r.ok && "opacity-30")} strokeWidth={3} />
                {r.label}
              </li>
            ))}
          </ul>
          {error && (
            <p role="alert" className="text-[0.75rem] text-[#a3381a]">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={!valid || busy}>
            Save password <ArrowRight className="size-4" />
          </Button>
          <p className="flex items-center gap-1.5 text-[0.625rem] text-ink-3">
            <ShieldCheck className="size-3" /> Sessions on other devices will be revoked.
          </p>
        </form>
      )}
    </AuthShell>
  );
}

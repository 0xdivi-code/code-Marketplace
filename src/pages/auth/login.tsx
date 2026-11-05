import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Checkbox } from "@/components/ui/field";
import { AuthShell } from "./auth-shell";
import { toast } from "sonner";
import { authApi, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

const demo = [{ label: "Customer", email: "marcus@brightlane.io", note: "library, orders, wishlist" }];

export default function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [remember, setRemember] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.includes("@") || password.length < 1) {
      setError("Use a valid email and your password.");
      return;
    }
    setLoading(true);
    try {
      const user = await authApi.login(email.trim(), password);
      toast.success(`Welcome back, ${user.name.split(" ")[0]}`);
      navigate("/account");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to download your purchases, manage licenses and pick up where you left off."
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="font-medium underline underline-offset-2 hover:text-ink">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {demo.map((d) => (
            <button
              key={d.email}
              type="button"
              onClick={() => setEmail(d.email)}
              className="rounded-md border border-line p-2.5 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
            >
              <p className="text-[0.6875rem] font-medium">{d.label}</p>
              <p className="truncate font-mono text-[0.5625rem] text-ink-3">{d.email}</p>
            </button>
          ))}
        </div>

        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@studio.com"
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={error}
        >
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-[0.75rem] text-ink-2">
            <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
            Keep me signed in
          </label>
          <Link
            to="/forgot-password"
            className="text-[0.75rem] text-ink-2 underline underline-offset-2 hover:text-ink"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Signing in…
            </>
          ) : (
            <>
              Sign in <ArrowRight className="size-4" />
            </>
          )}
        </Button>

        <div className="rounded-sm border border-line bg-surface-2 px-3 py-2.5">
          <p className="text-[0.625rem] uppercase tracking-[0.16em] text-ink-3">Demo customer</p>
          <button
            type="button"
            onClick={() => {
              setEmail("marcus@brightlane.io");
              setPassword("demo1234");
            }}
            className="mt-1 text-left text-[0.75rem] text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink"
          >
            marcus@brightlane.io / demo1234
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

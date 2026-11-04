import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Checkbox } from "@/components/ui/field";
import { AuthShell } from "./auth-shell";
import { useSession } from "@/lib/store";
import { toast } from "sonner";

const demo = [
  { label: "Customer", email: "buyer@kiln.dev", note: "library, orders, wishlist" },
  { label: "Admin", email: "admin@kiln.dev", note: "full console access" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useSession();
  const [email, setEmail] = React.useState("buyer@kiln.dev");
  const [password, setPassword] = React.useState("demo1234");
  const [show, setShow] = React.useState(false);
  const [remember, setRemember] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.includes("@") || password.length < 6) {
      setError("Use a valid email and at least 6 characters.");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    const role = email.includes("admin") ? "admin" : "customer";
    signIn(email, role);
    setLoading(false);
    toast.success("Welcome back");
    navigate(role === "admin" ? "/admin" : "/account");
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

        <div className="relative py-1 text-center">
          <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
          <span className="relative bg-paper px-3 text-[0.625rem] uppercase tracking-wider text-ink-3">
            or continue with
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={() => { signIn("buyer@kiln.dev", "customer"); navigate("/account"); }}>
            <Code2 className="size-4" /> GitHub
          </Button>
          <Button type="button" variant="outline" onClick={() => { signIn("buyer@kiln.dev", "customer"); navigate("/account"); }}>
            <span className="font-semibold text-[0.8125rem]">G</span> Google
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}

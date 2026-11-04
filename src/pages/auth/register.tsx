import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Checkbox } from "@/components/ui/field";
import { AuthShell } from "./auth-shell";
import { useSession } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { signIn } = useSession();
  const [form, setForm] = React.useState({ name: "", email: "", password: "" });
  const [show, setShow] = React.useState(false);
  const [terms, setTerms] = React.useState(false);
  const [created, setCreated] = React.useState(false);

  const strength = React.useMemo(() => {
    const p = form.password;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  }, [form.password]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terms) return;
    await new Promise((r) => setTimeout(r, 600));
    signIn(form.email || "new@kiln.dev", "customer");
    setCreated(true);
    toast.success("Account created", { description: "Welcome to Kiln." });
    setTimeout(() => navigate("/account"), 900);
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Buy once, keep it forever. Licenses, downloads and invoices live in your library."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium underline underline-offset-2 hover:text-ink">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name" htmlFor="name">
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Amara Okafor"
            required
          />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="you@studio.com"
            required
          />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters, one number">
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="pr-10"
              required
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
          {form.password && (
            <div className="flex gap-1 pt-1.5">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    i < strength
                      ? strength >= 3
                        ? "bg-emerald-500"
                        : "bg-amber-500"
                      : "bg-line",
                  )}
                />
              ))}
            </div>
          )}
        </Field>

        <label className="flex cursor-pointer items-start gap-2.5 text-[0.75rem] leading-relaxed text-ink-2">
          <Checkbox
            className="mt-0.5"
            checked={terms}
            onCheckedChange={(v) => setTerms(v === true)}
          />
          <span>
            I agree to the{" "}
            <Link to="/page/terms" className="underline underline-offset-2 hover:text-ink">
              terms
            </Link>{" "}
            and{" "}
            <Link to="/page/privacy" className="underline underline-offset-2 hover:text-ink">
              privacy policy
            </Link>
            .
          </span>
        </label>

        <Button type="submit" size="lg" className="w-full" disabled={!terms || created}>
          {created ? (
            <>
              <Check className="size-4" /> Account created
            </>
          ) : (
            <>
              Create account <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>
    </AuthShell>
  );
}

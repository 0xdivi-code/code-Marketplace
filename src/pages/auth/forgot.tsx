import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MailCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { AuthShell } from "./auth-shell";
import { authApi, ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email.includes("@")) {
      setError("Enter the email you signed up with.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await authApi.forgot(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title={sent ? "Check your inbox" : "Reset your password"}
      subtitle={
        sent
          ? `If an account exists for ${email}, a reset link is on its way. It expires in 30 minutes.`
          : "Enter the email you use for Kiln and we’ll send a reset link."
      }
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 hover:text-ink">
          <ArrowLeft className="size-3.5" /> Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-md border border-line bg-surface p-5 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-sage/70">
            <MailCheck className="size-5 text-accent-ink" />
          </div>
          <p className="mt-3 text-[0.8125rem] text-ink-2">
            Didn’t arrive? Check spam, or resend in a minute.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setSent(false)}>
            Use a different email
          </Button>
          <p className="mt-3 text-[0.6875rem] text-ink-3">
            In development the link is printed to the server console and appended to{" "}
            <span className="font-mono">.data/mail.log</span>.
          </p>
        </div>
      ) : (
        <form onSubmit={send} className="space-y-4">
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@studio.com"
            />
          </Field>
          {error && (
            <p role="alert" className="text-[0.75rem] text-[#a3381a]">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            <Send className="size-4" /> {busy ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

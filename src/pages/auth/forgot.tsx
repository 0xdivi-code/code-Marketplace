import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MailCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { AuthShell } from "./auth-shell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);

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
            <MailCheck className="size-5 text-[#2c4331]" />
          </div>
          <p className="mt-3 text-[0.8125rem] text-ink-2">
            Didn’t arrive? Check spam, or resend in a minute.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setSent(false)}>
            Use a different email
          </Button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
          className="space-y-4"
        >
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
          <Button type="submit" size="lg" className="w-full">
            <Send className="size-4" /> Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Check, MailWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthShell } from "./auth-shell";
import { authApi, ApiError, refreshAuth } from "@/lib/api";

/**
 * Landing page for the emailed verification link.
 *
 * The token is single use and short lived; a bad or already-used link explains
 * itself instead of failing silently.
 */
export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = React.useState<"working" | "done" | "failed">("working");
  const [message, setMessage] = React.useState("");

  // A verification token is single-use, so the request must fire exactly once —
  // StrictMode's double-invoke in development would otherwise burn it and then
  // show the "already used" error over a perfectly good success.
  const attempted = React.useRef(false);

  React.useEffect(() => {
    if (!token) {
      setState("failed");
      setMessage("This link is missing its token. Open the link from your inbox again.");
      return;
    }
    if (attempted.current) return;
    attempted.current = true;
    let alive = true;
    authApi
      .verify(token)
      .then(async () => {
        await refreshAuth(true);
        if (alive) setState("done");
      })
      .catch((err) => {
        if (!alive) return;
        setState("failed");
        setMessage(err instanceof ApiError ? err.message : "We could not verify that link.");
      });
    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <AuthShell
      title={state === "done" ? "Email verified" : state === "failed" ? "That link didn’t work" : "Verifying your email"}
      subtitle={
        state === "done"
          ? "Your account is confirmed. Receipts and licence keys will arrive at this address."
          : state === "failed"
            ? message
            : "One moment while we check the token."
      }
      footer={
        <Link to="/account" className="inline-flex items-center gap-1.5 hover:text-ink">
          Go to your library <ArrowRight className="size-3.5" />
        </Link>
      }
    >
      <div className="rounded-md border border-line bg-surface p-5 text-center">
        {state === "working" && (
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-surface-2">
            <span className="size-4 animate-spin rounded-full border-2 border-line-strong border-t-ink" />
          </div>
        )}
        {state === "done" && (
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-brand text-brand-ink">
            <Check className="size-5" strokeWidth={3} />
          </div>
        )}
        {state === "failed" && (
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-accent-soft text-accent-ink">
            <MailWarning className="size-5" />
          </div>
        )}

        <p className="mt-3 text-[0.8125rem] text-ink-2">
          {state === "done"
            ? "Nothing else is required."
            : state === "failed"
              ? "Verification links expire after 24 hours and can only be used once."
              : "This usually takes under a second."}
        </p>

        {state === "done" && (
          <Button size="sm" className="mt-4" asChild>
            <Link to="/browse">Browse the catalogue</Link>
          </Button>
        )}
        {state === "failed" && (
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link to="/login">Back to sign in</Link>
          </Button>
        )}
      </div>
    </AuthShell>
  );
}

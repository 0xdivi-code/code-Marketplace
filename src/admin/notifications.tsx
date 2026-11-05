import * as React from "react";
import { Mail, RefreshCw, Send, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { PageHeader } from "./admin-layout";
import { Panel, Stat } from "./ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

interface Notification {
  id: string;
  toEmail: string;
  template: string;
  subject: string;
  status: "sent" | "failed" | "skipped";
  transport: string;
  error: string | null;
  createdAt: string;
}

interface Payload {
  notifications: Notification[];
  counts: { sent: number; failed: number; skipped: number };
  transport: "resend" | "smtp" | "log";
}

const TEMPLATE_LABEL: Record<string, string> = {
  verify_email: "Verify email",
  reset_password: "Password reset",
  order_receipt: "Order receipt",
  payment_confirmed: "Payment confirmed",
  download_ready: "Download link",
  refund_processed: "Refund",
  product_update: "Product update",
};

/** How each transport behaves, shown so nobody ships with the dev logger. */
const TRANSPORT_COPY: Record<Payload["transport"], { label: string; tone: string; note: string }> = {
  resend: {
    label: "Resend",
    tone: "good",
    note: "Production. Messages are delivered through the Resend API.",
  },
  smtp: {
    label: "SMTP bridge",
    tone: "good",
    note: "Messages POST to your SMTP relay endpoint.",
  },
  log: {
    label: "Development log",
    tone: "warn",
    note: "Nothing is delivered. Set RESEND_API_KEY (or SMTP_URL) before launch.",
  },
};

export default function AdminNotifications() {
  const [data, setData] = React.useState<Payload | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.get<Payload>("/admin/notifications?limit=100"));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const transport = data ? TRANSPORT_COPY[data.transport] : null;

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Every transactional email, whether it was delivered or not."
        actions={
          <Button size="xs" variant="outline" className="h-8" onClick={() => void load()}>
            <RefreshCw className="size-3" /> Refresh
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sent" value={(data?.counts.sent ?? 0).toLocaleString()} icon={Send} tone="good" />
        <Stat label="Failed" value={(data?.counts.failed ?? 0).toLocaleString()} icon={XCircle} tone={data?.counts.failed ? "warn" : undefined} />
        <Stat label="Skipped" value={(data?.counts.skipped ?? 0).toLocaleString()} icon={Mail} hint="turned off in settings" />
        <Stat
          label="Transport"
          value={transport?.label ?? "—"}
          icon={data?.transport === "log" ? ShieldAlert : ShieldCheck}
          tone={transport?.tone as never}
        />
      </div>

      {transport && (
        <div
          className={
            "mt-3 flex items-start gap-2.5 rounded-lg border px-4 py-3 text-[0.8125rem] " +
            (data?.transport === "log"
              ? "border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
              : "border-line bg-surface text-ink-2")
          }
        >
          {data?.transport === "log" ? (
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          ) : (
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          )}
          <p>{transport.note}</p>
        </div>
      )}

      <Panel
        title="Outbox"
        description="Most recent first"
        className="mt-3"
        bodyClassName=""
      >
        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-ink-3">Loading…</p>
        ) : !data?.notifications.length ? (
          <div className="px-4 py-12 text-center">
            <Mail className="mx-auto size-5 text-ink-3" />
            <p className="mt-3 text-sm font-medium">No email sent yet</p>
            <p className="mt-1 text-[0.8125rem] text-ink-3">
              Welcome, receipt, refund and product-update emails will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {["Template", "Recipient", "Subject", "Transport", "Status", "When"].map((h, i) => (
                    <th
                      key={h}
                      className={
                        "label-mono px-4 py-1.5 text-[0.4375rem] text-ink-3 " +
                        (i === 5 ? "text-right" : "") +
                        (i === 3 ? "hidden sm:table-cell" : "")
                      }
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.notifications.map((n) => (
                  <tr key={n.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2/40">
                    <td className="px-4 py-2.5">
                      <Badge variant="neutral" size="sm">
                        {TEMPLATE_LABEL[n.template] ?? n.template}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-[0.6875rem]">{n.toEmail}</td>
                    <td className="max-w-[280px] truncate px-4 py-2.5 text-[0.6875rem] text-ink-2">
                      {n.subject}
                      {n.error && <span className="ml-2 text-red-600">{n.error}</span>}
                    </td>
                    <td className="hidden px-4 py-2.5 font-mono text-[0.625rem] text-ink-3 sm:table-cell">
                      {n.transport}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant={n.status === "sent" ? "accent" : n.status === "failed" ? "warn" : "neutral"}
                        size="sm"
                      >
                        {n.status}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-[0.625rem] text-ink-3">
                      {new Date(n.createdAt).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

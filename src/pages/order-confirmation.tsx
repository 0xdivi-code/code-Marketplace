import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Check,
  Download,
  ArrowRight,
  Mail,
  Copy,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Wallet,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { money } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { QrCode } from "@/components/ui/qr-code";
import { toast } from "sonner";

/** The shape `/api/account/orders/:number` returns. */
interface OrderResponse {
  order: {
    number: string;
    status: string;
    email: string;
    subtotal: number;
    discount: number;
    total: number;
    currency: string;
    createdAt: string;
    paidAt?: string | null;
    reference?: string | null;
    items: {
      productSlug: string;
      productName: string;
      license: string;
      unitPrice: number;
    }[];
  };
}

interface PaymentState {
  payment: {
    status: string;
    payCurrency: string;
    payAmount: string | null;
    payAddress: string | null;
    invoiceUrl: string | null;
    network: string | null;
    expiresAt: string | null;
    sandbox: boolean;
  } | null;
}

type Phase = "loading" | "waiting" | "confirming" | "paid" | "expired" | "failed" | "refunded" | "cancelled";

/** USDT/USDC amounts want two decimals; BTC and friends want more. */
const formatCrypto = (amount: string | null, currency: string) => {
  if (!amount) return "—";
  const stable = /usdt|usdc|dai|busd/i.test(currency);
  return stable ? Number(amount).toFixed(2) : Number(amount).toFixed(6);
};

const coinLabel = (code: string) => code.replace(/usdt(\w+)/i, "USDT").replace(/usdc(\w+)/i, "USDC").toUpperCase();

export default function OrderConfirmationPage() {
  const { id = "" } = useParams();
  const [order, setOrder] = React.useState<OrderResponse["order"] | null>(null);
  const [payment, setPayment] = React.useState<PaymentState["payment"]>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<"address" | "amount" | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [remaining, setRemaining] = React.useState<number | null>(null);

  const load = React.useCallback(async () => {
    try {
      const [o, p] = await Promise.all([
        api.get<OrderResponse>(`/account/orders/${encodeURIComponent(id)}`),
        api.get<PaymentState>(`/account/orders/${encodeURIComponent(id)}/payment`).catch(() => ({ payment: null })),
      ]);
      setOrder(o.order);
      setPayment(p.payment);
      return o.order;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We could not load that order.");
      return null;
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const phase: Phase = !order
    ? "loading"
    : order.status === "paid"
      ? "paid"
      : order.status === "refunded"
        ? "refunded"
        : order.status === "cancelled"
          ? "expired"
          : payment?.status === "partially_paid"
            ? "failed"
            : payment?.status === "expired" || payment?.status === "failed"
              ? (payment.status as Phase)
              : payment?.status === "confirming"
                ? "confirming"
                : "waiting";

  /**
   * Poll while the invoice is open. This is a convenience, not the source of
   * truth: the endpoint asks the gateway server-to-server, and only a verified
   * amount can flip an order to paid.
   */
  React.useEffect(() => {
    if (phase !== "waiting" && phase !== "confirming") return;
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      const next = await load();
      if (next?.status === "paid") toast.success("Payment confirmed", { description: "Downloads unlocked." });
    };
    const timer = window.setInterval(tick, 7000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [phase, load]);

  // Countdown for the invoice window.
  React.useEffect(() => {
    if (!payment?.expiresAt) return;
    const deadline = new Date(payment.expiresAt).getTime();
    const tick = () => setRemaining(Math.max(0, deadline - Date.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [payment?.expiresAt]);

  const copy = async (text: string, which: "address" | "amount") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      toast.error("Could not copy — select the text manually.");
    }
  };

  const checkNow = async () => {
    setChecking(true);
    try {
      const res = await api.get<{ order: { status: string }; reconciled: boolean }>(
        `/account/orders/${encodeURIComponent(id)}/payment`,
      );
      await load();
      if (res.order.status === "paid") toast.success("Payment confirmed");
      else toast.message("Not confirmed yet", { description: "Still waiting on the network." });
    } catch {
      toast.error("Could not check the payment right now.");
    } finally {
      setChecking(false);
    }
  };

  if (error) {
    return (
      <div className="container-x py-24 text-center">
        <h1 className="text-[1.75rem]">Order not found</h1>
        <p className="mt-2 text-sm text-ink-2">{error}</p>
        <Button asChild className="mt-5">
          <Link to="/account/orders">Go to your orders</Link>
        </Button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container-x py-24 text-center text-sm text-ink-3">
        <Loader2 className="mx-auto size-5 animate-spin" />
        <p className="mt-3">Loading your order…</p>
      </div>
    );
  }

  const address = payment?.payAddress ?? "";
  const amount = formatCrypto(payment?.payAmount ?? null, payment?.payCurrency ?? "");

  return (
    <div className="container-x max-w-4xl py-12">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label-mono text-[0.5625rem] text-ink-3">Order</p>
          <h1 className="mt-1 font-display text-[2rem] leading-none tracking-[-0.02em]">{order.number}</h1>
          <p className="mt-2 text-[0.8125rem] text-ink-2">
            {order.email} · {new Date(order.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <PhaseBadge phase={phase} />
      </div>

      {phase === "paid" && <PaidPanel order={order} />}

      {phase === "refunded" && (
        <Notice
          tone="warn"
          icon={<AlertTriangle className="size-5" />}
          title="This order was refunded"
          body="The licences granted by this order have been revoked and its downloads are closed. If you believe this is wrong, reply to the refund email."
        />
      )}

      {phase === "expired" && (
        <Notice
          tone="warn"
          icon={<Clock className="size-5" />}
          title="This invoice expired"
          body="Nothing was charged. Rates lock for one hour, so an unpaid invoice closes rather than letting the price drift. Start again from your cart to get a fresh rate."
          action={
            <Button asChild size="sm" className="mt-4">
              <Link to="/cart">Back to cart</Link>
            </Button>
          }
        />
      )}

      {phase === "failed" && (
        <Notice
          tone="bad"
          icon={<AlertTriangle className="size-5" />}
          title="The amount received was short"
          body="The gateway reports less than the invoice total, so the order stays locked. Nothing is lost — send the shortfall to the same address within the window, or reply to the invoice email and we will sort it out by hand."
          action={
            <Button size="sm" variant="outline" className="mt-4" onClick={checkNow} disabled={checking}>
              <RefreshCw className={checking ? "size-3.5 animate-spin" : "size-3.5"} /> Check again
            </Button>
          }
        />
      )}

      {(phase === "waiting" || phase === "confirming") && payment && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="grid gap-6 md:grid-cols-[1fr_260px]">
            <div className="rounded-lg border border-line bg-surface">
              <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Wallet className="size-4 text-ink-3" />
                  <p className="text-[0.8125rem] font-medium">
                    Send {amount} {coinLabel(payment.payCurrency)}
                  </p>
                </div>
                {remaining != null && (
                  <span className="flex items-center gap-1.5 font-mono text-[0.6875rem] text-ink-3">
                    <Clock className="size-3" />
                    {Math.floor(remaining / 60000)}:{String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0")}
                  </span>
                )}
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <p className="label-mono text-[0.5rem] text-ink-3">Network</p>
                  <p className="mt-1 text-[0.8125rem]">{payment.network ?? "—"}</p>
                  <p className="mt-1 text-[0.6875rem] text-ink-3">
                    Send only {coinLabel(payment.payCurrency)} on this network. Funds sent on another chain
                    are unrecoverable.
                  </p>
                </div>

                <div>
                  <p className="label-mono text-[0.5rem] text-ink-3">Amount</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="font-mono text-[1.05rem]">{amount} {coinLabel(payment.payCurrency)}</p>
                    <button
                      onClick={() => void copy(payment.payAmount ?? "", "amount")}
                      className="rounded p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                      aria-label="Copy amount"
                    >
                      {copied === "amount" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    </button>
                  </div>
                  <p className="mt-0.5 text-[0.6875rem] text-ink-3">≈ {money(order.total)} USD · rate locked</p>
                </div>

                <div>
                  <p className="label-mono text-[0.5rem] text-ink-3">Deposit address</p>
                  <div className="mt-1 flex items-start gap-2 rounded-md border border-line bg-surface-2 p-3">
                    <code className="min-w-0 flex-1 break-all font-mono text-[0.75rem] leading-relaxed">
                      {address || "Waiting for the gateway…"}
                    </code>
                    <button
                      onClick={() => void copy(address, "address")}
                      className="shrink-0 rounded p-1 text-ink-3 transition-colors hover:bg-surface hover:text-ink"
                      aria-label="Copy address"
                    >
                      {copied === "address" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    </button>
                  </div>
                </div>

                {payment.invoiceUrl && (
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <a href={payment.invoiceUrl} target="_blank" rel="noreferrer">
                      {payment.sandbox ? "Open the sandbox invoice" : "Open the hosted invoice"}
                      <ArrowRight className="size-3.5" />
                    </a>
                  </Button>
                )}

                <div className="flex items-center justify-between border-t border-line pt-3">
                  <p className="flex items-center gap-1.5 text-[0.6875rem] text-ink-3">
                    <Loader2 className="size-3 animate-spin" />
                    {phase === "confirming" ? "Payment seen — waiting for confirmations" : "Waiting for payment"}
                  </p>
                  <Button variant="ghost" size="sm" onClick={checkNow} disabled={checking}>
                    <RefreshCw className={checking ? "size-3.5 animate-spin" : "size-3.5"} /> Check
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-surface p-5 text-center">
              <p className="label-mono text-[0.5rem] text-ink-3">Scan to pay</p>
              {address ? (
                <QrCode value={address} className="mx-auto mt-3 size-[200px]" />
              ) : (
                <div className="mx-auto mt-3 grid size-[200px] place-items-center rounded border border-dashed border-line text-[0.6875rem] text-ink-3">
                  Address pending
                </div>
              )}
              <p className="mt-3 text-[0.625rem] leading-relaxed text-ink-3">
                Scan with any wallet that supports {payment.network ?? coinLabel(payment.payCurrency)}.
              </p>
              <p className="mt-3 flex items-center justify-center gap-1 border-t border-line pt-3 text-[0.625rem] text-ink-3">
                <ShieldCheck className="size-3" /> Verified server-side
              </p>
            </div>
          </div>

          {payment.sandbox && (
            <p className="mt-4 rounded-md border border-dashed border-line bg-surface-2 px-4 py-2.5 text-[0.6875rem] text-ink-2">
              <strong className="font-medium">Sandbox mode.</strong> No live gateway key is configured, so this
              invoice uses the local sandbox. Paying it posts a signed webhook through the same verification
              path a real gateway would.
            </p>
          )}
        </motion.div>
      )}

      {/* Order summary stays visible in every state. */}
      <div className="mt-8 rounded-lg border border-line bg-surface">
        <div className="border-b border-line px-5 py-3.5">
          <p className="text-[0.8125rem] font-medium">Order summary</p>
        </div>
        <ul className="divide-y divide-line">
          {order.items.map((item) => (
            <li key={`${item.productSlug}-${item.license}`} className="flex items-baseline justify-between gap-4 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-[0.8125rem]">{item.productName}</p>
                <p className="text-[0.6875rem] capitalize text-ink-3">{item.license} licence</p>
              </div>
              <span className="font-mono text-[0.75rem]">{money(item.unitPrice)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1.5 border-t border-line px-5 py-3.5 text-[0.8125rem]">
          {order.discount > 0 && (
            <div className="flex justify-between text-ink-2">
              <dt>Discount</dt>
              <dd className="font-mono">−{money(order.discount)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between">
            <dt className="font-medium">Total</dt>
            <dd className="font-mono text-[1.05rem] font-medium">{money(order.total)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link to="/account/orders">All orders</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link to="/browse">Keep browsing</Link>
        </Button>
      </div>
    </div>
  );
}

function PhaseBadge({ phase }: { phase: Phase }) {
  const map: Record<Phase, { label: string; variant: "brand" | "warn" | "danger" | "neutral" }> = {
    loading: { label: "Loading", variant: "neutral" },
    waiting: { label: "Awaiting payment", variant: "warn" },
    confirming: { label: "Confirming", variant: "warn" },
    paid: { label: "Paid", variant: "brand" },
    expired: { label: "Expired", variant: "neutral" },
    failed: { label: "Underpaid", variant: "danger" },
    refunded: { label: "Refunded", variant: "neutral" },
    cancelled: { label: "Cancelled", variant: "neutral" },
  };
  const { label, variant } = map[phase];
  return (
    <Badge variant={variant} size="md" className="gap-1.5">
      {phase === "paid" && <Check className="size-3" strokeWidth={3} />}
      {label}
    </Badge>
  );
}

function PaidPanel({ order }: { order: OrderResponse["order"] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="rounded-lg border border-line bg-surface p-6">
        <div className="flex items-start gap-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-brand-ink">
            <Check className="size-5" strokeWidth={3} />
          </div>
          <div className="min-w-0">
            <p className="font-display text-xl leading-tight">You’re all set.</p>
            <p className="mt-1 text-[0.8125rem] text-ink-2">
              Payment verified and {order.items.length} licence{order.items.length === 1 ? "" : "s"} issued.
              Your downloads are unlocked now, and a receipt is on its way to {order.email}.
            </p>
            {order.reference && (
              <p className="mt-2 flex flex-wrap items-center gap-x-2 font-mono text-[0.6875rem] text-ink-3">
                <span>Ref {order.reference}</span>
                {order.paidAt && <span>· paid {new Date(order.paidAt).toLocaleString("en-GB")}</span>}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to="/account/library">
                  <Download className="size-3.5" /> Go to your library
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/account/orders">
                  <FileText className="size-3.5" /> Invoice
                </Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link to="/account/certificates">Licence certificates</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-[0.6875rem] text-ink-3">
        <Mail className="size-3" /> Nothing in your inbox? Check spam, or read the receipt under orders.
      </p>
    </motion.div>
  );
}

function Notice({
  tone,
  icon,
  title,
  body,
  action,
}: {
  tone: "warn" | "bad";
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={
        tone === "warn"
          ? "rounded-lg border border-line bg-surface p-6"
          : "rounded-lg border border-line bg-surface p-6"
      }
    >
      <div className="flex items-start gap-4">
        <div
          className={
            tone === "warn"
              ? "grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2"
              : "grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2"
          }
        >
          {icon}
        </div>
        <div>
          <p className="font-display text-xl leading-tight">{title}</p>
          <p className="mt-1 text-[0.8125rem] text-ink-2">{body}</p>
          {action}
        </div>
      </div>
    </div>
  );
}

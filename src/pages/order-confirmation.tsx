import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Download, FileText, ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductArt } from "@/components/ui/product-art";
import { money } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";

/** The shape `/api/account/orders/:number` returns for a completed purchase. */
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
    items: {
      productSlug: string;
      productName: string;
      license: "personal" | "commercial" | "extended";
      unitPrice: number;
    }[];
  };
}

export default function OrderConfirmationPage() {
  const { id = "" } = useParams();
  const [order, setOrder] = React.useState<OrderResponse["order"] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  /**
   * Read the order back from the API rather than trusting router state — that
   * way a refresh, a shared link or a bookmark all still show the real receipt.
   */
  React.useEffect(() => {
    let alive = true;
    api
      .get<OrderResponse>(`/account/orders/${encodeURIComponent(id)}`)
      .then((res) => alive && setOrder(res.order))
      .catch((err) => alive && setError(err instanceof ApiError ? err.message : "We could not load that order."));
    return () => {
      alive = false;
    };
  }, [id]);

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
    return <div className="container-x py-24 text-center text-sm text-ink-3">Loading your receipt…</div>;
  }


  return (
    <div className="container-x py-14">
      <div className="mx-auto max-w-2xl">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="grid size-14 place-items-center rounded-full bg-brand text-brand-ink"
        >
          <Check className="size-6" strokeWidth={3} />
        </motion.div>
        <h1 className="mt-5 text-[2rem] leading-tight sm:text-[2.5rem]">You’re all set.</h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
          Order <span className="font-mono text-ink">{order.number}</span> is paid. Download links are live in
          your library, and a receipt is on its way to your inbox.
        </p>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <Button asChild size="lg">
            <Link to="/account/library">
              <Download className="size-4" /> Go to your library
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/account/orders">
              <FileText className="size-4" /> View receipt
            </Link>
          </Button>
        </div>

        <div className="mt-9 rounded-lg border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-[0.9375rem] font-medium">In this order</h2>
            <Badge variant="success" size="sm">
              Paid
            </Badge>
          </div>
          <ul className="divide-y divide-line">
            {order.items.map((line) => (
              <li key={line.productSlug} className="flex items-center gap-3 px-5 py-3.5">
                <div className="grid size-12 shrink-0 place-items-center rounded-sm bg-surface-3 font-display text-lg text-ink-2">
                  {line.productName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-medium">{line.productName}</p>
                  <p className="text-[0.6875rem] capitalize text-ink-3">{line.license} license</p>
                </div>
                <span className="font-mono text-[0.75rem] text-ink-2">{money(line.unitPrice)}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-1 border-t border-line bg-surface-2/50 px-5 py-3 text-[0.8125rem]">
            <div className="flex items-center justify-between text-ink-2">
              <span>Subtotal</span>
              <span className="font-mono">{money(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex items-center justify-between text-ink-2">
                <span>Discount</span>
                <span className="font-mono">−{money(order.discount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="font-medium">Total paid</span>
              <span className="font-mono text-[0.9375rem] font-medium">{money(order.total)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-md border border-line bg-surface-2/50 p-4">
          <Mail className="mt-0.5 size-4 shrink-0 text-ink-3" />
          <p className="text-[0.75rem] leading-relaxed text-ink-2">
            Missing the email? Check spam, then{" "}
            <Link to="/contact" className="underline underline-offset-2 hover:text-ink">
              contact support
            </Link>
            . Your files never expire — the license is tied to your account, not a link.
          </p>
        </div>

        <Link
          to="/browse"
          className="group mt-8 flex items-center justify-between border-t border-line pt-5 text-sm text-ink-2 hover:text-ink"
        >
          Keep browsing the catalogue
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}

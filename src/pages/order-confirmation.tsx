import { Link, useLocation, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Download, FileText, ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductArt } from "@/components/ui/product-art";
import { productBySlug } from "@/data/catalog";
import type { CartLine, License } from "@/data/types";
import { money } from "@/lib/utils";

type PlacedOrder = { lines: CartLine[]; total: number };

export default function OrderConfirmationPage() {
  const { id = "KL-10482" } = useParams();
  const location = useLocation();
  // checkout hands us the real lines + total; a direct visit falls back to the demo order
  const placed = (location.state as PlacedOrder | null) ?? null;
  const demo = { lines: [{ productSlug: "forge-saas-starter", license: "personal" as License }], total: 14900 };
  const order = placed ?? demo;
  const sample = order.lines
    .map((l) => ({ line: l, product: productBySlug(l.productSlug) }))
    .filter((x): x is { line: CartLine; product: NonNullable<ReturnType<typeof productBySlug>> } =>
      Boolean(x.product),
    );

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
          Order <span className="font-mono text-ink">{id}</span> is paid. Download links are live in
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
            {sample.map(({ line, product }) => (
              <li key={product.slug} className="flex items-center gap-3 px-5 py-3.5">
                <ProductArt {...product.art} kind={product.art.kind} className="size-12 shrink-0 rounded-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-medium">{product.name}</p>
                  <p className="text-[0.6875rem] capitalize text-ink-3">
                    {line.license} license · v{product.version}
                  </p>
                </div>
                <Button size="sm" variant="soft">
                  <Download className="size-3.5" /> .zip
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-line bg-surface-2/50 px-5 py-3">
            <span className="text-[0.8125rem] text-ink-2">Total paid</span>
            <span className="font-mono text-[0.9375rem] font-medium">{money(order.total)}</span>
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

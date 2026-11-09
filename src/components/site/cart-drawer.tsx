import * as React from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, Plus, Minus, Trash2, Tag, ShieldCheck, ArrowRight, ShoppingBag, Layers } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ProductArt } from "@/components/ui/product-art";
import { useCart, useCartTotals, useUi, validateCoupon } from "@/lib/store";
import { money, cn } from "@/lib/utils";
import { NativeSelect } from "@/components/ui/field";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/constants";

export function CartDrawer() {
  const { cartOpen, setCart } = useUi();
  const { items, subtotal, discount, total, coupon, count } = useCartTotals();
  const { remove, setLicense, applyCoupon, removeCoupon } = useCart();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  return (
    <Dialog open={cartOpen} onOpenChange={setCart}>
      <DialogContent side="right" className="flex flex-col gap-0 p-0" showClose={false}>
        <DialogTitle className="sr-only">Your cart</DialogTitle>
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-xl">Your cart</h2>
            <p className="text-xs text-ink-3">
              {count === 0 ? "Nothing here yet" : `${count} item${count === 1 ? "" : "s"} · instant download`}
            </p>
          </div>
          <button
            onClick={() => setCart(false)}
            className="grid size-9 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </header>

        {count === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="grid size-16 place-items-center rounded-full bg-surface-2">
              <ShoppingBag className="size-6 text-ink-3" />
            </div>
            <div>
              <p className="font-display text-lg">Your cart is empty</p>
              <p className="mt-1 text-sm text-ink-2">
                Find something you love — it’ll wait here for you.
              </p>
            </div>
            <Button asChild onClick={() => setCart(false)}>
              <Link to="/browse">Browse items</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5">
              <ul className="divide-y divide-line">
                {items.map(({ product, bundle, tier, price, line }) => (
                  <motion.li
                    key={line.productSlug}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex gap-3 py-4"
                  >
                    {product ? (
                      <Link to={`/item/${product.slug}`} onClick={() => setCart(false)}>
                        <ProductArt
                          from={product.art.from}
                          to={product.art.to}
                          ink={product.art.ink}
                          kind={product.art.kind}
                          className="h-16 w-20 shrink-0 rounded-sm"
                        />
                      </Link>
                    ) : (
                      <div className="grid h-16 w-20 shrink-0 place-items-center rounded-sm bg-surface-2 text-ink-3">
                        <Layers className="size-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      {product ? (
                        <Link
                          to={`/item/${product.slug}`}
                          onClick={() => setCart(false)}
                          className="line-clamp-2 text-[0.8125rem] font-medium leading-snug hover:text-accent-ink dark:hover:text-accent"
                        >
                          {product.name}
                        </Link>
                      ) : (
                        <p className="line-clamp-2 text-[0.8125rem] font-medium leading-snug">
                          {bundle?.name ?? line.productSlug}
                        </p>
                      )}
                      <div className="mt-1.5 flex items-center gap-2">
                        {product && (
                          <NativeSelect
                            aria-label="License"
                            value={tier?.license}
                            onChange={(e) => setLicense(product.slug, e.target.value as never)}
                            className="h-7 w-auto py-0 pl-2 pr-7 text-[0.6875rem]"
                          >
                            {product.tiers.map((t) => (
                              <option key={t.license} value={t.license}>
                                {t.name} — {money(t.price)}
                              </option>
                            ))}
                          </NativeSelect>
                        )}
                        <button
                          onClick={() => remove(line.productSlug)}
                          className="ml-auto grid size-6 place-items-center rounded text-ink-3 transition-colors hover:bg-surface-2 hover:text-negative"
                          aria-label={`Remove ${product?.name ?? bundle?.name ?? "item"}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      <p className="mt-1.5 font-mono text-[0.6875rem] text-ink-3">
                        {product ? `${product.version} · ${product.license} license` : `Bundle · ${bundle?.license ?? "personal"} licence`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right font-mono text-[0.8125rem] font-medium">
                      {money(price)}
                    </div>
                  </motion.li>
                ))}
              </ul>

              <div className="rounded-md border border-line bg-surface-2/60 p-3">
                <div className="flex items-center gap-2 text-xs text-ink-2">
                  <ShieldCheck className="size-3.5 text-accent" />
                  Instant download · lifetime updates on this version
                </div>
              </div>
            </div>

            <footer className="border-t border-line px-5 py-4">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!code.trim()) return;
                  const result = await validateCoupon(code, subtotal);
                  if (!result.ok) {
                    setError(result.error ?? "That code isn’t valid on this store.");
                    return;
                  }
                  const ok = applyCoupon(code);
                  setError(ok ? null : "That code isn’t valid on this store.");
                  if (ok) setCode("");
                }}
                className="mb-3 flex gap-2"
              >
                <div className="relative flex-1">
                  <Tag className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
                  <input
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setError(null);
                    }}
                    placeholder={coupon ? coupon : "Discount code"}
                    className={cn(
                      "h-9 w-full rounded-sm border border-line-strong bg-surface pl-8 pr-2 text-xs uppercase tracking-wide placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-3",
                      error && "border-negative",
                    )}
                  />
                </div>
                <Button type="submit" size="sm" variant="outline">
                  Apply
                </Button>
              </form>
              {error && <p className="mb-2 text-[0.6875rem] text-negative">{error}</p>}
              {coupon && (
                <div className="mb-3 flex items-center justify-between rounded-sm bg-sage/60 px-2.5 py-1.5 text-[0.6875rem] text-ink-2 dark:bg-brand-soft dark:text-ink-2">
                  <span className="font-medium">{coupon} applied</span>
                  <button onClick={removeCoupon} className="underline underline-offset-2">
                    remove
                  </button>
                </div>
              )}

              <dl className="space-y-1.5 text-[0.8125rem]">
                <div className="flex justify-between text-ink-2">
                  <dt>Subtotal</dt>
                  <dd className="font-mono">{money(subtotal)}</dd>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-accent-ink dark:text-accent">
                    <dt>Discount</dt>
                    <dd className="font-mono">−{money(discount)}</dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between border-t border-line pt-2 text-ink">
                  <dt className="font-medium">Total</dt>
                  <dd className="font-mono text-lg font-medium">{money(total)}</dd>
                </div>
              </dl>
              <p className="mt-1 text-[0.625rem] text-ink-3">Taxes calculated at checkout.</p>

              <Button asChild size="lg" className="mt-3 w-full" onClick={() => setCart(false)}>
                <Link to="/checkout">
                  Checkout <ArrowRight className="size-4" />
                </Link>
              </Button>
              <button
                onClick={() => setCart(false)}
                className="mt-2 w-full text-center text-[0.6875rem] text-ink-3 hover:text-ink"
              >
                or keep browsing
              </button>
              {subtotal > FREE_SHIPPING_THRESHOLD && (
                <p className="mt-2 text-center text-[0.625rem] text-ink-3">
                  Bulk-license pricing applied automatically
                </p>
              )}
            </footer>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-line">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="grid size-8 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-40"
        disabled={value <= min}
        aria-label="Decrease"
      >
        <Minus className="size-3.5" />
      </button>
      <span className="w-8 text-center font-mono text-sm">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="grid size-8 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-40"
        disabled={value >= max}
        aria-label="Increase"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

export { AnimatePresence };

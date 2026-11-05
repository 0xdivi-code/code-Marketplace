import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, ShoppingBag, Tag, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductArt } from "@/components/ui/product-art";
import { NativeSelect } from "@/components/ui/field";
import { useCart, useCartTotals, validateCoupon } from "@/lib/store";
import { money } from "@/lib/utils";
import * as React from "react";

export default function CartPage() {
  const { items, subtotal, discount, tax, total, coupon, count } = useCartTotals();
  const { remove, setLicense, applyCoupon, removeCoupon } = useCart();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  if (count === 0) {
    return (
      <div className="container-x flex flex-col items-center justify-center py-24 text-center">
        <div className="grid size-16 place-items-center rounded-full bg-surface-2">
          <ShoppingBag className="size-6 text-ink-3" />
        </div>
        <h1 className="mt-5 text-[1.9rem]">Your cart is empty</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-2">
          Find something you love — it’ll wait here for you.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link to="/browse">Browse items</Link>
        </Button>
        <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[0.6875rem] text-ink-3">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" /> Secure checkout
          </span>
          <span>Instant download</span>
          <span>14-day refund window</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-x py-10">
      <h1 className="text-[2rem] leading-tight sm:text-[2.4rem]">Your cart</h1>
      <p className="mt-1 text-sm text-ink-2">
        {count} item{count === 1 ? "" : "s"} · digital delivery, no shipping
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <ul className="divide-y divide-line border-y border-line">
            {items.map(({ product, tier }) => (
              <li key={product.slug} className="flex gap-4 py-5">
                <Link to={`/item/${product.slug}`} className="shrink-0">
                  <ProductArt
                    {...product.art}
                    kind={product.art.kind}
                    className="h-20 w-28 rounded-sm"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        to={`/item/${product.slug}`}
                        className="font-display text-[1.05rem] leading-snug hover:text-accent-ink dark:hover:text-accent"
                      >
                        {product.name}
                      </Link>
                      <p className="mt-0.5 text-[0.75rem] text-ink-2">{product.tagline}</p>
                    </div>
                    <div className="shrink-0 text-right font-mono text-[0.9375rem] font-medium">
                      {money(tier.price)}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <NativeSelect
                      aria-label={`License for ${product.name}`}
                      value={tier.license}
                      onChange={(e) => setLicense(product.slug, e.target.value as never)}
                      className="h-8 w-auto py-0 pl-2 pr-7 text-[0.6875rem]"
                    >
                      {product.tiers.map((t) => (
                        <option key={t.license} value={t.license}>
                          {t.name} license — {money(t.price)}
                        </option>
                      ))}
                    </NativeSelect>
                    <button
                      onClick={() => remove(product.slug)}
                      className="flex items-center gap-1 text-[0.6875rem] text-ink-3 transition-colors hover:text-red-600"
                    >
                      <Trash2 className="size-3" /> Remove
                    </button>
                    <span className="ml-auto text-[0.625rem] text-ink-3">
                      {product.version} · lifetime updates
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-center justify-between">
            <Link to="/browse" className="text-[0.8125rem] text-ink-2 hover:text-ink">
              ← Continue browsing
            </Link>
            <span className="flex items-center gap-1.5 text-[0.6875rem] text-ink-3">
              <ShieldCheck className="size-3.5 text-accent" /> Payment secured by Stripe
            </span>
          </div>
        </div>

        <aside>
          <div className="sticky top-24 rounded-lg border border-line bg-surface p-5">
            <h2 className="font-display text-lg">Order summary</h2>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!code.trim()) return;
                // Checked against the coupon table, not a hard-coded list.
                const result = await validateCoupon(code, subtotal);
                if (!result.ok) {
                  setError(result.error ?? "That code isn’t valid.");
                  return;
                }
                const ok = applyCoupon(code);
                setError(ok ? null : "That code isn’t valid.");
                if (ok) setCode("");
              }}
              className="mt-4 flex gap-2"
            >
              <div className="relative flex-1">
                <Tag className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
                <input
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setError(null);
                  }}
                  placeholder="Discount code"
                  className="h-9 w-full rounded-sm border border-line-strong bg-surface pl-8 pr-2 text-xs uppercase tracking-wide placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-3 focus:border-accent focus:outline-none"
                />
              </div>
              <Button type="submit" size="sm" variant="outline">
                Apply
              </Button>
            </form>
            {error && <p className="mt-1.5 text-[0.6875rem] text-red-600 dark:text-red-400">{error}</p>}
            {coupon && (
              <div className="mt-2 flex items-center justify-between rounded-sm bg-sage/60 px-2.5 py-1.5 text-[0.6875rem]">
                <span className="font-medium">{coupon} applied</span>
                <button onClick={removeCoupon} aria-label="Remove coupon">
                  <X className="size-3" />
                </button>
              </div>
            )}

            <dl className="mt-4 space-y-2 text-[0.8125rem]">
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
              <div className="flex justify-between text-ink-2">
                <dt>
                  VAT <span className="text-[0.625rem] text-ink-3">(7.5% est.)</span>
                </dt>
                <dd className="font-mono">{money(tax)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-2.5">
                <dt className="font-medium">Total</dt>
                <dd className="font-mono text-xl font-medium">{money(total)}</dd>
              </div>
            </dl>

            <Button asChild size="lg" className="mt-4 w-full">
              <Link to="/checkout">
                Checkout <ArrowRight className="size-4" />
              </Link>
            </Button>
            <p className="mt-2.5 text-center text-[0.625rem] leading-relaxed text-ink-3">
              By continuing you agree to the license terms. Digital goods are non-returnable except
              where required by law.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

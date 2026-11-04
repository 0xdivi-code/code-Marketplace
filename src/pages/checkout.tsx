import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ChevronLeft,
  CreditCard,
  Lock,
  ShieldCheck,
  ArrowRight,
  Building2,
  Wallet,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KilnMark } from "@/components/site/logo";
import { Field, Input, NativeSelect, Checkbox, RadioGroup, RadioCard } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { ProductArt } from "@/components/ui/product-art";
import { useCart, useCartTotals, useSession } from "@/lib/store";
import { cn, money } from "@/lib/utils";
import { toast } from "sonner";

const steps = ["Details", "Payment", "Confirm"] as const;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, subtotal, discount, tax, total, count, coupon } = useCartTotals();
  const { clear } = useCart();
  const { user } = useSession();
  const [step, setStep] = React.useState(0);
  const [method, setMethod] = React.useState("card");
  const [billing, setBilling] = React.useState("personal");
  const [processing, setProcessing] = React.useState(false);
  // set once payment succeeds so the empty-cart guard cannot bounce us to /cart
  const placed = React.useRef(false);
  const [form, setForm] = React.useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    company: "",
    vat: "",
    country: "Portugal",
    card: "4242 4242 4242 4242",
    expiry: "09 / 29",
    cvc: "123",
    promo: "",
    terms: false,
  });

  React.useEffect(() => {
    if (count === 0 && !processing && !placed.current) navigate("/cart", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const pay = async () => {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 1400));
    const id = `KL-${Math.floor(10500 + Math.random() * 400)}`;
    placed.current = true;
    clear();
    toast.success("Payment approved", { description: `Order ${id} · receipt sent by email` });
    navigate(`/order/${id}`, {
      replace: true,
      state: { lines: items.map((i) => ({ productSlug: i.product.slug, license: i.line.license })), total },
    });
    setProcessing(false);
  };

  const canContinue =
    step === 0
      ? form.name.includes(" ") && form.email.includes("@")
      : step === 1
        ? method !== "card" || (form.card.replace(/\s/g, "").length >= 15 && form.cvc.length >= 3)
        : form.terms;

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line">
        <div className="container-x flex h-16 items-center justify-between">
          <Link to="/" aria-label="Kiln home" className="flex items-center gap-2.5">
            <KilnMark className="size-8" />
            <span className="font-display text-lg leading-none tracking-[-0.03em]">Kiln</span>
          </Link>
          <div className="flex items-center gap-2 text-[0.6875rem] text-ink-3">
            <Lock className="size-3.5" /> Encrypted checkout
          </div>
        </div>
      </header>

      <div className="container-x grid gap-10 py-10 lg:grid-cols-[1fr_380px] lg:gap-14">
        <div>
          <Link
            to="/cart"
            className="mb-5 inline-flex items-center gap-1.5 text-[0.75rem] text-ink-2 hover:text-ink"
          >
            <ChevronLeft className="size-3.5" /> Back to cart
          </Link>

          <ol className="mb-8 flex items-center gap-2">
            {steps.map((s, i) => (
              <li key={s} className="flex flex-1 items-center gap-2">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full border text-[0.6875rem] font-medium transition-colors",
                    i < step
                      ? "border-brand bg-brand text-brand-ink"
                      : i === step
                        ? "border-ink text-ink"
                        : "border-line text-ink-3",
                  )}
                >
                  {i < step ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "text-[0.8125rem]",
                    i === step ? "font-medium text-ink" : "text-ink-3",
                  )}
                >
                  {s}
                </span>
                {i < steps.length - 1 && <span className="h-px flex-1 bg-line" />}
              </li>
            ))}
          </ol>

          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.22 }}
                className="space-y-5"
              >
                <h1 className="text-[1.6rem] leading-tight">Where should we send the files?</h1>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name" htmlFor="name">
                    <Input id="name" value={form.name} onChange={set("name")} placeholder="Amara Okafor" />
                  </Field>
                  <Field label="Email" htmlFor="email" hint="Download links go here">
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={set("email")}
                      placeholder="you@studio.com"
                    />
                  </Field>
                </div>
                <Field label="Company" htmlFor="company" optional>
                  <Input id="company" value={form.company} onChange={set("company")} placeholder="Studio name" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Country" htmlFor="country">
                    <NativeSelect id="country" className="h-11 text-sm">
                      {["Portugal", "Nigeria", "United Kingdom", "Germany", "United States", "India", "Brazil"].map(
                        (c) => (
                          <option key={c}>{c}</option>
                        ),
                      )}
                    </NativeSelect>
                  </Field>
                  <Field label="VAT number" htmlFor="vat" optional hint="EU businesses can reverse-charge">
                    <Input id="vat" value={form.vat} onChange={set("vat")} placeholder="PT123456789" />
                  </Field>
                </div>

                <div>
                  <p className="mb-2 text-[0.8125rem] font-medium text-ink-2">Buying as</p>
                  <RadioGroup value={billing} onValueChange={setBilling} className="grid gap-2 sm:grid-cols-2">
                    <RadioCard
                      value="personal"
                      checked={billing === "personal"}
                      title="An individual"
                      description="Personal or freelance work"
                      meta={<Wallet className="size-4 text-ink-3" />}
                    />
                    <RadioCard
                      value="business"
                      checked={billing === "business"}
                      title="A business"
                      description="Invoice with company details"
                      meta={<Building2 className="size-4 text-ink-3" />}
                    />
                  </RadioGroup>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="payment"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.22 }}
                className="space-y-5"
              >
                <h1 className="text-[1.6rem] leading-tight">Payment</h1>
                <RadioGroup value={method} onValueChange={setMethod} className="grid grid-cols-1 gap-2">
                  <RadioCard
                    value="card"
                    checked={method === "card"}
                    title="Card"
                    description="Visa, Mastercard, Amex · processed by Stripe"
                    meta={<CreditCard className="size-4 text-ink-3" />}
                  />
                  <RadioCard
                    value="paypal"
                    checked={method === "paypal"}
                    title="PayPal"
                    description="You’ll be redirected to approve the payment"
                    meta={<Wallet className="size-4 text-ink-3" />}
                  />
                  <RadioCard
                    value="invoice"
                    checked={method === "invoice"}
                    title="Bank transfer (invoice)"
                    description="For orders over $500 · files released on clearance"
                    meta={<Receipt className="size-4 text-ink-3" />}
                  />
                </RadioGroup>

                {method === "card" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="overflow-hidden rounded-md border border-line bg-surface p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[0.8125rem] font-medium">Card details</span>
                      <div className="flex gap-1">
                        {["VISA", "MC", "AMEX"].map((b) => (
                          <span
                            key={b}
                            className="rounded border border-line px-1.5 py-0.5 font-mono text-[0.5rem] text-ink-3"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Field label="Card number" htmlFor="card">
                          <Input id="card" value={form.card} onChange={set("card")} className="font-mono" />
                        </Field>
                      </div>
                      <Field label="Expiry" htmlFor="exp">
                        <Input id="exp" value={form.expiry} onChange={set("expiry")} className="font-mono" />
                      </Field>
                      <Field label="CVC" htmlFor="cvc">
                        <Input id="cvc" value={form.cvc} onChange={set("cvc")} className="font-mono" />
                      </Field>
                    </div>
                    <p className="mt-3 flex items-center gap-1.5 text-[0.625rem] text-ink-3">
                      <Lock className="size-3" /> Demo mode — no real charge. Use any test card.
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.22 }}
                className="space-y-5"
              >
                <h1 className="text-[1.6rem] leading-tight">Review and confirm</h1>
                <div className="rounded-md border border-line bg-surface divide-y divide-line">
                  <div className="flex items-start justify-between gap-4 p-4">
                    <div>
                      <p className="label-mono text-[0.5rem] text-ink-3">Delivery</p>
                      <p className="mt-1 text-[0.8125rem] font-medium">{form.name}</p>
                      <p className="text-[0.75rem] text-ink-2">{form.email}</p>
                      <p className="text-[0.75rem] text-ink-2">
                        {form.company || "Individual"} · {form.country}
                      </p>
                    </div>
                    <button onClick={() => setStep(0)} className="text-[0.6875rem] text-accent-ink hover:underline dark:text-accent">
                      Edit
                    </button>
                  </div>
                  <div className="flex items-start justify-between gap-4 p-4">
                    <div>
                      <p className="label-mono text-[0.5rem] text-ink-3">Payment</p>
                      <p className="mt-1 text-[0.8125rem] font-medium">
                        {method === "card"
                          ? "Visa •••• 4242"
                          : method === "paypal"
                            ? "PayPal"
                            : "Bank transfer"}
                      </p>
                      <p className="text-[0.75rem] text-ink-2">
                        {billing === "business" ? "Business invoice" : "Personal receipt"}
                      </p>
                    </div>
                    <button onClick={() => setStep(1)} className="text-[0.6875rem] text-accent-ink hover:underline dark:text-accent">
                      Edit
                    </button>
                  </div>
                  <div className="p-4">
                    <p className="label-mono text-[0.5rem] text-ink-3">Items</p>
                    <ul className="mt-2 space-y-2">
                      {items.map(({ product, tier }) => (
                        <li key={product.slug} className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
                          <span className="min-w-0 flex-1 truncate text-ink-2">
                            {product.name} <span className="text-ink-3">· {tier.name}</span>
                          </span>
                          <span className="font-mono text-[0.75rem]">{money(tier.price)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <label className="flex cursor-pointer items-start gap-2.5 text-[0.8125rem] text-ink-2">
                  <Checkbox
                    className="mt-0.5"
                    checked={form.terms}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, terms: v === true }))}
                  />
                  <span>
                    I agree to the{" "}
                    <Link to="/page/licensing" className="underline underline-offset-2 hover:text-ink">
                      license terms
                    </Link>{" "}
                    and{" "}
                    <Link to="/page/terms" className="underline underline-offset-2 hover:text-ink">
                      terms of service
                    </Link>
                    , and I understand digital goods are generally non-refundable.
                  </span>
                </label>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 flex items-center gap-3 border-t border-line pt-5">
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={processing}>
                <ChevronLeft className="size-4" /> Back
              </Button>
            )}
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden text-[0.6875rem] text-ink-3 sm:block">
                {step === 2 ? `Total ${money(total)}` : "No charge until you confirm"}
              </span>
              {step < 2 ? (
                <Button size="lg" onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
                  Continue <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button size="lg" onClick={pay} disabled={!canContinue || processing}>
                  {processing ? (
                    <>
                      <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Processing…
                    </>
                  ) : (
                    <>
                      <Lock className="size-4" /> Pay {money(total)}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* summary */}
        <aside>
          <div className="sticky top-24 rounded-lg border border-line bg-surface p-5">
            <h2 className="font-display text-lg">Summary</h2>
            <ul className="mt-3 space-y-3">
              {items.map(({ product, tier }) => (
                <li key={product.slug} className="flex items-center gap-3">
                  <ProductArt {...product.art} kind={product.art.kind} className="size-11 shrink-0 rounded-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.75rem] font-medium">{product.name}</p>
                    <p className="text-[0.625rem] text-ink-3">{tier.name} license</p>
                  </div>
                  <span className="font-mono text-[0.75rem]">{money(tier.price)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-[0.8125rem]">
              <div className="flex justify-between text-ink-2">
                <dt>Subtotal</dt>
                <dd className="font-mono">{money(subtotal)}</dd>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-accent-ink dark:text-accent">
                  <dt>{coupon}</dt>
                  <dd className="font-mono">−{money(discount)}</dd>
                </div>
              )}
              <div className="flex justify-between text-ink-2">
                <dt>VAT (est.)</dt>
                <dd className="font-mono">{money(tax)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-2.5">
                <dt className="font-medium">Total</dt>
                <dd className="font-mono text-xl font-medium">{money(total)}</dd>
              </div>
            </dl>
            <div className="mt-4 space-y-2 border-t border-line pt-3">
              {[
                { icon: ShieldCheck, t: "14-day refund window" },
                { icon: Lock, t: "Stripe-secured payment" },
                { icon: Badge, t: "Instant download links" },
              ].map(({ icon: Icon, t }) => (
                <p key={t} className="flex items-center gap-2 text-[0.6875rem] text-ink-2">
                  <Icon className="size-3.5 text-accent" /> {t}
                </p>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

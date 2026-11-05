import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ChevronLeft,
  Lock,
  ShieldCheck,
  ArrowRight,
  Building2,
  Wallet,
  Coins,
  CircleDollarSign,
  Triangle,
  Zap,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KilnMark } from "@/components/site/logo";
import { Field, Input, NativeSelect, Checkbox, RadioGroup, RadioCard } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { ProductArt } from "@/components/ui/product-art";
import { useCart, useCartTotals, useSession } from "@/lib/store";
import { cn, money } from "@/lib/utils";
import { toast } from "sonner";
import { api, ApiError, refreshAuth } from "@/lib/api";


/**
 * Payment rails offered at checkout.
 *
 * USDT and USDC on a low-fee chain are the default because that is what the
 * customers this store actually has can pay with: a Lagos vendor can receive,
 * a buyer anywhere can send, and the fee is cents rather than dollars.
 */
type Rail = {
  code: string;
  ticker: string;
  name: string;
  network: string;
  fee: string;
  cheap: boolean;
  group: "stable" | "coin";
};

const RAILS: Rail[] = [
  { code: "usdttrc20", ticker: "USDT", name: "Tether", network: "TRON · TRC-20", fee: "~$1", cheap: true, group: "stable" },
  { code: "usdtbsc", ticker: "USDT", name: "Tether", network: "BNB Chain · BEP-20", fee: "~$0.20", cheap: true, group: "stable" },
  { code: "usdtpolygon", ticker: "USDT", name: "Tether", network: "Polygon", fee: "~$0.02", cheap: true, group: "stable" },
  { code: "usdcsol", ticker: "USDC", name: "USD Coin", network: "Solana", fee: "~$0.001", cheap: true, group: "stable" },
  { code: "usdcbase", ticker: "USDC", name: "USD Coin", network: "Base", fee: "~$0.01", cheap: true, group: "stable" },
  { code: "usdteth", ticker: "USDT", name: "Tether", network: "Ethereum · ERC-20", fee: "high", cheap: false, group: "stable" },
  { code: "btc", ticker: "BTC", name: "Bitcoin", network: "Bitcoin", fee: "varies", cheap: false, group: "coin" },
  { code: "eth", ticker: "ETH", name: "Ether", network: "Ethereum", fee: "high", cheap: false, group: "coin" },
  { code: "ltc", ticker: "LTC", name: "Litecoin", network: "Litecoin", fee: "~$0.01", cheap: true, group: "coin" },
  { code: "sol", ticker: "SOL", name: "Solana", network: "Solana", fee: "~$0.001", cheap: true, group: "coin" },
];

type LicenseTerm = { license: string; name: string; summary: string; seats: string; terms: string };

/** Lucide has no Bitcoin glyph; this is the standard ₿ mark at icon size. */
function BitcoinMark({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm3.1 11.4c.3-1.1-.2-1.9-1.3-2.3l1-1.6-1.3-.8-1 1.6-.9-.5 1-1.6-1.2-.8-1 1.6-1.5-.9-.5 1.3 1 .6-.6 1-1-.6-.5 1.3 1 .6-2.3 3.6 1.5.9.9-1.4.9.5-.9 1.4 1.2.8 1-1.6 1.5.9.5-1.3-1-.6.6-1 1 .6.4-1.2Zm-2.6-.6-1.3-.8.6-1 1.3.8-.6 1Z" />
    </svg>
  );
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, subtotal, discount, tax, total, count, coupon } = useCartTotals();
  const { clear } = useCart();
  const { user } = useSession();
  const [step, setStep] = React.useState(0);
  const [rail, setRail] = React.useState("usdttrc20");
  const [terms, setTerms] = React.useState<LicenseTerm[]>([]);
  /** Stable across retries so a double submit cannot create two orders. */
  const idemKey = React.useRef(
    `co_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
  );
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
    promo: "",
    terms: false,
  });

  // Licence terms must be visible before the customer commits.
  React.useEffect(() => {
    api
      .get<{ terms: LicenseTerm[] }>("/licenses/terms")
      .then((r) => setTerms(r.terms))
      .catch(() => {});
  }, []);

  /**
   * The cart is rehydrated from localStorage asynchronously, so the first render
   * legitimately sees zero items. Wait a beat before treating an empty cart as
   * "you came here directly" and bouncing back.
   */
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    const id = window.setTimeout(() => setHydrated(true), 400);
    return () => window.clearTimeout(id);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    if (count === 0 && !processing && !placed.current) navigate("/cart", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, hydrated]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // The session arrives after first paint; backfill the fields the customer
  // would otherwise have to retype, without clobbering anything they typed.
  React.useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      name: f.name || user.name,
      email: f.email || user.email,
    }));
  }, [user?.name, user?.email]);

  const pay = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      /**
       * The server reprices every line, opens the invoice and returns an
       * address. Nothing the browser says here is trusted: no prices, no
       * status, no licence. `idempotencyKey` makes a retry safe.
       */
      const res = await api.post<{
        order: { number: string; total: number; status: string };
        payment: {
          sandbox: boolean;
          payCurrency: string;
          ticker: string;
          network: string;
          payAmount: string;
          payAddress: string;
          invoiceUrl: string;
        } | null;
      }>("/account/checkout", {
        lines: items.map((i) => ({ slug: i.product.slug, license: i.line.license })),
        coupon: coupon ?? undefined,
        country: form.country,
        vatNumber: form.vat || undefined,
        payCurrency: rail,
        idempotencyKey: idemKey.current,
      });

      placed.current = true;
      clear();
      await refreshAuth(true);

      if (!res.payment) {
        // Every line was free, so the server already granted the licences.
        toast.success("Order complete", { description: `${res.order.number} · downloads unlocked` });
        navigate(`/order/${res.order.number}`, { replace: true });
        return;
      }

      // Hand off to the invoice. Its status is decided server-side; this page
      // only shows what the server says.
      navigate(`/order/${res.order.number}`, {
        replace: true,
        state: { justPaid: false, awaiting: true },
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        toast.error("Sign in to complete your order.", { description: "Your cart is saved." });
        navigate("/login");
      } else if (err instanceof ApiError && err.status === 409 && err.data?.code === "already_owned") {
        toast.error(err.message, { description: "Remove it from your cart to check out the rest." });
        navigate("/cart");
      } else {
        toast.error(err instanceof ApiError ? err.message : "Payment could not be started.");
      }
    } finally {
      setProcessing(false);
    }
  };

  /** A cart of only free items skips the payment rail entirely. */
  const allFree = items.length > 0 && total === 0;
  const steps = React.useMemo(
    () => (allFree ? (["Details", "Confirm"] as const) : (["Details", "Payment", "Confirm"] as const)),
    [allFree],
  );
  /** Map the logical step to the rendered panel when Payment is skipped. */
  const panel = allFree && step === 2 ? 2 : step;

  const canContinue =
    step === 0
      ? form.name.includes(" ") && form.email.includes("@")
      : allFree
        ? form.terms
        : step === 1
          ? Boolean(rail)
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

            {panel === 1 && (
              <motion.div
                key="payment"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.22 }}
                className="space-y-5"
              >
                <h1 className="text-[1.6rem] leading-tight">Pay with crypto</h1>
                <p className="-mt-3 text-[0.8125rem] text-ink-2">
                  Pay in USDT or USDC on a low-fee chain. The invoice locks a rate for one hour; the
                  download unlocks the moment the network confirms — usually under a minute.
                </p>

                {[
                  { label: "Stablecoins", note: "Priced 1:1 with the dollar", group: "stable" as const },
                  { label: "Other coins", note: "Rate locked when the invoice is created", group: "coin" as const },
                ].map((section) => (
                  <div key={section.group}>
                    <div className="mb-2 flex items-baseline justify-between">
                      <p className="text-[0.8125rem] font-medium">{section.label}</p>
                      <p className="text-[0.625rem] text-ink-3">{section.note}</p>
                    </div>
                    <RadioGroup
                      value={rail}
                      onValueChange={setRail}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                    >
                      {RAILS.filter((r) => r.group === section.group).map((r) => (
                        <RadioCard
                          key={r.code}
                          value={r.code}
                          checked={rail === r.code}
                          title={`${r.ticker} on ${r.network}`}
                          description={`${r.name} · network fee ${r.fee}`}
                          meta={
                            r.ticker === "BTC" ? (
                              <BitcoinMark />
                            ) : r.ticker === "ETH" ? (
                              <Triangle className="size-4 text-ink-3" />
                            ) : r.cheap ? (
                              <Zap className="size-4 text-ink-3" />
                            ) : (
                              <Coins className="size-4 text-ink-3" />
                            )
                          }
                        />
                      ))}
                    </RadioGroup>
                  </div>
                ))}

                <div className="rounded-md border border-line bg-surface-2 p-4">
                  <p className="flex items-center gap-1.5 text-[0.8125rem] font-medium">
                    <CircleDollarSign className="size-4 text-ink-3" /> How it works
                  </p>
                  <ol className="mt-2 space-y-1.5 text-[0.75rem] text-ink-2">
                    <li>1 · We open an invoice with a deposit address and a 60-minute window.</li>
                    <li>2 · You send the exact amount from any wallet or exchange.</li>
                    <li>3 · The gateway signs a callback; we verify it and check the amount ourselves.</li>
                    <li>4 · Your licences and downloads appear immediately after confirmation.</li>
                  </ol>
                  <p className="mt-2.5 flex items-center gap-1.5 text-[0.625rem] text-ink-3">
                    <Lock className="size-3" /> We never take payment details, and a browser cannot mark an
                    order paid.
                  </p>
                </div>
              </motion.div>
            )}

            {panel === 2 && (
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
                        {(() => {
                          const r = RAILS.find((x) => x.code === rail);
                          return r ? `${r.ticker} on ${r.network}` : "Crypto";
                        })()}
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
                      {items.map(({ product, tier, price, listPrice }) => (
                        <li key={product.slug} className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
                          <span className="min-w-0 flex-1 truncate text-ink-2">
                            {product.name} <span className="text-ink-3">· {tier.name}</span>
                          </span>
                          <span className="flex items-baseline gap-1.5 font-mono text-[0.75rem]">
                            {listPrice > price && (
                              <span className="text-[0.6875rem] text-ink-3 line-through">{money(listPrice)}</span>
                            )}
                            {money(price)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Licence terms must be readable before the customer commits. */}
                <div className="rounded-md border border-line bg-surface">
                  <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                    <FileText className="size-3.5 text-ink-3" />
                    <p className="text-[0.8125rem] font-medium">What you are buying</p>
                  </div>
                  <ul className="divide-y divide-line">
                    {Array.from(new Set(items.map((i) => i.line.license))).map((tier) => {
                      const info = terms.find((x) => x.license === tier);
                      return (
                        <li key={tier} className="px-4 py-3">
                          <p className="text-[0.8125rem] font-medium">
                            {info?.name ?? tier} licence
                            <span className="ml-2 font-normal text-ink-3">{info?.seats}</span>
                          </p>
                          <p className="mt-0.5 text-[0.75rem] text-ink-2">{info?.summary}</p>
                          {info?.terms && (
                            <p className="mt-1 text-[0.6875rem] leading-relaxed text-ink-3">{info.terms}</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="border-t border-line px-4 py-2.5 text-[0.6875rem] text-ink-3">
                    Full terms on the{" "}
                    <Link to="/page/licensing" className="underline underline-offset-2 hover:text-ink">
                      licensing page
                    </Link>
                    . A licence certificate is issued with every order.
                  </p>
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
              <Button
                variant="ghost"
                onClick={() => setStep((s) => (allFree && s === 2 ? 0 : s - 1))}
                disabled={processing}
              >
                <ChevronLeft className="size-4" /> Back
              </Button>
            )}
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden text-[0.6875rem] text-ink-3 sm:block">
                {step === 2 ? `Total ${money(total)}` : "No charge until you confirm"}
              </span>
              {step < 2 ? (
                <Button
                  size="lg"
                  onClick={() => setStep((s) => (allFree && s === 0 ? 2 : s + 1))}
                  disabled={!canContinue}
                >
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
              {items.map(({ product, tier, price, listPrice }) => (
                <li key={product.slug} className="flex items-center gap-3">
                  <ProductArt {...product.art} kind={product.art.kind} className="size-11 shrink-0 rounded-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.75rem] font-medium">{product.name}</p>
                    <p className="text-[0.625rem] text-ink-3">
                      {tier.name} license
                      {listPrice > price ? " · on sale" : ""}
                    </p>
                  </div>
                  <span className="text-right font-mono text-[0.75rem]">
                    {listPrice > price && (
                      <span className="mr-1.5 text-[0.625rem] text-ink-3 line-through">{money(listPrice)}</span>
                    )}
                    {money(price)}
                  </span>
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
                { icon: Lock, t: "Webhook-verified payment" },
                { icon: Coins, t: "Crypto · USDT, USDC, BTC" },
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

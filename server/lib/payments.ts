/**
 * Payment providers.
 *
 * Deliberately an interface with two implementations rather than a pile of
 * `if (provider === ...)` scattered through the checkout route:
 *
 *   nowpayments — real hosted invoices, USDT/USDC/BTC/… on low-fee chains.
 *   sandbox     — a local, deterministic stand-in used when no API key is
 *                 configured. It speaks the same shapes so the rest of the
 *                 system cannot tell the difference, and its webhooks are
 *                 signed with the same scheme.
 *
 * Nothing in here trusts the browser. `verifyWebhook` is the only way an order
 * can become paid, and every provider must implement it.
 */
import crypto from "node:crypto";
import { getSetting, setSetting } from "./settings-store";

export const PROVIDER_KEYS = ["nowpayments", "sandbox"] as const;
export type ProviderKey = (typeof PROVIDER_KEYS)[number];

/** Coins we offer. Chosen for low network fees and stable value. */
export type PayOption = {
  /** provider currency code */
  code: string;
  /** ticker shown to humans */
  ticker: string;
  name: string;
  network: string;
  /** EVM/Solana/TRON addresses are case-sensitive-ish; kept for display only */
  kind: "stable" | "coin";
  note: string;
  /** chains we treat as low-fee for small software purchases */
  cheap: boolean;
};

export const PAY_OPTIONS: PayOption[] = [
  {
    code: "usdttrc20",
    ticker: "USDT",
    name: "Tether",
    network: "TRON (TRC-20)",
    kind: "stable",
    note: "~$1 fee",
    cheap: true,
  },
  {
    code: "usdtbsc",
    ticker: "USDT",
    name: "Tether",
    network: "BNB Smart Chain (BEP-20)",
    kind: "stable",
    note: "~$0.20 fee",
    cheap: true,
  },
  {
    code: "usdtpolygon",
    ticker: "USDT",
    name: "Tether",
    network: "Polygon",
    kind: "stable",
    note: "~$0.02 fee",
    cheap: true,
  },
  {
    code: "usdcsol",
    ticker: "USDC",
    name: "USD Coin",
    network: "Solana",
    kind: "stable",
    note: "~$0.001 fee",
    cheap: true,
  },
  {
    code: "usdcbase",
    ticker: "USDC",
    name: "USD Coin",
    network: "Base",
    kind: "stable",
    note: "~$0.01 fee",
    cheap: true,
  },
  {
    code: "usdteth",
    ticker: "USDT",
    name: "Tether",
    network: "Ethereum (ERC-20)",
    kind: "stable",
    note: "high fee",
    cheap: false,
  },
  {
    code: "btc",
    ticker: "BTC",
    name: "Bitcoin",
    network: "Bitcoin",
    kind: "coin",
    note: "network fee varies",
    cheap: false,
  },
  {
    code: "eth",
    ticker: "ETH",
    name: "Ether",
    network: "Ethereum",
    kind: "coin",
    note: "high fee",
    cheap: false,
  },
  {
    code: "ltc",
    ticker: "LTC",
    name: "Litecoin",
    network: "Litecoin",
    kind: "coin",
    note: "~$0.01 fee",
    cheap: true,
  },
  {
    code: "sol",
    ticker: "SOL",
    name: "Solana",
    network: "Solana",
    kind: "coin",
    note: "~$0.001 fee",
    cheap: true,
  },
];

export const payOption = (code: string) => PAY_OPTIONS.find((p) => p.code === code.toLowerCase());

/** Provider-facing order states, normalised across gateways. */
export type NormalizedStatus =
  | "waiting"
  | "confirming"
  | "paid"
  | "partially_paid"
  | "failed"
  | "expired"
  | "refunded";

export type CreatedInvoice = {
  invoiceUrl: string | null;
  payAddress: string | null;
  payAmount: string | null;
  priceAmount: number;
  priceCurrency: string;
  payCurrency: string;
  network: string | null;
  providerRef: string | null;
  purchaseId: string | null;
  expiresAt: Date | null;
  status: NormalizedStatus;
  /** true when the gateway is the local sandbox */
  sandbox: boolean;
};

export type ProviderConfig = {
  apiKey: string;
  ipnSecret: string;
  /** public base URL the gateway can call back */
  baseUrl: string;
  /** payout wallet, shown in admin for reconciliation */
  payoutWallet: string;
  /** "test" routes to the gateway sandbox, "live" does not */
  mode: "test" | "live";
};

const SETTINGS_KEY = "crypto";

/**
 * Credentials resolve env-first, then the settings row written by the admin
 * panel. Env wins so a deployment can override a stale database value without
 * anyone logging in.
 */
export async function providerConfig(): Promise<ProviderConfig> {
  const stored = (await getSetting<Partial<ProviderConfig>>(SETTINGS_KEY)) ?? {};
  const env = process.env;
  const mode = (env.NOWPAYMENTS_MODE as ProviderConfig["mode"]) || stored.mode || "test";
  return {
    apiKey: env.NOWPAYMENTS_API_KEY || stored.apiKey || "",
    ipnSecret: env.NOWPAYMENTS_IPN_SECRET || stored.ipnSecret || "",
    baseUrl: env.PUBLIC_BASE_URL || stored.baseUrl || "http://localhost:8787",
    payoutWallet: env.NOWPAYMENTS_PAYOUT_WALLET || stored.payoutWallet || "",
    mode: mode === "live" ? "live" : "test",
  };
}

/** The secret used to sign callbacks. Sandbox and NowPayments share the scheme. */
export async function ipnSecret(): Promise<string> {
  const { ipnSecret: secret } = await providerConfig();
  // A fixed dev fallback keeps local runs testable; in production an unset
  // secret must fail closed, which `verifyWebhook` enforces.
  if (secret) return secret;
  // In production an unsigned IPN would let anyone mark an order paid.
  if (process.env.NODE_ENV === "production") return "";
  return "dev-ipn-secret-change-me";
}

export async function saveProviderConfig(patch: Partial<ProviderConfig>) {
  const current = (await getSetting<Partial<ProviderConfig>>(SETTINGS_KEY)) ?? {};
  await setSetting(SETTINGS_KEY, { ...current, ...patch });
}

/** Which implementation is live right now. */
export async function activeProvider(): Promise<ProviderKey> {
  const { apiKey } = await providerConfig();
  return apiKey ? "nowpayments" : "sandbox";
}

/**
 * True when checkout can actually take money.
 *
 * In production a missing gateway key must be a loud misconfiguration, not a
 * quiet fall-through to the sandbox: the sandbox would happily accept orders
 * and never collect a cent. Callers use this to refuse checkout with a clear
 * message instead of creating an invoice nobody can pay.
 */
export async function paymentsConfigured(): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return true;
  const { apiKey, ipnSecret } = await providerConfig();
  return Boolean(apiKey && ipnSecret);
}

export interface Provider {
  key: ProviderKey;
  label: string;
  createInvoice(input: {
    priceUsdCents: number;
    payCurrency: string;
    orderNumber: string;
    description: string;
    callbackUrl: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CreatedInvoice>;
  fetchStatus(providerRef: string): Promise<{ status: NormalizedStatus; raw: unknown }>;
  verifyWebhook(rawBody: string, signature: string | null, secret: string): boolean;
  normalizeStatus(raw: string): NormalizedStatus;
}

/* ----------------------------------------------------------- normalisation */

/** Both gateways use slightly different words; collapse them to ours. */
export function normalizeStatus(raw: string): NormalizedStatus {
  switch (raw) {
    case "waiting":
    case "pending":
      return "waiting";
    case "confirming":
    case "sending":
      return "confirming";
    case "confirmed":
    case "finished":
    case "paid":
    case "succeeded":
      return "paid";
    case "partially_paid":
      return "partially_paid";
    case "failed":
    case "error":
      return "failed";
    case "expired":
      return "expired";
    case "refunded":
      return "refunded";
    default:
      return "waiting";
  }
}

const API = "https://api.nowpayments.io/v1";

async function np(path: string, init: RequestInit = {}) {
  const { apiKey } = await providerConfig();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(
      `NOWPayments ${path} failed (${res.status}): ${
        typeof body === "object" ? JSON.stringify(body).slice(0, 300) : String(body).slice(0, 300)
      }`,
    );
  }
  return body as Record<string, unknown>;
}

export const nowpayments: Provider = {
  key: "nowpayments",
  label: "NOWPayments",
  normalizeStatus,

  async createInvoice(input) {
    const body = await np("/invoice", {
      method: "POST",
      body: JSON.stringify({
        price_amount: input.priceUsdCents / 100,
        price_currency: "usd",
        pay_currency: input.payCurrency,
        order_id: input.orderNumber,
        order_description: input.description.slice(0, 200),
        ipn_callback_url: input.callbackUrl,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      }),
    });

    return {
      invoiceUrl: typeof body.invoice_url === "string" ? body.invoice_url : null,
      payAddress: typeof body.pay_address === "string" ? body.pay_address : null,
      payAmount: body.pay_amount != null ? String(body.pay_amount) : null,
      priceAmount: input.priceUsdCents,
      priceCurrency: "usd",
      payCurrency: input.payCurrency,
      network: typeof body.network === "string" ? body.network : null,
      providerRef: null,
      purchaseId: typeof body.id === "string" ? body.id : null,
      expiresAt: null,
      status: "waiting",
      sandbox: false,
    };
  },

  async fetchStatus(providerRef) {
    const body = await np(`/payment/${encodeURIComponent(providerRef)}`);
    const raw = String(body.payment_status ?? "");
    return { status: normalizeStatus(raw), raw: body };
  },

  /**
   * NOWPayments signs the body as HMAC-SHA512 over the JSON with keys sorted
   * alphabetically. We re-serialise from the parsed object (not the raw bytes)
   * because that is what their documented verifiers do — it survives proxies
   * that re-encode the body.
   */
  verifyWebhook(rawBody, signature, secret) {
    if (!signature || !secret) return false;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return false;
    }
    const sorted = JSON.stringify(parsed, Object.keys(parsed).sort());
    const expected = crypto.createHmac("sha512", secret).update(sorted).digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  },
};

/**
 * Local sandbox.
 *
 * Used when no API key is present so the whole pipeline — invoice, webhook,
 * verification, delivery — can be exercised honestly offline. Addresses are
 * derived from the invoice id so they are stable and obviously fake, and the
 * "invoice page" is served by our own API rather than a third party.
 */
export const sandbox: Provider = {
  key: "sandbox",
  label: "Sandbox (local)",
  normalizeStatus,

  async createInvoice(input) {
    const id = crypto.randomBytes(9).toString("hex");
    const pay = payOption(input.payCurrency);
    return {
      invoiceUrl: `/api/webhooks/sandbox/${id}`,
      // Deterministic pseudo-address; never a real wallet.
      payAddress: sandboxAddress(input.payCurrency, id),
      payAmount: (input.priceUsdCents / 100).toFixed(pay?.kind === "stable" ? 2 : 6),
      priceAmount: input.priceUsdCents,
      priceCurrency: "usd",
      payCurrency: input.payCurrency,
      network: pay?.network ?? null,
      providerRef: id,
      purchaseId: id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      status: "waiting",
      sandbox: true,
    };
  },

  async fetchStatus() {
    // The sandbox has no external state; status only moves via webhooks.
    return { status: "waiting", raw: { sandbox: true } };
  },

  verifyWebhook(rawBody, signature, secret) {
    if (!signature || !secret) return false;
    const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  },
};

/** Stable, obviously-not-real address per (currency, invoice). */
export function sandboxAddress(currency: string, id: string): string {
  const h = crypto.createHash("sha256").update(`${currency}:${id}`).digest("hex");
  if (currency.startsWith("usdttrc")) return `T${h.slice(0, 33)}`;
  if (currency === "btc") return `bc1q${h.slice(0, 38)}`;
  if (currency === "ltc") return `ltc1q${h.slice(0, 38)}`;
  return `0x${h.slice(0, 40)}`;
}

export async function getProvider(): Promise<Provider> {
  return (await activeProvider()) === "nowpayments" ? nowpayments : sandbox;
}

/** Build the payload the sandbox signs, so tests use the real code path. */
export function signSandboxPayload(payload: unknown, secret: string): string {
  return crypto.createHmac("sha512", secret).update(JSON.stringify(payload)).digest("hex");
}

/**
 * The invoice link to show a customer.
 *
 * Sandbox links are derived from the provider ref rather than read from the
 * database: rows written before the route was renamed still point at
 * `/api/pay/sandbox/...`, and a stored dead link is worse than no link.
 */
export function invoiceUrlFor(session: {
  provider: string;
  providerRef: string | null;
  invoiceUrl: string | null;
}): string | null {
  if (session.provider === "sandbox" && session.providerRef) {
    return `/api/webhooks/sandbox/${session.providerRef}`;
  }
  return session.invoiceUrl;
}

/** usdttrc20 → USDT, usdcsol → USDC. Display only; never used for matching. */
export function tickerFor(code: string): string {
  const m = code.match(/^(usdt|usdc)/i);
  return m ? m[1].toUpperCase() : code.toUpperCase();
}

/** Crypto amounts keep 2dp for stablecoins, 6dp for everything else. */
export function formatPayAmount(amount: string | null, currency: string): string {
  if (!amount) return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  return /^usdt|^usdc/i.test(currency) ? n.toFixed(2) : n.toFixed(6);
}

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine, License } from "@/data/types";
import { productBySlug } from "@/data/catalog";
import { authApi, type SessionUser } from "./api";
import { useAuth } from "./use-auth";

/* ------------------------------------------------------------------ theme */
type Theme = "light" | "dark";
interface ThemeState {
  theme: Theme;
  toggle: () => void;
  set: (t: Theme) => void;
}
const applyTheme = (t: Theme) => {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(t);
  root.style.colorScheme = t;
};
export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "light",
      toggle: () => {
        const next = get().theme === "light" ? "dark" : "light";
        applyTheme(next);
        set({ theme: next });
      },
      set: (t) => {
        applyTheme(t);
        set({ theme: t });
      },
    }),
    {
      name: "kiln-theme",
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    },
  ),
);

/* ------------------------------------------------------------------ cart */
interface CartState {
  lines: CartLine[];
  coupon: string | null;
  add: (productSlug: string, license?: License) => void;
  remove: (productSlug: string) => void;
  setLicense: (productSlug: string, license: License) => void;
  clear: () => void;
  applyCoupon: (code: string) => boolean;
  removeCoupon: () => void;
}

/**
 * Coupon cache.
 *
 * Codes live in the database and are validated server-side at checkout. The
 * store keeps the validated rate only so the cart can show the discount before
 * the order is placed — the authoritative figure always comes back from the API.
 */
export const COUPONS: Record<string, number> = {};
let couponRate = 0;

export async function validateCoupon(code: string, subtotal: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/coupons/validate", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, subtotal }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? "That code is not valid." };
    const rate = subtotal > 0 ? data.discount / subtotal : 0;
    COUPONS[code.trim().toUpperCase()] = rate;
    couponRate = rate;
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not check that code." };
  }
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      coupon: null,
      add: (productSlug, license) => {
        const product = productBySlug(productSlug);
        if (!product) return;
        if (get().lines.some((l) => l.productSlug === productSlug)) return;
        const fallback: License = (product.tiers[0]?.license ?? "personal") as License;
        set({ lines: [...get().lines, { productSlug, license: license ?? fallback }] });
      },
      remove: (productSlug) =>
        set({ lines: get().lines.filter((l) => l.productSlug !== productSlug) }),
      setLicense: (productSlug, license) =>
        set({
          lines: get().lines.map((l) => (l.productSlug === productSlug ? { ...l, license } : l)),
        }),
      clear: () => set({ lines: [], coupon: null }),
      applyCoupon: (code) => {
        const upper = code.trim().toUpperCase();
        if (COUPONS[upper] !== undefined) {
          set({ coupon: upper });
          return true;
        }
        return false;
      },
      removeCoupon: () => set({ coupon: null }),
    }),
    { name: "kiln-cart" },
  ),
);

/**
 * The same sale maths the server uses (`server/lib/pricing.ts`): a live sale is
 * a ratio applied to every tier, so the cart never quotes a price the checkout
 * will not charge. The server still re-prices everything; this is display only.
 */
export function saleRatio(product: { price: number; salePrice?: number | null; saleEndsAt?: string | null }) {
  if (product.salePrice == null || product.price <= 0) return 1;
  if (product.salePrice >= product.price) return 1;
  if (product.saleEndsAt && new Date(product.saleEndsAt).getTime() <= Date.now()) return 1;
  return product.salePrice / product.price;
}

export function useCartTotals() {
  const { lines, coupon } = useCart();
  const items = lines.flatMap((line) => {
    const product = productBySlug(line.productSlug);
    if (!product) return [];
    const tier = product.tiers.find((t) => t.license === line.license) ?? product.tiers[0];
    const listPrice = tier?.price ?? product.price;
    const ratio = saleRatio(product);
    return [{ line, product, tier, listPrice, price: Math.round(listPrice * ratio) }];
  });
  const subtotal = items.reduce((n, i) => n + i.price, 0);
  const rate = coupon ? (COUPONS[coupon] ?? couponRate ?? 0) : 0;
  const discount = Math.round(subtotal * rate);
  // Digital goods: no sales tax is collected by this store.
  const tax = 0;
  const total = Math.max(0, subtotal - discount + tax);
  return { items, subtotal, discount, tax, total, coupon, count: items.length };
}

/* ------------------------------------------------------------------ wishlist */
interface WishlistState {
  slugs: string[];
  toggle: (slug: string) => void;
  has: (slug: string) => boolean;
}
export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      slugs: ["beacon-analytics", "ledger-billing"],
      toggle: (slug) =>
        set({
          slugs: get().slugs.includes(slug)
            ? get().slugs.filter((s) => s !== slug)
            : [...get().slugs, slug],
        }),
      has: (slug) => get().slugs.includes(slug),
    }),
    { name: "kiln-wishlist" },
  ),
);

/* ------------------------------------------------------------------ session */
export type Role = "customer" | "admin";
/**
 * Session view for the storefront.
 *
 * The old version persisted a fake signed-in user so the UI had something to
 * render. Now the real cookie session is the only source of truth: `useSession`
 * exposes it in the shape the header and account pages already expect, and
 * `signOut` calls the API so the session row is destroyed server-side.
 */
const shapeUser = (u: SessionUser | null) =>
  u
    ? {
        name: u.name,
        email: u.email,
        initials: u.name
          .split(" ")
          .map((p) => p[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        role: u.role === "admin" || u.role === "owner" ? "admin" : "customer",
        country: u.country ?? null,
        createdAt: u.createdAt,
        emailVerified: u.emailVerified,
      }
    : null;

export function useSession() {
  const { user, loading } = useAuth();
  return {
    user: shapeUser(user),
    loading,
    signIn: () => {
      /* sign-in always goes through authApi (see pages/auth) */
    },
    signOut: () => {
      void authApi.logout();
    },
  };
}

/* ------------------------------------------------------------------ recently viewed */
interface RecentState {
  slugs: string[];
  push: (slug: string) => void;
}
export const useRecent = create<RecentState>()(
  persist(
    (set, get) => ({
      slugs: [],
      push: (slug) => set({ slugs: [slug, ...get().slugs.filter((s) => s !== slug)].slice(0, 6) }),
    }),
    { name: "kiln-recent" },
  ),
);

/* ------------------------------------------------------------------ search history */
interface HistoryState {
  items: string[];
  push: (term: string) => void;
  clear: () => void;
}
export const useSearchHistory = create<HistoryState>()(
  persist(
    (set, get) => ({
      items: ["stripe billing", "admin table"],
      push: (term) =>
        set({ items: [term, ...get().items.filter((t) => t.toLowerCase() !== term.toLowerCase())].slice(0, 6) }),
      clear: () => set({ items: [] }),
    }),
    { name: "kiln-search-history" },
  ),
);

/* ------------------------------------------------------------------ search ui */
interface UiState {
  searchOpen: boolean;
  cartOpen: boolean;
  mobileNavOpen: boolean;
  setSearch: (v: boolean) => void;
  setCart: (v: boolean) => void;
  setMobileNav: (v: boolean) => void;
}
export const useUi = create<UiState>((set) => ({
  searchOpen: false,
  cartOpen: false,
  mobileNavOpen: false,
  setSearch: (v) => set({ searchOpen: v }),
  setCart: (v) => set({ cartOpen: v }),
  setMobileNav: (v) => set({ mobileNavOpen: v }),
}));

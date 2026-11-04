import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine, License } from "@/data/types";
import { productBySlug } from "@/data/catalog";

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

export const COUPONS: Record<string, number> = { LAUNCH25: 0.25, WELCOME10: 0.1, BLACKFRIDAY: 0.4 };

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

export function useCartTotals() {
  const { lines, coupon } = useCart();
  const items = lines.flatMap((line) => {
    const product = productBySlug(line.productSlug);
    if (!product) return [];
    const tier = product.tiers.find((t) => t.license === line.license) ?? product.tiers[0];
    return [{ line, product, tier, price: tier?.price ?? product.price }];
  });
  const subtotal = items.reduce((n, i) => n + i.price, 0);
  const discount = coupon ? Math.round(subtotal * (COUPONS[coupon] ?? 0)) : 0;
  const tax = Math.round((subtotal - discount) * 0.075);
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
interface SessionState {
  user: { name: string; email: string; initials: string; role: Role } | null;
  signIn: (email: string, role?: Role) => void;
  signOut: () => void;
}
export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: { name: "Amara Okafor", email: "amara@okafor.design", initials: "AO", role: "customer" },
      signIn: (email, role = "customer") => {
        const name = email.includes("admin")
          ? "Kiln Admin"
          : email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        const initials = name
          .split(" ")
          .map((p) => p[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        set({ user: { name, email, initials, role } });
      },
      signOut: () => set({ user: null }),
    }),
    { name: "kiln-session" },
  ),
);

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

/**
 * Live catalogue.
 *
 * The Step 1 UI reads plain arrays (`products`, `categories`, …) from
 * `@/data/catalog`. Rather than rewrite 47 components, those arrays are backed
 * by one observable snapshot that is hydrated from `/api/catalog`.
 *
 * Reads stay synchronous, so component code is untouched: an admin write bumps
 * the version, subscribed pages re-render, and `saveCatalog()` republishes the
 * arrays in place.
 */
import * as React from "react";
import type {
  ActivityEntry,
  Author,
  Category,
  Collection,
  Coupon,
  Customer,
  Order,
  Product,
  Review,
} from "@/data/types";

export interface HomepageSection {
  id: string;
  key: string;
  label: string;
  enabled: boolean;
  position: number;
  config: Record<string, unknown>;
}

export interface CatalogStats {
  products: number;
  customers: number;
  downloads: number;
  reviews: number;
}

export interface CatalogState {
  products: Product[];
  categories: Category[];
  authors: Author[];
  reviews: Review[];
  collections: Collection[];
  customers: Customer[];
  orders: Order[];
  coupons: Coupon[];
  activity: ActivityEntry[];
  sections: HomepageSection[];
  announcement: { id: string; text: string; href: string | null } | null;
  settings: Record<string, unknown>;
  stats: CatalogStats | null;
  loadedAt: number | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
}

export const state: CatalogState = {
  products: [],
  categories: [],
  authors: [],
  reviews: [],
  collections: [],
  customers: [],
  orders: [],
  coupons: [],
  activity: [],
  sections: [],
  announcement: null,
  settings: {},
  stats: null,
  loadedAt: null,
  status: "idle",
  error: null,
};

/* ------------------------------------------------------------------ internals */

const listeners = new Set<() => void>();
let version = 0;
let inFlight: Promise<void> | null = null;
/** Runs after every successful load (the catalogue module republishes arrays). */
const afterLoad = new Set<() => void>();

export function onCatalogLoad(fn: () => void) {
  afterLoad.add(fn);
  return () => afterLoad.delete(fn);
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit() {
  version += 1;
  for (const fn of listeners) fn();
}

export const getVersion = () => version;

/* ------------------------------------------------------------------ loading */

export async function loadCatalog(force = false): Promise<void> {
  if (inFlight && !force) return inFlight;
  if (!force && state.status === "ready" && state.loadedAt && Date.now() - state.loadedAt < 15_000) return;

  state.status = "loading";
  emit();

  inFlight = (async () => {
    try {
      const res = await fetch("/api/catalog", { credentials: "include" });
      if (!res.ok) throw new Error(`Catalogue request failed (${res.status})`);
      const data = await res.json();

      // The database is authoritative from here on.
      state.products = data.products ?? [];
      state.categories = data.categories ?? [];
      state.authors = data.authors ?? [];
      state.reviews = data.reviews ?? [];
      state.collections = data.collections ?? [];
      state.sections = data.sections ?? [];
      state.announcement = data.announcement ?? null;
      state.settings = data.settings ?? {};
      state.loadedAt = Date.now();
      state.status = "ready";
      state.error = null;

      for (const fn of afterLoad) fn();
      emit();

      // Counter strip on the marketing pages.
      fetch("/api/stats", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => {
          if (s) {
            state.stats = s;
            for (const fn of afterLoad) fn();
            emit();
          }
        })
        .catch(() => {});
    } catch (err) {
      state.status = state.loadedAt ? "ready" : "error";
      state.error = err instanceof Error ? err.message : "Could not load the catalogue";
      emit();
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/* -------------------------------------------------------------- accessors */

export const productBySlug = (slug: string) => state.products.find((p) => p.slug === slug);
export const authorBySlug = (slug: string) => state.authors.find((a) => a.slug === slug);
export const categoryBySlug = (slug: string) => state.categories.find((c) => c.slug === slug);
export const reviewsFor = (slug: string) => state.reviews.filter((r) => r.productSlug === slug);

/** Public storefront view: published rows only. */
export function publishedProducts(): Product[] {
  return state.products.filter((p) => p.status === "published");
}

/** Cheap re-render key for memo dependencies. */
export function useCatalogVersion(): number {
  return React.useSyncExternalStore(subscribe, getVersion, getVersion);
}

/** React binding: re-renders whenever the catalogue changes. */
export function useCatalog(): CatalogState {
  React.useSyncExternalStore(subscribe, getVersion, getVersion);
  return state;
}

export function usePublished(): Product[] {
  useCatalog();
  return publishedProducts();
}

/* ------------------------------------------------------- admin-only data */

/**
 * Customers, orders and coupons are large and private, so they are fetched
 * lazily — only once an admin session exists, and only for the admin panel.
 */
export async function loadAdminData(force = false): Promise<void> {
  if (adminInFlight && !force) return adminInFlight;
  if (!force && adminLoadedAt && Date.now() - adminLoadedAt < 10_000) return;

  adminInFlight = (async () => {
    try {
      const [customersRes, ordersRes, couponsRes, activityRes] = await Promise.all([
        fetch("/api/admin/customers", { credentials: "include" }),
        fetch("/api/admin/orders", { credentials: "include" }),
        fetch("/api/admin/coupons", { credentials: "include" }),
        fetch("/api/admin/activity", { credentials: "include" }),
      ]);
      if (customersRes.ok) state.customers = (await customersRes.json()).customers ?? [];
      if (ordersRes.ok) state.orders = (await ordersRes.json()).orders ?? [];
      if (couponsRes.ok) state.coupons = (await couponsRes.json()).coupons ?? [];
      if (activityRes.ok) {
        state.activity = ((await activityRes.json()).activity ?? []).map(
          (row: { id: string; actor: string; action: string; target: string; createdAt: string; kind: string }) => ({
            id: row.id,
            actor: row.actor,
            action: row.action,
            target: row.target,
            at: row.createdAt,
            kind: row.kind,
          }),
        );
      }
      adminLoadedAt = Date.now();
      for (const fn of afterLoad) fn();
      emit();
    } catch {
      /* admin panel renders its own empty states */
    } finally {
      adminInFlight = null;
    }
  })();

  return adminInFlight;
}

let adminInFlight: Promise<void> | null = null;
let adminLoadedAt: number | null = null;
export const getAdminLoadedAt = () => adminLoadedAt;

export type License = "personal" | "commercial" | "extended";

export type ProductStatus = "published" | "draft" | "review" | "archived";

export interface Category {
  slug: string;
  name: string;
  blurb: string;
  /** tailwind-safe gradient pair used for generated category art */
  from: string;
  to: string;
  glyph: string;
  parent?: string;
  /** reference cover image; falls back to the gradient when absent */
  src?: string;
}

export interface Author {
  slug: string;
  name: string;
  role: string;
  bio: string;
  verified: boolean;
  avatar: string;
  items: number;
  sales: number;
  rating: number;
  joined: string;
  location: string;
  links: { label: string; href: string }[];
}

export interface Review {
  id: string;
  productSlug: string;
  author: string;
  initials: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  helpful: number;
  verified: boolean;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  notes: string[];
}

export interface PricingTier {
  license: License;
  name: string;
  price: number;
  compareAt?: number;
  summary: string;
  includes: string[];
  seats: string;
  popular?: boolean;
}

export type ArtKind = "window" | "grid" | "terminal" | "waves";

/** Fallback gradient art. When `src` is present the image wins; if it fails to
 *  load the component falls back to the gradient rather than showing a broken
 *  image icon. This keeps the UI intact until real assets are dropped in. */
export interface ArtSpec {
  from: string;
  to: string;
  ink: string;
  kind: ArtKind;
  src?: string;
  alt?: string;
}

export interface GalleryItem extends ArtSpec {
  id: string;
  caption: string;
}

export interface Product {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  stack: string[];
  status: ProductStatus;
  price: number;
  compareAt?: number;
  rating: number;
  reviews: number;
  sales: number;
  views: number;
  author: string;
  featured: boolean;
  trending: boolean;
  free: boolean;
  new: boolean;
  bestseller: boolean;
  updated: string;
  released: string;
  version: string;
  license: string;
  /** art direction for the cover — `src` swaps the generated art for a real image */
  art: ArtSpec;
  description: string;
  features: { title: string; body: string }[];
  highlights: string[];
  includes: string[];
  requirements: string[];
  tiers: PricingTier[];
  changelog: ChangelogEntry[];
  gallery: GalleryItem[];
}

export interface Collection {
  slug: string;
  name: string;
  blurb: string;
  products: string[];
  from: string;
  to: string;
  /** reference cover image; falls back to the gradient when absent */
  src?: string;
}

export interface CartLine {
  productSlug: string;
  license: License;
}

export interface Order {
  id: string;
  date: string;
  status: "completed" | "refunded" | "pending";
  total: number;
  items: { productSlug: string; license: License; price: number }[];
  payment: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  initials: string;
  orders: number;
  spent: number;
  joined: string;
  status: "active" | "invited" | "blocked";
  country: string;
}

export interface Coupon {
  code: string;
  kind: "percent" | "fixed";
  value: number;
  uses: number;
  limit: number;
  expires: string;
  status: "active" | "scheduled" | "expired";
}

export interface ActivityEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  at: string;
  kind: "product" | "order" | "customer" | "settings" | "content" | "promo";
}

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  read: number;
  from: string;
  to: string;
  /** reference hero image; falls back to the gradient when absent */
  src?: string;
}

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
  /** art direction for the generated cover */
  art: { from: string; to: string; ink: string; kind: "window" | "grid" | "terminal" | "waves" };
  description: string;
  features: { title: string; body: string }[];
  highlights: string[];
  includes: string[];
  requirements: string[];
  tiers: PricingTier[];
  changelog: ChangelogEntry[];
  gallery: { id: string; caption: string; from: string; to: string; ink: string; kind: "window" | "grid" | "terminal" | "waves" }[];
}

export interface Collection {
  slug: string;
  name: string;
  blurb: string;
  products: string[];
  from: string;
  to: string;
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
}

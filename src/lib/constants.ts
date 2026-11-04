export const SITE = {
  name: "Kiln",
  tagline: "Production-ready source code from one small studio.",
  domain: "kiln.dev",
  email: "hello@kiln.dev",
  support: "support@kiln.dev",
  phone: "+351 21 000 1180",
  address: "Rua da Boavista 118, 1200-068 Lisbon, Portugal",
  founded: 2021,
};

export const FREE_SHIPPING_THRESHOLD = 20000;

export const NAV = [
  { label: "Browse", to: "/browse" },
  { label: "Categories", to: "/browse", mega: true },
  { label: "Collections", to: "/collections" },
  { label: "Free", to: "/free" },
  { label: "Journal", to: "/blog" },
];

export const SORT_OPTIONS = [
  { value: "popular", label: "Most popular" },
  { value: "newest", label: "Newest first" },
  { value: "rating", label: "Highest rated" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
] as const;

export const STACK_FILTERS = [
  "React",
  "Next.js",
  "TypeScript",
  "Tailwind",
  "Node",
  "Postgres",
  "Stripe",
  "React Native",
] as const;

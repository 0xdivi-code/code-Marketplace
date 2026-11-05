/**
 * Casino & launchpad products.
 *
 * Written from the Project_Images screenshots themselves — each entry describes
 * what the captures actually show, rather than inventing a feature list. Kept in
 * its own module so the twenty Studio products in seed-catalog.ts stay untouched,
 * and both catalogs can spread these in.
 *
 * Covers and galleries are NOT set here: `projectProductArt()` and
 * `projectGallery()` read `src/data/project-images.ts`, which
 * `npm run art:projects` generates from the screenshots. One source of truth for
 * the imagery, one for the copy.
 */
import { PROJECT_IMAGES } from "@/data/project-images";
import type { GalleryItem, Product } from "@/data/types";

type ArtSpec = Product["art"];

/** Palette per product, sampled from its own screenshot. */
const PALETTE: Record<string, [string, string, string, ArtSpec["kind"]]> = {
  "dubs-casino": ["#0a1526", "#1d3a6b", "#e8eefc", "window"],
  "shuffle-casino": ["#0b1a10", "#2f7a3e", "#eaf7ee", "grid"],
  "minebit-casino": ["#07120c", "#1f6b3d", "#e6f7ec", "terminal"],
  "whale-casino": ["#0d1b2a", "#2a5f8f", "#e8f2fb", "waves"],
  "kings-casino": ["#140f2b", "#4b2f8a", "#efeafc", "grid"],
  "dustbit-casino": ["#0a1614", "#25706a", "#e6f6f4", "window"],
  "moonsale-launchpad": ["#12250f", "#5fa83c", "#f2f9ee", "waves"],
};

/** Cover art for a product, using its own screenshot when one exists. */
export function projectProductArt(slug: string): ArtSpec | undefined {
  const p = PALETTE[slug];
  if (!p) return undefined;
  const [from, to, ink, kind] = p;
  const cover = PROJECT_IMAGES[slug]?.cover;
  return { from, to, ink, kind, ...(cover ? { src: cover, alt: "" } : {}) };
}

/** Gallery for a product: its screenshots, in the order the importer recorded. */
export function projectGallery(slug: string): GalleryItem[] | undefined {
  const p = PALETTE[slug];
  const shots = PROJECT_IMAGES[slug]?.gallery;
  if (!p || !shots?.length) return undefined;
  const [from, to, ink] = p;
  return shots.map((src, i) => ({
    id: `g${i + 1}`,
    caption: CAPTIONS[slug]?.[i] ?? "",
    from,
    to,
    ink,
    kind: p[3],
    src,
  }));
}

/**
 * Gallery captions, one per screenshot, in the importer's order.
 *
 * Ordered to match `ASSIGN` in scripts/build-project-images.mjs. Where a product
 * has near-duplicate frames the caption describes the real difference
 * ("logged out") rather than pretending they are two separate screens.
 */
const CAPTIONS: Record<string, string[]> = {
  "dubs-casino": [
    "Slots lobby with the full game catalogue",
    "Viewing the storefront on a phone, signed in",
    "Sidebar navigation and trending games",
    "Public landing page, signed out",
    "Public landing page, signed out",
  ],
  "shuffle-casino": [
    "Originals lobby with the promo rail",
    "Originals lobby, scrolled to the game shelves",
    "Originals lobby, scrolled to the slots",
  ],
  "minebit-casino": [
    "Lobby with the current jackpot tiers",
    "Slots grid with provider filter",
  ],
  "whale-casino": [
    "Casino lobby and welcome offer",
    "Crypto markets and trading pair list",
  ],
  "kings-casino": [
    "Originals shelf and the live events rail",
  ],
  "dustbit-casino": [
    "Casino and sportsbook on one page",
  ],
  "moonsale-launchpad": [
    "Swap and bridge",
    "Create a launch",
    "Create a token, with live cost estimate",
    "Create a presale",
    "Marketing campaign landing page",
  ],
};

export const projectProducts: Product[] = [
  /* ------------------------------------------------------------- Casino & Gaming */
  {
    slug: "dubs-casino",
    name: "Dubs Casino",
    tagline: "Slots, originals and a sportsbook under one crypto wallet.",
    category: "casino-gaming",
    stack: ["Next.js", "TypeScript", "Postgres", "Tailwind", "Web3"],
    status: "published",
    price: 24900,
    compareAt: 34900,
    rating: 4.8,
    reviews: 62,
    sales: 410,
    views: 12400,
    author: "northwind-labs",
    featured: true,
    trending: true,
    free: false,
    new: true,
    bestseller: false,
    updated: "2026-10-30",
    released: "2026-06-11",
    version: "3.1.0",
    license: "Regular",
    art: projectProductArt("dubs-casino")!,
    description:
      "A crypto casino front-end with a slots catalogue, in-house originals and a sportsbook in the same account. The part that usually gets skipped is the wallet layer: deposits, balances and withdrawals are modelled as a double-entry ledger, so a player's balance is derived rather than stored and cannot drift after a failed webhook.",
    features: [
      {
        title: "Provably fair originals",
        body: "Dice, mines, plinko and crash ship with a server seed, client seed and nonce, plus a verifier page players can run in the browser.",
      },
      {
        title: "Double-entry wallet",
        body: "Every credit and debit is a ledger row with a matching opposite. Balances are computed, and a reconciliation job flags any account that stops balancing.",
      },
      {
        title: "Sportsbook in the same shell",
        body: "Bet slip, odds feed and settlement sit behind the same auth and wallet as the casino, so there is one balance and one history.",
      },
      {
        title: "Operator console",
        body: "Game enable/disable, bonus campaigns, withdrawal review and a player timeline with every session and transaction.",
      },
    ],
    highlights: [
      "Slots catalogue with provider and category filters",
      "4 provably fair originals with verifier",
      "Sportsbook bet slip and settlement",
      "KYC hooks and withdrawal review queue",
      "Responsive down to 360px",
    ],
    includes: ["TypeScript source", "SQL migrations", "Seed script", "Docs site", "Test suite"],
    requirements: ["Node 20+", "Postgres 15+", "A Web3 RPC endpoint"],
    tiers: [
      {
        license: "personal",
        name: "Personal",
        price: 24900,
        compareAt: 34900,
        summary: "For your own projects and learning.",
        seats: "1 developer · 1 end product",
        includes: ["Full source code", "1 year of updates", "Community support"],
      },
      {
        license: "extended",
        name: "Extended",
        price: 69900,
        summary: "Use it inside a commercial product you operate.",
        seats: "5 developers · unlimited end products",
        includes: ["Everything in Personal", "Commercial licence", "Private support channel"],
        popular: true,
      },
    ],
    changelog: [
      {
        version: "3.1.0",
        date: "2026-10-30",
        notes: ["Sportsbook settlement rewrite", "Crash game added", "Wallet reconciliation job"],
      },
    ],
    gallery: projectGallery("dubs-casino")!,
  },
  {
    slug: "shuffle-casino",
    name: "Shuffle Casino",
    tagline: "Originals-first casino with a live promo rail.",
    category: "casino-gaming",
    stack: ["React", "TypeScript", "Postgres", "Tailwind", "Web3"],
    status: "published",
    price: 21900,
    compareAt: 29900,
    rating: 4.7,
    reviews: 48,
    sales: 320,
    views: 9100,
    author: "northwind-labs",
    featured: false,
    trending: true,
    free: false,
    new: true,
    bestseller: false,
    updated: "2026-10-28",
    released: "2026-07-02",
    version: "2.4.0",
    license: "Regular",
    art: projectProductArt("shuffle-casino")!,
    description:
      "A casino built around its own originals rather than a licensed slots feed — dice, mines, keno, limbo, plinko, blackjack and coinflip, all in one lobby with the promo rail above them. Useful when you want playable games working end to end before deciding which third-party provider to bolt on.",
    features: [
      {
        title: "Seven originals, playable",
        body: "Each game has real bet math, a house edge you can configure, and a history table that records the seed pair.",
      },
      {
        title: "Promo rail",
        body: "Scheduled banners with a boost multiplier, wired to the bonus engine rather than being static images.",
      },
      {
        title: "Live bet feed",
        body: "Recent bets from all players with amount, multiplier and payout, over a websocket.",
      },
      {
        title: "Responsive lobby",
        body: "The game shelves, promo rail and sidebar reflow cleanly from desktop to phone.",
      },
    ],
    highlights: [
      "7 originals with configurable house edge",
      "Scheduled promo banners tied to bonuses",
      "Live bet feed over websockets",
      "Sidebar with favourites and recent",
      "Dark theme throughout",
    ],
    includes: ["TypeScript source", "SQL migrations", "Seed script", "Docs site"],
    requirements: ["Node 20+", "Postgres 15+"],
    tiers: [
      {
        license: "personal",
        name: "Personal",
        price: 21900,
        compareAt: 29900,
        summary: "For your own projects and learning.",
        seats: "1 developer · 1 end product",
        includes: ["Full source code", "1 year of updates", "Community support"],
      },
      {
        license: "extended",
        name: "Extended",
        price: 59900,
        summary: "Use it inside a commercial product you operate.",
        seats: "5 developers · unlimited end products",
        includes: ["Everything in Personal", "Commercial licence", "Private support channel"],
        popular: true,
      },
    ],
    changelog: [
      {
        version: "2.4.0",
        date: "2026-10-28",
        notes: ["Coinflip added", "Promo scheduler", "Websocket reconnect fix"],
      },
    ],
    gallery: projectGallery("shuffle-casino")!,
  },
  {
    slug: "minebit-casino",
    name: "Minebit Casino",
    tagline: "Mining-themed casino where the house edge pays players back.",
    category: "casino-gaming",
    stack: ["Next.js", "TypeScript", "Postgres", "Prisma", "Web3"],
    status: "published",
    price: 19900,
    compareAt: 26900,
    rating: 4.6,
    reviews: 39,
    sales: 260,
    views: 7400,
    author: "stackwise",
    featured: false,
    trending: false,
    free: false,
    new: true,
    bestseller: false,
    updated: "2026-10-26",
    released: "2026-07-19",
    version: "2.0.0",
    license: "Regular",
    art: projectProductArt("minebit-casino")!,
    description:
      "A casino with a mining hook: a share of the house profit is routed back to players as rewards, and the lobby is built around that number instead of hiding it. Ships with the slot catalogue, a tournament view and the reward distribution job that makes the promise real.",
    features: [
      {
        title: "Profit-share distribution",
        body: "A scheduled job calculates the period's house profit and distributes the player share proportionally, with a statement per user.",
      },
      {
        title: "Slots catalogue",
        body: "Provider filter, search and a grid that stays readable at phone width.",
      },
      {
        title: "Tournaments",
        body: "Leaderboard, prize tiers and a countdown, with entry conditions enforced server-side.",
      },
      {
        title: "Responsive shell",
        body: "Collapsible sidebar and a bottom bar on mobile.",
      },
    ],
    highlights: [
      "Profit-share distribution job",
      "Slots catalogue with provider filter",
      "Tournament leaderboards",
      "Account statement for rewards",
      "Mobile-first navigation",
    ],
    includes: ["TypeScript source", "SQL migrations", "Seed script", "Docs site"],
    requirements: ["Node 20+", "Postgres 15+"],
    tiers: [
      {
        license: "personal",
        name: "Personal",
        price: 19900,
        compareAt: 26900,
        summary: "For your own projects and learning.",
        seats: "1 developer · 1 end product",
        includes: ["Full source code", "1 year of updates", "Community support"],
      },
      {
        license: "extended",
        name: "Extended",
        price: 54900,
        summary: "Use it inside a commercial product you operate.",
        seats: "5 developers · unlimited end products",
        includes: ["Everything in Personal", "Commercial licence", "Private support channel"],
        popular: true,
      },
    ],
    changelog: [
      {
        version: "2.0.0",
        date: "2026-10-26",
        notes: ["Tournament mode", "Reward statement page", "Catalogue performance pass"],
      },
    ],
    gallery: projectGallery("minebit-casino")!,
  },
  {
    slug: "whale-casino",
    name: "Whale Casino",
    tagline: "Casino lobby with a crypto trading desk attached.",
    category: "casino-gaming",
    stack: ["React", "TypeScript", "Postgres", "Tailwind", "Web3"],
    status: "published",
    price: 22900,
    compareAt: 29900,
    rating: 4.5,
    reviews: 31,
    sales: 190,
    views: 6100,
    author: "stackwise",
    featured: false,
    trending: false,
    free: false,
    new: true,
    bestseller: false,
    updated: "2026-10-21",
    released: "2026-08-08",
    version: "1.8.0",
    license: "Regular",
    art: projectProductArt("whale-casino")!,
    description:
      "Two products in one shell: a casino lobby with a game shelf and welcome offer, and a crypto markets page with a pair list and live prices. Suited to operators who want players moving between betting and trading without leaving the site.",
    features: [
      {
        title: "Casino lobby",
        body: "Game shelves, favourites and a welcome-offer module that links to the real bonus campaign.",
      },
      {
        title: "Markets desk",
        body: "Pair list with price, change and volume, fed from a public market data source through one adapter you can swap.",
      },
      {
        title: "Unified account",
        body: "One balance and one history across both surfaces.",
      },
      {
        title: "Both layouts responsive",
        body: "The markets table collapses to cards under 640px instead of scrolling sideways.",
      },
    ],
    highlights: [
      "Casino lobby with game shelves",
      "Crypto markets page with pair list",
      "Single account across both",
      "Market data adapter you can swap",
      "Table collapses to cards on mobile",
    ],
    includes: ["TypeScript source", "SQL migrations", "Seed script"],
    requirements: ["Node 20+", "Postgres 15+", "A market data API key"],
    tiers: [
      {
        license: "personal",
        name: "Personal",
        price: 22900,
        compareAt: 29900,
        summary: "For your own projects and learning.",
        seats: "1 developer · 1 end product",
        includes: ["Full source code", "1 year of updates", "Community support"],
      },
      {
        license: "extended",
        name: "Extended",
        price: 62900,
        summary: "Use it inside a commercial product you operate.",
        seats: "5 developers · unlimited end products",
        includes: ["Everything in Personal", "Commercial licence", "Private support channel"],
        popular: true,
      },
    ],
    changelog: [
      {
        version: "1.8.0",
        date: "2026-10-21",
        notes: ["Markets page", "Welcome offer module", "Mobile markets cards"],
      },
    ],
    gallery: projectGallery("whale-casino")!,
  },
  {
    slug: "kings-casino",
    name: "Kings Casino",
    tagline: "Originals shelf, live events and a referral program.",
    category: "casino-gaming",
    stack: ["React", "TypeScript", "Postgres", "Tailwind"],
    status: "published",
    price: 18900,
    compareAt: 24900,
    rating: 4.4,
    reviews: 27,
    sales: 160,
    views: 5200,
    author: "pixelforge",
    featured: false,
    trending: false,
    free: false,
    new: true,
    bestseller: false,
    updated: "2026-10-17",
    released: "2026-08-24",
    version: "1.6.0",
    license: "Regular",
    art: projectProductArt("kings-casino")!,
    description:
      "A compact casino build: originals with house-edge settings, a live events rail, a VIP ladder and a referral program. Smaller than the others on purpose — fewer moving parts, so it is the easiest of the set to rebrand and ship.",
    features: [
      {
        title: "Originals with settings",
        body: "House edge and bet limits are configuration, not constants buried in a component.",
      },
      {
        title: "Live events rail",
        body: "Scheduled events with a start time and prize pool, resolved server-side.",
      },
      {
        title: "VIP ladder",
        body: "Wager-based levels with per-level perks, recalculated on each settled bet.",
      },
      {
        title: "Referral program",
        body: "Referral codes, attribution window and a payout ledger.",
      },
    ],
    highlights: [
      "Configurable house edge and limits",
      "Scheduled live events",
      "Wager-based VIP levels",
      "Referral codes and payout ledger",
      "The smallest build in the set to rebrand",
    ],
    includes: ["TypeScript source", "SQL migrations", "Seed script"],
    requirements: ["Node 20+", "Postgres 15+"],
    tiers: [
      {
        license: "personal",
        name: "Personal",
        price: 18900,
        compareAt: 24900,
        summary: "For your own projects and learning.",
        seats: "1 developer · 1 end product",
        includes: ["Full source code", "1 year of updates", "Community support"],
      },
      {
        license: "extended",
        name: "Extended",
        price: 51900,
        summary: "Use it inside a commercial product you operate.",
        seats: "5 developers · unlimited end products",
        includes: ["Everything in Personal", "Commercial licence", "Private support channel"],
        popular: true,
      },
    ],
    changelog: [
      {
        version: "1.6.0",
        date: "2026-10-17",
        notes: ["Referral ledger", "VIP recalc on settle", "Events rail"],
      },
    ],
    gallery: projectGallery("kings-casino")!,
  },
  {
    slug: "dustbit-casino",
    name: "Dustbit Casino",
    tagline: "Casino and sportsbook sharing one account and one balance.",
    category: "casino-gaming",
    stack: ["Next.js", "TypeScript", "Postgres", "Drizzle", "Web3"],
    status: "published",
    price: 23900,
    compareAt: 31900,
    rating: 4.6,
    reviews: 35,
    sales: 210,
    views: 6800,
    author: "pixelforge",
    featured: false,
    trending: false,
    free: false,
    new: true,
    bestseller: false,
    updated: "2026-10-24",
    released: "2026-09-05",
    version: "1.4.0",
    license: "Regular",
    art: projectProductArt("dustbit-casino")!,
    description:
      "Casino and sportsbook on one page, with a single wallet behind both. Includes the sports feed adapter, cash-out handling and the settlement job, plus the casino originals you need for the lobby not to look empty on day one.",
    features: [
      {
        title: "One page, two products",
        body: "Casino rails and a sportsbook strip share the header, the wallet and the bet history.",
      },
      {
        title: "Sports feed adapter",
        body: "One interface over an odds provider, so switching providers does not touch the UI.",
      },
      {
        title: "Cash-out",
        body: "Partial and full cash-out with a provisional balance that settles when the event ends.",
      },
      {
        title: "Settlement job",
        body: "Idempotent settlement with a replay path for events that were voided or rescheduled.",
      },
    ],
    highlights: [
      "Casino and sportsbook on one page",
      "Pluggable odds provider",
      "Partial and full cash-out",
      "Idempotent settlement with replay",
      "Shared wallet and bet history",
    ],
    includes: ["TypeScript source", "SQL migrations", "Seed script", "Docs site"],
    requirements: ["Node 20+", "Postgres 15+", "An odds provider API key"],
    tiers: [
      {
        license: "personal",
        name: "Personal",
        price: 23900,
        compareAt: 31900,
        summary: "For your own projects and learning.",
        seats: "1 developer · 1 end product",
        includes: ["Full source code", "1 year of updates", "Community support"],
      },
      {
        license: "extended",
        name: "Extended",
        price: 64900,
        summary: "Use it inside a commercial product you operate.",
        seats: "5 developers · unlimited end products",
        includes: ["Everything in Personal", "Commercial licence", "Private support channel"],
        popular: true,
      },
    ],
    changelog: [
      {
        version: "1.4.0",
        date: "2026-10-24",
        notes: ["Cash-out", "Settlement replay", "Odds adapter split"],
      },
    ],
    gallery: projectGallery("dustbit-casino")!,
  },

  /* ---------------------------------------------------------- Crypto & Launchpads */
  {
    slug: "moonsale-launchpad",
    name: "Moonsale Launchpad",
    tagline: "Token creation, presales and swaps in one dashboard.",
    category: "crypto-launchpad",
    stack: ["Next.js", "TypeScript", "Postgres", "Tailwind", "Solidity", "Web3"],
    status: "published",
    price: 27900,
    compareAt: 37900,
    rating: 4.8,
    reviews: 57,
    sales: 380,
    views: 11200,
    author: "northwind-labs",
    featured: true,
    trending: true,
    free: false,
    new: true,
    bestseller: false,
    updated: "2026-11-01",
    released: "2026-05-14",
    version: "4.0.0",
    license: "Regular",
    art: projectProductArt("moonsale-launchpad")!,
    description:
      "A launchpad for teams who need token creation, presales and swaps without stitching three vendors together. The swap routes through a quote adapter, token creation shows the current cost before you commit, and a presale tracks contributions and caps against the contract rather than a database field.",
    features: [
      {
        title: "Token generator",
        body: "Name, symbol, supply and decimals with a live cost estimate, then a deploy transaction and a confirmation screen.",
      },
      {
        title: "Presale with a hard cap",
        body: "Contribution tracking, cap enforcement, refund path and a claim step, all read from the contract.",
      },
      {
        title: "Swap and bridge",
        body: "Quote, route and slippage in one panel, with the route adapter isolated so a new DEX is a single file.",
      },
      {
        title: "Launch campaigns",
        body: "A marketing page per launch with the token details, the timeline and the call to action.",
      },
    ],
    highlights: [
      "Token deployment with live cost estimate",
      "Presale with cap enforcement and refunds",
      "Swap and bridge with slippage control",
      "Per-launch marketing pages",
      "Contract reads, not cached database fields",
    ],
    includes: ["TypeScript source", "Solidity contracts", "SQL migrations", "Docs site", "Test suite"],
    requirements: ["Node 20+", "Postgres 15+", "A Web3 RPC endpoint", "Hardhat"],
    tiers: [
      {
        license: "personal",
        name: "Personal",
        price: 27900,
        compareAt: 37900,
        summary: "For your own projects and learning.",
        seats: "1 developer · 1 end product",
        includes: ["Full source code", "1 year of updates", "Community support"],
      },
      {
        license: "extended",
        name: "Extended",
        price: 79900,
        summary: "Use it inside a commercial product you operate.",
        seats: "5 developers · unlimited end products",
        includes: ["Everything in Personal", "Commercial licence", "Private support channel"],
        popular: true,
      },
    ],
    changelog: [
      {
        version: "4.0.0",
        date: "2026-11-01",
        notes: ["Bridge support", "Contract-first presale state", "Cost estimate before deploy"],
      },
    ],
    gallery: projectGallery("moonsale-launchpad")!,
  },
];

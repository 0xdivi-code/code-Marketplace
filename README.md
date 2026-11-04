# Kiln — source code marketplace

A single-owner marketplace for developer source code: starters, dashboards, API
layers and UI kits. Step 1 delivers the complete **storefront + admin UI** on
realistic mock data. No backend, no real payments yet — every surface is built
and wired for Step 2 integration.

Layout and interaction anatomy follow the reference design
(`demo.storekitt.app`), re-skinned into an editorial "Kiln" identity and adapted
from multi-vendor to a single studio that sells and supports its own catalogue.

## Stack

React 19 · TypeScript · Vite 8 · Tailwind CSS 4 (`@tailwindcss/vite`) ·
Radix primitives · Framer Motion · Lucide · Recharts · cmdk · Zustand · Sonner

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle
npx tsc --noEmit # type check
```

## Routes

**Storefront** — `/` · `/browse` · `/category/:slug` · `/item/:slug` ·
`/collections` · `/collection/:slug` · `/free` · `/cart` · `/checkout` ·
`/order/:id` · `/about` · `/contact` · `/blog` · `/blog/:slug` · `/changelog` ·
`/page/:slug` (licensing, terms, privacy, refunds, cookies, support, faq)

**Account** — `/account` (overview) · `orders` · `library` · `wishlist` · `settings`

**Auth** — `/login` · `/register` · `/forgot-password` · `/reset-password`

**Admin** — `/admin` (dashboard) · `products` · `products/new` · `products/:slug`
· `categories` · `orders` · `orders/:id` · `customers` · `payments` ·
`banners` · `promotions` · `content` · `settings` · `activity`

Checkout is registered **outside** `SiteLayout` — it ships its own minimal
header so the funnel has no competing navigation.

## Design tokens

| Token | Light | Dark |
| --- | --- | --- |
| `--paper` | `#FBF7F0` | `#12100D` |
| `--ink` | `#191814` | `#F4EFE6` |
| `--brand` (forest) | `#17392B` | — |
| `--accent` (terracotta) | `#C0592B` | — |
| `--sage` | `#DFE9DC` | — |
| `--gold` | `#B0842F` | `#D8AB54` |

Utilities in `src/index.css`: `container-x`, `label-mono`, `surface-card`,
`grain`, `ruled`, `link-underline`, `skeleton`, `marquee-track`, `floaty`,
`animate-accordion-up/down`.

## Data & state

- `src/data/catalog.ts` — 8 categories, 4 authors, 16 products, 4 collections,
  plus reviews, customers, orders, coupons, activity and posts. Prices are
  integer **dollars**; `money()` divides by 100, so all amounts are stored as
  cents-equivalents (`14900` → `$149`).
- License tiers are derived: commercial `2.4×`, extended `5×`, snapped to clean
  retail figures via `retail()`.
- `src/lib/store.ts` — Zustand stores persisted under `kiln-theme`, `kiln-cart`,
  `kiln-wishlist`, `kiln-session`, `kiln-recent`, `kiln-search-history`.
- Coupons: `LAUNCH25` (25%), `WELCOME10` (10%), `BLACKFRIDAY` (40%); cart totals
  add 7.5% VAT.

## Verification tools

```bash
npx vite-node scripts/render-check.ts   # SSR-renders all 48 routes, fails on console errors
```

`scripts/shots.mjs` drives Puppeteer over every route in light + dark + mobile,
asserting no horizontal overflow and capturing full-page screenshots. It needs a
Chromium binary; extract the bundled one and point `LD_LIBRARY_PATH` at its libs:

```bash
node -e "import('@sparticuz/chromium').then(async m=>{console.log(await m.default.executablePath())})"
# writes /tmp/chromium; libs unpack from node_modules/@sparticuz/chromium/bin/al2023.tar.br

LD_LIBRARY_PATH=/tmp/al2023/lib node scripts/shots.mjs /tmp/shots
```

## Step 2 hand-off

Mock data access is isolated in `src/data/catalog.ts` and `src/lib/store.ts`.
Replace those two modules with API calls and the UI needs no structural change.
Checkout already carries the purchased lines and total through router state to
the confirmation page, and the cart clears only after a successful payment.

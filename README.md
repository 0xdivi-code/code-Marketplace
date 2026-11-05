# Kiln — source code marketplace

A single-owner marketplace for developer source code: starters, dashboards, API
layers and UI kits. Storefront, customer accounts, crypto-first checkout,
automatic delivery of purchased archives, and an owner-only admin console.

Layout and interaction anatomy follow the reference design
(`demo.storekitt.app`), re-skinned into an editorial "Kiln" identity and adapted
from multi-vendor to a single studio that sells and supports its own catalogue.

**Stack** — React 19 · TypeScript · Vite · Tailwind CSS 4 · Radix · Framer
Motion · Recharts · Zustand · Hono · Drizzle · PGlite/PostgreSQL

---

## Quick start

```bash
npm install
cp .env.example .env       # optional; defaults work locally
npm run migrate            # create the schema (4 migrations, 33 tables)
npm run seed               # catalogue, demo customers, owner account
npm run dev:all            # API on :8787, storefront on :5173
```

Open <http://localhost:5173>. If port 5173 is busy Vite picks the next free one —
read the terminal.

`npm run seed` prints the owner credentials on first run
(`owner@kiln.dev` / `kiln-owner-demo-2026`). **Change them before deploying.**

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Owner (admin) | `owner@kiln.dev` | `kiln-owner-demo-2026` |
| Customer | `amara@okafor.design` | `demo1234` |
| Customer | `marcus@brightlane.io` | `demo1234` |

The admin console lives at `/admin/login`.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite only (storefront) |
| `npm run api` | API only |
| `npm run dev:all` | Both, side by side |
| `npm run build` | Production bundle into `dist/` |
| `npm run migrate` | Apply migrations |
| `npm run seed` | Seed demo data (skips if a catalogue exists) |
| `npm run reseed` | **Destructive.** Wipe and rebuild demo data |
| `npm run typecheck` | Typecheck `src/` |
| `npm run typecheck:server` | Typecheck `server/` |
| `npm run test:payments` | 22-case payment/delivery suite |
| `npm run test:journey` | 39-case end-to-end journey + security |
| `npm run test:responsive` | 12 widths × 8 pages, fails on overflow (needs Chrome, see below) |
| `npm run check:images` | Fails if a product references artwork that does not exist |
| `npm run fetch:images` | Download the reference artwork into `public/img/ref/` |
| `npm run backup` | Database + archives with checksums |
| `npm run restore` | Restore a backup directory |

---

## Product artwork

Product covers are real photographs, not generated art — but the files are not
committed. They live in `public/img/ref/`, which is gitignored, so a fresh clone
has none of them and every cover falls back to a generated gradient. That
fallback is deliberate: the storefront is never broken, just less pretty.

To pull the real artwork in:

```bash
npm run fetch:images   # downloads all 51 into public/img/ref/
npm run check:images   # confirms everything referenced is present
```

No reseed is needed — the database already stores the cover paths, so an image
appears as soon as its file exists.

```bash
node scripts/check-ref-images.mjs --strict   # also fails when files are missing
```

`npm run test:responsive` drives a real browser and `puppeteer-core` ships none,
so it needs one. It checks `CHROME`, then a few common paths:

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:responsive
```

---

## Testing it yourself

**The fast check** — no browser needed:

```bash
npm run api            # in one terminal
npm run test:journey   # in another
```

`test-journey` drives the real HTTP API and asserts the full purchase path:
admin login → create and publish a product → upload a ZIP → customer
registration → checkout → signed webhook → paid order → library access →
download (verifying real ZIP bytes) → admin revenue → version bump →
product-update email. It also checks that forged webhooks, invented download
tokens, non-owner downloads, path traversal and customer-session access to
`/api/admin/*` are all refused. **39 assertions.**

**In the browser** — the path worth walking once:

1. Sign in to `/admin/login`, go to **Products → New product**, fill it in and
   upload a ZIP, then publish.
2. In a private window, find it at `/browse` and add it to the cart.
3. Check out. The sandbox gateway stands in for NOWPayments — click through the
   invoice page and it posts a *signed* webhook to the real verification path,
   exactly as a real gateway would.
4. The order becomes paid, the product appears in `/account/library`, and the
   download serves the archive.
5. Back in admin, the order and the revenue show on the dashboard.
6. Bump the version on the product — every licence holder gets an email, visible
   under **Admin → Notifications**.

The sandbox gateway is local-only. In production it returns 404 and paid
checkout refuses to run without a real gateway key, so no order can ever be
marked paid without money moving.

---

## How it works

### Data

One PostgreSQL database, embedded (PGlite) or external, selected by
`DATABASE_URL`. Migrations are plain SQL in `server/db/migrations/`, applied in
order and recorded in `_migrations`; every file is idempotent so a re-run is
safe.

Money is integer **cents** everywhere — in the database, in the API and in the
cart. Dollars appear only in the admin forms, which convert on the boundary.

### Delivery

Purchased archives live in a private storage root that no web server serves.
Minting a download does not return a file URL; it returns a token that is
stored **hashed**, expires in 15 minutes and works at most three times.
`GET /api/account/downloads/:token` is the only route that streams bytes, and it
re-checks entitlement at download time so a refund between minting and
downloading wins.

### Payments

`server/lib/payments.ts` defines a provider interface with two implementations:

- **nowpayments** — hosted crypto invoices. Webhooks are verified with
  HMAC-SHA256 against the IPN secret before anything is marked paid.
- **sandbox** — a deterministic local stand-in with the same shapes and the same
  signing scheme.

Nothing trusts the browser. `verifyWebhook` is the only path to a paid order, and
the paid amount is re-checked against the order total.

### Bundles

A bundle is its own line in the cart with a price and a licence tier. At
checkout the server expands it into one order item per member product, splitting
the price in exact cents (the last member absorbs the remainder), so licences,
receipts, library access and refunds need no bundle-specific code.

### Analytics

Every dashboard figure is aggregated from `orders`, `order_items`, `downloads`
and `users` over the selected range. Nothing on the dashboard is decorative.

---

## Routes

**Storefront** — `/` · `/browse` · `/category/:slug` · `/item/:slug` ·
`/collections` · `/collection/:slug` · `/bundles` · `/free` · `/cart` ·
`/checkout` · `/order/:id` · `/about` · `/contact` · `/blog` · `/blog/:slug` ·
`/changelog` · `/page/:slug`

**Account** — `/account` · `orders` · `library` · `wishlist` · `settings` ·
`certificates`

**Auth** — `/login` · `/register` · `/forgot-password` · `/reset-password` ·
`/verify-email`

**Admin** — `/admin` (dashboard) · `products` · `products/new` ·
`products/:slug` · `categories` · `orders` · `orders/:id` · `customers` ·
`payments` · `webhooks` · `promotions` · `bundles` · `notifications` ·
`reviews` · `banners` · `content` · `settings` · `activity`

---

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

---

## Verification tools

```bash
npx vite-node scripts/render-check.ts   # SSR-renders every route, fails on console errors
npm run test:responsive                 # horizontal-overflow guard
```

`scripts/check-responsive.mjs` and `scripts/shots.mjs` drive Puppeteer. They
need a Chromium binary; extract the bundled one and point `LD_LIBRARY_PATH` at
its libs:

```bash
node -e "import('@sparticuz/chromium').then(async m=>{console.log(await m.default.executablePath())})"
# writes /tmp/chromium; libs unpack from node_modules/@sparticuz/chromium/bin/al2023.tar.br

LD_LIBRARY_PATH=/tmp/al2023/lib node scripts/shots.mjs /tmp/shots
```

---

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** — environment reference, systemd unit,
Caddy and Nginx configuration, backups, monitoring and a go-live checklist.

Three guards are worth knowing about before you deploy:

- The server **refuses to boot** with `NODE_ENV=production` and no
  `STORAGE_SECRET`, because the default would let anyone forge download URLs.
- The sandbox payment gateway **404s in production**.
- Paid checkout returns **503** if no gateway key is configured, rather than
  minting an invoice nobody can pay.

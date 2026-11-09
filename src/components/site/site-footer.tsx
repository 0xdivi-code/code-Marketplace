import * as React from "react";
import { Link } from "react-router-dom";
import { Code2, AtSign, Rss, ArrowUpRight, Check } from "lucide-react";
import { KilnLogo } from "./logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

const groups = [
  {
    title: "Marketplace",
    links: [
      { label: "Browse all", to: "/browse" },
      { label: "New releases", to: "/browse?sort=newest" },
      { label: "Free code", to: "/free" },
      { label: "Collections", to: "/collections" },
              { label: "Bundles", to: "/bundles" },
      { label: "Changelog", to: "/changelog" },
    ],
  },
  {
    title: "Categories",
    links: [
      { label: "SaaS Starters", to: "/category/saas-starters" },
      { label: "API & Backends", to: "/category/api-backends" },
      { label: "Mobile Starters", to: "/category/mobile-starters" },
      { label: "Free Code", to: "/category/free-code" },
      { label: "Casino & Gaming", to: "/category/casino-gaming" },
      { label: "Crypto & Launchpads", to: "/category/crypto-launchpad" },
    ],
  },
  {
    title: "Studio",
    links: [
      { label: "About", to: "/about" },
      { label: "Contact", to: "/contact" },
      { label: "Journal", to: "/blog" },
      { label: "FAQ", to: "/page/faq" },
      { label: "Support", to: "/page/support" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Licensing", to: "/page/licensing" },
      { label: "Terms of service", to: "/page/terms" },
      { label: "Privacy policy", to: "/page/privacy" },
      { label: "Refund policy", to: "/page/refunds" },
      { label: "Cookies", to: "/page/cookies" },
    ],
  },
];

export function SiteFooter() {
  const [email, setEmail] = React.useState("");
  const [done, setDone] = React.useState(false);

  return (
    <footer className="relative mt-24 overflow-hidden border-t border-line bg-surface">
      <div className="container-x">
        <div className="grid gap-10 py-14 lg:grid-cols-[1.15fr_2fr] lg:gap-16">
          <div>
            <KilnLogo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-2">
              A small studio selling the code we use ourselves — starters, dashboards and tools with
              upgrade paths we actually maintain.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (email.includes("@")) setDone(true);
              }}
              className="mt-6 max-w-sm"
            >
              <label htmlFor="footer-email" className="label-mono mb-2 block text-[0.5625rem] text-ink-3">
                New drops, twice a month
              </label>
              {done ? (
                <div className="flex items-center gap-2 rounded-sm border border-line bg-surface-2 px-3 py-2.5 text-[0.8125rem] text-ink-2">
                  <Check className="size-4 text-positive" />
                  You’re on the list — check {email} for a confirmation.
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    id="footer-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@studio.com"
                    className="h-10 text-[0.8125rem]"
                  />
                  <Button type="submit" size="sm" className="h-10 shrink-0 px-4">
                    Subscribe
                  </Button>
                </div>
              )}
              <p className="mt-2 text-[0.625rem] text-ink-3">
                No spam. Unsubscribe any time. We never sell your address.
              </p>
            </form>

            <div className="mt-6 flex items-center gap-2">
              {[
                { icon: Code2, label: "GitHub" },
                { icon: AtSign, label: "Twitter" },
                { icon: Rss, label: "Blog RSS" },
              ].map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="grid size-9 place-items-center rounded-full border border-line text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {groups.map((g) => (
              <div key={g.title}>
                <h3 className="label-mono mb-3 text-[0.5625rem] text-ink-3">{g.title}</h3>
                <ul className="space-y-2">
                  {g.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        to={l.to}
                        className="text-[0.8125rem] text-ink-2 transition-colors hover:text-ink"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-lg border border-line bg-brand px-6 py-8 text-brand-ink sm:px-10 sm:py-10">
          <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="label-mono text-[0.5625rem] opacity-60">Bundle & save</p>
              <p className="mt-1.5 font-display text-2xl leading-tight sm:text-[1.75rem]">
                Buy the Launch Stack, save 20%.
              </p>
              <p className="mt-1 text-sm text-brand-ink/70">
                Five items, one license, one invoice — everything to ship a SaaS.
              </p>
            </div>
            <Button asChild variant="accent" size="lg" className="shrink-0">
              <Link to="/collection/the-launch-stack">
                See the bundle <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-16 size-64 rounded-full opacity-20 blur-2xl"
            style={{ background: "radial-gradient(circle, var(--accent), transparent 70%)" }}
          />
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-line py-6 text-[0.6875rem] text-ink-3 sm:flex-row">
          <p>© {new Date().getFullYear()} Kiln Studio, Unipessoal Lda. All code licensed per sale.</p>
          <div className="flex items-center gap-4">
            <span>Payments in USDT, USDC & BTC</span>
            <span className="hidden sm:inline">·</span>
            <Link to="/page/terms" className="hover:text-ink">
              Terms
            </Link>
            <Link to="/page/privacy" className="hover:text-ink">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

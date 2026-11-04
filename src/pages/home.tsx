import * as React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  RefreshCw,
  ShieldCheck,
  Headphones,
  Star,
  Sparkles,
  Terminal,
  GitBranch,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/ui/card";
import { ProductCard } from "@/components/site/product-card";
import { ProductArt } from "@/components/ui/product-art";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/disclosure";
import {
  categories,
  collections,
  featuredProducts,
  freeProducts,
  posts,
  productBySlug,
  products,
  stats,
  trendingProducts,
} from "@/data/catalog";
import { compact, money } from "@/lib/utils";
import { RefImage } from "@/components/ui/ref-image";
import { useUi } from "@/lib/store";

const ease = [0.22, 1, 0.36, 1] as const;

const promises = [
  {
    icon: BadgeCheck,
    title: "Reviewed before it ships",
    body: "Every release is read, run and tested by a human.",
  },
  {
    icon: RefreshCw,
    title: "Lifetime updates",
    body: "New versions land in your library at no cost.",
  },
  {
    icon: ShieldCheck,
    title: "Clear licensing",
    body: "Plain-language terms, no seat-count surprises.",
  },
  {
    icon: Headphones,
    title: "Answers from the author",
    body: "You talk to the person who wrote the code.",
  },
];

const words = ["SaaS", "dashboards", "APIs", "auth", "billing", "UI kits"];

export default function HomePage() {
  const { setSearch } = useUi();
  const [tab, setTab] = React.useState("newest");
  const discover = React.useMemo(() => {
    if (tab === "rating") return [...products].sort((a, b) => b.rating - a.rating).slice(0, 4);
    if (tab === "bestselling") return [...products].sort((a, b) => b.sales - a.sales).slice(0, 4);
    return [...products].sort((a, b) => +new Date(b.released) - +new Date(a.released)).slice(0, 4);
  }, [tab]);

  // bundle pricing is derived from the same catalogue the collection page uses
  const bundleProducts = (collections[0]?.products ?? [])
    .map((slug) => productBySlug(slug))
    .filter(Boolean) as { price: number }[];
  const bundleList = bundleProducts.reduce((n, p) => n + p.price, 0);
  const bundlePrice = Math.round(bundleList * 0.8);

return (
    <div>
      <Hero onSearch={() => setSearch(true)} />

      {/* ---------------------------------------------------- promises strip */}
      <section className="border-y border-line bg-surface">
        <div className="container-x grid grid-cols-2 gap-x-6 gap-y-6 py-7 md:grid-cols-4">
          {promises.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.06, ease }}
              className="flex items-start gap-3"
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand dark:bg-brand-soft dark:text-[#a9cdb6]">
                <p.icon className="size-4" />
              </span>
              <div>
                <p className="text-[0.8125rem] font-medium leading-tight">{p.title}</p>
                <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-ink-3">{p.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------- categories */}
      <section className="container-x pt-16 sm:pt-20">
        <SectionHeading
          eyebrow="Explore"
          title="Shop by category"
          description="Eight shelves, one standard. Everything is built to be read, extended and shipped."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/browse">
                All items <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
        />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {categories.map((c, i) => {
            const items = products.filter((p) => p.category === c.slug);
            return (
              <motion.div
                key={c.slug}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.05, ease }}
              >
                <Link
                  to={`/category/${c.slug}`}
                  className="group relative block overflow-hidden rounded-md border border-line"
                >
                  <div
                    className="relative aspect-[5/3] overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
                  >
                    {c.src ? (
                      <>
                        <RefImage src={c.src} hover />
                        {/* keeps the label legible over arbitrary photography */}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#14120f]/80 via-[#14120f]/20 to-transparent" />
                      </>
                    ) : (
                      <svg
                        viewBox="0 0 300 180"
                        className="absolute inset-0 size-full opacity-40 transition-transform duration-700 group-hover:scale-105"
                        aria-hidden
                      >
                        <circle cx="240" cy="40" r="60" fill="white" opacity="0.08" />
                        <circle cx="60" cy="150" r="44" fill="white" opacity="0.06" />
                        <path d="M0 130 Q 75 100 150 130 T 300 120" stroke="white" strokeWidth="1" fill="none" opacity="0.25" />
                      </svg>
                    )}
                    <div className="absolute inset-0 flex flex-col justify-end p-4">
                      <span className="label-mono text-[0.5rem] text-white/60">
                        {items.length} item{items.length === 1 ? "" : "s"}
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="font-display text-[1.0625rem] leading-tight text-white">
                          {c.name}
                        </span>
                        <ArrowUpRight className="size-4 shrink-0 text-white/70 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ---------------------------------------------------- trending */}
      <section className="container-x pt-20">
        <SectionHeading
          eyebrow="Trending now"
          title="Popular this week"
          description="What other teams are shipping with right now."
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/browse?sort=trending">
                View all <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
        />
        <div className="mt-8 grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {trendingProducts.slice(0, 8).map((p, i) => (
            <ProductCard key={p.slug} product={p} index={i} />
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------- promo pair */}
      <section className="container-x mt-20">
        <div className="grid gap-4 lg:grid-cols-2">
          <Promo
            href="/browse?sort=newest"
            from="#17392b"
            to="#3f7458"
            eyebrow="Fresh drops"
            title="New code every other Tuesday"
            body="Starters, dashboards and tools, versioned and documented from the first commit."
            cta="See new releases"
            art="window"
          />
          <Promo
            href="/free"
            from="#c0592b"
            to="#e39a6f"
            eyebrow="Free collection"
            title="Six items, zero dollars"
            body="Production-grade empty states, hooks and recipes — MIT licensed, no email wall."
            cta="Browse free code"
            art="grid"
          />
        </div>
      </section>

      {/* ---------------------------------------------------- discover tabs */}
      <section className="container-x pt-20">
        <SectionHeading
          eyebrow="Discover"
          title="Explore the catalogue"
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/browse">
                Browse everything <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
        />
        <Tabs value={tab} onValueChange={setTab} className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList className="w-fit">
              <TabsTrigger value="newest">New releases</TabsTrigger>
              <TabsTrigger value="bestselling">Best sellers</TabsTrigger>
              <TabsTrigger value="rating">Top rated</TabsTrigger>
            </TabsList>
            <p className="hidden text-[0.6875rem] text-ink-3 sm:block">
              {discover.length} items · updated weekly
            </p>
          </div>
          {["newest", "bestselling", "rating"].map((key) => (
            <TabsContent key={key} value={key} className="mt-8">
              {tab === key && (
                <div className="grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
                  {discover.map((p, i) => (
                    <ProductCard key={p.slug} product={p} index={i} />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </section>

      {/* ---------------------------------------------------- collection editorial */}
      <section className="mt-24 overflow-hidden border-y border-line bg-surface-2/60">
        <div className="container-x py-16">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="label-mono mb-3 flex items-center gap-2 text-accent-ink dark:text-accent">
                <span className="inline-block h-px w-6 bg-current" />
                Featured collection
              </div>
              <h2 className="text-[2rem] leading-[1.05] sm:text-[2.6rem]">The Launch Stack</h2>
              <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-ink-2">
                Five items that take a SaaS from empty repository to first invoice: the starter, the
                auth layer, the billing engine, the API and the UI kit they all share.
              </p>
              <div className="mt-6 flex flex-wrap items-baseline gap-3">
                <span className="font-display text-2xl">{money(bundlePrice)}</span>
                <span className="font-mono text-sm text-ink-3 line-through">{money(bundleList)}</span>
                <Badge variant="accent" size="md">
                  Save 20%
                </Badge>
              </div>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <Button asChild size="lg">
                  <Link to="/collection/the-launch-stack">
                    View the collection <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/collection/operations-toolkit">Operations toolkit</Link>
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2.5 sm:gap-3">
              {(collections[0]?.products ?? []).map((slug, i) => {
                const p = productBySlug(slug)!;
                return (
                  <motion.div
                    key={slug}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.07, ease }}
                    className={i === 0 ? "col-span-3 row-span-2 h-full" : "col-span-2"}
                  >
                    <Link
                      to={`/item/${slug}`}
                      className="group block h-full overflow-hidden rounded-md"
                    >
                      <ProductArt
                        {...p.art}
                        kind={p.art.kind}
                        className={`h-full w-full transition-transform duration-700 group-hover:scale-[1.03] ${
                          i === 0 ? "aspect-[4/5]" : "aspect-[16/10]"
                        }`}
                      />
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- free */}
      <section className="container-x pt-20">
        <SectionHeading
          eyebrow="Free collection"
          title="Good code, no checkout"
          description="MIT licensed drops we maintain in public. Download, read, use — attribution appreciated, never required."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/free">
                All free items <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {freeProducts.slice(0, 3).map((p, i) => (
            <motion.div
              key={p.slug}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.05, ease }}
            >
              <Link
                to={`/item/${p.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-md border border-line bg-surface transition-shadow hover:shadow-card"
              >
                <ProductArt {...p.art} kind={p.art.kind} className="aspect-[16/8]" />
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-[1.0625rem] leading-snug">{p.name}</h3>
                    <Badge variant="sage" size="sm" className="shrink-0">
                      Free
                    </Badge>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[0.75rem] leading-relaxed text-ink-2">
                    {p.tagline}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-4 text-[0.6875rem] text-ink-3">
                    <span className="flex items-center gap-1">
                      <Star className="size-3 fill-gold text-gold" /> {p.rating.toFixed(1)} ·{" "}
                      {compact(p.sales)} downloads
                    </span>
                    <span className="flex items-center gap-1 font-medium text-accent-ink dark:text-accent">
                      Get it <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------- studio + stats */}
      <section className="container-x pt-20">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease }}
            className="relative overflow-hidden rounded-lg border border-line"
          >
            <img
              src="/img/studio-maker.png"
              alt="The Kiln studio desk at work"
              className="aspect-[4/3] w-full object-cover"
              loading="lazy"
            />
            <div className="absolute bottom-4 left-4 rounded-md border border-white/20 bg-[#14120f]/70 px-3.5 py-2.5 backdrop-blur-md">
              <p className="label-mono text-[0.5rem] text-white/55">Est. 2021 · Lisbon</p>
              <p className="mt-0.5 text-[0.8125rem] font-medium text-white">
                Written by the people who maintain it
              </p>
            </div>
          </motion.div>
          <div>
            <div className="label-mono mb-3 flex items-center gap-2 text-accent-ink dark:text-accent">
              <span className="inline-block h-px w-6 bg-current" />
              One studio, no resellers
            </div>
            <h2 className="text-[1.9rem] leading-[1.08] sm:text-[2.4rem]">
              You buy the code. You also get the person who wrote it.
            </h2>
            <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-2">
              Kiln is a three-person studio. We sell the foundations we build for client work, keep
              them on a real release cadence, and answer support ourselves. No marketplace middle
              layer, no abandoned templates.
            </p>
            <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-line pt-6">
              {[
                { k: "Items", v: `${stats.products}`, s: "all maintained" },
                { k: "Developers", v: "24.8K", s: "using our code" },
                { k: "Rating", v: stats.rating.toFixed(1), s: "from 1,340 reviews" },
              ].map((s) => (
                <div key={s.k}>
                  <dt className="label-mono text-[0.5rem] text-ink-3">{s.k}</dt>
                  <dd className="mt-1 font-display text-[1.65rem] leading-none">{s.v}</dd>
                  <dd className="mt-1 text-[0.625rem] text-ink-3">{s.s}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Button asChild>
                <Link to="/about">
                  About the studio <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/contact">Talk to us</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- journal */}
      <section className="container-x pt-20">
        <SectionHeading
          eyebrow="Journal"
          title="Notes from the workbench"
          description="Release notes with reasoning, pricing decisions, and the parts we got wrong."
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/blog">
                All posts <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
        />
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {posts.map((post, i) => (
            <motion.article
              key={post.slug}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.06, ease }}
            >
              <Link to={`/blog/${post.slug}`} className="group block">
                <div
                  className="relative aspect-[16/9] overflow-hidden rounded-md"
                  style={{ background: `linear-gradient(135deg, ${post.from}, ${post.to})` }}
                >
                  <RefImage src={post.src} hover />
                  <svg viewBox="0 0 320 180" className="absolute inset-0 size-full" aria-hidden>
                    <path
                      d="M0 140 Q 80 96 160 132 T 320 118"
                      stroke="white"
                      strokeWidth="1"
                      fill="none"
                      opacity="0.25"
                    />
                    <circle cx="262" cy="44" r="34" fill="white" opacity="0.08" />
                  </svg>
                  <Badge variant="glass" size="sm" className="absolute left-3 top-3">
                    {post.category}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[0.625rem] text-ink-3">
                  <time>{new Date(post.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</time>
                  <span>·</span>
                  <span>{post.read} min read</span>
                </div>
                <h3 className="mt-1.5 font-display text-[1.0625rem] leading-snug group-hover:text-accent-ink dark:group-hover:text-accent">
                  {post.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-[0.75rem] leading-relaxed text-ink-2">
                  {post.excerpt}
                </p>
              </Link>
            </motion.article>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------- faq + newsletter */}
      <section className="container-x pt-20">
        <div className="grid gap-10 overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-2">
          <div className="p-7 sm:p-10">
            <div className="label-mono mb-3 flex items-center gap-2 text-accent-ink dark:text-accent">
              <span className="inline-block h-px w-6 bg-current" />
              Buying
            </div>
            <h2 className="text-[1.6rem] leading-tight">Questions before you buy</h2>
            <dl className="mt-6 space-y-5">
              {[
                {
                  q: "What does a license cover?",
                  a: "Personal covers your own projects. Commercial covers one client product with up to five developers. Extended covers unlimited products, including SaaS you resell access to.",
                },
                {
                  q: "Do updates cost extra?",
                  a: "No. Every purchase includes lifetime updates. You download the new version from your library.",
                },
                {
                  q: "What if it doesn’t fit?",
                  a: "Email within 14 days with what you tried. If the code is broken or not as described, we refund it.",
                },
                {
                  q: "Can I see the code first?",
                  a: "Every free item is the real thing, unminified. For paid items the docs and demo are public — and we answer questions before purchase.",
                },
              ].map((f) => (
                <div key={f.q}>
                  <dt className="text-[0.875rem] font-medium">{f.q}</dt>
                  <dd className="mt-1 text-[0.8125rem] leading-relaxed text-ink-2">{f.a}</dd>
                </div>
              ))}
            </dl>
            <Button asChild variant="outline" size="sm" className="mt-6">
              <Link to="/page/faq">
                Full FAQ <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
          <div className="relative flex flex-col justify-center bg-brand p-7 text-brand-ink sm:p-10">
            <div className="relative z-10">
              <Sparkles className="size-6 opacity-70" />
              <h2 className="mt-4 font-display text-[1.6rem] leading-tight">
                Twice a month: one new item, one freebie, no filler.
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-brand-ink/70">
                Written by the studio. Subscribers get free drops a day early and a 10% first-order
                code.
              </p>
              <form
                onSubmit={(e) => e.preventDefault()}
                className="mt-6 flex max-w-sm flex-col gap-2 sm:flex-row"
              >
                <input
                  type="email"
                  required
                  placeholder="you@studio.com"
                  className="h-11 flex-1 rounded-full border border-white/25 bg-white/10 px-4 text-sm text-white placeholder:text-white/50 focus:border-white/60 focus:outline-none"
                />
                <Button variant="accent" className="shrink-0">
                  Subscribe
                </Button>
              </form>
              <p className="mt-2.5 text-[0.625rem] text-brand-ink/50">
                4,100 developers. Unsubscribe in one click.
              </p>
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-16 -right-10 size-64 rounded-full opacity-25 blur-3xl"
              style={{ background: "radial-gradient(circle, #c0592b, transparent 70%)" }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ hero */
function Hero({ onSearch }: { onSearch: () => void }) {
  const [wordIndex, setWordIndex] = React.useState(0);
  React.useEffect(() => {
    const id = window.setInterval(() => setWordIndex((i) => (i + 1) % words.length), 2600);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="relative overflow-hidden border-b border-line">
      <div className="grain absolute inset-0" aria-hidden />
      <div className="container-x relative">
        <div className="grid items-center gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-16">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease }}
              className="flex flex-wrap items-center gap-2"
            >
              <Badge variant="outline" size="lg" className="gap-1.5 border-line-strong">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                v6 release week · 14 new files
              </Badge>
              <Link
                to="/browse?sort=newest"
                className="link-underline text-[0.6875rem] font-medium text-ink-2"
              >
                See what’s new
              </Link>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05, ease }}
              className="mt-5 text-[2.6rem] leading-[0.98] tracking-[-0.035em] sm:text-[3.5rem] lg:text-[4rem]"
            >
              Production-ready
              <br />
              <span className="relative inline-flex h-[1.02em] overflow-hidden align-bottom text-accent-ink dark:text-accent">
                <motion.span
                  key={wordIndex}
                  initial={{ y: "100%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "-100%", opacity: 0 }}
                  transition={{ duration: 0.45, ease }}
                  className="inline-block"
                >
                  {words[wordIndex]}
                </motion.span>
              </span>{" "}
              code
              <br />
              you can read.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12, ease }}
              className="mt-5 max-w-lg text-[0.9375rem] leading-relaxed text-ink-2 sm:text-base"
            >
              Starters, dashboards and developer tools from a three-person studio. Every item is
              reviewed, documented and updated — with an upgrade path we actually maintain.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.18, ease }}
              className="mt-7"
            >
              <button
                onClick={onSearch}
                className="group flex w-full max-w-md items-center gap-3 rounded-full border border-line-strong bg-surface py-2 pl-4 pr-2 text-left shadow-card transition-shadow hover:shadow-pop"
              >
                <Terminal className="size-4 shrink-0 text-ink-3" />
                <span className="flex-1 text-[0.8125rem] text-ink-3">
                  Search “stripe”, “tables”, “next.js”…
                </span>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-brand-ink transition-transform group-hover:scale-105">
                  <ArrowRight className="size-4" />
                </span>
              </button>
              <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[0.6875rem] text-ink-3">
                <span>Popular:</span>
                {["stripe billing", "admin tables", "passkeys"].map((t) => (
                  <button
                    key={t}
                    onClick={onSearch}
                    className="rounded-full border border-line px-2 py-0.5 transition-colors hover:border-line-strong hover:text-ink"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.28 }}
              className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3"
            >
              {[
                { v: `${stats.products}`, l: "maintained items" },
                { v: "24.8K", l: "developers" },
                { v: `${stats.rating}/5`, l: "average rating" },
              ].map((s) => (
                <div key={s.l} className="flex items-baseline gap-1.5">
                  <span className="font-display text-[1.35rem] leading-none">{s.v}</span>
                  <span className="text-[0.6875rem] text-ink-3">{s.l}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* right: composed preview stack */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease }}
            className="relative"
          >
            <div className="relative overflow-hidden rounded-lg border border-line bg-surface shadow-pop">
              <img
                src="/img/hero-studio.png"
                alt="A calm desk with a laptop showing a Kiln dashboard template"
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-[#14120f]/85 via-[#14120f]/35 to-transparent p-4">
                <div>
                  <p className="label-mono text-[0.5rem] text-white/60">Featured file</p>
                  <p className="mt-0.5 font-display text-[1.05rem] text-white">
                    Forge — SaaS Starter 4.2
                  </p>
                </div>
                <Badge variant="glass" size="sm">
                  TypeScript
                </Badge>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5, ease }}
              className="absolute -bottom-6 -left-4 w-[16.5rem] rounded-md border border-line bg-surface p-3 shadow-pop sm:-left-8"
            >
              <div className="flex items-center justify-between">
                <span className="label-mono text-[0.5rem] text-ink-3">Lighthouse · shipped</span>
                <span className="flex items-center gap-1 text-[0.625rem] font-medium text-emerald-700 dark:text-emerald-400">
                  <BadgeCheck className="size-3" /> 100
                </span>
              </div>
              <div className="mt-2 flex items-end gap-1">
                {[38, 52, 44, 66, 58, 72, 64, 81, 74, 88].map((h, i) => (
                  <span
                    key={i}
                    className="flex-1 rounded-t-[2px] bg-brand/25 dark:bg-brand/50"
                    style={{ height: `${h * 0.42}px` }}
                  />
                ))}
              </div>
              <div className="mt-2.5 flex items-center gap-2 border-t border-line pt-2 text-[0.625rem] text-ink-3">
                <GitBranch className="size-3" /> main · 12 commits this week
              </div>
            </motion.div>

            <div className="absolute -right-2 -top-4 hidden rounded-md border border-line bg-surface px-3 py-2 shadow-pop sm:block">
              <div className="flex items-center gap-1.5">
                <Package className="size-3.5 text-accent" />
                <span className="text-[0.6875rem] font-medium">Instant download</span>
              </div>
              <p className="mt-0.5 text-[0.5625rem] text-ink-3">Zip + git access</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* editorial marquee */}
      <div className="relative border-t border-line bg-surface py-3">
        <div className="marquee-track gap-10">
          {Array.from({ length: 2 }).map((_, dup) => (
            <div key={dup} className="flex shrink-0 items-center gap-10 pr-10">
              {[
                "TypeScript-first",
                "Reviewed by a human",
                "Lifetime updates",
                "MIT for free items",
                "Plain-language licenses",
                "Docs you can search",
                "No lock-in",
              ].map((t) => (
                <span key={t} className="label-mono flex items-center gap-3 text-[0.5625rem] text-ink-3">
                  <span className="size-1 rounded-full bg-accent/60" />
                  {t}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Promo({
  href,
  from,
  to,
  eyebrow,
  title,
  body,
  cta,
  art,
}: {
  href: string;
  from: string;
  to: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  art: "window" | "grid";
}) {
  return (
    <Link
      to={href}
      className="group relative overflow-hidden rounded-lg border border-line"
      style={{ background: `linear-gradient(115deg, ${from} 0%, ${to} 100%)` }}
    >
      <div className="relative z-10 flex min-h-[13rem] flex-col justify-between p-6 text-white sm:min-h-[14rem] sm:p-8">
        <div>
          <p className="label-mono text-[0.5rem] text-white/60">{eyebrow}</p>
          <h3 className="mt-2 max-w-xs font-display text-[1.4rem] leading-tight">{title}</h3>
          <p className="mt-2 max-w-xs text-[0.8125rem] leading-relaxed text-white/70">{body}</p>
        </div>
        <span className="mt-5 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium">
          {cta}
          <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </div>
      <div className="absolute -right-6 -top-2 h-[110%] w-1/2 opacity-60 transition-transform duration-700 group-hover:scale-105">
        <ProductArt from={from} to={to} ink="#ffffff" kind={art} className="size-full" />
      </div>
    </Link>
  );
}

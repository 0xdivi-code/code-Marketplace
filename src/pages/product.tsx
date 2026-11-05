import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Star,
  Download,
  Heart,
  ShieldCheck,
  Check,
  FileCode2,
  Package,
  Clock,
  ExternalLink,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  ThumbsUp,
  Sparkles,
  Layers,
  GitCommitHorizontal,
  BookOpen,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ProductArt } from "@/components/ui/product-art";
import { CheckRow, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/disclosure";
import { RadioCard, RadioGroup } from "@/components/ui/field";
import { ProductCard } from "@/components/site/product-card";
import {
  authorBySlug,
  categoryBySlug,
  productBySlug,
  products,
  reviewsFor,
} from "@/data/catalog";
import type { License } from "@/data/types";
import { cn, compact, money } from "@/lib/utils";
import { saleRatio, useCart, useRecent, useUi, useWishlist } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";
import NotFoundPage from "./not-found";

export default function ProductPage() {
  const { slug = "" } = useParams();
  const product = productBySlug(slug);
  const wishlist = useWishlist();
  const { add } = useCart();
  const { setCart } = useUi();
  const recent = useRecent();
  const [license, setLicense] = React.useState<License>("personal");
  const [imageIndex, setImageIndex] = React.useState(0);
  // Declared above the "product is missing" early return: hooks must run in the
  // same order on every render, and the catalogue hydrates a frame later.
  const [grabbing, setGrabbing] = React.useState(false);

  React.useEffect(() => {
    if (product) {
      recent.push(product.slug);
      setLicense((product.tiers.find((t) => t.popular)?.license ?? "personal") as License);
      setImageIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (!product) return <NotFoundPage />;

  const author = authorBySlug(product.author)!;
  const category = categoryBySlug(product.category)!;
  const reviews = reviewsFor(product.slug);
  const baseTier = product.tiers.find((t) => t.license === license) ?? product.tiers[0];
  /**
   * A live sale cuts every tier by the same ratio the server charges. The
   * struck-through figure prefers the sale's own list price; `compareAt` is only
   * an editorial "was" price and stays as a fallback.
   */
  const ratio = saleRatio(product);
  const onSale = ratio < 1;
  const tier = onSale
    ? { ...baseTier, price: Math.round(baseTier.price * ratio), compareAt: baseTier.price }
    : baseTier;
  const isWished = wishlist.slugs.includes(product.slug);
  const related = products
    .filter((p) => p.slug !== product.slug && (p.category === product.category || p.author === product.author))
    .slice(0, 4);
  const moreFromAuthor = products.filter((p) => p.author === product.author && p.slug !== product.slug).slice(0, 4);

  const buy = () => {
    add(product.slug, license);
    toast.success(`Added to cart — ${product.name}`, {
      description: `${tier.name} license · ${money(tier.price)}`,
      action: { label: "View cart", onClick: () => setCart(true) },
    });
  };

  const grabFree = async () => {
    setGrabbing(true);
    try {
      const res = await api.post<{ url: string; filename: string; inLibrary: boolean }>(
        `/free/${product.slug}/claim`,
        {},
      );
      window.location.href = res.url;
      toast.success("Downloading", {
        description: res.inLibrary
          ? "Saved to your library — updates included."
          : "Create a free account to hear about new versions.",
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not start the download.");
    } finally {
      setGrabbing(false);
    }
  };

  const gallery = product.gallery;

  return (
    <div>
      {/* breadcrumb */}
      <div className="border-b border-line bg-surface-2/40">
        <div className="container-x flex items-center gap-2 py-3">
          <nav className="label-mono no-scrollbar flex items-center gap-2 overflow-x-auto text-[0.5625rem] text-ink-3">
            <Link to="/" className="shrink-0 hover:text-ink">
              Home
            </Link>
            <span>/</span>
            <Link to="/browse" className="shrink-0 hover:text-ink">
              Browse
            </Link>
            <span>/</span>
            <Link to={`/category/${category.slug}`} className="shrink-0 hover:text-ink">
              {category.name}
            </Link>
            <span>/</span>
            <span className="shrink-0 truncate text-ink-2">{product.name}</span>
          </nav>
        </div>
      </div>

      <div className="container-x py-8 lg:py-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_392px] xl:gap-14">
          {/* ---------------------------------------------------- left */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="relative overflow-hidden rounded-lg border border-line bg-surface"
            >
              <div className="relative aspect-[16/10]">
                <ProductArt
                  {...gallery[imageIndex]}
                  className="size-full"
                />
                <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {product.free && <Badge variant="solid" size="sm" className="bg-white text-[#17392b]">Free</Badge>}
                    {product.new && <Badge variant="glass" size="sm">New</Badge>}
                    {product.bestseller && <Badge variant="glass" size="sm">Bestseller</Badge>}
                  </div>
                  <Badge variant="glass" size="sm">
                    {imageIndex + 1} / {gallery.length}
                  </Badge>
                </div>
                {gallery.length > 1 && (
                  <>
                    <button
                      onClick={() => setImageIndex((i) => (i - 1 + gallery.length) % gallery.length)}
                      className="absolute left-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-[#17392b] shadow-sm backdrop-blur transition-transform hover:scale-105"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <button
                      onClick={() => setImageIndex((i) => (i + 1) % gallery.length)}
                      className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-[#17392b] shadow-sm backdrop-blur transition-transform hover:scale-105"
                      aria-label="Next image"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#14120f]/70 to-transparent p-4 pt-10">
                  <p className="text-[0.6875rem] text-white/80">{gallery[imageIndex].caption}</p>
                </div>
              </div>
            </motion.div>

            <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1">
              {gallery.map((g, i) => (
                <button
                  key={g.id}
                  onClick={() => setImageIndex(i)}
                  className={cn(
                    "relative h-16 w-24 shrink-0 overflow-hidden rounded-sm border-2 transition-colors",
                    i === imageIndex ? "border-accent" : "border-transparent opacity-70 hover:opacity-100",
                  )}
                  aria-label={`View ${g.caption}`}
                >
                  <ProductArt {...g} className="size-full" dense />
                </button>
              ))}
            </div>

            {/* title block */}
            <div className="mt-7">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/category/${category.slug}`}>
                  <Badge variant="outline" size="md">
                    {category.name}
                  </Badge>
                </Link>
                <Badge variant="neutral" size="md">
                  v{product.version}
                </Badge>
                <span className="flex items-center gap-1 text-[0.6875rem] text-ink-3">
                  <Clock className="size-3" /> Updated{" "}
                  {new Date(product.updated).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <h1 className="mt-3 text-[1.9rem] leading-[1.05] sm:text-[2.4rem]">{product.name}</h1>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">{product.tagline}</p>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.75rem] text-ink-2">
                <span className="flex items-center gap-1">
                  <Star className="size-3.5 fill-gold text-gold" />
                  <span className="font-medium text-ink">{product.rating.toFixed(1)}</span>
                  <span className="text-ink-3">({product.reviews} reviews)</span>
                </span>
                <span className="flex items-center gap-1">
                  <Download className="size-3.5 text-ink-3" /> {compact(product.sales)} downloads
                </span>
                <a href="#author" className="flex items-center gap-1.5 hover:text-ink">
                  <Avatar initials={author.avatar} size="sm" />
                  by {author.name}
                  {author.verified && <ShieldCheck className="size-3 text-accent" />}
                </a>
              </div>
            </div>

            {/* mobile buy bar */}
            <div className="mt-6 rounded-md border border-line bg-surface p-4 lg:hidden">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-2xl font-medium">{money(tier.price)}</span>
                {tier.compareAt && (
                  <span className="font-mono text-sm text-ink-3 line-through">{money(tier.compareAt)}</span>
                )}
              </div>
              <p className="mt-0.5 text-[0.6875rem] text-ink-3">{tier.name} license · {tier.seats}</p>
              <Button onClick={buy} size="lg" className="mt-3 w-full">
                {product.free ? "Download free" : "Add to cart"}
              </Button>
            </div>

            <Tabs defaultValue="overview" className="mt-9">
              <TabsList variant="line">
                <TabsTrigger variant="line" value="overview">
                  Overview
                </TabsTrigger>
                <TabsTrigger variant="line" value="reviews">
                  Reviews <span className="text-ink-3">({reviews.length})</span>
                </TabsTrigger>
                <TabsTrigger variant="line" value="changelog">
                  Changelog
                </TabsTrigger>
                <TabsTrigger variant="line" value="license">
                  License
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="pt-6">
                <p className="max-w-3xl text-[0.9375rem] leading-relaxed text-ink-2">
                  {product.description}
                </p>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {product.features.map((f, i) => (
                    <motion.div
                      key={f.title}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: i * 0.05 }}
                      className="rounded-md border border-line bg-surface p-4"
                    >
                      <div className="flex items-center gap-2">
                        <span className="grid size-6 place-items-center rounded-full bg-brand-soft text-[0.625rem] font-semibold text-brand dark:text-[#a9cdb6]">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <h3 className="text-[0.875rem] font-medium">{f.title}</h3>
                      </div>
                      <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-2">{f.body}</p>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-8 grid gap-6 sm:grid-cols-2">
                  <div>
                    <h3 className="label-mono mb-2.5 text-[0.5625rem] text-ink-3">
                      What’s in the download
                    </h3>
                    <ul className="space-y-1.5">
                      {product.includes.map((i) => (
                        <CheckRow key={i}>{i}</CheckRow>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="label-mono mb-2.5 text-[0.5625rem] text-ink-3">Highlights</h3>
                    <ul className="space-y-1.5">
                      {product.highlights.map((i) => (
                        <CheckRow key={i}>{i}</CheckRow>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  <InfoBox icon={Layers} title="Tech stack">
                    <div className="flex flex-wrap gap-1.5">
                      {product.stack.map((s) => (
                        <span
                          key={s}
                          className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[0.5625rem] text-ink-2"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </InfoBox>
                  <InfoBox icon={Package} title="Requirements">
                    <ul className="space-y-1 text-[0.6875rem] text-ink-2">
                      {product.requirements.map((r) => (
                        <li key={r}>· {r}</li>
                      ))}
                    </ul>
                  </InfoBox>
                  <InfoBox icon={FileCode2} title="Files">
                    <p className="font-mono text-[0.6875rem] text-ink-2">
                      248 files · 34.2 MB <span className="text-ink-3">unzipped</span>
                    </p>
                    <p className="mt-1 text-[0.625rem] text-ink-3">
                      Includes a git bundle for history
                    </p>
                  </InfoBox>
                </div>
              </TabsContent>

              <TabsContent value="reviews" className="pt-6">
                <ReviewSection productSlug={product.slug} rating={product.rating} count={product.reviews} />
              </TabsContent>

              <TabsContent value="changelog" className="pt-6">
                <div className="space-y-0">
                  {product.changelog.map((c, i) => (
                    <div key={c.version} className="relative flex gap-4 pb-7">
                      {i !== product.changelog.length - 1 && (
                        <span className="absolute left-[13px] top-7 h-full w-px bg-line" />
                      )}
                      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-line bg-surface">
                        <GitCommitHorizontal className="size-3.5 text-ink-3" />
                      </span>
                      <div>
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-mono text-[0.8125rem] font-medium">v{c.version}</span>
                          <time className="text-[0.6875rem] text-ink-3">
                            {new Date(c.date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </time>
                          {i === 0 && (
                            <Badge variant="sage" size="sm">
                              Latest
                            </Badge>
                          )}
                        </div>
                        <ul className="mt-1.5 space-y-1">
                          {c.notes.map((n) => (
                            <li key={n} className="flex items-start gap-2 text-[0.8125rem] text-ink-2">
                              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-ink-3" />
                              {n}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/changelog">
                    <BookOpen className="size-3.5" /> Full store changelog
                  </Link>
                </Button>
              </TabsContent>

              <TabsContent value="license" className="pt-6">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {product.tiers.map((t) => (
                    <div
                      key={t.license}
                      className={cn(
                        "rounded-md border p-4",
                        tier.license === t.license ? "border-brand bg-brand-soft/40" : "border-line",
                      )}
                    >
                      <div className="flex items-baseline justify-between">
                        <h3 className="text-[0.8125rem] font-medium">{t.name}</h3>
                        <span className="font-mono text-[0.8125rem]">{money(t.price)}</span>
                      </div>
                      <p className="mt-1 text-[0.625rem] uppercase tracking-wide text-ink-3">
                        {t.seats}
                      </p>
                      <ul className="mt-2.5 space-y-1">
                        {t.includes.map((i) => (
                          <li key={i} className="flex gap-1.5 text-[0.6875rem] text-ink-2">
                            <Check className="mt-0.5 size-3 shrink-0 text-accent" /> {i}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <p className="mt-4 flex items-start gap-2 text-[0.6875rem] leading-relaxed text-ink-3">
                  <Lock className="mt-0.5 size-3.5 shrink-0" />
                  Licenses are issued per purchase and stored in your account. Reselling the source
                  itself is not permitted under any tier.
                </p>
              </TabsContent>
            </Tabs>

            {/* author */}
            <div id="author" className="mt-12 scroll-mt-24 rounded-lg border border-line bg-surface p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <Avatar initials={author.avatar} size="xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-xl">{author.name}</h2>
                    {author.verified && (
                      <Badge variant="accent" size="sm" className="gap-1">
                        <ShieldCheck className="size-2.5" /> Verified
                      </Badge>
                    )}
                  </div>
                  <p className="text-[0.6875rem] text-ink-3">
                    {author.role} · {author.location} · joined {author.joined}
                  </p>
                  <p className="mt-2 max-w-xl text-[0.8125rem] leading-relaxed text-ink-2">
                    {author.bio}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-[0.6875rem] text-ink-3">
                    <span>
                      <strong className="font-medium text-ink">{author.items}</strong> items
                    </span>
                    <span>
                      <strong className="font-medium text-ink">{compact(author.sales)}</strong> sales
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="size-3 fill-gold text-gold" />
                      <strong className="font-medium text-ink">{author.rating}</strong> rating
                    </span>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="shrink-0">
                  <MessageSquare className="size-3.5" /> Message
                </Button>
              </div>
            </div>

            {moreFromAuthor.length > 0 && (
              <section className="mt-12">
                <div className="mb-5 flex items-end justify-between">
                  <h2 className="text-[1.35rem]">More from {author.name}</h2>
                  <Link to="/browse" className="text-[0.75rem] text-ink-2 hover:text-ink">
                    View all
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-3">
                  {moreFromAuthor.slice(0, 3).map((p, i) => (
                    <ProductCard key={p.slug} product={p} index={i} />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ---------------------------------------------------- right (sticky) */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-lg border border-line bg-surface p-5 shadow-card">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[2rem] font-medium leading-none">
                    {money(tier.price)}
                  </span>
                  {tier.compareAt && (
                    <span className="font-mono text-sm text-ink-3 line-through">
                      {money(tier.compareAt)}
                    </span>
                  )}
                  {tier.compareAt && (
                    <Badge variant="accent" size="sm">
                      −{Math.round((1 - tier.price / tier.compareAt) * 100)}%
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-[0.6875rem] text-ink-3">One-time payment · no subscription</p>

                <RadioGroup
                  value={license}
                  onValueChange={(v) => setLicense(v as License)}
                  className="mt-4 space-y-2"
                >
                  {product.tiers.map((t) => (
                    <RadioCard
                      key={t.license}
                      value={t.license}
                      checked={license === t.license}
                      title={t.name}
                      description={t.seats}
                      meta={<span className="font-mono text-[0.75rem]">{money(t.price)}</span>}
                    />
                  ))}
                </RadioGroup>

                <Button onClick={product.free ? () => void grabFree() : buy} size="lg" className="mt-4 w-full" disabled={product.free && grabbing}>
                  {product.free ? (
                    <>
                      <Download className="size-4" /> {grabbing ? "Preparing…" : "Download free"}
                    </>
                  ) : (
                    <>
                      <Package className="size-4" /> Add to cart
                    </>
                  )}
                </Button>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <Button variant="outline" size="lg">
                    Buy now
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-13"
                    onClick={() => wishlist.toggle(product.slug)}
                    aria-label={isWished ? "Remove from wishlist" : "Save to wishlist"}
                    aria-pressed={isWished}
                  >
                    <Heart className={cn("size-4", isWished && "fill-accent text-accent")} />
                  </Button>
                </div>

                <ul className="mt-4 space-y-2 border-t border-line pt-4">
                  {[
                    { icon: Download, text: "Instant download after payment" },
                    { icon: RefreshCwIcon, text: "Lifetime updates included" },
                    { icon: ShieldCheck, text: "14-day refund if it doesn’t fit" },
                  ].map(({ icon: Icon, text }) => (
                    <li key={text} className="flex items-center gap-2 text-[0.6875rem] text-ink-2">
                      <Icon className="size-3.5 shrink-0 text-accent" />
                      {text}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-line bg-surface-2/60 p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-3.5 text-accent" />
                  <p className="text-[0.75rem] font-medium">Bundle it</p>
                </div>
                <p className="mt-1 text-[0.6875rem] leading-relaxed text-ink-2">
                  Part of <strong>The Launch Stack</strong> — five items, 20% off together.
                </p>
                <Link
                  to="/collection/the-launch-stack"
                  className="mt-2 inline-flex items-center gap-1 text-[0.6875rem] font-medium text-accent-ink hover:underline dark:text-accent"
                >
                  View bundle <ExternalLink className="size-3" />
                </Link>
              </div>

              <div className="rounded-lg border border-line p-4">
                <p className="label-mono text-[0.5rem] text-ink-3">Questions?</p>
                <p className="mt-1.5 text-[0.75rem] leading-relaxed text-ink-2">
                  We answer pre-sales questions in under a day, usually much less.
                </p>
                <Button asChild variant="soft" size="sm" className="mt-2.5 w-full">
                  <Link to="/contact">Ask the studio</Link>
                </Button>
              </div>
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <section className="mt-16 border-t border-line pt-10">
            <div className="mb-6 flex items-end justify-between">
              <h2 className="text-[1.5rem]">You may also like</h2>
              <Link to="/browse" className="text-[0.75rem] text-ink-2 hover:text-ink">
                Browse all
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4">
              {related.map((p, i) => (
                <ProductCard key={p.slug} product={p} index={i} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function RefreshCwIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M13.5 8a5.5 5.5 0 1 1-1.9-4.2" strokeLinecap="round" />
      <path d="M13.5 2v3.2h-3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoBox({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-line bg-surface-2/50 p-3.5">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className="size-3.5 text-ink-3" />
        <h3 className="label-mono text-[0.5rem] text-ink-3">{title}</h3>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ reviews */
function ReviewSection({
  productSlug,
  rating,
  count,
}: {
  productSlug: string;
  rating: number;
  count: number;
}) {
  const list = reviewsFor(productSlug);
  const [helpful, setHelpful] = React.useState<Record<string, boolean>>({});
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    pct: star === 5 ? 72 : star === 4 ? 19 : star === 3 ? 6 : star === 2 ? 2 : 1,
  }));

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 rounded-lg border border-line bg-surface p-5 sm:grid-cols-[160px_1fr]">
        <div className="text-center sm:border-r sm:border-line sm:text-left">
          <p className="font-display text-4xl leading-none">{rating.toFixed(1)}</p>
          <div className="mt-1.5 flex justify-center gap-0.5 sm:justify-start">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn("size-3.5", i < Math.round(rating) ? "fill-gold text-gold" : "text-line-strong")}
              />
            ))}
          </div>
          <p className="mt-1 text-[0.6875rem] text-ink-3">{count} verified reviews</p>
        </div>
        <div className="space-y-1.5">
          {dist.map((d) => (
            <div key={d.star} className="flex items-center gap-2">
              <span className="w-3 text-right font-mono text-[0.625rem] text-ink-3">{d.star}</span>
              <Star className="size-2.5 fill-gold text-gold" />
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${d.pct}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className="h-full rounded-full bg-brand"
                />
              </div>
              <span className="w-8 font-mono text-[0.625rem] text-ink-3">{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {list.length === 0 && (
          <div className="rounded-md border border-dashed border-line-strong py-12 text-center">
            <MessageSquare className="mx-auto size-5 text-ink-3" />
            <p className="mt-2 font-display text-lg">No reviews yet</p>
            <p className="mt-1 text-sm text-ink-2">Buyers can review 14 days after purchase.</p>
          </div>
        )}
        {list.map((r, i) => (
          <motion.article
            key={r.id}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: i * 0.04 }}
            className="rounded-md border border-line bg-surface p-4"
          >
            <div className="flex items-start gap-3">
              <Avatar initials={r.initials} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[0.8125rem] font-medium">{r.author}</span>
                  {r.verified && (
                    <Badge variant="sage" size="sm" className="gap-1">
                      <Check className="size-2.5" /> Verified purchase
                    </Badge>
                  )}
                  <span className="ml-auto text-[0.625rem] text-ink-3">
                    {new Date(r.date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="mt-1 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star
                      key={s}
                      className={cn("size-3", s < r.rating ? "fill-gold text-gold" : "text-line-strong")}
                    />
                  ))}
                </div>
                <h3 className="mt-1.5 text-[0.875rem] font-medium">{r.title}</h3>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-2">{r.body}</p>
                <button
                  onClick={() => setHelpful((h) => ({ ...h, [r.id]: !h[r.id] }))}
                  className={cn(
                    "mt-2.5 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.625rem] transition-colors",
                    helpful[r.id]
                      ? "border-brand bg-brand-soft text-brand dark:text-[#a9cdb6]"
                      : "border-line text-ink-3 hover:text-ink",
                  )}
                >
                  <ThumbsUp className="size-3" /> Helpful ({r.helpful + (helpful[r.id] ? 1 : 0)})
                </button>
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  );
}

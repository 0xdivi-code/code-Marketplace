import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Package, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductArt } from "@/components/ui/product-art";
import { ProductCard } from "@/components/site/product-card";
import { collections, productBySlug } from "@/data/catalog";
import { money } from "@/lib/utils";
import { useCart, useUi } from "@/lib/store";
import { toast } from "sonner";
import NotFoundPage from "./not-found";

export default function CollectionPage() {
  const { slug = "" } = useParams();
  const collection = collections.find((c) => c.slug === slug);
  const { add } = useCart();
  const { setCart } = useUi();

  if (!collection) return <NotFoundPage />;

  const items = collection.products.map((s) => productBySlug(s)!).filter(Boolean);
  const total = items.reduce((n, p) => n + p.price, 0);
  const bundle = Math.round(total * 0.8);

  const addAll = () => {
    items.forEach((p) => add(p.slug));
    toast.success(`Added ${items.length} items to cart`, {
      description: "Bundle discount applies at checkout with code LAUNCH25.",
      action: { label: "View cart", onClick: () => setCart(true) },
    });
  };

  return (
    <div>
      <header
        className="relative overflow-hidden border-b border-line"
        style={{ background: `linear-gradient(115deg, ${collection.from}, ${collection.to})` }}
      >
        <div className="container-x relative py-12 text-white sm:py-16">
          <nav className="label-mono mb-5 flex items-center gap-2 text-[0.5625rem] text-white/60">
            <Link to="/" className="hover:text-white">
              Home
            </Link>
            <span>/</span>
            <Link to="/collections" className="hover:text-white">
              Collections
            </Link>
            <span>/</span>
            <span className="text-white/85">{collection.name}</span>
          </nav>
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <Badge variant="glass" size="sm" className="gap-1">
                <Sparkles className="size-2.5" /> Curated collection
              </Badge>
              <h1 className="mt-3 max-w-xl text-[2.2rem] leading-[1.02] sm:text-[3rem]">
                {collection.name}
              </h1>
              <p className="mt-3 max-w-lg text-[0.9375rem] leading-relaxed text-white/70">
                {collection.blurb}
              </p>
              <div className="mt-6 flex flex-wrap items-end gap-4">
                <div>
                  <p className="label-mono text-[0.5rem] text-white/55">Bundle price</p>
                  <p className="font-display text-[2rem] leading-none">{money(bundle)}</p>
                </div>
                <p className="pb-1 font-mono text-sm text-white/50 line-through">{money(total)}</p>
                <Badge variant="solid" size="md" className="mb-1 bg-white text-[#171717]">
                  Save 20%
                </Badge>
              </div>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Button variant="accent" size="lg" onClick={addAll}>
                  <Package className="size-4" /> Add all {items.length} to cart
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border-white/30 text-white hover:border-white/60 hover:bg-white/10"
                >
                  <Link to="/browse">Browse separately</Link>
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {items.slice(0, 6).map((p, i) => (
                <motion.div
                  key={p.slug}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.05 * i }}
                  className="overflow-hidden rounded-sm shadow-lg"
                >
                  <ProductArt {...p.art} kind={p.art.kind} className="aspect-square w-full" />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="container-x py-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-6 flex items-end justify-between">
              <h2 className="text-[1.35rem]">
                {items.length} item{items.length === 1 ? "" : "s"} in this collection
              </h2>
              <Link to="/collections" className="text-[0.75rem] text-ink-2 hover:text-ink">
                All collections
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 xl:grid-cols-4">
              {items.map((p, i) => (
                <ProductCard key={p.slug} product={p} index={i} />
              ))}
            </div>
          </div>

          <aside>
            <div className="sticky top-24 rounded-lg border border-line bg-surface p-5">
              <h2 className="font-display text-lg">What you get</h2>
              <ul className="mt-3 space-y-2.5 border-b border-line pb-4">
                {items.map((p) => (
                  <li key={p.slug} className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
                    <span className="min-w-0 flex-1 truncate text-ink-2">{p.name}</span>
                    <span className="font-mono text-[0.75rem] text-ink">{money(p.price)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-3 space-y-1.5 text-[0.8125rem]">
                <div className="flex justify-between text-ink-2">
                  <dt>Individually</dt>
                  <dd className="font-mono">{money(total)}</dd>
                </div>
                <div className="flex justify-between text-accent-ink dark:text-accent">
                  <dt>Bundle saving</dt>
                  <dd className="font-mono">−{money(total - bundle)}</dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-line pt-2">
                  <dt className="font-medium">Bundle total</dt>
                  <dd className="font-mono text-lg font-medium">{money(bundle)}</dd>
                </div>
              </dl>
              <Button size="lg" className="mt-4 w-full" onClick={addAll}>
                Add bundle to cart
              </Button>
              <p className="mt-3 flex items-start gap-2 text-[0.625rem] leading-relaxed text-ink-3">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                Each item keeps its own license and updates. Bundles are a discount, not a lock-in.
              </p>
            </div>
          </aside>
        </div>

        <div className="mt-14 border-t border-line pt-8">
          <Link
            to="/browse"
            className="group flex items-center justify-between rounded-lg border border-line bg-surface p-5 transition-colors hover:bg-surface-2"
          >
            <div>
              <p className="font-display text-xl">Keep looking</p>
              <p className="mt-0.5 text-sm text-ink-2">
                The full catalogue — {items.length > 0 ? "and 15 more items" : "all items"}.
              </p>
            </div>
            <ArrowRight className="size-5 text-ink-3 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}

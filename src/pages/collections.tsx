import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { collections, productBySlug } from "@/data/catalog";
import { ProductArt } from "@/components/ui/product-art";
import { money } from "@/lib/utils";

export default function CollectionsPage() {
  return (
    <div>
      <header className="border-b border-line bg-surface-2/50">
        <div className="container-x py-12 sm:py-16">
          <nav className="label-mono mb-4 flex items-center gap-2 text-[0.5625rem] text-ink-3">
            <Link to="/" className="hover:text-ink">
              Home
            </Link>
            <span>/</span>
            <span className="text-ink-2">Collections</span>
          </nav>
          <h1 className="max-w-2xl text-[2.2rem] leading-[1.02] sm:text-[3rem]">
            Curated sets, priced together
          </h1>
          <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-ink-2">
            Hand-picked groups of items that belong in the same codebase. Buy the set and save —
            licenses stay separate, so you always know what you own.
          </p>
        </div>
      </header>

      <div className="container-x py-10">
        <div className="grid gap-6 lg:grid-cols-2">
          {collections.map((c, i) => {
            const items = c.products.map((s) => productBySlug(s)!).filter(Boolean);
            const total = items.reduce((n, p) => n + p.price, 0);
            const bundle = Math.round(total * 0.8);
            return (
              <motion.article
                key={c.slug}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className="group overflow-hidden rounded-lg border border-line bg-surface"
              >
                <Link to={`/collection/${c.slug}`} className="block">
                  <div className="relative grid grid-cols-3 gap-1 p-1">
                    <div className="col-span-2 row-span-2 overflow-hidden rounded-sm">
                      <ProductArt
                        {...items[0].art}
                        kind={items[0].art.kind}
                        className="aspect-[4/3] w-full transition-transform duration-700 group-hover:scale-[1.03]"
                      />
                    </div>
                    {items.slice(1, 3).map((p) => (
                      <div key={p.slug} className="overflow-hidden rounded-sm">
                        <ProductArt {...p.art} kind={p.art.kind} className="aspect-[2/1] w-full" />
                      </div>
                    ))}
                    <div className="absolute right-3 top-3">
                      <Badge variant="glass" size="sm" className="gap-1">
                        <Layers className="size-2.5" /> {items.length} items
                      </Badge>
                    </div>
                  </div>
                </Link>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-[1.35rem] leading-tight">{c.name}</h2>
                      <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-2">{c.blurb}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-[0.9375rem] font-medium">{money(bundle)}</p>
                      <p className="font-mono text-[0.625rem] text-ink-3 line-through">{money(total)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                    <div className="flex -space-x-2">
                      {items.slice(0, 5).map((p) => (
                        <span
                          key={p.slug}
                          className="size-6 rounded-full border-2 border-surface"
                          style={{ background: `linear-gradient(135deg, ${p.art.from}, ${p.art.to})` }}
                        />
                      ))}
                    </div>
                    <span className="flex items-center gap-1 text-[0.75rem] font-medium text-accent-ink dark:text-accent">
                      View collection
                      <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

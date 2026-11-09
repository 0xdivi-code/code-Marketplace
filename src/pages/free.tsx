import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Download, Gift, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductArt } from "@/components/ui/product-art";
import { freeProducts, paidProducts } from "@/data/catalog";
import { compact } from "@/lib/utils";
import { useCart, useUi } from "@/lib/store";
import { toast } from "sonner";
import { ProductCard } from "@/components/site/product-card";
import { api, ApiError } from "@/lib/api";

export default function FreePage() {
  const navigate = useNavigate();

  /**
   * Free code should not need a cart, a checkout or an account. This claims the
   * file server-side and hands the browser an expiring download token; signing
   * in is offered afterwards, only because it adds version updates.
   */
  const [grabbing, setGrabbing] = React.useState<string | null>(null);
  const grab = async (slug: string, name: string) => {
    setGrabbing(slug);
    try {
      const res = await api.post<{ url: string; filename: string; inLibrary: boolean }>(
        `/free/${slug}/claim`,
        {},
      );
      window.location.href = res.url;
      toast.success(`Downloading “${name}”`, {
        description: res.inLibrary
          ? "Saved to your library — you'll be told about updates."
          : "Create a free account to be notified about new versions.",
        action: res.inLibrary ? undefined : { label: "Sign up", onClick: () => navigate("/register") },
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        toast.error(err.message, {
          description: "A free account lifts the limit.",
          action: { label: "Create one", onClick: () => navigate("/register") },
        });
      } else {
        toast.error(err instanceof ApiError ? err.message : "Could not start the download.");
      }
    } finally {
      setGrabbing(null);
    }
  };

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line bg-ink text-paper">
        <div className="container-x relative py-14 sm:py-20">
          <div className="max-w-2xl">
            <Badge variant="glass" size="sm" className="gap-1">
              <Gift className="size-2.5" /> Free collection
            </Badge>
            <h1 className="mt-4 text-[2.4rem] leading-[0.98] sm:text-[3.4rem]">
              Six items. Zero dollars.
              <span className="block text-accent">No email wall.</span>
            </h1>
            <p className="mt-4 max-w-lg text-[0.9375rem] leading-relaxed text-paper/65">
              These are the same components, hooks and recipes running on this store — MIT licensed,
              unminified, and maintained alongside the paid items.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-[0.75rem] text-paper/50">
              <span className="flex items-center gap-1.5">
                <Download className="size-3.5" /> {compact(freeProducts.reduce((n, p) => n + p.sales, 0))} downloads
              </span>
              <span className="flex items-center gap-1.5">
                <Star className="size-3.5 fill-gold text-gold" /> 4.7 average rating
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-accent" /> MIT license
              </span>
            </div>
          </div>
          <svg
            viewBox="0 0 600 300"
            className="pointer-events-none absolute -right-20 top-1/2 hidden h-[130%] w-1/2 -translate-y-1/2 opacity-25 lg:block"
            aria-hidden
          >
            {Array.from({ length: 60 }).map((_, i) => (
              <circle
                key={i}
                cx={(i % 10) * 60 + 20}
                cy={Math.floor(i / 10) * 50 + 20}
                r={2 + (i % 4)}
                fill="var(--accent)"
                opacity={0.15 + (i % 5) * 0.1}
              />
            ))}
          </svg>
        </div>
      </section>

      <div className="container-x py-10">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {freeProducts.map((p, i) => (
            <motion.article
              key={p.slug}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
              className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface"
            >
              <Link to={`/item/${p.slug}`} className="relative block overflow-hidden">
                <ProductArt
                  {...p.art}
                  kind={p.art.kind}
                  className="aspect-[16/9] w-full transition-transform duration-700 group-hover:scale-[1.03]"
                />
                <div className="absolute left-3 top-3">
                  <Badge variant="solid" size="sm" className="bg-white text-[#171717]">
                    Free · MIT
                  </Badge>
                </div>
              </Link>
              <div className="flex flex-1 flex-col p-4">
                <h2 className="font-display text-[1.1rem] leading-snug">
                  <Link to={`/item/${p.slug}`} className="hover:text-accent-ink dark:hover:text-accent">
                    {p.name}
                  </Link>
                </h2>
                <p className="mt-1 line-clamp-2 text-[0.75rem] leading-relaxed text-ink-2">{p.tagline}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {p.stack.slice(0, 3).map((s) => (
                    <span
                      key={s}
                      className="rounded border border-line px-1.5 py-0.5 font-mono text-[0.5625rem] text-ink-3"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <div className="mt-auto flex items-center justify-between pt-4">
                  <span className="flex items-center gap-1 text-[0.6875rem] text-ink-3">
                    <Star className="size-3 fill-gold text-gold" /> {p.rating.toFixed(1)} ·{" "}
                    {compact(p.sales)}
                  </span>
                  <Button size="sm" variant="soft" onClick={() => void grab(p.slug, p.name)} disabled={grabbing === p.slug}>
                    <Download className="size-3.5" /> {grabbing === p.slug ? "Preparing…" : "Get it"}
                  </Button>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        <div className="mt-14 rounded-lg border border-line bg-surface-2/50 p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-lg">
              <h2 className="font-display text-xl">Free is the front door, not the whole house</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
                The paid items go deeper: multi-tenant auth, billing engines, admin consoles with
                real data handling. Same standards, more surface area.
              </p>
            </div>
            <Button asChild variant="primary" size="lg" className="shrink-0">
              <Link to="/browse">
                See paid items <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-12 border-t border-line pt-8">
          <h2 className="mb-5 text-[1.35rem]">Pairs well with</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
            {paidProducts.slice(0, 4).map((p, i) => (
              <ProductCard key={p.slug} product={p} index={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

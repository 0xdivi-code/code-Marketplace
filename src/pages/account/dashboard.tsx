import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Download,
  Receipt,
  Heart,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Star,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductArt } from "@/components/ui/product-art";
import { orders, productBySlug, products } from "@/data/catalog";
import { money, compact } from "@/lib/utils";
import { useWishlist } from "@/lib/store";

export default function DashboardPage() {
  const wishlist = useWishlist();
  const purchased = orders
    .filter((o) => o.status === "completed")
    .flatMap((o) => o.items.map((i) => ({ ...i, order: o.id, date: o.date })))
    .slice(0, 4);
  const saved = products.filter((p) => wishlist.slugs.includes(p.slug)).slice(0, 3);

  const stats = [
    { label: "Items owned", value: "7", sub: "across 4 orders", icon: Download },
    { label: "Spent to date", value: money(118700), sub: "avg $16,957/order", icon: Receipt },
    { label: "Saved items", value: String(wishlist.slugs.length), sub: "wishlist", icon: Heart },
    { label: "Updates waiting", value: "3", sub: "free, as always", icon: RefreshCw },
  ];

  return (
    <div className="space-y-7">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.05 }}
            className="surface-card rounded-lg p-4"
          >
            <div className="flex items-center justify-between">
              <span className="label-mono text-[0.5rem] text-ink-3">{s.label}</span>
              <s.icon className="size-3.5 text-ink-3" />
            </div>
            <p className="mt-2 font-display text-[1.5rem] leading-none">{s.value}</p>
            <p className="mt-1 text-[0.625rem] text-ink-3">{s.sub}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <section className="surface-card rounded-lg">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <div>
              <h2 className="text-[0.9375rem] font-medium">Recent library</h2>
              <p className="text-[0.6875rem] text-ink-3">Latest downloads, newest first</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/account/library">
                All files <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
          <ul className="divide-y divide-line">
            {purchased.map((item) => {
              const p = productBySlug(item.productSlug);
              if (!p) return null;
              return (
                <li key={`${item.productSlug}-${item.order}`} className="flex items-center gap-3 px-5 py-3">
                  <ProductArt {...p.art} kind={p.art.kind} className="size-12 shrink-0 rounded-sm" />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/item/${p.slug}`}
                      className="block truncate text-[0.8125rem] font-medium hover:text-accent-ink dark:hover:text-accent"
                    >
                      {p.name}
                    </Link>
                    <p className="text-[0.625rem] text-ink-3">
                      v{p.version} · {item.order} ·{" "}
                      {new Date(item.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  {p.changelog.length > 1 ? (
                    <Badge variant="accent" size="sm">
                      Update
                    </Badge>
                  ) : (
                    <Badge variant="neutral" size="sm">
                      Current
                    </Badge>
                  )}
                  <Button size="sm" variant="soft" className="shrink-0">
                    <Download className="size-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="space-y-5">
          <section className="overflow-hidden rounded-lg border border-line bg-brand p-5 text-brand-ink">
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 opacity-70" />
              <p className="label-mono text-[0.5rem] opacity-60">For you</p>
            </div>
            <h2 className="mt-2 font-display text-xl leading-tight">
              Ledger 1.1 goes well with Forge
            </h2>
            <p className="mt-1.5 text-[0.75rem] leading-relaxed text-brand-ink/70">
              You own Forge — Ledger plugs into it with a documented adapter and keeps your existing
              invoices intact.
            </p>
            <Button asChild variant="accent" size="sm" className="mt-3.5">
              <Link to="/item/ledger-billing">
                Take a look <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </section>

          <section className="surface-card rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[0.875rem] font-medium">Your reviews</h2>
              <Link to="/account/orders" className="text-[0.6875rem] text-ink-3 hover:text-ink">
                Write one
              </Link>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-3.5 fill-gold text-gold" />
                ))}
              </div>
              <span className="text-[0.75rem] text-ink-2">2 reviews published</span>
            </div>
            <p className="mt-2 text-[0.6875rem] leading-relaxed text-ink-3">
              Authors reply to every review within a day.
            </p>
          </section>
        </div>
      </div>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-[1.15rem]">Saved for later</h2>
          <Link to="/account/wishlist" className="text-[0.75rem] text-ink-2 hover:text-ink">
            View wishlist
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {saved.map((p) => (
            <Link
              key={p.slug}
              to={`/item/${p.slug}`}
              className="group flex gap-3 rounded-md border border-line bg-surface p-3 transition-colors hover:bg-surface-2/50"
            >
              <ProductArt {...p.art} kind={p.art.kind} className="size-16 shrink-0 rounded-sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.8125rem] font-medium">{p.name}</p>
                <p className="truncate text-[0.625rem] text-ink-3">{p.tagline}</p>
                <div className="mt-1.5 flex items-center gap-2 text-[0.625rem] text-ink-3">
                  <span className="flex items-center gap-0.5">
                    <Star className="size-2.5 fill-gold text-gold" /> {p.rating}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-0.5">
                    <TrendingUp className="size-2.5" /> {compact(p.sales)}
                  </span>
                  <span className="ml-auto font-mono text-[0.6875rem] text-ink">{money(p.price)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

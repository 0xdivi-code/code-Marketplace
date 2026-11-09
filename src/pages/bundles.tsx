import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Boxes, Check, Layers, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductArt } from "@/components/ui/product-art";
import { api } from "@/lib/api";
import { money } from "@/lib/utils";
import { rememberBundle, useCart, useUi } from "@/lib/store";
import { toast } from "sonner";
import type { License } from "@/data/types";
import { useSeo } from "@/lib/seo";

interface Bundle {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  price: number;
  compareAt: number | null;
  license: License;
  featured: boolean;
  art: { from: string; to: string };
  items: { slug: string; name: string; price: number; tagline: string }[];
  separateTotal: number;
}

/**
 * Bundles are fetched rather than derived from the catalogue: membership and
 * pricing live server-side, so the storefront cannot disagree with checkout.
 */
export default function BundlesPage() {
  useSeo({
    title: "Bundles — products that are better together",
    description:
      "Buy a Kiln stack for less than the sum of its parts. Every product in the bundle comes with a full licence and lifetime updates.",
    path: "/bundles",
  });
  const [bundles, setBundles] = React.useState<Bundle[]>([]);
  const [loading, setLoading] = React.useState(true);
  const add = useCart((s) => s.add);
  const setCart = useUi((s) => s.setCart);

  React.useEffect(() => {
    let alive = true;
    api
      .get<{ bundles: Bundle[] }>("/bundles")
      .then((res) => alive && setBundles(res.bundles))
      .catch(() => alive && setBundles([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const buy = (b: Bundle) => {
    rememberBundle({ slug: b.slug, name: b.name, price: b.price, license: b.license });
    // Bundles need an explicit licence: they are not in the catalogue map that
    // `add` otherwise uses to reject unknown slugs.
    add(b.slug, b.license);
    toast.success(`Added ${b.name}`, {
      description: `${b.items.length} products · ${money(b.price)}`,
      action: { label: "View cart", onClick: () => setCart(true) },
    });
  };

  return (
    <div className="container-x py-12">
      <div className="max-w-2xl">
        <p className="label-mono text-[0.5625rem] text-ink-3">Bundles</p>
        <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">
          Products that are better together
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-2">
          Each bundle is a set of products we build to work as one stack, sold for less than buying them
          separately. You get a full licence — and a certificate — for every product inside.
        </p>
      </div>

      {loading ? (
        <div className="mt-10 rounded-lg border border-line py-16 text-center text-sm text-ink-3">
          Loading bundles…
        </div>
      ) : bundles.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-line-strong py-16 text-center">
          <Boxes className="mx-auto size-5 text-ink-3" />
          <p className="mt-3 text-sm font-medium">No bundles on sale right now</p>
          <p className="mt-1 text-[0.8125rem] text-ink-3">Browse the catalogue for single products.</p>
          <Button asChild className="mt-4" size="sm">
            <Link to="/browse">Browse the catalogue</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-10 space-y-6">
          {bundles.map((b) => {
            const off = b.separateTotal > 0 ? Math.round((1 - b.price / b.separateTotal) * 100) : 0;
            return (
              <div
                key={b.slug}
                className="grid gap-6 rounded-lg border border-line bg-surface p-5 shadow-card md:grid-cols-[240px_1fr_220px]"
              >
                <div>
                  <ProductArt
                    from={b.art.from}
                    to={b.art.to}
                    ink="#f3efe5"
                    kind="grid"
                    className="h-40 w-full rounded-sm"
                  />
                  {b.featured && (
                    <Badge variant="accent" size="sm" className="mt-2">
                      Featured
                    </Badge>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-xl">{b.name}</h2>
                    <Badge variant="neutral" size="sm">
                      <Layers className="size-3" /> {b.items.length} products
                    </Badge>
                  </div>
                  <p className="mt-1 text-[0.875rem] text-ink-2">{b.tagline}</p>
                  <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-2">{b.description}</p>

                  <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
                    {b.items.map((i) => (
                      <li key={i.slug} className="flex items-start gap-2 text-[0.8125rem]">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-accent" />
                        <span className="min-w-0">
                          <Link to={`/item/${i.slug}`} className="hover:text-accent-ink dark:hover:text-accent">
                            {i.name}
                          </Link>
                          <span className="ml-1.5 font-mono text-[0.6875rem] text-ink-3">{money(i.price)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col justify-between border-t border-line pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-2xl font-medium">{money(b.price)}</span>
                      {b.separateTotal > b.price && (
                        <span className="font-mono text-sm text-ink-3 line-through">{money(b.separateTotal)}</span>
                      )}
                    </div>
                    {off > 0 && (
                      <p className="mt-1 text-[0.75rem] text-accent-ink dark:text-accent">
                        Save {money(b.separateTotal - b.price)} ({off}%)
                      </p>
                    )}
                    <p className="mt-2 text-[0.6875rem] capitalize text-ink-3">
                      {b.license} licence · one-time payment
                    </p>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Button onClick={() => buy(b)} className="w-full">
                      Add bundle <ArrowRight className="size-4" />
                    </Button>
                    <p className="flex items-center gap-1.5 text-[0.625rem] text-ink-3">
                      <ShieldCheck className="size-3" /> Every product, full source, lifetime updates
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

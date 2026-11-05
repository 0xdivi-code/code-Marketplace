import { Link } from "react-router-dom";
import { Heart, ShoppingBag, Trash2, Star, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductArt } from "@/components/ui/product-art";
import { Badge } from "@/components/ui/badge";
import { products } from "@/data/catalog";
import { money } from "@/lib/utils";
import { useCart, useUi, useWishlist } from "@/lib/store";
import { toast } from "sonner";

export default function WishlistPage() {
  const wishlist = useWishlist();
  const { add } = useCart();
  const { setCart } = useUi();
  const saved = products.filter((p) => wishlist.slugs.includes(p.slug));

  if (saved.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed border-line-strong py-20 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-surface-2">
          <Heart className="size-5 text-ink-3" />
        </div>
        <h2 className="mt-4 font-display text-xl">Nothing saved yet</h2>
        <p className="mt-1.5 max-w-xs text-sm text-ink-2">
          Tap the heart on any item and it will wait here while you decide.
        </p>
        <Button asChild className="mt-5">
          <Link to="/browse">Browse items</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[1.35rem]">Wishlist</h2>
        <p className="mt-0.5 text-[0.8125rem] text-ink-2">
          {saved.length} saved item{saved.length === 1 ? "" : "s"} · prices are current
        </p>
      </div>

      <ul className="space-y-3">
        {saved.map((p) => (
          <li key={p.slug} className="surface-card flex flex-col gap-4 rounded-lg p-4 sm:flex-row sm:items-center">
            <Link to={`/item/${p.slug}`} className="shrink-0">
              <ProductArt {...p.art} kind={p.art.kind} className="h-20 w-full rounded-sm sm:h-16 sm:w-24" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/item/${p.slug}`}
                  className="text-[0.9375rem] font-medium hover:text-accent-ink dark:hover:text-accent"
                >
                  {p.name}
                </Link>
                {p.free && (
                  <Badge variant="sage" size="sm">
                    Free
                  </Badge>
                )}
                {p.new && (
                  <Badge variant="accent" size="sm">
                    New
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-[0.75rem] text-ink-2">{p.tagline}</p>
              <div className="mt-1.5 flex items-center gap-3 text-[0.6875rem] text-ink-3">
                <span className="flex items-center gap-1">
                  <Star className="size-3 fill-gold text-gold" /> {p.rating.toFixed(1)} ({p.reviews})
                </span>
                <span className="flex items-center gap-1">
                  <Download className="size-3" /> {p.sales.toLocaleString()}
                </span>
                <span className="font-mono text-[0.75rem] text-ink">{money(p.price)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:shrink-0">
              <Button
                size="sm"
                onClick={() => {
                  add(p.slug);
                  toast.success(`Added ${p.name}`, {
                    action: { label: "Cart", onClick: () => setCart(true) },
                  });
                }}
              >
                <ShoppingBag className="size-3.5" /> {p.free ? "Get free" : "Add to cart"}
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => wishlist.toggle(p.slug)}
                aria-label={`Remove ${p.name} from wishlist`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between rounded-md border border-line bg-surface-2/50 p-4">
        <p className="text-[0.75rem] text-ink-2">
          Buying two or more? The Launch Stack bundle saves 20%.
        </p>
        <Button asChild size="sm" variant="outline">
          <Link to="/collection/the-launch-stack">View bundle</Link>
        </Button>
      </div>
    </div>
  );
}

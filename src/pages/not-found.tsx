import { Link } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/site/product-card";
import { trendingProducts } from "@/data/catalog";

export default function NotFoundPage() {
  return (
    <div className="container-x py-16 sm:py-24">
      <div className="max-w-xl">
        <p className="label-mono text-accent-ink dark:text-accent">404 — page not found</p>
        <h1 className="mt-3 text-[2.4rem] leading-[1.02] sm:text-[3.2rem]">
          This link went cold.
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-2">
          The page may have moved, or the item was retired. Everything still in the catalogue is one
          search away.
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Button asChild>
            <Link to="/">
              <ArrowLeft className="size-4" /> Back home
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/browse">
              <Compass className="size-4" /> Browse items
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-14 border-t border-line pt-8">
        <h2 className="mb-5 text-[1.25rem]">Popular right now</h2>
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4">
          {trendingProducts.slice(0, 4).map((p, i) => (
            <ProductCard key={p.slug} product={p} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

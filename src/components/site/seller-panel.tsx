import { Link } from "react-router-dom";
import { ProductArt } from "@/components/ui/product-art";
import { RefImage } from "@/components/ui/ref-image";
import type { Product } from "@/data/types";

/**
 * "Turn your creativity into income" — the seller panel.
 *
 * The artwork on the right is a stack of polaroids: three tilted covers plus a
 * handwritten card that overlaps them. It is decoration, so the whole column is
 * `aria-hidden` and none of the images carry alt text — a screen-reader user
 * would otherwise wade through four unnamed photos on the way to the button.
 *
 * The rotation is CSS `rotate`, not a transform utility, for the same reason the
 * card lift is: what gets rotated must not also be the element framer or a
 * hover rule is transforming.
 */
export function SellerPanel({
  items,
  href = "/about",
  cta = "Become a seller",
}: {
  items: Product[];
  href?: string;
  cta?: string;
}) {
  const shots = items.slice(0, 3);

  return (
    <section
      className="container-x"
      style={{
        paddingTop: "calc(var(--tk-section-space) * 0.5)",
        paddingBottom: "calc(var(--tk-section-space) * 0.5)",
      }}
    >
      <div className="relative z-0 overflow-hidden rounded-panel bg-surface-2 px-7 py-10 text-fg sm:px-12 sm:py-12">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
          <div className="relative z-10">
            <p className="tk-eyebrow mb-4 text-fg-muted">For creators, by creators</p>
            <h2 className="text-[clamp(1.9rem,3.4vw,2.75rem)] leading-[1.08]">
              Turn your <span className="text-accent">creativity</span>
              <br />
              into income
            </h2>
            <p className="mt-4 max-w-lg text-[0.9375rem] leading-relaxed text-fg-muted">
              Join the creators who sell their work here. Share your products, reach a global
              audience and grow your brand.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <Link
                to={href}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[0.875rem] font-medium text-primary-fg transition-colors hover:bg-primary-hover active:bg-primary-active sm:h-12 sm:px-6 sm:text-[0.9375rem]"
              >
                {cta}
              </Link>
              <Link
                to="/contact"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-5 text-[0.875rem] font-medium text-fg transition-colors hover:border-fg/30 sm:h-12 sm:px-6 sm:text-[0.9375rem]"
              >
                Ask us anything
              </Link>
            </div>
          </div>

          <div className="relative mx-auto h-72 w-full max-w-lg sm:h-80" aria-hidden>
            {shots.map((p, i) => (
              <div
                key={p.slug}
                className="polaroid absolute bg-white p-1.5 pb-5 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.45)]"
                style={[
                  { left: "0%", top: "1.5rem", width: "46%", rotate: "-6deg", zIndex: 1 },
                  { left: "30%", top: "0", width: "44%", rotate: "3deg", zIndex: 2 },
                  { left: "12%", bottom: "0", width: "42%", rotate: "-2deg", zIndex: 3 },
                ][i]}
              >
                <span className="block aspect-[4/3] w-full">
                  <Shot product={p} />
                </span>
              </div>
            ))}

            <div
              className="absolute right-0 top-8 z-30 w-[34%] rounded-xl bg-white px-5 py-6 text-[#1b1b1b] shadow-[0_18px_40px_-18px_rgb(0_0_0/0.45)]"
              style={{ rotate: "3deg" }}
            >
              <p className="tk-script whitespace-pre-line text-[1.7rem] leading-[1.1]">
                {"Create\nShare\nEarn\nGrow"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * One polaroid photo. Real covers get the white border's inner radius; the
 * generated art keeps its own gradient so the stack never shows an empty frame.
 */
function Shot({ product }: { product: Product }) {
  /*
   * The generated art is always painted underneath, and a real cover is layered
   * on top when one exists.
   *
   * Not an if/else. RefImage renders nothing when its file 404s, and the
   * reference art set is fetched rather than committed — so branching on
   * `art.src` alone produced three blank white polaroids. The gradient is the
   * floor, exactly as it is on the category tiles.
   *
   * The wrapper is sized explicitly rather than with aspect-ratio: an img
   * positioned absolutely has no in-flow child to give the box a height.
   */
  return (
    <span className="relative block h-full w-full overflow-hidden rounded-[0.5rem]">
      <ProductArt {...product.art} kind={product.art.kind} className="size-full" />
      {product.art.src && <RefImage src={product.art.src} alt="" />}
    </span>
  );
}

/**
 * Project screenshots — the marketplace's own product imagery.
 *
 * Originals live in `Project_Images/` at the repo root, untouched and committed
 * as the source of truth. `npm run art:projects` derives web copies into
 * `public/img/products/<product-slug>/` and regenerates this file, so nothing
 * hand-maintains these paths.
 *
 * Distinct from the other two image layers on purpose:
 *
 *   PROJECT_IMAGES   real screenshots of products we sell  (this file, committed)
 *   ARTWORK          optional overrides by slot key        (src/data/artwork.ts)
 *   /img/ref/…       captured from the design reference    (gitignored, not ours)
 *
 * `productImages(slug)` is the single lookup the UI uses, so a product's cover
 * and gallery come from one place rather than being threaded through props.
 */

export interface ProductImages {
  /** card + detail cover */
  cover?: string;
  /** detail-page gallery, in display order */
  gallery: string[];
}

export const PROJECT_IMAGES: Record<string, ProductImages> = {
  "dubs-casino": {
    cover: "/img/products/dubs-casino/dub-1-cover.webp",
    gallery: [
      "/img/products/dubs-casino/dub-1-full.webp",
      "/img/products/dubs-casino/dub-2-full.webp",
      "/img/products/dubs-casino/dubs-3-full.webp",
      "/img/products/dubs-casino/dubs-4-full.webp",
      "/img/products/dubs-casino/screenshot_2025_11_19_at_12_21_04-full.webp",
    ],
  },
  "dustbit-casino": {
    cover: "/img/products/dustbit-casino/dustbit-1-cover.webp",
    gallery: [
      "/img/products/dustbit-casino/dustbit-1-full.webp",
    ],
  },
  "kings-casino": {
    cover: "/img/products/kings-casino/kings-1-cover.webp",
    gallery: [
      "/img/products/kings-casino/kings-1-full.webp",
    ],
  },
  "minebit-casino": {
    cover: "/img/products/minebit-casino/minebit-1-cover.webp",
    gallery: [
      "/img/products/minebit-casino/minebit-1-full.webp",
      "/img/products/minebit-casino/minebit-2-full.webp",
    ],
  },
  "moonsale-launchpad": {
    cover: "/img/products/moonsale-launchpad/moonsale-1-cover.webp",
    gallery: [
      "/img/products/moonsale-launchpad/moonsale-1-full.webp",
      "/img/products/moonsale-launchpad/moonsale-2-full.webp",
      "/img/products/moonsale-launchpad/moonsale-3-full.webp",
      "/img/products/moonsale-launchpad/moonsale-4-full.webp",
      "/img/products/moonsale-launchpad/moonsale-5-full.webp",
    ],
  },
  "shuffle-casino": {
    cover: "/img/products/shuffle-casino/shuffle-1-cover.webp",
    gallery: [
      "/img/products/shuffle-casino/shuffle-1-full.webp",
      "/img/products/shuffle-casino/shuffle-2-full.webp",
      "/img/products/shuffle-casino/shuffle-3-full.webp",
    ],
  },
  "whale-casino": {
    cover: "/img/products/whale-casino/whale-1-cover.webp",
    gallery: [
      "/img/products/whale-casino/whale-1-full.webp",
      "/img/products/whale-casino/whale-2-full.webp",
    ],
  },
};

export const productImages = (slug: string): ProductImages | undefined => PROJECT_IMAGES[slug];

/** True when a product has real screenshots rather than generated art. */
export const hasProjectImages = (slug: string): boolean => Boolean(PROJECT_IMAGES[slug]?.cover);

/**
 * Original artwork overrides.
 *
 * The reference-manifest in `ref-images.ts` describes the *demo's* asset set —
 * captures pulled from demo.storekitt.app into a gitignored directory purely so
 * the layout could be matched. Those are stand-ins.
 *
 * This file is the real thing: a key → public-path map for the actual work that
 * belongs on the storefront. It is committed, unlike `public/img/ref/`, because
 * these are the site's own assets.
 *
 * Resolution order, applied inside `refSrc()`:
 *
 *     artwork  →  reference capture  →  generated gradient
 *
 * so dropping an entry here replaces the placeholder everywhere that key is used
 * — the product card, the product gallery, the search dialog, the collection
 * mosaic, the seller polaroids — without touching a single component.
 *
 * Keys are the same ones the catalog already passes to `art()` / `images: []`
 * (`p-nature-details`, `c-fonts`, `collection-spot-2`, …). New keys are allowed
 * too: `scripts/import-artwork.mjs` and `npm run check:images` both treat this
 * map as authoritative, so artwork for a product you add later just works.
 *
 * Normally you never edit this by hand — `npm run art:import` writes it from the
 * images it finds. The empty object is a valid, fully-working state.
 */

export const ARTWORK: Record<string, string> = {};

/** Public path for original artwork, or undefined when the key has none. */
export const artworkSrc = (file: string): string | undefined => ARTWORK[file];

export const artworkKeys = (): string[] => Object.keys(ARTWORK);

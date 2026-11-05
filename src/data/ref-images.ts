/**
 * Reference imagery manifest.
 *
 * Layout and art direction were modelled on demo.storekitt.app. These are the
 * original asset URLs from that demo, kept here so the set can be re-fetched
 * reproducibly. `scripts/fetch-ref-images.sh` is generated from this file, so
 * adding an entry here and re-running the generator keeps them in sync.
 *
 * Nothing here is required at runtime: `<ProductArt>` falls back to the
 * generated gradient whenever a file is missing or fails to load.
 */

import { artworkSrc } from "@/data/artwork";

export type RefKind = "product" | "category" | "promo" | "blog" | "avatar" | "spot";

export interface RefImage {
  /** local filename, without extension — files land in /public/img/ref/<file>.webp */
  file: string;
  /** path relative to the demo's /uploads (or /theme/presets) root */
  remote: string;
  kind: RefKind;
  /** what the image shows in the reference, for picking replacements later */
  label: string;
}

const U = "uploads";
const T = `${U}/products/thumbnails/2026/10`;
const C = `${U}/categories/2026/10`;
const A = `${U}/avatars/2026/10`;
const B = `${U}/blog/2026/10`;
const P = "theme/presets/storekitt";

export const REF_IMAGES: RefImage[] = [
  // ---------------------------------------------------------------- products
  { file: "p-nature-details", remote: `${T}/MqpYPzqtpRa6ODBVlgoLzxhA.webp`, kind: "product", label: "Nature Details" },
  { file: "p-golden-retriever", remote: `${T}/ZIKdbQRnHEZMzqHY3xbkA5DL.webp`, kind: "product", label: "Happy Golden Retriever" },
  { file: "p-coastal-dream", remote: `${T}/s5JHgFSkVEp05dAuOsvwM9Em.webp`, kind: "product", label: "Coastal Dream" },
  { file: "p-morning-reflections", remote: `${T}/CEMC8TXi2lsRUvqaXk8ucwVN.webp`, kind: "product", label: "Morning Reflections" },
  { file: "p-abstract-gradient", remote: `${T}/8LIrXXBdk9De1BuweYvtJ4fR.webp`, kind: "product", label: "Abstract Gradient Flow" },
  { file: "p-summit-theme", remote: `${T}/HCQ1LWsXivU4Vhiu6zcpe7fH.webp`, kind: "product", label: "Summit — WordPress Theme" },
  { file: "p-line-icons", remote: `${T}/8CLNoJsexh9Fde4sceYFbaoX.webp`, kind: "product", label: "Line Icons Pack" },
  { file: "p-youtube-pack", remote: `${T}/j7Mzz6nLY6yOirhWKB3xoshF.webp`, kind: "product", label: "YouTube Creator Pack" },
  { file: "p-golden-hour", remote: `${T}/SgezNVA487fF3RQtY14NNM2K.webp`, kind: "product", label: "Golden Hour Portrait" },
  { file: "p-still-life", remote: `${T}/RMYzFC4YOKj8cPWmWRQp2Prv.webp`, kind: "product", label: "Minimal Still Life" },
  { file: "p-corporate", remote: `${T}/3ALHXvuufVhe7NaOSLEsR3eR.webp`, kind: "product", label: "Inspiring Corporate" },
  { file: "p-city-vibes", remote: `${T}/ZtaErw1TPmjfK0lCUQvpInXI.webp`, kind: "product", label: "City Vibes" },
  { file: "p-sea-cliffs", remote: `${T}/fwQpxlnempkCp8VREVkKnzUj.webp`, kind: "product", label: "Sea Cliffs" },
  { file: "p-above-valley", remote: `${T}/uiiTiW9hT8T6ex9GT7blMtAt.webp`, kind: "product", label: "Above the Valley" },
  { file: "p-wanderer", remote: `${T}/qYWvvON5TTTANTZoNvyunEtK.webp`, kind: "product", label: "Wanderer at Sunrise" },
  { file: "p-lofi-beat", remote: `${T}/FIQ0OMuHEGFweuwU6pgaL0v5.webp`, kind: "product", label: "Lo-fi Chill Study Beat" },
  { file: "p-nova-ui-kit", remote: `${T}/kbhsmUl3aBojsFpnbbTPeuM9.webp`, kind: "product", label: "Nova — SaaS Dashboard UI Kit" },
  { file: "p-skyline-dusk", remote: `${T}/n1QtRnE43ShDik7YKLys2ZyG.webp`, kind: "product", label: "Skyline at Dusk" },
  { file: "p-forest-mist", remote: `${T}/MVm72i5lr8eRUuF0IpHLL4Ea.webp`, kind: "product", label: "Forest in the Mist" },
  { file: "p-harvest-bowl", remote: `${T}/qozn7MnHr7fEwASIXYPlYniF.webp`, kind: "product", label: "Fresh Harvest Bowl" },
  { file: "p-travel-video", remote: `${T}/bSKsJn3ux1pbEW1rbMliHZA0.webp`, kind: "product", label: "Cinematic Travel Video Pack" },
  { file: "p-flowsync", remote: `${T}/uVGYOkSdJDoQjOqD6DHxhhxF.webp`, kind: "product", label: "FlowSync — SaaS Dashboard Template" },
  { file: "p-calm-workspace", remote: `${T}/sDJFbfWyAJYT6hMkO33AvHLQ.webp`, kind: "product", label: "Calm Workspace" },
  { file: "p-happy-people", remote: `${T}/hEEsSrWM8bk3hxZpFZqN0jFQ.webp`, kind: "product", label: "Happy People Illustration Set" },
  { file: "p-sound-effects", remote: `${T}/h8FXBm0o67q4AjMA6b3NMqFi.webp`, kind: "product", label: "UI Sound Effects" },
  { file: "p-trailer-rise", remote: `${T}/wJK4Gx3EyXl3WfDMPhsbqX4U.webp`, kind: "product", label: "Epic Trailer Rise" },

  // -------------------------------------------------------------- categories
  { file: "c-website-templates", remote: `${C}/wUG3l4rMHQjRcPjZ41eGRMOp.webp`, kind: "category", label: "Website Templates" },
  { file: "c-wordpress", remote: `${C}/ODcRdQNZXKyZfCAV1Mc6SVvk.webp`, kind: "category", label: "WordPress" },
  { file: "c-scripts-code", remote: `${C}/CGPNCWFZkcYEVLPdxnEHvvo7.webp`, kind: "category", label: "Scripts & Code" },
  { file: "c-ui-kits", remote: `${C}/JnfkkjsliTa130vv0yU9mdy9.webp`, kind: "category", label: "UI Kits" },
  { file: "c-graphics", remote: `${C}/dvcizWOpI2FrBosyg0l0xMjZ.webp`, kind: "category", label: "Graphics" },
  { file: "c-fonts", remote: `${C}/Ezu8Vg1qsVdWwikvKBScS6hK.webp`, kind: "category", label: "Fonts" },
  { file: "c-photos", remote: `${C}/J80xIkeKBpJ9F1baFWbMdf4A.webp`, kind: "category", label: "Photos" },
  { file: "c-video", remote: `${C}/JwVxZGOdyFaW5QsQ24RB4Zjv.webp`, kind: "category", label: "Video" },

  // ------------------------------------------------------- promos & editorial
  { file: "promo-1", remote: `${P}/promo-1.webp`, kind: "promo", label: "Fresh drops promo" },
  { file: "promo-2", remote: `${P}/promo-2.webp`, kind: "promo", label: "Free goodies promo" },
  { file: "collection-spot-1", remote: `${P}/spot-1.webp`, kind: "spot", label: "Featured collection 1" },
  { file: "collection-spot-2", remote: `${P}/spot-2.webp`, kind: "spot", label: "Featured collection 2" },
  { file: "collection-spot-3", remote: `${P}/spot-3.webp`, kind: "spot", label: "Featured collection 3" },
  { file: "collection-spot-4", remote: `${P}/spot-4.webp`, kind: "spot", label: "Featured collection 4" },
  { file: "cta-1", remote: `${P}/cta-1.webp`, kind: "spot", label: "Seller CTA 1" },
  { file: "cta-2", remote: `${P}/cta-2.webp`, kind: "spot", label: "Seller CTA 2" },
  { file: "cta-3", remote: `${P}/cta-3.webp`, kind: "spot", label: "Seller CTA 3" },
  { file: "newsletter", remote: `${P}/newsletter.webp`, kind: "spot", label: "Newsletter panel" },

  // -------------------------------------------------------------------- blog
  { file: "b-dashboard-template", remote: `${B}/ISdcdQhOIKWjj739zPHKKtCr.webp`, kind: "blog", label: "Choosing a dashboard template" },
  { file: "b-creator-story", remote: `${B}/z7le7NBxHuejOWeTaW1kPwwD.webp`, kind: "blog", label: "Creator story — Rockies" },
  { file: "b-design-trends", remote: `${B}/MxQTbxSPFLloVlB8fqeicrbm.webp`, kind: "blog", label: "Design trends" },

  // ------------------------------------------------------------------ avatars
  { file: "a-daniel", remote: `${A}/tohH9Fa8rwN0YsiGXUMXFgGq.webp`, kind: "avatar", label: "Daniel K. Photography" },
  { file: "a-maria", remote: `${A}/E4kH6TXOlpQPvCEzprAMhhan.webp`, kind: "avatar", label: "Maria Lopez Studio" },
  { file: "a-pixelforge", remote: `${A}/bJw4R5rN9f48TgWME3h3fIgV.webp`, kind: "avatar", label: "PixelForge Studio" },
  { file: "a-lumen", remote: `${A}/VA5kEybZPc46OGPJ7K4zAwwP.webp`, kind: "avatar", label: "Lumen Creative" },
];

export const REF_ORIGIN = "https://demo.storekitt.app";

/** Public path for a reference image. */
export const ref = (file: string) => `/img/ref/${file}.webp`;

const byFile = new Map(REF_IMAGES.map((i) => [i.file, i]));

/**
 * Resolve a key to a usable image path, or undefined so callers can fall back.
 *
 * Order: original artwork first, then the reference capture. Doing the swap
 * here rather than at each call site means every consumer — cards, galleries,
 * the search dialog, the mosaic — picks up new artwork automatically.
 */
export const refSrc = (file: string): string | undefined => {
  const own = artworkSrc(file);
  if (own) return own;
  return byFile.has(file) ? ref(file) : undefined;
};

export const refByKind = (kind: RefKind) => REF_IMAGES.filter((i) => i.kind === kind);

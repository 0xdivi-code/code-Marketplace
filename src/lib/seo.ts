/**
 * Per-page metadata.
 *
 * A single-page app still needs correct head tags: crawlers that execute JS read
 * these, and every social card is scraped from them. `useSeo` writes the tags
 * on mount and restores nothing afterwards — a route change always sets its own
 * values, so a stale title cannot leak between pages.
 *
 * Titles and descriptions set here are the same strings the server puts in the
 * sitemap, so the two never disagree.
 */
import * as React from "react";

const SITE = "Kiln";
const SUFFIX = " — production-ready source code";

export interface SeoInput {
  title: string;
  description?: string;
  /** Path only, e.g. `/item/quill-cms`. Canonicals are never absolute here. */
  path?: string;
  image?: string;
  type?: "website" | "product" | "article";
  /** Schema.org payload for rich results. */
  jsonLd?: Record<string, unknown>;
  noindex?: boolean;
}

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    document.head.appendChild(el);
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

export function useSeo(input: SeoInput) {
  const { title, description, path, image, type = "website", jsonLd, noindex } = input;

  React.useEffect(() => {
    const origin = window.location.origin;
    const url = `${origin}${path ?? window.location.pathname}`;
    const full = title.includes(SITE) ? title : `${title}${SUFFIX}`;

    document.title = full;
    if (description) {
      upsertMeta('meta[name="description"]', { name: "description", content: description });
      upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
      upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
    }

    upsertMeta('meta[property="og:title"]', { property: "og:title", content: full });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: full });
    upsertMeta('meta[property="og:type"]', { property: "og:type", content: type });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: url });
    upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: SITE });
    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    if (image) {
      const absolute = image.startsWith("http") ? image : `${origin}${image}`;
      upsertMeta('meta[property="og:image"]', { property: "og:image", content: absolute });
      upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: absolute });
    }

    upsertMeta('meta[name="robots"]', {
      name: "robots",
      content: noindex ? "noindex, nofollow" : "index, follow",
    });
    upsertLink("canonical", url);

    // Structured data is replaced rather than appended, or Google sees several
    // competing Product blocks for one page.
    document.head.querySelectorAll('script[data-seo="jsonld"]').forEach((n) => n.remove());
    if (jsonLd) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.seo = "jsonld";
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
  }, [title, description, path, image, type, noindex, JSON.stringify(jsonLd)]);
}

import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { FileText, Shield, RefreshCcw, Copyright, Cookie, LifeBuoy, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SITE } from "@/lib/constants";

/**
 * Legal and help pages live in the `pages` table so the studio can edit them
 * from the admin console without a deploy. Only presentation metadata — the
 * document order and each icon — stays in code.
 */
const navDocs: { slug: string; title: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { slug: "licensing", title: "License terms", icon: Copyright },
  { slug: "terms", title: "Terms of service", icon: Shield },
  { slug: "privacy", title: "Privacy policy", icon: Shield },
  { slug: "refunds", title: "Refund policy", icon: RefreshCcw },
  { slug: "cookies", title: "Cookie policy", icon: Cookie },
  { slug: "support", title: "Support policy", icon: LifeBuoy },
  { slug: "faq", title: "FAQ", icon: HelpCircle },
];

interface PageRecord {
  slug: string;
  title: string;
  body: string;
  excerpt: string;
  kind: string;
  status: string;
  updatedAt: string;
}

/** Renders the subset of markdown the CMS body editor produces. */
function Markdown({ body }: { body: string }) {
  const blocks = body.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="mt-7 space-y-6">
      {blocks.map((block, i) => {
        if (block.startsWith("## ")) {
          return (
            <h2 key={i} className="text-[1.15rem] leading-snug">
              {block.slice(3)}
            </h2>
          );
        }
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i} className="space-y-1.5">
              {lines.map((li, j) => (
                <li key={j} className="flex items-start gap-2 text-[0.875rem] text-ink-2">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-ink-3" />
                  <span className="leading-relaxed">{li.slice(2)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-[0.875rem] leading-[1.75] text-ink-2">
            {lines.join(" ")}
          </p>
        );
      })}
    </div>
  );
}

export default function LegalPage() {
  const { slug = "" } = useParams();
  const [page, setPage] = React.useState<PageRecord | null>(null);
  const [nav, setNav] = React.useState<PageRecord[]>([]);
  const [state, setState] = React.useState<"loading" | "ready" | "missing">("loading");

  React.useEffect(() => {
    let alive = true;
    setState("loading");
    void (async () => {
      try {
        const [one, list] = await Promise.all([
          fetch(`/api/pages/${encodeURIComponent(slug)}`),
          fetch("/api/pages"),
        ]);
        if (!alive) return;
        if (!one.ok) {
          setState("missing");
          return;
        }
        const record = (await one.json()) as { page: PageRecord };
        const all = list.ok ? ((await list.json()) as { pages: PageRecord[] }).pages : [];
        setPage(record.page);
        setNav(all);
        setState("ready");
      } catch {
        if (alive) setState("missing");
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  if (state === "loading") {
    return <div className="container-x py-24 text-center text-sm text-ink-3">Loading…</div>;
  }

  if (state === "missing" || !page) {
    return (
      <div className="container-x py-20 text-center">
        <h1 className="text-2xl">Document not found</h1>
        <Link to="/" className="mt-3 inline-block text-sm underline">
          Back home
        </Link>
      </div>
    );
  }

  const isFaq = page.slug === "faq";
  const icon = navDocs.find((n) => n.slug === page.slug)?.icon ?? FileText;
  const Icon = icon;
  const updated = new Date(page.updatedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="container-x py-10">
      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="label-mono mb-3 text-[0.5625rem] text-ink-3">Documents</p>
          <nav className="space-y-0.5">
            {navDocs
              .filter((n) => nav.some((p) => p.slug === n.slug))
              .map((n) => {
                const D = n.icon;
                return (
                  <Link
                    key={n.slug}
                    to={`/page/${n.slug}`}
                    className={`flex items-center gap-2 rounded-sm px-2.5 py-2 text-[0.8125rem] transition-colors ${
                      n.slug === slug
                        ? "bg-surface font-medium text-ink shadow-[inset_2px_0_0_var(--accent)]"
                        : "text-ink-2 hover:bg-surface-2/70 hover:text-ink"
                    }`}
                  >
                    <D className="size-3.5" />
                    {n.title}
                  </Link>
                );
              })}
          </nav>
          <div className="mt-4 rounded-md border border-line bg-surface-2/50 p-3">
            <p className="text-[0.6875rem] leading-relaxed text-ink-2">
              Something unclear? Email{" "}
              <a href={`mailto:${SITE.email}`} className="underline underline-offset-2">
                {SITE.email}
              </a>{" "}
              — plain answers, no legal theatre.
            </p>
          </div>
        </aside>

        <div className="min-w-0 max-w-3xl">
          <div className="flex items-center gap-2">
            <Badge variant="neutral" size="sm">
              {isFaq ? "Help" : "Legal"}
            </Badge>
            <span className="text-[0.6875rem] text-ink-3">Updated {updated}</span>
          </div>
          <h1 className="mt-3 text-[2.2rem] leading-tight sm:text-[2.6rem]">{page.title}</h1>
          {page.excerpt && <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">{page.excerpt}</p>}
          <Markdown body={page.body} />
          <div className="mt-10 flex items-center gap-2 border-t border-line pt-5 text-[0.75rem] text-ink-3">
            <Icon className="size-3.5" />
            {isFaq ? (
              <span>
                Still stuck?{" "}
                <Link to="/contact" className="underline underline-offset-2 hover:text-ink">
                  Ask us directly
                </Link>
                .
              </span>
            ) : (
              <span>Questions about this document? Email {SITE.email}.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

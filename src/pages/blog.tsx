import * as React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { posts } from "@/data/catalog";
import { cn } from "@/lib/utils";
import { RefImage } from "@/components/ui/ref-image";

const cats = ["All", "Business", "Engineering", "Product"];

export default function BlogPage() {
  const [cat, setCat] = React.useState("All");
  const [q, setQ] = React.useState("");
  const list = posts.filter(
    (p) =>
      (cat === "All" || p.category === cat) &&
      (p.title + p.excerpt).toLowerCase().includes(q.toLowerCase()),
  );
  const [hero, ...rest] = list;

  return (
    <div className="container-x py-12">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label-mono text-accent-ink dark:text-accent">Journal</p>
          <h1 className="mt-2 text-[2.2rem] leading-[1.02] sm:text-[2.9rem]">Notes from the workbench</h1>
          <p className="mt-2 max-w-lg text-[0.9375rem] leading-relaxed text-ink-2">
            Release reasoning, pricing decisions and the parts we got wrong. Twice a month, roughly.
          </p>
        </div>
        <div className="relative w-full sm:max-w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search posts"
            className="h-10 pl-8 text-[0.8125rem]"
          />
        </div>
      </div>

      <div className="mt-6 flex gap-1.5">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[0.75rem] transition-colors",
              cat === c
                ? "border-brand bg-brand text-brand-ink"
                : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-line-strong py-20 text-center">
          <p className="font-display text-xl">No posts match</p>
          <p className="mt-1 text-sm text-ink-2">Try a different category or search term.</p>
        </div>
      ) : (
        <>
          <motion.article
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mt-8"
          >
            <Link to={`/blog/${hero.slug}`} className="group grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
              <div
                className="relative aspect-[16/10] overflow-hidden rounded-lg"
                style={{ background: `linear-gradient(135deg, ${hero.from}, ${hero.to})` }}
              >
                <svg viewBox="0 0 480 300" className="absolute inset-0 size-full" aria-hidden>
                  <circle cx="380" cy="80" r="70" fill="white" opacity="0.08" />
                  <path d="M0 230 Q120 170 240 215 T480 200" stroke="white" strokeWidth="1" fill="none" opacity="0.25" />
                </svg>
                <Badge variant="glass" size="sm" className="absolute left-3 top-3">
                  Latest · {hero.category}
                </Badge>
              </div>
              <div>
                <div className="flex items-center gap-2 text-[0.6875rem] text-ink-3">
                  <time>
                    {new Date(hero.date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </time>
                  <span>·</span>
                  <span>{hero.read} min read</span>
                </div>
                <h2 className="mt-2 text-[1.7rem] leading-tight group-hover:text-accent-ink dark:group-hover:text-accent sm:text-[2rem]">
                  {hero.title}
                </h2>
                <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-ink-2">{hero.excerpt}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-accent-ink dark:text-accent">
                  Read the post <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          </motion.article>

          <div className="mt-12 grid gap-6 border-t border-line pt-10 md:grid-cols-3">
            {rest.map((p, i) => (
              <motion.article
                key={p.slug}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <Link to={`/blog/${p.slug}`} className="group block">
                  <div
                    className="relative aspect-[16/9] overflow-hidden rounded-md"
                    style={{ background: `linear-gradient(135deg, ${p.from}, ${p.to})` }}
                  >
                    <RefImage src={p.src} hover />
                    {p.src && <div className="absolute inset-0 bg-gradient-to-t from-[#14120f]/45 to-transparent" />}
                    <Badge variant="glass" size="sm" className="absolute left-3 top-3">
                      {p.category}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[0.625rem] text-ink-3">
                    <time>
                      {new Date(p.date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </time>
                    <span>·</span>
                    <span>{p.read} min read</span>
                  </div>
                  <h3 className="mt-1.5 font-display text-[1.1rem] leading-snug group-hover:text-accent-ink dark:group-hover:text-accent">
                    {p.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-[0.8125rem] leading-relaxed text-ink-2">
                    {p.excerpt}
                  </p>
                </Link>
              </motion.article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

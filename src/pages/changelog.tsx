import * as React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { products } from "@/data/catalog";
import { cn } from "@/lib/utils";
import { GitCommitHorizontal, ArrowUpRight } from "lucide-react";

type Entry = {
  version: string;
  date: string;
  notes: string[];
  product: string;
  slug: string;
  kind: "feature" | "fix" | "breaking";
};

export default function ChangelogPage() {
  const [filter, setFilter] = React.useState("all");

  const entries: Entry[] = React.useMemo(
    () =>
      products
        .flatMap((p) =>
          p.changelog.map((c, i) => ({
            version: c.version,
            date: c.date,
            notes: c.notes,
            product: p.name,
            slug: p.slug,
            kind: (i === 0 && c.version.endsWith(".0") ? "feature" : i === 0 && c.version.startsWith("1.") ? "breaking" : "fix") as Entry["kind"],
          })),
        )
        .sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    [],
  );

  const list = filter === "all" ? entries : entries.filter((e) => e.kind === filter);
  const grouped = list.reduce<Record<string, Entry[]>>((acc, e) => {
    const key = new Date(e.date).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    (acc[key] ||= []).push(e);
    return acc;
  }, {});

  return (
    <div className="container-x py-12">
      <p className="label-mono text-accent-ink dark:text-accent">Changelog</p>
      <h1 className="mt-2 text-[2.2rem] leading-tight sm:text-[2.8rem]">Everything we shipped</h1>
      <p className="mt-2 max-w-lg text-[0.9375rem] leading-relaxed text-ink-2">
        Release notes for the whole catalogue, newest first. Breaking changes are always called out
        with a migration note.
      </p>

      <div className="mt-6 flex flex-wrap gap-1.5">
        {[
          { id: "all", label: "Everything" },
          { id: "feature", label: "Features" },
          { id: "fix", label: "Fixes" },
          { id: "breaking", label: "Breaking" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[0.75rem] transition-colors",
              filter === f.id
                ? "border-brand bg-brand text-brand-ink"
                : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-9 space-y-9">
        {Object.entries(grouped).map(([month, items]) => (
          <section key={month}>
            <h2 className="mb-4 flex items-center gap-3 text-[0.9375rem] font-medium">
              {month}
              <span className="h-px flex-1 bg-line" />
              <span className="label-mono text-[0.5625rem] text-ink-3">{items.length} releases</span>
            </h2>
            <div className="space-y-2">
              {items.map((e, i) => (
                <motion.div
                  key={`${e.slug}-${e.version}`}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: i * 0.03 }}
                  className="group grid gap-3 rounded-md border border-line bg-surface p-4 sm:grid-cols-[130px_1fr_auto] sm:items-start"
                >
                  <div>
                    <span className="font-mono text-[0.8125rem] font-medium">v{e.version}</span>
                    <p className="text-[0.625rem] text-ink-3">
                      {new Date(e.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <div>
                    <Link
                      to={`/item/${e.slug}`}
                      className="flex items-center gap-1 text-[0.8125rem] font-medium hover:text-accent-ink dark:hover:text-accent"
                    >
                      {e.product} <ArrowUpRight className="size-3 text-ink-3" />
                    </Link>
                    <ul className="mt-1 space-y-1">
                      {e.notes.map((n) => (
                        <li key={n} className="flex items-start gap-2 text-[0.75rem] leading-relaxed text-ink-2">
                          <GitCommitHorizontal className="mt-0.5 size-3 shrink-0 text-ink-3" />
                          {n}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Badge
                    variant={e.kind === "breaking" ? "danger" : e.kind === "feature" ? "sage" : "neutral"}
                    size="sm"
                    className="justify-self-start capitalize sm:justify-self-end"
                  >
                    {e.kind}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

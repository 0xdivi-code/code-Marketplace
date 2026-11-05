import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, GitBranch, Code2, Users, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { authors, stats } from "@/data/catalog";

const values = [
  {
    title: "Code you can read",
    body: "No minified builds, no “coming soon”. Every file in the zip is the file we run. If it looks strange in six months, the comment explains why.",
  },
  {
    title: "One release cadence",
    body: "Boring, predictable Tuesdays. Breaking changes get a migration note and a codemod where feasible — never a silent bump.",
  },
  {
    title: "Small, permanent team",
    body: "Three people, no resellers, no affiliate spam. The person answering support wrote the code you’re asking about.",
  },
  {
    title: "Honest pricing",
    body: "One-time payment. License tiers that map to how you actually work, not to how many phone screens you open.",
  },
];

const timeline = [
  { year: "2021", text: "Kiln starts as a two-person client studio in Lisbon, building ops tooling." },
  { year: "2022", text: "The internal dashboard kit gets cleaned up and listed as Lattice. 400 sales in year one." },
  { year: "2024", text: "Forge ships with multi-tenant auth and Stripe billing. The release cadence starts." },
  { year: "2025", text: "Free collection launches — 21,000 downloads and the studio’s best lead source." },
  { year: "2026", text: "Sixteen maintained items, 1,340 reviews, and a license policy we can explain in one paragraph." },
];

export default function AboutPage() {
  return (
    <div>
      <header className="relative overflow-hidden border-b border-line">
        <div className="grain absolute inset-0" aria-hidden />
        <div className="container-x relative py-14 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="label-mono text-accent-ink dark:text-accent">About the studio</p>
              <h1 className="mt-3 max-w-xl text-[2.4rem] leading-[0.98] sm:text-[3.4rem]">
                We sell the foundations we use every day.
              </h1>
              <p className="mt-4 max-w-lg text-[0.9375rem] leading-relaxed text-ink-2">
                Kiln is a three-person studio in Lisbon. We build product foundations for clients,
                keep the reusable parts on a real release schedule, and sell them here so other teams
                don’t have to rebuild auth and billing for the hundredth time.
              </p>
              <div className="mt-7 flex flex-wrap gap-2.5">
                <Button asChild size="lg">
                  <Link to="/browse">
                    See the catalogue <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/contact">Work with us</Link>
                </Button>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-line">
              <picture>
                <source srcSet="/img/studio-maker.webp" type="image/webp" />
                <img
                  src="/img/studio-maker.jpg"
                  alt="Inside the Kiln studio"
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                  decoding="async"
                  width={1408}
                  height={768}
                />
              </picture>
            </div>
          </div>
        </div>
      </header>

      <section className="container-x py-14">
        <div className="grid gap-4 border-y border-line py-8 sm:grid-cols-4">
          {[
            { k: `${stats.products}`, l: "maintained items", i: Code2 },
            { k: "24.8K", l: "developers using it", i: Users },
            { k: "1,340", l: "verified reviews", i: BadgeCheck },
            { k: "Lisbon", l: "one studio, no resellers", i: MapPin },
          ].map((s) => (
            <div key={s.l} className="flex items-start gap-3">
              <s.i className="mt-1 size-4 text-ink-3" />
              <div>
                <p className="font-display text-[1.6rem] leading-none">{s.k}</p>
                <p className="mt-1 text-[0.6875rem] text-ink-3">{s.l}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-x">
        <h2 className="text-[1.9rem] leading-tight sm:text-[2.3rem]">What we believe</h2>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {values.map((v, i) => (
            <motion.div
              key={v.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="rounded-lg border border-line bg-surface p-5"
            >
              <span className="label-mono text-[0.5rem] text-accent-ink dark:text-accent">
                0{i + 1}
              </span>
              <h3 className="mt-2 font-display text-[1.15rem]">{v.title}</h3>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-2">{v.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="container-x py-14">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-[1.9rem] leading-tight">A short history</h2>
            <p className="mt-2 max-w-sm text-[0.9375rem] leading-relaxed text-ink-2">
              No funding rounds, no growth at all costs. Just a steady list of things that work.
            </p>
          </div>
          <ol className="relative border-l border-line pl-6">
            {timeline.map((t, i) => (
              <motion.li
                key={t.year}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="relative pb-6 last:pb-0"
              >
                <span className="absolute -left-[27px] top-1.5 size-2.5 rounded-full border-2 border-paper bg-accent" />
                <p className="font-mono text-[0.6875rem] text-ink-3">{t.year}</p>
                <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">{t.text}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-x pb-16">
        <div className="rounded-lg border border-line bg-surface-2/50 p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-[1.5rem]">Who you’re buying from</h2>
              <p className="mt-1 text-[0.875rem] text-ink-2">
                Three people, plus two long-term collaborators.
              </p>
            </div>
            <span className="flex items-center gap-1.5 text-[0.6875rem] text-ink-3">
              <GitBranch className="size-3.5" /> Everything on main is releasable
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {authors.map((a) => (
              <div key={a.slug} className="rounded-md border border-line bg-surface p-4">
                <div className="flex items-center gap-2.5">
                  <Avatar initials={a.avatar} />
                  <div className="min-w-0">
                    <p className="truncate text-[0.8125rem] font-medium">{a.name}</p>
                    <p className="truncate text-[0.625rem] text-ink-3">{a.role}</p>
                  </div>
                </div>
                <p className="mt-2.5 line-clamp-3 text-[0.6875rem] leading-relaxed text-ink-2">{a.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

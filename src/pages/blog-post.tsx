import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { posts } from "@/data/catalog";
import NotFoundPage from "./not-found";

export default function BlogPostPage() {
  const { slug = "" } = useParams();
  const post = posts.find((p) => p.slug === slug);
  if (!post) return <NotFoundPage />;
  const next = posts.find((p) => p.slug !== post.slug);

  return (
    <div>
      <div
        className="relative overflow-hidden border-b border-line"
        style={{ background: `linear-gradient(135deg, ${post.from}, ${post.to})` }}
      >
        <div className="container-x relative py-12 text-white sm:py-16">
          <Link
            to="/blog"
            className="inline-flex items-center gap-1.5 text-[0.6875rem] text-white/70 hover:text-white"
          >
            <ArrowLeft className="size-3.5" /> Journal
          </Link>
          <Badge variant="glass" size="sm" className="mt-4">
            {post.category}
          </Badge>
          <h1 className="mt-3 max-w-3xl text-[2.1rem] leading-[1.05] sm:text-[3rem]">{post.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-[0.75rem] text-white/70">
            <span className="flex items-center gap-2">
              <Avatar initials="KS" size="sm" />
              Kiln Studio
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5" /> {post.read} min read
            </span>
            <time>
              {new Date(post.date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </time>
          </div>
        </div>
      </div>

      <article className="container-x py-12">
        <div className="mx-auto max-w-2xl">
          <p className="font-display text-[1.35rem] leading-snug text-ink">{post.excerpt}</p>
          <div className="mt-6 space-y-5 text-[0.9375rem] leading-[1.75] text-ink-2">
            <p>
              Every quarter we sit down with the support queue and the refund reasons and ask the
              same question: what did we ship that created work for someone else? It’s a slower
              process than a roadmap, and a more honest one.
            </p>
            <p>
              The pattern that keeps surfacing is that buyers don’t regret paying. They regret
              buying something they couldn’t read. Minified builds, "documentation coming soon",
              a component that reassures you in the demo and fights you on day three.
            </p>
            <h2 className="!mt-9 text-[1.4rem] !leading-snug text-ink">
              Subtraction is the actual release
            </h2>
            <p>
              For Forge 4 we deleted eight screens, two abstractions and a service worker nobody
              needed. The release notes looked thin. Support volume dropped by a third in the
              following month, which is the only metric we trust for a template.
            </p>
            <blockquote className="border-l-2 border-accent pl-4 font-display text-[1.15rem] italic leading-snug text-ink">
              “The best thing we can ship is a smaller surface area with a better comment on top.”
            </blockquote>
            <p>
              Practically, that means our definition of done includes: a migration note, a working
              upgrade path, and a paragraph explaining the trade-off we made. If we can’t write the
              paragraph, the feature isn’t finished.
            </p>
            <h2 className="!mt-9 text-[1.4rem] !leading-snug text-ink">What this means for pricing</h2>
            <p>
              We price per product, not per seat, because a license is about what you ship, not how
              many people sat in the room. Extended covers the case where the code becomes part of
              something you sell — that’s a different business relationship and it should cost
              differently.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-line pt-6">
            {[post.category, "Kiln", "release process"].map((t) => (
              <Badge key={t} variant="neutral" size="md">
                {t}
              </Badge>
            ))}
          </div>
        </div>

        {next && (
          <div className="mx-auto mt-12 max-w-2xl">
            <Link
              to={`/blog/${next.slug}`}
              className="group flex items-center justify-between rounded-lg border border-line bg-surface p-5 transition-colors hover:bg-surface-2/60"
            >
              <div>
                <p className="label-mono text-[0.5rem] text-ink-3">Next post</p>
                <p className="mt-1 font-display text-[1.05rem] leading-snug group-hover:text-accent-ink dark:group-hover:text-accent">
                  {next.title}
                </p>
              </div>
              <ArrowRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-1" />
            </Link>
            <div className="mt-4 text-center">
              <Button asChild variant="outline" size="sm">
                <Link to="/browse">Browse the catalogue</Link>
              </Button>
            </div>
          </div>
        )}
      </article>
    </div>
  );
}

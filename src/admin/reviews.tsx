import * as React from "react";
import { Star, Check, X, Eye, MessageSquare } from "lucide-react";
import { PageHeader } from "./admin-layout";
import { Panel } from "./ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { NativeSelect } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";

interface AdminReview {
  id: string;
  productSlug: string;
  productName: string | null;
  author: string;
  initials: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  helpful: number;
  verified: boolean;
  status: "pending" | "published" | "rejected";
}

export default function AdminReviews() {
  const [reviews, setReviews] = React.useState<AdminReview[]>([]);
  const [filter, setFilter] = React.useState("all");
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await api.get<{ reviews: AdminReview[] }>("/admin/reviews");
      setReviews(res.reviews);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load reviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function moderate(review: AdminReview, status: "published" | "rejected" | "pending") {
    setBusy(review.id);
    try {
      await api.patch(`/admin/reviews/${review.id}`, { status });
      toast.success(
        status === "published"
          ? `Published — ${review.author}'s rating now counts`
          : status === "rejected"
            ? "Review rejected and hidden from the product page"
            : "Moved back to the queue",
        { description: "The product's average rating was recalculated." },
      );
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That change did not stick.");
    } finally {
      setBusy(null);
    }
  }

  const rows = reviews.filter((r) => (filter === "all" ? true : r.status === filter));
  const pending = reviews.filter((r) => r.status === "pending").length;
  const published = reviews.filter((r) => r.status === "published");
  const average =
    published.length > 0 ? published.reduce((n, r) => n + r.rating, 0) / published.length : 0;

  return (
    <div>
      <PageHeader
        title="Reviews"
        subtitle={
          loading
            ? "Loading reviews…"
            : `${reviews.length} reviews · ${pending} awaiting moderation · ${average.toFixed(1)} average`
        }
        actions={
          <NativeSelect value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8 w-auto">
            <option value="all">All reviews</option>
            <option value="pending">Awaiting</option>
            <option value="published">Published</option>
            <option value="rejected">Rejected</option>
          </NativeSelect>
        }
      />

      <div className="mb-3 grid gap-3 sm:grid-cols-4">
        {[
          { l: "Awaiting", v: String(pending) },
          { l: "Published", v: String(published.length) },
          { l: "Rejected", v: String(reviews.filter((r) => r.status === "rejected").length) },
          { l: "Average rating", v: published.length ? average.toFixed(1) : "—" },
        ].map((s) => (
          <div key={s.l} className="rounded-lg border border-line bg-surface px-4 py-2.5">
            <p className="label-mono text-[0.4375rem] text-ink-3">{s.l}</p>
            <p className="font-mono text-[0.8125rem]">{s.v}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="rounded-lg border border-line py-16 text-center text-sm text-ink-3">Loading reviews…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong py-16 text-center">
          <MessageSquare className="mx-auto size-5 text-ink-3" />
          <p className="mt-2 text-[0.8125rem] font-medium">Nothing in this queue</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start gap-3">
                <Avatar initials={r.initials} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.8125rem] font-medium">{r.author}</span>
                    <span className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "size-3",
                            i < r.rating ? "fill-gold text-gold" : "text-line-strong",
                          )}
                        />
                      ))}
                    </span>
                    {r.verified && (
                      <Badge variant="sage" size="sm">
                        Verified buyer
                      </Badge>
                    )}
                    <Badge
                      variant={r.status === "published" ? "success" : r.status === "pending" ? "warn" : "neutral"}
                      size="sm"
                      className="capitalize"
                    >
                      {r.status}
                    </Badge>
                  </div>
                  <p className="mt-1.5 font-display text-[1rem] leading-snug">{r.title}</p>
                  <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-2">{r.body}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-[0.5625rem] text-ink-3">
                    <span>{r.productName ?? r.productSlug}</span>
                    <span>·</span>
                    <span>
                      {new Date(r.date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span>·</span>
                    <span>{r.helpful} found this helpful</span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {r.status !== "published" && (
                    <Button
                      size="xs"
                      className="h-7"
                      disabled={busy === r.id}
                      onClick={() => void moderate(r, "published")}
                    >
                      <Check className="size-3" /> Publish
                    </Button>
                  )}
                  {r.status !== "rejected" && (
                    <Button
                      variant="outline"
                      size="xs"
                      className="h-7"
                      disabled={busy === r.id}
                      onClick={() => void moderate(r, "rejected")}
                    >
                      <X className="size-3" /> Reject
                    </Button>
                  )}
                  {r.status !== "pending" && (
                    <Button
                      variant="ghost"
                      size="xs"
                      className="h-7"
                      disabled={busy === r.id}
                      onClick={() => void moderate(r, "pending")}
                    >
                      <Eye className="size-3" /> Requeue
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        <Panel title="How moderation works" bodyClassName="p-4 text-[0.6875rem] leading-relaxed text-ink-2">
          <p>
            Publishing or rejecting a review recalculates the product's average rating and review count
            from the reviews that remain published — the number on the product page is always the count of
            what is actually visible.
          </p>
        </Panel>
      </div>
    </div>
  );
}

import * as React from "react";
import { motion } from "framer-motion";
import { Mail, MessageSquare, Clock, Check, Send, MapPin, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, NativeSelect } from "@/components/ui/field";
import { SITE } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";

const topics = [
  { id: "presale", label: "Pre-sales question", meta: "Usually under 4 hours" },
  { id: "support", label: "Technical support", meta: "Licensed items, under 1 day" },
  { id: "license", label: "Licensing & invoices", meta: "Under 1 day" },
  { id: "custom", label: "Custom work", meta: "We reply with availability" },
];

export default function ContactPage() {
  const [topic, setTopic] = React.useState("presale");
  const [sent, setSent] = React.useState(false);

  return (
    <div className="container-x py-12">
      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          <p className="label-mono text-accent-ink dark:text-accent">Contact</p>
          <h1 className="mt-2.5 max-w-lg text-[2.2rem] leading-[1.02] sm:text-[2.9rem]">
            Talk to the people who wrote the code.
          </h1>
          <p className="mt-3 max-w-lg text-[0.9375rem] leading-relaxed text-ink-2">
            No ticket maze. Messages come to the studio and one of us answers — usually the same
            person who built the item.
          </p>

          <div className="mt-7 grid gap-2 sm:grid-cols-2">
            {topics.map((t) => (
              <button
                key={t.id}
                onClick={() => setTopic(t.id)}
                className={`rounded-md border p-3 text-left transition-colors ${
                  topic === t.id
                    ? "border-brand bg-brand-soft/50"
                    : "border-line hover:border-line-strong hover:bg-surface-2/50"
                }`}
              >
                <p className="text-[0.8125rem] font-medium">{t.label}</p>
                <p className="mt-0.5 text-[0.625rem] text-ink-3">{t.meta}</p>
              </button>
            ))}
          </div>

          {sent ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-lg border border-line bg-surface p-8 text-center"
            >
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-brand text-brand-ink">
                <Check className="size-5" strokeWidth={3} />
              </div>
              <h2 className="mt-4 font-display text-xl">Message received</h2>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-2">
                We’ll reply from {SITE.email} within one business day. Check your spam folder if you
                don’t see it.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setSent(false)}>
                Send another
              </Button>
            </motion.div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSent(true);
              }}
              className="mt-6 space-y-4 rounded-lg border border-line bg-surface p-5"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="name">
                  <Input id="name" required placeholder="Your name" />
                </Field>
                <Field label="Email" htmlFor="email">
                  <Input id="email" type="email" required placeholder="you@studio.com" />
                </Field>
              </div>
              <Field label="Topic" htmlFor="topic">
                <NativeSelect
                  id="topic"
                  className="h-11 text-sm"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                >
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Order number" htmlFor="order" optional hint="Speeds things up for support requests">
                <Input id="order" placeholder="KL-10482" />
              </Field>
              <Field label="Message" htmlFor="message">
                <Textarea
                  id="message"
                  required
                  placeholder="Tell us what you’re building and what you’ve tried…"
                  className="min-h-32"
                />
              </Field>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[0.625rem] text-ink-3">
                  We never share your message or email address.
                </p>
                <Button type="submit">
                  <Send className="size-4" /> Send message
                </Button>
              </div>
            </form>
          )}
        </div>

        <aside className="space-y-3">
          <div className="rounded-lg border border-line bg-surface p-5">
            <h2 className="font-display text-lg">Direct lines</h2>
            <ul className="mt-3 space-y-3 text-[0.8125rem]">
              <li className="flex items-start gap-2.5">
                <Mail className="mt-0.5 size-4 text-ink-3" />
                <div>
                  <p className="font-medium">General</p>
                  <a href={`mailto:${SITE.email}`} className="text-ink-2 hover:text-ink">
                    {SITE.email}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <LifeBuoy className="mt-0.5 size-4 text-ink-3" />
                <div>
                  <p className="font-medium">Support</p>
                  <a href={`mailto:${SITE.support}`} className="text-ink-2 hover:text-ink">
                    {SITE.support}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 text-ink-3" />
                <div>
                  <p className="font-medium">Studio</p>
                  <p className="text-ink-2">{SITE.address}</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-line bg-surface-2/60 p-5">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-ink-3" />
              <p className="text-[0.8125rem] font-medium">Response times</p>
            </div>
            <dl className="mt-3 space-y-2 text-[0.75rem]">
              {[
                ["Pre-sales", "~4 hours"],
                ["Bug reports", "~1 day"],
                ["Custom work", "2–3 days"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-ink-2">{k}</dt>
                  <dd className="font-mono text-ink-3">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 border-t border-line pt-3 text-[0.625rem] leading-relaxed text-ink-3">
              Mon–Fri, 09:00–18:00 WET. Urgent license issues get handled on weekends too.
            </p>
          </div>

          <div className="rounded-lg border border-line bg-brand p-5 text-brand-ink">
            <Badge variant="glass" size="sm" className="gap-1">
              <MessageSquare className="size-2.5" /> Faster option
            </Badge>
            <p className="mt-2 text-[0.8125rem] font-medium">Ask from inside an item</p>
            <p className="mt-1 text-[0.6875rem] leading-relaxed text-brand-ink/70">
              Use the message button on any product page and we get the stack context automatically.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

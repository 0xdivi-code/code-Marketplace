import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { FileText, Shield, RefreshCcw, Copyright, Cookie, LifeBuoy, HelpCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/disclosure";
import { Badge } from "@/components/ui/badge";
import { SITE } from "@/lib/constants";

type Doc = {
  title: string;
  eyebrow: string;
  updated: string;
  icon: React.ComponentType<{ className?: string }>;
  sections: { h: string; p?: string; list?: string[] }[];
};

const docs: Record<string, Doc> = {
  licensing: {
    title: "License terms",
    eyebrow: "Licensing",
    updated: "1 October 2026",
    icon: Copyright,
    sections: [
      {
        h: "Personal license",
        p: "For your own projects and learning. One developer, one end product. You may modify the code freely and use it in work you do not resell as source code.",
        list: ["1 developer seat", "1 end product", "Attribution appreciated, not required"],
      },
      {
        h: "Commercial license",
        p: "For client work. Up to five developers may work on one end product that you deliver to a client. The client may use the delivered product, but not redistribute the source.",
        list: ["Up to 5 developers", "1 client product", "Attribution removal permitted"],
      },
      {
        h: "Extended license",
        p: "For products you sell access to. Unlimited seats, unlimited end products, including SaaS offerings where the source is not distributed. White-label rights included.",
        list: ["Unlimited developers", "Unlimited products", "White-label rights"],
      },
      {
        h: "Never permitted",
        list: [
          "Reselling, sublicensing or redistributing the source itself",
          "Publishing the code as a template, starter or course asset",
          "Using the files to train a model that reproduces them",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of service",
    eyebrow: "Legal",
    updated: "1 October 2026",
    icon: FileText,
    sections: [
      {
        h: "1. Who we are",
        p: "Kiln is operated by Kiln Studio, Unipessoal Lda., registered in Portugal. By creating an account or buying an item you agree to these terms.",
      },
      {
        h: "2. Accounts",
        p: "You are responsible for activity under your account. Licenses are tied to the account that purchased them and may be transferred once, in writing, to another party with the original invoice.",
      },
      {
        h: "3. Delivery",
        p: "Digital items are delivered immediately after payment via your library and a download link by email. No physical delivery occurs.",
      },
      {
        h: "4. EU consumer right of withdrawal",
        p: "Digital content supplied immediately is exempt from the 14-day right of withdrawal once download begins, where you have explicitly consented. We still offer our refund policy as a courtesy (see Refunds).",
      },
      {
        h: "5. Liability",
        p: "Items are provided as-is. Our aggregate liability is limited to the amount you paid for the item in question. We are not liable for indirect or consequential loss.",
      },
      {
        h: "6. Changes",
        p: "We may update these terms. Material changes are announced by email to account holders at least 14 days before taking effect.",
      },
    ],
  },
  privacy: {
    title: "Privacy policy",
    eyebrow: "Legal",
    updated: "1 October 2026",
    icon: Shield,
    sections: [
      {
        h: "What we collect",
        list: [
          "Account details: name, email address, country and optional company details",
          "Order data: items purchased, license tier, invoice address, VAT number",
          "Technical data: IP address and user agent, kept for fraud prevention (90 days)",
          "Usage data: which pages and downloads, aggregated and never sold",
        ],
      },
      {
        h: "What we do not do",
        list: [
          "We do not sell personal data",
          "We do not run third-party advertising trackers",
          "We do not share your email with other customers",
        ],
      },
      {
        h: "Processors",
        p: "Payments are handled by Stripe. Email delivery by Postmark. Hosting in the EU (Falkenstein, Germany). Each processor is bound by a data processing agreement.",
      },
      {
        h: "Your rights",
        p: `Access, correction, export and deletion. Write to ${SITE.email} and we respond within 30 days. You may also complain to your local supervisory authority.`,
      },
    ],
  },
  refunds: {
    title: "Refund policy",
    eyebrow: "Legal",
    updated: "1 October 2026",
    icon: RefreshCcw,
    sections: [
      {
        h: "The short version",
        p: "If an item is broken, materially different from its description, or simply doesn’t fit your stack, tell us within 14 days and we’ll refund it. We would rather have a refund than a frustrated customer.",
      },
      {
        h: "What we need",
        list: [
          "Your order number",
          "What you tried (a stack trace, a screenshot, a short note)",
          "A chance to fix it first — we often can, within a day",
        ],
      },
      {
        h: "Where we can’t refund",
        list: [
          "Requests made after 14 days, except where law requires it",
          "Items already refunded once",
          "Bundles partially used beyond one item at our discretion",
        ],
      },
      {
        h: "How long it takes",
        p: "Approved refunds return to the original payment method within 5–10 business days. Card processors set the final timing.",
      },
    ],
  },
  cookies: {
    title: "Cookie policy",
    eyebrow: "Legal",
    updated: "1 October 2026",
    icon: Cookie,
    sections: [
      {
        h: "Strictly necessary",
        p: "Session cookie and CSRF token. These cannot be disabled without breaking sign-in and checkout.",
      },
      {
        h: "Preferences",
        p: "Theme choice, cart contents and recently viewed items. Stored locally in your browser, not on our servers.",
      },
      {
        h: "Analytics",
        p: "Aggregate page views with no cross-site identifiers and IP truncation. You can opt out in account settings.",
      },
    ],
  },
  support: {
    title: "Support policy",
    eyebrow: "Help",
    updated: "1 October 2026",
    icon: LifeBuoy,
    sections: [
      {
        h: "Included with every purchase",
        list: [
          "Answers from the author, not a first-line script",
          "Bug fixes for as long as the item is sold",
          "Access to earlier versions, forever",
          "Migration notes for breaking releases",
        ],
      },
      {
        h: "Response targets",
        p: "Mon–Fri, 09:00–18:00 WET. Pre-sales around 4 hours; technical support within one business day. We are a small team and we answer everything ourselves.",
      },
      {
        h: "Out of scope",
        p: "Custom feature work, debugging your own modifications, or third-party services you have integrated. We’ll say so clearly and offer a quote where it makes sense.",
      },
    ],
  },
};

const faqs = [
  {
    q: "What can I do with a personal license?",
    a: "Use the item in one end product for yourself or a client-facing project you don’t resell as source. It covers one developer. The end product can be free or paid, but the code itself can’t be redistributed.",
  },
  {
    q: "Do I get future updates?",
    a: "Yes. Every purchase includes all future versions at no extra cost, for as long as the item is published. Downloads live in your library and never expire.",
  },
  {
    q: "How do refunds work?",
    a: "If an item is broken or not as described, contact us within 14 days and we’ll make it right — usually a fix, or a full refund if we can’t.",
  },
  {
    q: "Can I use the code in a SaaS product?",
    a: "Commercial covers one client product. If you’re selling access to software built on the code, you need Extended — that’s the license that covers unlimited end products and white-labelling.",
  },
  {
    q: "Do you offer student or startup discounts?",
    a: "Students with a valid institutional email get 40% off any personal license. Pre-revenue startups can apply for a 50% credit toward an Extended license once they raise.",
  },
  {
    q: "Is there a demo or trial?",
    a: "The free collection is the real code — unminified and MIT licensed. For paid items, the public docs and live preview cover the architecture, and we answer pre-sales questions quickly.",
  },
  {
    q: "How do I get an invoice with my VAT number?",
    a: "Add your VAT number in account settings before checkout, or to the order afterwards. EU businesses are reverse-charged automatically where VIES validates the number.",
  },
  {
    q: "Can I hire you for custom work?",
    a: "Sometimes, when the scope fits around the catalogue. Send a note through the contact page with your stack and timeline.",
  },
];

export default function LegalPage() {
  const { slug = "" } = useParams();
  const isFaq = slug === "faq";
  const doc = docs[slug];
  const nav = [...Object.entries(docs), ["faq", { title: "FAQ", eyebrow: "Help", icon: HelpCircle }] as const];

  if (!isFaq && !doc) {
    return (
      <div className="container-x py-20 text-center">
        <h1 className="text-2xl">Document not found</h1>
        <Link to="/" className="mt-3 inline-block text-sm underline">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="container-x py-10">
      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="label-mono mb-3 text-[0.5625rem] text-ink-3">Documents</p>
          <nav className="space-y-0.5">
            {nav.map(([key, d]) => {
              const D = d as { title: string; icon: React.ComponentType<{ className?: string }> };
              return (
                <Link
                  key={key}
                  to={`/page/${key}`}
                  className={`flex items-center gap-2 rounded-sm px-2.5 py-2 text-[0.8125rem] transition-colors ${
                    key === slug
                      ? "bg-surface font-medium text-ink shadow-[inset_2px_0_0_var(--accent)]"
                      : "text-ink-2 hover:bg-surface-2/70 hover:text-ink"
                  }`}
                >
                  <D.icon className="size-3.5" />
                  {D.title}
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
          {isFaq ? (
            <>
              <p className="label-mono text-accent-ink dark:text-accent">Help</p>
              <h1 className="mt-2 text-[2.2rem] leading-tight sm:text-[2.6rem]">
                Frequently asked questions
              </h1>
              <p className="mt-2 text-[0.9375rem] text-ink-2">
                Buying, licensing and updates. If yours isn’t here,{" "}
                <Link to="/contact" className="underline underline-offset-2 hover:text-ink">
                  ask us directly
                </Link>
                .
              </p>
              <Accordion type="single" collapsible defaultValue="item-0" className="mt-7">
                {faqs.map((f, i) => (
                  <AccordionItem key={f.q} value={`item-${i}`}>
                    <AccordionTrigger>{f.q}</AccordionTrigger>
                    <AccordionContent>{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </>
          ) : (
            doc && (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant="neutral" size="sm">
                    {doc.eyebrow}
                  </Badge>
                  <span className="text-[0.6875rem] text-ink-3">Updated {doc.updated}</span>
                </div>
                <h1 className="mt-3 text-[2.2rem] leading-tight sm:text-[2.6rem]">{doc.title}</h1>
                <div className="mt-7 space-y-7">
                  {doc.sections.map((s) => (
                    <section key={s.h}>
                      <h2 className="text-[1.15rem] leading-snug">{s.h}</h2>
                      {s.p && (
                        <p className="mt-2 text-[0.875rem] leading-[1.75] text-ink-2">{s.p}</p>
                      )}
                      {s.list && (
                        <ul className="mt-2.5 space-y-1.5">
                          {s.list.map((li) => (
                            <li key={li} className="flex items-start gap-2 text-[0.875rem] text-ink-2">
                              <span className="mt-2 size-1 shrink-0 rounded-full bg-ink-3" />
                              <span className="leading-relaxed">{li}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  ))}
                </div>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}

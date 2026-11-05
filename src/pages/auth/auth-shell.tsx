import * as React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { KilnLogo } from "@/components/site/logo";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  aside,
}: {
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label="Kiln home">
            <KilnLogo />
          </Link>
          <Link
            to="/browse"
            className="flex items-center gap-1.5 text-[0.75rem] text-ink-2 hover:text-ink"
          >
            <ArrowLeft className="size-3.5" /> Back to shop
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="w-full max-w-sm"
          >
            <h1 className="text-[1.9rem] leading-tight">{title}</h1>
            <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-2">{subtitle}</p>
            <div className="mt-7">{children}</div>
            {footer && <div className="mt-6 text-center text-[0.8125rem] text-ink-2">{footer}</div>}
          </motion.div>
        </div>

        <div className="flex items-center justify-center gap-1.5 pb-2 text-[0.625rem] text-ink-3">
          <ShieldCheck className="size-3" /> Encrypted sign-in · we never store your card
        </div>
      </div>

      <aside className="relative hidden overflow-hidden bg-brand lg:block">
        <div className="relative z-10 flex h-full flex-col justify-between p-10 text-brand-ink">
          <p className="label-mono text-[0.5625rem] text-brand-ink/50">Kiln library</p>
          <div>
            <p className="max-w-md font-display text-[2rem] leading-[1.1]">
              {aside ?? "One account. Every license, download and receipt in one place."}
            </p>
            <div className="mt-8 space-y-3">
              {[
                "Download any version you’ve ever bought",
                "Manage licenses and seats",
                "Invoices generated automatically",
                "Early access to new drops",
              ].map((t) => (
                <p key={t} className="flex items-center gap-2.5 text-[0.8125rem] text-brand-ink/70">
                  <span className="size-1.5 rounded-full bg-[#8fbf9a]" />
                  {t}
                </p>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 border-t border-white/10 pt-5">
            <div className="flex -space-x-2">
              {["MA", "IC", "PR", "AO"].map((i) => (
                <span
                  key={i}
                  className="grid size-8 place-items-center rounded-full border-2 border-brand bg-white/12 text-[0.5625rem] font-medium"
                >
                  {i}
                </span>
              ))}
            </div>
            <p className="text-[0.6875rem] text-brand-ink/60">
              24,800 developers keep their licenses here
            </p>
          </div>
        </div>
        <div
          aria-hidden
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 75% 25%, rgba(143,191,154,0.35), transparent 55%), radial-gradient(circle at 20% 80%, rgba(192,89,43,0.3), transparent 50%)",
          }}
        />
      </aside>
    </div>
  );
}

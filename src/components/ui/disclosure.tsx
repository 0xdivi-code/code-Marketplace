import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ChevronDown, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------- tabs */
export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  variant = "pill",
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
  variant?: "pill" | "line";
}) {
  return (
    <TabsPrimitive.List
      className={cn(
        "no-scrollbar flex items-center overflow-x-auto",
        variant === "pill"
          ? "gap-1 rounded-full border border-line bg-surface p-1"
          : "gap-6 border-b border-line",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  variant = "pill",
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
  variant?: "pill" | "line";
}) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap text-[0.8125rem] font-medium transition-colors focus-visible:outline-none disabled:opacity-50",
        variant === "pill"
          ? "rounded-full px-3.5 py-1.5 text-ink-2 hover:text-ink data-[state=active]:bg-brand data-[state=active]:text-brand-ink"
          : "-mb-px border-b-2 border-transparent px-0.5 pb-3 text-ink-2 hover:text-ink data-[state=active]:border-accent data-[state=active]:text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("focus-visible:outline-none", className)}
      {...props}
    />
  );
}

/* ----------------------------------------------------------------- tooltip */
export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}) {
  return (
    <TooltipPrimitive.Root delayDuration={200}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={8}
          className={cn(
            "z-50 max-w-60 rounded-sm bg-ink px-2.5 py-1.5 text-[0.6875rem] leading-snug text-paper shadow-pop",
            "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95",
            className,
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/* ----------------------------------------------------------------- accordion */
export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      className={cn("border-b border-line last:border-b-0", className)}
      {...props}
    />
  );
}

export function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          "group flex flex-1 items-center justify-between gap-4 py-4 text-left text-[0.9375rem] font-medium text-ink transition-colors hover:text-accent-ink dark:hover:text-accent [&[data-state=open]>svg]:rotate-180",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown className="size-4 shrink-0 text-ink-3 transition-transform duration-300" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={cn("pb-4 pr-8 text-sm leading-relaxed text-ink-2", className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}

/* ----------------------------------------------------------------- popover */
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 8,
  ...props
}: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 rounded-md border border-line bg-surface p-4 shadow-pop outline-none",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

/* ----------------------------------------------------------------- pagination */
export function Pagination({
  page,
  pages,
  onChange,
  className,
}: {
  page: number;
  pages: number;
  onChange: (p: number) => void;
  className?: string;
}) {
  const nums = React.useMemo(() => {
    const out: (number | "…")[] = [];
    const push = (v: number | "…") => out.push(v);
    if (pages <= 7) for (let i = 1; i <= pages; i++) push(i);
    else {
      push(1);
      if (page > 3) push("…");
      for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) push(i);
      if (page < pages - 2) push("…");
      push(pages);
    }
    return out;
  }, [page, pages]);

  return (
    <nav className={cn("flex items-center gap-1", className)} aria-label="Pagination">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="grid size-9 place-items-center rounded-sm border border-line text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-40"
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" />
      </button>
      {nums.map((n, i) =>
        n === "…" ? (
          <span key={`e${i}`} className="px-1.5 text-sm text-ink-3">
            …
          </span>
        ) : (
          <button
            key={n}
            onClick={() => onChange(n)}
            aria-current={n === page ? "page" : undefined}
            className={cn(
              "size-9 rounded-sm border text-[0.8125rem] font-medium transition-colors",
              n === page
                ? "border-brand bg-brand text-brand-ink"
                : "border-line text-ink-2 hover:bg-surface-2",
            )}
          >
            {n}
          </button>
        ),
      )}
      <button
        onClick={() => onChange(Math.min(pages, page + 1))}
        disabled={page === pages}
        className="grid size-9 place-items-center rounded-sm border border-line text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-40"
        aria-label="Next page"
      >
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}

/* ----------------------------------------------------------------- status dot */
export function StatusDot({ tone = "neutral" }: { tone?: "neutral" | "success" | "warn" | "danger" | "info" }) {
  const map = {
    neutral: "bg-ink-3",
    success: "bg-positive",
    warn: "bg-amber-500",
    danger: "bg-negative",
    info: "bg-sky-500",
  } as const;
  return (
    <span className="relative inline-flex size-2">
      <span className={cn("size-2 rounded-full", map[tone])} />
      {(tone === "success" || tone === "info") && (
        <span className={cn("absolute inset-0 animate-ping rounded-full opacity-40", map[tone])} />
      )}
    </span>
  );
}

/* ----------------------------------------------------------------- check row */
export function CheckRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <li className={cn("flex items-start gap-2.5 text-sm text-ink-2", className)}>
      <Check className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2.5} />
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

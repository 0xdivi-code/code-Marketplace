import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      variant: {
        neutral: "border-line bg-surface-2 text-ink-2",
        outline: "border-line-strong bg-transparent text-ink-2",
        brand: "border-transparent bg-brand text-brand-ink",
        accent: "border-transparent bg-accent-soft text-accent-ink",
        sage: "border-transparent bg-sage text-ink-2",
        solid: "border-transparent bg-ink text-paper",
        success: "border-transparent bg-positive-soft text-positive",
        warn: "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
        danger: "border-transparent bg-negative-soft text-negative",
        /*
         * Badges sit on top of product artwork, whose brightness is not ours to
         * control — the light pastel covers left white-on-white unreadable.
         * A dark scrim behind light type is the one treatment that stays
         * legible over every image in the library.
         */
        glass: "border-white/25 bg-black/45 text-white backdrop-blur-md",
      },
      size: {
        sm: "h-5 px-2 text-[0.625rem] tracking-wide",
        md: "h-6 px-2.5 text-[0.6875rem]",
        lg: "h-7 px-3 text-xs",
      },
    },
    defaultVariants: { variant: "neutral", size: "md" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { badgeVariants };

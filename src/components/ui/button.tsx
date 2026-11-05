import * as React from "react";
import { Slot } from "./slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background,color,box-shadow,transform] duration-200 disabled:pointer-events-none disabled:opacity-45 active:translate-y-px select-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-brand text-brand-ink shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_8px_20px_-10px_rgba(23,57,43,0.7)] hover:bg-brand/90",
        accent:
          "bg-accent text-white shadow-[0_8px_20px_-10px_rgba(192,89,43,0.8)] hover:brightness-105",
        ink: "bg-ink text-paper hover:opacity-90",
        outline:
          "border border-line-strong bg-transparent text-ink hover:border-ink/40 hover:bg-surface-2",
        soft: "bg-surface-2 text-ink hover:bg-surface-3",
        ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
        link: "text-ink underline-offset-4 hover:underline rounded-none px-0",
        danger: "bg-red-600 text-white hover:bg-red-700",
      },
      size: {
        xs: "h-7 px-2.5 text-xs [&_svg]:size-3.5",
        sm: "h-9 px-3.5 text-[0.8125rem] [&_svg]:size-4",
        md: "h-11 px-5 text-sm [&_svg]:size-4",
        lg: "h-13 px-7 text-[0.9375rem] [&_svg]:size-[1.15rem]",
        icon: "size-10 [&_svg]:size-[1.05rem]",
        "icon-sm": "size-8 [&_svg]:size-4",
        "icon-xs": "size-7 [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };

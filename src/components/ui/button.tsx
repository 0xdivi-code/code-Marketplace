import * as React from "react";
import { Slot } from "./slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background,color,box-shadow,transform] duration-200 disabled:pointer-events-none disabled:opacity-45 active:translate-y-px select-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /*
         * `primary` is the burnt-orange action: add to cart, buy, publish,
         * save. One per screen is the idea — everything structural uses
         * `ink`, which is the black surface of the identity.
         */
        primary:
          "bg-accent text-accent-fg shadow-[0_1px_0_rgba(255,255,255,0.16)_inset,0_8px_20px_-10px_rgba(223,77,32,0.55)] hover:bg-accent-strong",
        /* legacy alias — the old accent variant, kept so call sites still work */
        accent:
          "bg-accent text-accent-fg shadow-[0_1px_0_rgba(255,255,255,0.16)_inset,0_8px_20px_-10px_rgba(223,77,32,0.55)] hover:bg-accent-strong",
        /* the black button — secondary surfaces, nav, admin chrome */
        ink: "bg-ink text-paper shadow-[0_1px_0_rgba(255,255,255,0.10)_inset] hover:opacity-88",
        outline:
          "border border-line-strong bg-transparent text-ink hover:border-ink/40 hover:bg-surface-2",
        soft: "bg-surface-2 text-ink hover:bg-surface-3",
        ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
        link: "text-ink underline-offset-4 hover:underline rounded-none px-0",
        danger: "bg-negative text-white hover:bg-negative/90",
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

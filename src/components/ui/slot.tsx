import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal asChild Slot. Radix ships one per package; this avoids a dependency
 * for the handful of places we need to borrow a child element's props.
 */
export const Slot = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ children, ...props }, ref) => {
    if (!React.isValidElement(children)) return null;
    const child = children as React.ReactElement<Record<string, unknown>>;
    return React.cloneElement(child, {
      ...props,
      ...child.props,
      className: cn(
        (props as { className?: string }).className,
        (child.props as { className?: string }).className,
      ),
      ref,
    } as Record<string, unknown>);
  },
);
Slot.displayName = "Slot";

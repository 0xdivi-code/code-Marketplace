import * as React from "react";
import { cn } from "@/lib/utils";

const sizes = {
  sm: "size-7 text-[0.625rem]",
  md: "size-9 text-[0.6875rem]",
  lg: "size-12 text-sm",
  xl: "size-20 text-lg",
};

const tones = [
  "bg-[#17392b] text-[#eef4e9]",
  "bg-[#c0592b] text-[#fbeee6]",
  "bg-[#2c4a6e] text-[#e9f0f7]",
  "bg-[#56682e] text-[#f0f4e5]",
  "bg-[#7c3517] text-[#fbeade]",
  "bg-[#4a3f6b] text-[#efeaf7]",
];

export function Avatar({
  initials,
  size = "md",
  className,
  tone,
  ring,
}: {
  initials: string;
  size?: keyof typeof sizes;
  className?: string;
  tone?: number;
  ring?: boolean;
}) {
  const idx = React.useMemo(
    () => tone ?? initials.charCodeAt(0) % tones.length,
    [initials, tone],
  );
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-medium tracking-wide select-none",
        sizes[size],
        tones[idx],
        ring && "ring-2 ring-surface",
        className,
      )}
    >
      {initials.slice(0, 2).toUpperCase()}
    </span>
  );
}

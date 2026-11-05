import { cn } from "@/lib/utils";

export function KilnMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="currentColor" opacity="0.1" />
      <path
        d="M16 6.5c3.9 2.2 6.2 5.4 6.2 9.1 0 3.9-2.8 6.9-6.2 6.9s-6.2-3-6.2-6.9c0-3.7 2.3-6.9 6.2-9.1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M16 12.6c1.9 1.5 2.9 3.1 2.9 4.6 0 1.7-1.3 3-2.9 3s-2.9-1.3-2.9-3c0-1.5 1-3.1 2.9-4.6Z" fill="currentColor" opacity="0.85" />
      <path d="M9.6 25.4h12.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function KilnLogo({
  className,
  compact,
  onDark,
}: {
  className?: string;
  compact?: boolean;
  onDark?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5 select-none", className)}>
      <span
        className={cn(
          "grid size-9 place-items-center rounded-[11px]",
          onDark ? "bg-white/10 text-white" : "bg-brand text-brand-ink",
        )}
      >
        <KilnMark className="size-5.5" />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              "font-display text-[1.35rem] tracking-[-0.03em]",
              onDark ? "text-white" : "text-ink",
            )}
          >
            Kiln
          </span>
          <span
            className={cn(
              "label-mono mt-0.5 text-[0.5rem]",
              onDark ? "text-white/60" : "text-ink-3",
            )}
          >
            source code
          </span>
        </span>
      )}
    </span>
  );
}

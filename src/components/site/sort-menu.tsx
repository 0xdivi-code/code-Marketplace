import { ArrowUpDown, Check } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { SORT_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function SortMenu({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const current = SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0];
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3 text-[0.8125rem] text-ink transition-colors hover:border-line-strong">
          <ArrowUpDown className="size-3.5 text-ink-3" />
          {current.label}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-52 rounded-md border border-line bg-surface p-1.5 shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          {SORT_OPTIONS.map((o) => (
            <DropdownMenu.Item
              key={o.value}
              onSelect={() => onChange(o.value)}
              className={cn(
                "flex cursor-pointer items-center justify-between rounded-sm px-2.5 py-2 text-[0.8125rem] outline-none",
                o.value === value
                  ? "bg-surface-2 text-ink"
                  : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              {o.label}
              {o.value === value && <Check className="size-3.5 text-accent" />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

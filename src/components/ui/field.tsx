import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------- label */
export function Label({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "text-[0.8125rem] font-medium text-ink-2 leading-none select-none",
        className,
      )}
      {...props}
    />
  );
}

/* ----------------------------------------------------------------- input */
const fieldBase =
  "w-full rounded-sm border border-line-strong bg-surface text-ink placeholder:text-ink-3/80 transition-[border,box-shadow,background] duration-150 hover:border-ink-3/50 focus:border-accent focus:ring-[3px] focus:ring-accent/15 focus:outline-none disabled:opacity-50 disabled:bg-surface-2";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input ref={ref} type={type} className={cn(fieldBase, "h-11 px-3.5 text-sm", className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, "min-h-28 resize-y px-3.5 py-3 text-sm", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(fieldBase, "h-10 appearance-none pl-3 pr-9 text-[0.8125rem]", className)}
      {...props}
    >
      {children}
    </select>
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className="pointer-events-none absolute right-3 top-1/2 size-3 -translate-y-1/2 text-ink-3"
    >
      <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  </div>
));
NativeSelect.displayName = "NativeSelect";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
  optional,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
  optional?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={htmlFor}>{label}</Label>
          {optional && <span className="text-[0.6875rem] text-ink-3">optional</span>}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------- checkbox */
export function Checkbox({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer size-[18px] shrink-0 rounded-[5px] border border-line-strong bg-surface transition-colors data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=indeterminate]:border-brand data-[state=indeterminate]:bg-brand",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-brand-ink">
        {props.checked === "indeterminate" ? (
          <Minus className="size-3" strokeWidth={3} />
        ) : (
          <Check className="size-3" strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

/* ----------------------------------------------------------------- switch */
export function Switch({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-[22px] w-10 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors data-[state=checked]:bg-brand data-[state=unchecked]:bg-line-strong",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-[18px] translate-x-0.5 rounded-full bg-white shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-[20px]" />
    </SwitchPrimitive.Root>
  );
}

/* ----------------------------------------------------------------- radio */
export const RadioGroup = RadioGroupPrimitive.Root;

export function RadioCard({
  value,
  title,
  description,
  meta,
  checked,
  className,
}: {
  value: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  checked?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "group relative flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-all duration-200",
        checked
          ? "border-brand bg-brand-soft/60 shadow-[0_0_0_1px_var(--brand)]"
          : "border-line bg-surface hover:border-line-strong hover:bg-surface-2/60",
        className,
      )}
    >
      <RadioGroupPrimitive.Item
        value={value}
        className="mt-0.5 size-4 shrink-0 rounded-full border border-line-strong bg-surface transition-colors data-[state=checked]:border-brand data-[state=checked]:bg-brand"
      >
        <RadioGroupPrimitive.Indicator className="flex size-full items-center justify-center">
          <span className="size-1.5 rounded-full bg-white" />
        </RadioGroupPrimitive.Indicator>
      </RadioGroupPrimitive.Item>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-ink">{title}</span>
          {meta}
        </div>
        {description && <p className="mt-1 text-xs leading-relaxed text-ink-2">{description}</p>}
      </div>
    </label>
  );
}

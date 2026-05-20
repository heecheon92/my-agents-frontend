import { cloneElement, isValidElement, useId } from "react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: React.ReactElement<{ id?: string }>;
  hint?: string;
  className?: string;
}) {
  const fallbackId = useId();
  const controlId = children.props.id ?? fallbackId;
  const control = isValidElement(children)
    ? cloneElement(children, { id: controlId })
    : children;

  return (
    <label
      htmlFor={controlId}
      className={cn("grid gap-2 text-sm font-medium text-cal-ink", className)}
    >
      <span>{label}</span>
      {control}
      {hint ? (
        <span className="text-xs font-normal leading-5 text-cal-muted">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export const inputClassName =
  "min-h-11 rounded-md border border-cal-hairline bg-cal-canvas px-3.5 py-2.5 text-base text-cal-ink outline-none transition placeholder:text-cal-muted-soft focus:border-cal-ink focus:ring-2 focus:ring-cal-ink/10 disabled:cursor-not-allowed disabled:bg-cal-surface-strong disabled:text-cal-muted";

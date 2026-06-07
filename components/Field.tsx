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
      className={cn("grid gap-2 text-sm font-semibold text-km-ink", className)}
    >
      <span>{label}</span>
      {control}
      {hint ? (
        <span className="text-xs font-normal leading-5 text-km-muted">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export const inputClassName =
  "min-h-11 rounded-[10px] border border-km-hairline bg-km-surface px-3.5 py-2.5 text-base text-km-ink outline-none transition-[background-color,border-color,box-shadow,color] placeholder:text-km-muted-soft focus:border-km-accent focus:ring-3 focus:ring-km-accent/15 disabled:cursor-not-allowed disabled:bg-km-surface-strong disabled:text-km-muted aria-invalid:border-km-error aria-invalid:ring-3 aria-invalid:ring-km-error/15";

export const selectClassName = cn(
  inputClassName,
  "km-select w-full min-w-0 pr-11",
);

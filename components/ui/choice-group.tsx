"use client";

import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";

export type ChoiceOption<T extends string> = {
  value: T;
  label: string;
  /** One line under the label: what choosing this does. */
  description?: string;
  disabled?: boolean;
  /** A short marker beside the label, such as "recommended". */
  badge?: string;
};

/**
 * A small set of exclusive choices as a native radio group.
 *
 * Native radios for the same reasons as `AssistantModelOptions`, whose styling
 * this shares: arrow keys move between options without a roving-focus widget,
 * and the group works inside dialogs and popovers without fighting their
 * keyboard handling.
 */
export function ChoiceGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  disabled = false,
  busy = false,
  slot,
  className,
  children,
}: {
  legend: string;
  options: ChoiceOption<T>[];
  value: T;
  onChange: (next: T) => void;
  disabled?: boolean;
  /** A save is in flight: clicks are ignored, not dimmed (see the model list). */
  busy?: boolean;
  /** `data-slot`, so tests can scope to one group. */
  slot?: string;
  className?: string;
  /** Guidance under the options, such as a disclosure. */
  children?: ReactNode;
}) {
  const name = useId();
  return (
    <fieldset
      className={cn("grid gap-1", className)}
      disabled={disabled}
      aria-busy={busy || undefined}
      data-slot={slot}
    >
      <legend className="mb-1 text-sm font-medium text-cal-ink">
        {legend}
      </legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="flex min-h-9 cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-cal-body transition-colors hover:bg-cal-surface-soft has-[:checked]:bg-cal-surface-soft has-[:checked]:text-cal-ink has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-km-accent"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={option.disabled}
            onChange={() => {
              if (busy || option.value === value) return;
              onChange(option.value);
            }}
            className="mt-0.5 size-4 shrink-0 accent-cal-primary"
          />
          <span className="grid min-w-0 gap-0.5">
            <span className="flex flex-wrap items-center gap-2">
              <span className="break-words font-medium">{option.label}</span>
              {option.badge ? (
                <span className="shrink-0 rounded-full border border-cal-success/25 bg-cal-success/10 px-2 py-0.5 text-xs font-semibold text-cal-success">
                  {option.badge}
                </span>
              ) : null}
            </span>
            {option.description ? (
              <span className="break-words text-xs leading-5 text-cal-muted">
                {option.description}
              </span>
            ) : null}
          </span>
        </label>
      ))}
      {children}
    </fieldset>
  );
}

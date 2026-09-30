"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { AssistantModelId } from "@/model/my-agents";
import type { ResolvedAssistantModel } from "./assistant-model-selection";

/** Sentinel for the "follow the deployment default" radio; never sent. */
const DEFAULT_VALUE = "__default__";

/**
 * The model choice as a native radio group.
 *
 * Shared by the composer popover and account settings so both offer exactly
 * the same options. Radios rather than a menu: this sits inside a Popover next
 * to the effort slider, and a menu's roving arrow-key focus fights the slider
 * (see DESIGN.md). Arrow keys move between radios natively.
 *
 * "Default" is its own option and saves `null`, which is not the same as
 * picking the model that happens to be the default today: `null` follows the
 * deployment if it later changes its default, an explicit pick does not.
 */
export function AssistantModelOptions({
  resolved,
  legend,
  defaultOptionLabel,
  unlistedSelectionLabel,
  disabled,
  saving,
  onChange,
  className,
}: {
  resolved: ResolvedAssistantModel;
  legend: string;
  /** Receives the default model's display name. */
  defaultOptionLabel: (name: string) => string;
  /** Receives the ID of a saved model the catalog does not list. */
  unlistedSelectionLabel: (name: string) => string;
  disabled: boolean;
  /**
   * A save is in flight. Deliberately not rendered as `disabled`: a local save
   * settles in tens of milliseconds, and dimming the whole list for that long
   * read as a flicker on every choice. Clicks are ignored instead, and
   * `aria-busy` tells assistive technology what is happening.
   */
  saving: boolean;
  onChange: (next: AssistantModelId | null) => void;
  className?: string;
}) {
  const name = useId();
  // The clicked choice, shown checked in the same event. The radios are
  // controlled by server state, so without this they snap back to the old
  // value until the save starts and a click looks ignored. Cleared once a save
  // settles, which also reverts a failed save to what the server holds.
  const [optimistic, setOptimistic] = useState<{
    value: AssistantModelId | null;
  } | null>(null);
  const wasSaving = useRef(false);
  // Set in the click handler itself: `saving` only turns true a render later,
  // and a second click in that gap would send a competing save.
  const claimed = useRef(false);
  useEffect(() => {
    if (wasSaving.current && !saving) {
      setOptimistic(null);
      claimed.current = false;
    }
    wasSaving.current = saving;
  }, [saving]);
  const shown = optimistic ? optimistic.value : resolved.selectedId;
  const current = shown ?? DEFAULT_VALUE;
  const options = [
    ...(resolved.defaultModel
      ? [
          {
            value: DEFAULT_VALUE,
            label: defaultOptionLabel(resolved.defaultModel.name),
          },
        ]
      : []),
    ...resolved.models.map((model) => ({ value: model.id, label: model.name })),
  ];

  return (
    <fieldset
      className={cn("grid gap-1", className)}
      disabled={disabled}
      aria-busy={saving || undefined}
      data-slot="assistant-model-options"
    >
      <legend className="mb-1 text-sm font-medium text-cal-ink">
        {legend}
      </legend>
      {/* A saved model outside the catalog still answers, so say which one —
          but as text, not a radio: it is not a choice this build offers, and
          checking "default" instead would misstate the saved setting. No
          radio is checked in this state; picking one replaces it. Hidden
          while a new choice is in flight so it does not contradict it. */}
      {resolved.unlistedSelection && !optimistic ? (
        <p
          data-slot="assistant-model-unlisted"
          className="mb-1 rounded-lg bg-cal-surface-soft px-2 py-1.5 text-sm text-cal-body"
        >
          {unlistedSelectionLabel(resolved.unlistedSelection.name)}
        </p>
      ) : null}
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-cal-body transition-colors hover:bg-cal-surface-soft has-[:checked]:bg-cal-surface-soft has-[:checked]:font-medium has-[:checked]:text-cal-ink has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-km-accent",
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={current === option.value}
            onChange={() => {
              const next = option.value === DEFAULT_VALUE ? null : option.value;
              if (saving || claimed.current || next === shown) return;
              claimed.current = true;
              setOptimistic({ value: next });
              onChange(next);
            }}
            className="size-4 accent-cal-primary"
          />
          <span className="min-w-0 break-words">{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

"use client";

import { useId } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { ReasoningEffort } from "@/model/my-agents";
import type { ResolvedReasoning } from "./reasoning-selection";
import type { ChatLocalization } from "./types";

/**
 * Pre-send reasoning controls, rendered inside the composer surface.
 *
 * Stops come from `resolved.efforts` — the list the backend served — never from
 * a constant here, so a deployment that offers fewer levels cannot desync the
 * slider from what the API will accept.
 */
export function ReasoningControls({
  resolved,
  localization,
  onModeChange,
  onEffortChange,
  disabled,
}: {
  resolved: ResolvedReasoning;
  localization: ChatLocalization;
  onModeChange: (next: "standard" | "pro") => void;
  onEffortChange: (next: ReasoningEffort) => void;
  disabled: boolean;
}) {
  const effortLabelId = useId();
  const { selection, efforts, locked, proSupported } = resolved;
  if (!selection) return null;

  const index = Math.max(0, efforts.indexOf(selection.effort));
  const isInteractive = !locked && !disabled;
  const effortLabels = localization.reasoningEffortLabels as Record<
    string,
    string
  >;
  const effortHints = localization.reasoningEffortHints as Record<
    string,
    string
  >;

  const lockReason = locked
    ? localization.reasoningLockedGuest
    : !proSupported
      ? localization.reasoningProUnsupported
      : null;

  return (
    <div className="flex flex-col gap-3 border-t border-cal-hairline px-1 pt-3 sm:flex-row sm:items-center sm:gap-5">
      <div className="flex items-center gap-2">
        <Switch
          id={`${effortLabelId}-mode`}
          size="sm"
          checked={selection.mode === "pro"}
          disabled={!isInteractive || !proSupported}
          onCheckedChange={(checked) =>
            onModeChange(checked ? "pro" : "standard")
          }
        />
        <label
          htmlFor={`${effortLabelId}-mode`}
          className="cursor-pointer text-xs font-medium text-cal-body"
        >
          {localization.reasoningProLabel}
        </label>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          id={effortLabelId}
          className="shrink-0 text-xs font-medium text-cal-body"
        >
          {localization.reasoningEffortLabel}
        </span>
        <Slider
          className="max-w-56 min-w-32"
          aria-labelledby={effortLabelId}
          // Announce the level by name. A bare index would read as "4 of 7",
          // which tells a screen-reader user nothing about what it does.
          getAriaValueText={() => effortLabels[selection.effort] ?? ""}
          value={index}
          min={0}
          max={Math.max(0, efforts.length - 1)}
          step={1}
          ticks={efforts.length}
          disabled={!isInteractive}
          onValueChange={(next) => {
            const effort = efforts[Array.isArray(next) ? next[0] : next];
            if (effort) onEffortChange(effort);
          }}
        />
        {/* `key` restarts the fade so the label crossfades on each change
            rather than swapping instantly. */}
        <span
          key={selection.effort}
          className="w-16 shrink-0 animate-in text-xs text-cal-ink fade-in duration-[var(--duration-fast)]"
        >
          {effortLabels[selection.effort] ?? selection.effort}
        </span>
      </div>

      <div className="min-w-0 sm:max-w-72">
        <p className="text-xs leading-5 text-cal-muted">
          {lockReason ?? effortHints[selection.effort] ?? ""}
        </p>
        {/* Stated once, always visible: a lower level is a shorter review, not
            a weaker model. Without this the stop names read as a quality
            scale, which is the wrong mental model and undersells every level
            below the top one. */}
        {!locked ? (
          <p className="mt-1 text-xs leading-5 text-cal-muted/80">
            {localization.reasoningEffortNote}
          </p>
        ) : null}
      </div>
    </div>
  );
}

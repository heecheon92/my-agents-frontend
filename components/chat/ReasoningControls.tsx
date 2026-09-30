"use client";

import { ChevronDownIcon } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { AssistantModelId, ReasoningEffort } from "@/model/my-agents";
import { AssistantModelOptions } from "./AssistantModelOptions";
import type { ResolvedAssistantModel } from "./assistant-model-selection";
import { ReasoningEffortGuideDialog } from "./ReasoningEffortGuideDialog";
import type { ResolvedReasoning } from "./reasoning-selection";
import type { ChatLocalization } from "./types";

/**
 * Pre-send reasoning controls, collapsed to a single trigger in the composer.
 *
 * They used to sit inline and always-on: a switch, a labelled slider, a live
 * hint, and a guide link across the bottom of the input. That is four controls
 * competing with the one control that matters — send — for a setting most
 * messages never change. The trigger states the current level so nothing is
 * hidden, and the controls themselves move one click away.
 *
 * Stops come from `resolved.efforts` — the list the backend served — never from
 * a constant here, so a deployment that offers fewer levels cannot desync the
 * slider from what the API will accept.
 *
 * The model picker shares this popover because model and effort are one
 * decision: switching model refetches the reasoning capabilities, which can
 * change the recommended effort and whether Pro is offered, and the result
 * shows up in the slider right below the choice that caused it.
 */
export function ReasoningControls({
  resolved,
  localization,
  onModeChange,
  onEffortChange,
  disabled,
  model,
}: {
  resolved: ResolvedReasoning;
  localization: ChatLocalization;
  onModeChange: (next: "standard" | "pro") => void;
  onEffortChange: (next: ReasoningEffort) => void;
  disabled: boolean;
  model?: {
    resolved: ResolvedAssistantModel;
    pending: boolean;
    failed: boolean;
    onChange: (next: AssistantModelId | null) => void;
  };
}) {
  const effortLabelId = useId();
  const [open, setOpen] = useState(false);
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
  const currentLabel = effortLabels[selection.effort] ?? selection.effort;
  const modelName =
    model?.resolved.available && model.resolved.effectiveModel
      ? model.resolved.effectiveModel.name
      : null;
  const triggerLabel = modelName
    ? `${localization.assistantModelLabel}: ${modelName}, ${localization.reasoningEffortLabel}: ${currentLabel}`
    : `${localization.reasoningEffortLabel}: ${currentLabel}`;

  const lockReason = locked
    ? localization.reasoningLockedGuest
    : !proSupported
      ? localization.reasoningProUnsupported
      : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            // The trigger carries the state: "추론 강도: 보통". Without the
            // concept in the name it announces as a bare adjective.
            aria-label={triggerLabel}
            title={triggerLabel}
            className="gap-1 px-2 text-cal-muted hover:text-cal-ink"
          >
            {modelName ? (
              <>
                <span
                  data-slot="assistant-model-trigger-name"
                  className="max-w-[9rem] shrink-0 truncate text-cal-ink"
                >
                  {modelName}
                </span>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            {selection.mode === "pro" ? (
              <span className="font-semibold text-cal-ink">
                {localization.reasoningProLabel}
              </span>
            ) : null}
            <span>{currentLabel}</span>
            <ChevronDownIcon aria-hidden="true" />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-72">
        <div className="grid gap-3">
          {model?.resolved.available ? (
            <div className="grid gap-2 border-b border-cal-hairline pb-3">
              <AssistantModelOptions
                resolved={model.resolved}
                legend={localization.assistantModelLabel}
                defaultOptionLabel={(name) =>
                  localization.assistantModelDefaultOption.replace(
                    "{name}",
                    name,
                  )
                }
                unlistedSelectionLabel={(name) =>
                  localization.assistantModelUnlistedSelection.replace(
                    "{name}",
                    name,
                  )
                }
                disabled={model.resolved.locked || disabled}
                saving={model.pending}
                onChange={model.onChange}
              />
              <p
                aria-live="polite"
                className={
                  model.failed && !model.pending
                    ? "text-xs leading-5 text-cal-error"
                    : "text-xs leading-5 text-cal-muted"
                }
              >
                {model.resolved.locked
                  ? localization.assistantModelLockedGuest
                  : model.failed
                    ? localization.assistantModelUpdateError
                    : localization.assistantModelHint}
              </p>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor={`${effortLabelId}-mode`}
              className="cursor-pointer text-sm font-medium text-cal-ink"
            >
              {localization.reasoningProLabel}
            </label>
            <Switch
              id={`${effortLabelId}-mode`}
              size="sm"
              checked={selection.mode === "pro"}
              disabled={!isInteractive || !proSupported}
              onCheckedChange={(checked) =>
                onModeChange(checked ? "pro" : "standard")
              }
            />
          </div>

          <div className="grid gap-2 border-t border-cal-hairline pt-3">
            <div className="flex items-center justify-between gap-3">
              <span
                id={effortLabelId}
                className="text-sm font-medium text-cal-ink"
              >
                {localization.reasoningEffortLabel}
              </span>
              {/* `key` restarts the fade so the label crossfades on each
                  change rather than swapping instantly. */}
              <span
                key={selection.effort}
                className="animate-in text-sm text-cal-body fade-in duration-[var(--duration-fast)]"
              >
                {currentLabel}
              </span>
            </div>
            <Slider
              aria-labelledby={effortLabelId}
              // Announce the level by name. A bare index would read as "4 of
              // 7", which tells a screen-reader user nothing about what it does.
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
          </div>

          {/*
            Fixed height, not auto. The hints differ in length, so an
            auto-sized block re-flowed the panel on every slider step and the
            popover jumped as you dragged. Reserving the space keeps the height
            identical at every stop — the reason this mattered in the composer
            has not gone away, it has just moved in here.
          */}
          <div
            data-slot="reasoning-hint"
            className="flex h-10 items-start justify-between gap-2"
          >
            <p
              key={selection.effort}
              className="min-w-0 animate-in text-xs text-cal-muted leading-5 fade-in duration-[var(--duration-fast)]"
            >
              {lockReason ?? effortHints[selection.effort] ?? ""}
            </p>
            {!locked ? (
              <ReasoningEffortGuideDialog
                localization={localization}
                efforts={efforts}
                current={selection.effort}
              />
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ReasoningEffort } from "@/model/my-agents";
import type { ChatLocalization } from "./types";

/**
 * The full per-level guidance.
 *
 * It lives behind a dialog rather than inline because each level needs two or
 * three sentences to be useful, and that much text under the composer would
 * dominate the input at 390px. Inline keeps a single short line; anyone who
 * wants to choose deliberately opens this.
 */
export function ReasoningEffortGuideDialog({
  localization,
  efforts,
  current,
}: {
  localization: ChatLocalization;
  efforts: ReasoningEffort[];
  current: ReasoningEffort;
}) {
  const labels = localization.reasoningEffortLabels as Record<string, string>;
  const details = localization.reasoningEffortDetails as Record<string, string>;

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className="shrink-0 cursor-pointer rounded-control px-1 text-xs text-cal-muted underline underline-offset-2 hover:text-cal-ink"
      >
        {localization.reasoningEffortGuideAction}
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{localization.reasoningEffortGuideTitle}</DialogTitle>
          {/* The load-bearing sentence: effort is review time, not capability.
              Stated here as well as inline because this is where someone
              comparing levels will actually read it. */}
          <DialogDescription>
            {localization.reasoningEffortGuideDescription}
          </DialogDescription>
        </DialogHeader>
        <dl className="mt-2 flex flex-col gap-4">
          {efforts.map((effort) => (
            <div
              key={effort}
              className="border-cal-hairline border-t pt-3 first:border-t-0 first:pt-0"
            >
              <dt className="flex items-baseline gap-2 font-semibold text-cal-ink text-sm">
                {labels[effort] ?? effort}
                {effort === current ? (
                  <span className="font-normal text-cal-muted text-xs">
                    {localization.reasoningEffortGuideCurrent}
                  </span>
                ) : null}
              </dt>
              <dd className="mt-1 text-cal-body text-sm leading-6">
                {details[effort] ?? ""}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}

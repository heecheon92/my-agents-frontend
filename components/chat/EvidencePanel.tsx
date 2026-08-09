import type { ReactNode } from "react";
import { OnboardingTarget } from "@/components/onboarding/OnboardingTarget";
import type { AgentEvent, AgentRunSummary, Citation } from "@/model/my-agents";
import {
  CitationSourcesDetails,
  EvidenceDetails,
} from "./evidence-panel/sections";

export {
  CurrentAgentTraceStepPanel,
  getAgentTraceStageKeys,
  getCurrentAgentTraceStep,
  sanitizeActivityEventPayload,
} from "./evidence-panel/trace";

import type { ChatLocalization, LiveActivityEvent } from "./types";

export function EvidencePanel({
  localization,
  lang,
  isLatestAssistantMessage,
  isStreaming,
  replayButton,
  runs,
  events,
  citations,
}: {
  localization: ChatLocalization;
  lang: string;
  isLatestAssistantMessage: boolean;
  isStreaming: boolean;
  replayButton?: ReactNode;
  runs: AgentRunSummary[];
  events: Array<AgentEvent | LiveActivityEvent>;
  citations: Citation[];
}) {
  const evidenceCount = runs.length + events.length;
  const citationSummary = localization.citationSummary.replace(
    "{count}",
    String(citations.length),
  );

  return (
    // A `<fieldset>` announces a group of form controls; this is a set of
    // disclosures attached to a message, so `<section>` with a label is the
    // honest semantic and stops screen readers calling it a form group.
    <section
      aria-label={localization.messageFooterLabel}
      data-testid="assistant-message-footer"
      className="mt-3 border-t border-cal-hairline/70 pt-2"
    >
      <div className="flex min-w-0 flex-wrap items-start gap-2">
        {replayButton}
        {isLatestAssistantMessage || isStreaming ? (
          <>
            {citations.length > 0 ? (
              <details className="group/citations min-w-0 rounded-lg border border-cal-hairline bg-km-surface/70 text-cal-ink open:w-full open:bg-km-surface">
                <summary
                  aria-label={`${localization.viewCitationDetails} (${citations.length})`}
                  className="flex min-h-9 cursor-pointer list-none items-center gap-2 px-3 text-xs font-semibold marker:hidden hover:text-cal-primary"
                >
                  <span>{citationSummary}</span>
                </summary>
                <CitationSourcesDetails
                  citations={citations}
                  localization={localization}
                />
              </details>
            ) : null}
            <OnboardingTarget id="chat.response-evidence">
              <details className="group/evidence min-w-0 rounded-lg border border-cal-hairline bg-km-surface/70 text-cal-ink open:w-full open:bg-km-surface">
                <summary
                  aria-label={`${localization.viewResponseEvidence} (${evidenceCount})`}
                  className="flex min-h-9 cursor-pointer list-none items-center gap-2 px-3 text-xs font-semibold marker:hidden hover:text-cal-primary"
                >
                  <span>{localization.responseEvidence}</span>
                  <span className="rounded-full bg-cal-surface-soft px-2 py-0.5 text-[11px] text-cal-muted">
                    {evidenceCount}
                  </span>
                </summary>
                <EvidenceDetails
                  localization={localization}
                  lang={lang}
                  runs={runs}
                  events={events}
                  citationCount={citations.length}
                />
              </details>
            </OnboardingTarget>
          </>
        ) : (
          <p className="self-center text-xs leading-5 text-cal-muted">
            {localization.messageEvidenceUnavailable}
          </p>
        )}
      </div>
    </section>
  );
}

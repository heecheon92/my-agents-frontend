import type { ReactNode } from "react";
import { OnboardingTarget } from "@/components/onboarding/OnboardingTarget";
import type { AgentEvent, AgentRunSummary, Citation } from "@/model/my-agents";
import {
  buildEvidenceSources,
  groupSourcesByDocument,
} from "./evidence-panel/evidence-sources";
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
  copyButton,
  runs,
  events,
  citations,
  consultedSources,
}: {
  localization: ChatLocalization;
  lang: string;
  isLatestAssistantMessage: boolean;
  isStreaming: boolean;
  replayButton?: ReactNode;
  /**
   * Sits beside the replay control. A separate slot rather than a combined
   * `actions` node so this file, not the caller, owns the order the two
   * controls appear in.
   */
  copyButton?: ReactNode;
  runs: AgentRunSummary[];
  events: Array<AgentEvent | LiveActivityEvent>;
  citations: Citation[];
  /**
   * Every user-visible source given to answer composition, a superset of
   * `citations`. `null`/absent means the run predates citation attribution —
   * not that nothing was consulted. See `evidence-sources.ts`.
   */
  consultedSources?: Citation[] | null;
}) {
  const evidenceCount = runs.length + events.length;
  const evidence = buildEvidenceSources({ citations, consultedSources });
  // The panel counts and lists *documents*. A document contributes several
  // chunks routinely, and one row each made a single source look like four.
  const documents = groupSourcesByDocument(evidence.items);
  /*
   * Counted from the rendered rows, not from `citations.length`. In attributed
   * mode the list is the consulted superset, so the old count would have
   * labelled a four-source disclosure "인용 1개" and hidden three of them
   * behind a number that did not describe the contents.
   */
  const sourcesSummary = (
    evidence.mode === "attributed"
      ? localization.consultedSummary
      : localization.citationSummary
  ).replace("{count}", String(documents.length));
  const viewSourcesLabel =
    evidence.mode === "attributed"
      ? localization.viewConsultedDetails
      : localization.viewCitationDetails;

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
        {/* Outside the latest-message branch below: copying an older answer is
            always meaningful, unlike its citations and activity trail, which
            the backend only keeps for the most recent run. */}
        {copyButton}
        {isLatestAssistantMessage || isStreaming ? (
          <>
            {/*
              Gated on the rendered rows, not on `citations.length`. Attribution
              is deliberately conservative, so an answer with zero verified
              sources but several consulted ones is expected and common — the
              old gate would have made the evidence disclosure disappear on
              exactly those answers, which reads as a regression rather than as
              honesty.
            */}
            {documents.length > 0 ? (
              <details className="group/citations min-w-0 rounded-lg border border-cal-hairline bg-km-surface/70 text-cal-ink open:w-full open:bg-km-surface">
                <summary
                  aria-label={`${viewSourcesLabel} (${documents.length})`}
                  className="flex min-h-9 cursor-pointer list-none items-center gap-2 px-3 text-xs font-semibold marker:hidden hover:text-cal-primary"
                >
                  <span>{sourcesSummary}</span>
                </summary>
                <CitationSourcesDetails
                  documents={documents}
                  mode={evidence.mode}
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

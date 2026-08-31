import { HashIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { AgentEvent, Citation, DocumentCoverage } from "@/model/my-agents";
import { CopyTextButton } from "./CopyMessageButton";
import {
  buildEvidenceSources,
  groupSourcesByDocument,
} from "./evidence-panel/evidence-sources";
import { CitationSourcesDetails } from "./evidence-panel/sections";

export {
  AgentProcessPanel,
  getAgentProcessDetails,
  getAgentProcessHeadline,
  getAgentProcessState,
  getAgentTraceStageKeys,
} from "./evidence-panel/trace";

import type { ChatLocalization, LiveActivityEvent } from "./types";

export function EvidencePanel({
  localization,
  isLatestAssistantMessage,
  isStreaming,
  replayButton,
  copyButton,
  runId,
  events,
  citations,
  consultedSources,
  documentCoverage,
}: {
  localization: ChatLocalization;
  isLatestAssistantMessage: boolean;
  isStreaming: boolean;
  replayButton?: ReactNode;
  /**
   * Sits beside the replay control. A separate slot rather than a combined
   * `actions` node so this file, not the caller, owns the order the two
   * controls appear in.
   */
  copyButton?: ReactNode;
  runId?: string | null;
  events: Array<AgentEvent | LiveActivityEvent>;
  citations: Citation[];
  /**
   * Every user-visible source given to answer composition, a superset of
   * `citations`. `null`/absent means the run predates citation attribution —
   * not that nothing was consulted. See `evidence-sources.ts`.
   */
  consultedSources?: Citation[] | null;
  documentCoverage?: DocumentCoverage | null;
}) {
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
  const hasSources = documents.length > 0;
  const disclosureSummary = hasSources
    ? sourcesSummary
    : localization.documentCoverageSummary;
  const disclosureLabel = hasSources
    ? `${viewSourcesLabel} (${documents.length})`
    : localization.viewDocumentCoverage;

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
            {/* The agent process moved to the top of the message; the run
                handle stays here with the other per-message actions. It is
                still gated on events because a message with no recorded
                activity has no run worth quoting. */}
            {events.length > 0 && runId ? (
              <CopyTextButton
                content={runId}
                actionLabel={localization.copyRunIdAction}
                copiedAnnouncement={localization.runIdCopiedAnnouncement}
                copyFailedAnnouncement={
                  localization.runIdCopyFailedAnnouncement
                }
                revealOnFailure={true}
                fallbackLabel={localization.runIdFallbackLabel}
                idleIcon={<HashIcon aria-hidden="true" />}
                className="shrink-0"
              />
            ) : null}
            {/*
              Gated on the rendered rows, not on `citations.length`. Attribution
              is deliberately conservative, so an answer with zero verified
              sources but several consulted ones is expected and common — the
              old gate would have made the evidence disclosure disappear on
              exactly those answers, which reads as a regression rather than as
              honesty.
            */}
            {hasSources || documentCoverage ? (
              <details className="group/citations min-w-0 rounded-lg border border-cal-hairline bg-km-surface/70 text-cal-ink open:w-full open:bg-km-surface">
                <summary
                  aria-label={disclosureLabel}
                  className="flex min-h-9 cursor-pointer list-none items-center gap-2 px-3 text-xs font-semibold marker:hidden hover:text-cal-primary"
                >
                  <span>{disclosureSummary}</span>
                </summary>
                <CitationSourcesDetails
                  documents={documents}
                  mode={evidence.mode}
                  documentCoverage={documentCoverage}
                  localization={localization}
                />
              </details>
            ) : null}
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

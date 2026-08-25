import { EmptyState, Pill } from "@/components/Status";
import type { AgentEvent, AgentRunSummary } from "@/model/my-agents";
import type { ChatLocalization, LiveActivityEvent } from "../types";
import type { EvidenceDocument, EvidenceSourceMode } from "./evidence-sources";
import { AgentTraceSummary, formatActivityEventPayload } from "./trace";

/**
 * One row per document.
 *
 * Deliberately carries no snippet and no identifiers. Passage text duplicated
 * the answer while adding nothing the reader could act on, and `document_id`,
 * `knowledge_base_id` and `chunk_id` are internal handles that meant nothing to
 * a user — they were the bulk of what the old 상세 정보 disclosure contained, so
 * the disclosure went with them. `document_id` survives only as the grouping
 * key in `groupSourcesByDocument`; it never reaches the DOM.
 */
function DocumentSourceRow({
  source,
  localization,
}: {
  source: EvidenceDocument;
  localization: ChatLocalization;
}) {
  const pages =
    source.pages.length > 0
      ? localization.citationPages.replace("{pages}", source.pages.join(", "))
      : null;

  return (
    <article className="rounded-lg border border-km-accent/20 bg-km-accent/10 px-3 py-2 text-sm text-cal-ink">
      <p className="flex flex-wrap items-baseline gap-1.5">
        {source.isSupported ? (
          <span
            data-slot="supported-source-badge"
            className="shrink-0 rounded-full bg-cal-primary/12 px-2 py-0.5 text-[11px] font-semibold text-cal-primary"
          >
            {localization.supportedSourceBadge}
          </span>
        ) : null}
        <span className="min-w-0 break-words font-medium">
          {source.displayName ?? localization.sourceUnavailableLabel}
        </span>
      </p>
      {source.knowledgeBaseName || pages ? (
        <p className="mt-0.5 break-words text-xs text-cal-muted">
          {[source.knowledgeBaseName, pages].filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </article>
  );
}

function RunHistorySection({
  localization,
  lang,
  runs,
}: {
  localization: ChatLocalization;
  lang: string;
  runs: AgentRunSummary[];
}) {
  return (
    <section className="grid min-w-0 gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
        {localization.runHistory}
      </h4>
      {runs.length === 0 ? (
        <EmptyState
          title={localization.noRunsTitle}
          description={localization.noRunsDescription}
        />
      ) : null}
      {runs.map((run) => (
        <article
          key={run.run_id}
          className="rounded-lg border border-cal-hairline bg-cal-canvas p-3 text-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Pill tone={run.status === "completed" ? "green" : "rose"}>
              {localization.runStatuses[
                run.status as keyof typeof localization.runStatuses
              ] ?? run.status}
            </Pill>
            <span className="text-xs text-cal-muted">
              {new Date(run.created_at).toLocaleString(lang)}
            </span>
          </div>
          <p className="mt-2 text-cal-muted">{localization.runEvidenceLabel}</p>
          <details className="mt-2 rounded-md border border-cal-hairline bg-cal-surface-soft p-2 text-xs text-cal-muted">
            <summary className="cursor-pointer font-medium text-cal-ink">
              {localization.advancedDetails}
            </summary>
            <p className="mt-2 break-all font-mono">{run.run_id}</p>
          </details>
        </article>
      ))}
    </section>
  );
}

/**
 * Turns a backend event enum into readable copy.
 *
 * Event rows used to render the raw enum (`retrieval_completed`) directly into
 * a Korean UI. The backend does not publish a closed set — that contract is
 * requested in `docs/backend-requests.md` — so unknown types degrade to a
 * de-snaked, sentence-cased form rather than disappearing or throwing.
 */
export function describeEventType(
  eventType: string,
  localization: ChatLocalization,
) {
  const known = (
    localization.eventTypes as Record<string, string> | undefined
  )?.[eventType];
  if (known) return known;
  const humanized = eventType.replace(/_/g, " ").trim();
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}

function ActivitySection({
  localization,
  events,
  citationCount,
}: {
  localization: ChatLocalization;
  events: Array<AgentEvent | LiveActivityEvent>;
  citationCount: number;
}) {
  return (
    <section className="grid min-w-0 gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
        {localization.activityEvents}
      </h4>
      {events.length === 0 ? (
        <EmptyState
          title={localization.noEventsTitle}
          description={localization.noEventsDescription}
        />
      ) : (
        <AgentTraceSummary
          localization={localization}
          events={events}
          citationCount={citationCount}
        />
      )}
      {events.map((event) => (
        <article
          key={event.id}
          className="rounded-lg border border-cal-hairline bg-cal-canvas p-3 text-sm"
        >
          <p className="break-words font-medium text-cal-ink">
            {event.sequence}.{" "}
            {describeEventType(event.event_type, localization)}
          </p>
          <details className="mt-2 rounded-md border border-cal-hairline bg-cal-surface-soft p-2 text-xs text-cal-muted">
            <summary className="cursor-pointer font-medium text-cal-ink">
              {localization.activityRawPayload}
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded-xl border border-cal-hairline bg-km-surface p-3 font-mono text-xs text-cal-muted">
              {formatActivityEventPayload(
                event.payload,
                localization.activityPayloadHidden,
              )}
            </pre>
          </details>
        </article>
      ))}
    </section>
  );
}

export function CitationSourcesDetails({
  documents,
  mode,
  localization,
}: {
  documents: EvidenceDocument[];
  mode: EvidenceSourceMode;
  localization: ChatLocalization;
}) {
  const isAttributed = mode === "attributed";
  const supportedCount = documents.filter(
    (document) => document.isSupported,
  ).length;
  return (
    <div className="grid max-h-72 gap-2 overflow-auto border-t border-cal-hairline p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
        {isAttributed
          ? localization.consultedSourcesTitle
          : localization.citationSourcesTitle}
      </p>
      {/*
        Lead with the honest statement when nothing was verified. The backend's
        selector is deliberately conservative, so this is an expected outcome
        for a paraphrased answer rather than an error — but a list of sources
        with no explanation would read as "the answer cited these", which is
        the overclaim this whole feature removes.
      */}
      {isAttributed && supportedCount === 0 && documents.length > 0 ? (
        <p
          data-slot="no-supported-source"
          className="text-xs leading-5 text-cal-muted"
        >
          {localization.noSupportedSourceHint}
        </p>
      ) : null}
      {documents.map((document) => (
        <DocumentSourceRow
          key={document.documentId}
          // Never badge in legacy mode: those runs predate attribution, so a
          // badge would claim a check that never ran.
          source={isAttributed ? document : { ...document, isSupported: false }}
          localization={localization}
        />
      ))}
      {isAttributed && supportedCount > 0 ? (
        <p className="text-xs leading-5 text-cal-muted">
          {localization.supportedSourceHint}
        </p>
      ) : null}
    </div>
  );
}

export function EvidenceDetails({
  localization,
  lang,
  runs,
  events,
  citationCount,
}: {
  localization: ChatLocalization;
  lang: string;
  runs: AgentRunSummary[];
  events: Array<AgentEvent | LiveActivityEvent>;
  citationCount: number;
}) {
  return (
    <div className="grid max-h-80 gap-4 overflow-auto border-t border-cal-hairline p-3 lg:grid-cols-2">
      <RunHistorySection localization={localization} lang={lang} runs={runs} />
      <ActivitySection
        localization={localization}
        events={events}
        citationCount={citationCount}
      />
    </div>
  );
}

import type { ReactNode } from "react";
import { EmptyState, Pill } from "@/components/Status";
import type { AgentEvent, AgentRunSummary, Citation } from "@/model/my-agents";
import type { ChatLocalization, LiveActivityEvent } from "./types";

export type AgentTraceStageKey =
  | "planning"
  | "searchingKnowledge"
  | "draftingAnswer"
  | "checkingCitations"
  | "answerReady"
  | "needsEvidence";

const AGENT_TRACE_STAGE_ORDER: AgentTraceStageKey[] = [
  "planning",
  "searchingKnowledge",
  "draftingAnswer",
  "checkingCitations",
  "answerReady",
  "needsEvidence",
];

const INTERNAL_ACTIVITY_PAYLOAD_KEYS = new Set([
  "handled_by",
  "retrieval_route",
  "route",
  "route_label",
]);

export function sanitizeActivityEventPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeActivityEventPayload);
  }
  if (!value || typeof value !== "object") return value;

  const sanitizedEntries = Object.entries(value)
    .filter(([key]) => !INTERNAL_ACTIVITY_PAYLOAD_KEYS.has(key))
    .map(([key, entryValue]) => [
      key,
      sanitizeActivityEventPayload(entryValue),
    ]);

  return Object.fromEntries(sanitizedEntries);
}

function formatActivityEventPayload(value: unknown, fallbackLabel: string) {
  const sanitized = sanitizeActivityEventPayload(value);
  if (
    sanitized &&
    typeof sanitized === "object" &&
    !Array.isArray(sanitized) &&
    Object.keys(sanitized).length === 0
  ) {
    return fallbackLabel;
  }
  return JSON.stringify(sanitized, null, 2);
}

function collectPayloadKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectPayloadKeys);
  }
  if (!value || typeof value !== "object") return [];

  return Object.entries(value).flatMap(([key, child]) => [
    key,
    ...collectPayloadKeys(child),
  ]);
}

function activityEventSearchText(
  event: AgentEvent | LiveActivityEvent,
): string {
  return [event.event_type, ...collectPayloadKeys(event.payload)]
    .join(" ")
    .toLowerCase();
}

function eventMatchesAny(
  event: AgentEvent | LiveActivityEvent,
  patterns: RegExp[],
) {
  const searchText = activityEventSearchText(event);
  return patterns.some((pattern) => pattern.test(searchText));
}

export function getAgentTraceStageKeys({
  events,
  citationCount,
}: {
  events: Array<AgentEvent | LiveActivityEvent>;
  citationCount: number;
}): AgentTraceStageKey[] {
  if (events.length === 0) return [];

  const stageKeys = new Set<AgentTraceStageKey>(["planning"]);
  const hasCompletedEvent = events.some((event) =>
    /(^|_)run_completed$|\bcompleted\b/.test(event.event_type.toLowerCase()),
  );
  const hasUnreadyTerminalEvent = events.some((event) =>
    /(^|_)run_(failed|cancelled)$|\b(failed|cancelled|error)\b/.test(
      event.event_type.toLowerCase(),
    ),
  );

  if (
    citationCount > 0 ||
    events.some((event) =>
      eventMatchesAny(event, [
        /search/,
        /retriev/,
        /knowledge/,
        /context/,
        /source/,
      ]),
    )
  ) {
    stageKeys.add("searchingKnowledge");
  }

  if (
    hasCompletedEvent ||
    events.some((event) => eventMatchesAny(event, [/answer/, /delta/, /draft/]))
  ) {
    stageKeys.add("draftingAnswer");
  }

  if (
    hasCompletedEvent ||
    citationCount > 0 ||
    events.some((event) =>
      eventMatchesAny(event, [/citation/, /evidence/, /verify/, /check/]),
    )
  ) {
    stageKeys.add("checkingCitations");
  }

  if (hasCompletedEvent) {
    stageKeys.add(citationCount > 0 ? "answerReady" : "needsEvidence");
  } else if (hasUnreadyTerminalEvent) {
    stageKeys.add("needsEvidence");
  }

  return AGENT_TRACE_STAGE_ORDER.filter((stageKey) => stageKeys.has(stageKey));
}

function AgentTraceSummary({
  localization,
  events,
  citationCount,
}: {
  localization: ChatLocalization;
  events: Array<AgentEvent | LiveActivityEvent>;
  citationCount: number;
}) {
  const stageKeys = getAgentTraceStageKeys({ events, citationCount });
  if (stageKeys.length === 0) return null;

  return (
    <div className="rounded-lg border border-km-accent/20 bg-km-accent/10 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
        {localization.agentTrace.title}
      </p>
      <ol
        className="mt-2 flex min-w-0 flex-wrap gap-2"
        aria-label={localization.agentTrace.title}
      >
        {stageKeys.map((stageKey, index) => (
          <li
            key={stageKey}
            className="inline-flex min-h-8 min-w-0 items-center gap-1 rounded-full border border-km-accent/20 bg-white px-2.5 py-1 text-xs font-medium text-cal-ink"
          >
            <span className="shrink-0 text-cal-muted">{index + 1}</span>
            <span className="min-w-0 truncate">
              {localization.agentTrace.stages[stageKey]}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function citationTitle(citation: Citation, localization: ChatLocalization) {
  const filename =
    citation.source_filename ?? localization.sourceUnavailableLabel;
  const page = citation.source_page ? ` · p. ${citation.source_page}` : "";
  return `${filename}${page}`;
}

function CitationSourceCard({
  citation,
  localization,
}: {
  citation: Citation;
  localization: ChatLocalization;
}) {
  const hasAdvancedDetails = Boolean(
    citation.document_id || citation.knowledge_base_id || citation.chunk_id,
  );

  return (
    <article className="rounded-lg border border-km-accent/20 bg-km-accent/10 p-3 text-sm text-cal-ink">
      <p className="break-words font-medium">
        {citationTitle(citation, localization)}
      </p>
      <p className="mt-1 break-words text-cal-body">{citation.snippet}</p>
      {hasAdvancedDetails ? (
        <details className="mt-2 rounded-md border border-cal-hairline bg-cal-canvas p-2 text-xs text-cal-muted">
          <summary className="cursor-pointer font-medium text-cal-ink">
            {localization.advancedDetails}
          </summary>
          <dl className="mt-2 grid gap-1 font-mono">
            <div className="grid gap-0.5">
              <dt className="font-sans font-semibold text-cal-ink">
                {localization.documentLabel}
              </dt>
              <dd className="break-all">{citation.document_id}</dd>
            </div>
            {citation.knowledge_base_id ? (
              <div className="grid gap-0.5">
                <dt className="font-sans font-semibold text-cal-ink">
                  {localization.knowledgeBaseLabel}
                </dt>
                <dd className="break-all">{citation.knowledge_base_id}</dd>
              </div>
            ) : null}
            <div className="grid gap-0.5">
              <dt className="font-sans font-semibold text-cal-ink">
                {localization.chunkLabel}
              </dt>
              <dd className="break-all">{citation.chunk_id}</dd>
            </div>
          </dl>
        </details>
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
            {event.sequence}. {event.event_type}
          </p>
          <details className="mt-2 rounded-md border border-cal-hairline bg-cal-surface-soft p-2 text-xs text-cal-muted">
            <summary className="cursor-pointer font-medium text-cal-ink">
              {localization.activityDetails}
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded-xl border border-cal-hairline bg-white p-3 text-xs text-cal-muted">
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
    <fieldset
      aria-label={localization.messageFooterLabel}
      data-testid="assistant-message-footer"
      className="mt-3 border-t border-cal-hairline/70 pt-2"
    >
      <div className="flex min-w-0 flex-wrap items-start gap-2">
        {replayButton}
        {isLatestAssistantMessage || isStreaming ? (
          <>
            {citations.length > 0 ? (
              <details className="group/citations min-w-0 rounded-lg border border-cal-hairline bg-white/70 text-cal-ink open:w-full open:bg-white">
                <summary
                  aria-label={`${localization.viewCitationDetails} (${citations.length})`}
                  className="flex min-h-9 cursor-pointer list-none items-center gap-2 px-3 text-xs font-semibold marker:hidden hover:text-cal-primary"
                >
                  <span>{citationSummary}</span>
                </summary>
                <div className="grid max-h-72 gap-2 overflow-auto border-t border-cal-hairline p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
                    {localization.citationSourcesTitle}
                  </p>
                  {citations.map((citation) => (
                    <CitationSourceCard
                      key={citation.id}
                      citation={citation}
                      localization={localization}
                    />
                  ))}
                </div>
              </details>
            ) : null}
            <details className="group/evidence min-w-0 rounded-lg border border-cal-hairline bg-white/70 text-cal-ink open:w-full open:bg-white">
              <summary
                aria-label={`${localization.viewResponseEvidence} (${evidenceCount})`}
                className="flex min-h-9 cursor-pointer list-none items-center gap-2 px-3 text-xs font-semibold marker:hidden hover:text-cal-primary"
              >
                <span>{localization.responseEvidence}</span>
                <span className="rounded-full bg-cal-surface-soft px-2 py-0.5 text-[11px] text-cal-muted">
                  {evidenceCount}
                </span>
              </summary>
              <div className="grid max-h-80 gap-4 overflow-auto border-t border-cal-hairline p-3 lg:grid-cols-2">
                <RunHistorySection
                  localization={localization}
                  lang={lang}
                  runs={runs}
                />
                <ActivitySection
                  localization={localization}
                  events={events}
                  citationCount={citations.length}
                />
              </div>
            </details>
          </>
        ) : (
          <p className="self-center text-xs leading-5 text-cal-muted">
            {localization.messageEvidenceUnavailable}
          </p>
        )}
      </div>
    </fieldset>
  );
}

import { EmptyState, Pill } from "@/components/Status";
import type { AgentEvent, AgentRunSummary, Citation } from "@/model/my-agents";
import type { ChatLocalization, LiveActivityEvent } from "../types";
import { AgentTraceSummary, formatActivityEventPayload } from "./trace";

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
            <pre className="mt-2 max-h-40 overflow-auto rounded-xl border border-cal-hairline bg-km-surface p-3 text-xs text-cal-muted">
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
  citations,
  localization,
}: {
  citations: Citation[];
  localization: ChatLocalization;
}) {
  return (
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

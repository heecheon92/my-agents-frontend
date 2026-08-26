import type { ChatLocalization } from "../types";
import type { EvidenceDocument, EvidenceSourceMode } from "./evidence-sources";

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

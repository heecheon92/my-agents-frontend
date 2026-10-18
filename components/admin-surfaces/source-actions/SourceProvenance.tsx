import type { Document } from "@/model/my-agents";
import type { Localization } from "@/utils/localization";

type ProvenanceCopy = Pick<
  Localization["admin"]["documents"],
  | "provenanceTitle"
  | "provenanceMode"
  | "provenanceModel"
  | "provenanceProcessedAt"
  | "provenanceSections"
  | "provenanceOriginal"
  | "provenanceOriginalRetained"
  | "provenanceOriginalNotRetained"
  | "provenanceWarnings"
  | "provenanceNone"
  | "provenanceAdvanced"
  | "provenanceVersion"
  | "provenanceInputHash"
  | "provenanceOutputHash"
  | "provenanceWarningLabels"
  | "provenanceWarningUnknown"
  | "ingestionModeLabels"
>;

function warningLabel(code: string, copy: ProvenanceCopy) {
  // Served codes only; an unknown one gets generic copy, never the raw code.
  return (
    (copy.provenanceWarningLabels as Record<string, string>)[code] ??
    copy.provenanceWarningUnknown
  );
}

/**
 * How a document's active content was prepared: display-safe fields only.
 * Hashes and the processor version sit under a disclosure; they matter for
 * auditing a reprocess, not for reading the document.
 */
export function SourceProvenance({
  document: activeDocument,
  copy,
  lang,
}: {
  document: Document;
  copy: ProvenanceCopy;
  lang: string;
}) {
  const provenance = activeDocument.processing_provenance;
  const processedAt = activeDocument.processed_at
    ? new Date(activeDocument.processed_at)
    : null;
  const rows: Array<[string, string]> = [
    [
      copy.provenanceMode,
      copy.ingestionModeLabels[
        provenance?.mode ?? activeDocument.ingestion_mode
      ],
    ],
    ...(provenance?.model
      ? ([[copy.provenanceModel, provenance.model]] as Array<[string, string]>)
      : []),
    ...(processedAt && !Number.isNaN(processedAt.getTime())
      ? ([
          [copy.provenanceProcessedAt, processedAt.toLocaleString(lang)],
        ] as Array<[string, string]>)
      : []),
    // Counts AI cleanup sections (prose and protected spans), so it means
    // nothing for a standard preparation, which reports 0. Not a count of
    // provider requests.
    ...(provenance?.mode === "ai_assisted"
      ? ([[copy.provenanceSections, String(provenance.section_count)]] as Array<
          [string, string]
        >)
      : []),
    [
      copy.provenanceOriginal,
      activeDocument.original_retained
        ? copy.provenanceOriginalRetained
        : copy.provenanceOriginalNotRetained,
    ],
  ];

  return (
    <section className="grid gap-3" data-slot="source-provenance">
      <h3 className="text-sm font-semibold text-cal-ink">
        {copy.provenanceTitle}
      </h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-cal-muted">{label}</dt>
            <dd className="min-w-0 break-words text-cal-body">{value}</dd>
          </div>
        ))}
      </dl>
      {provenance && provenance.warnings.length > 0 ? (
        <div className="grid gap-1">
          <p className="text-xs font-semibold text-cal-ink">
            {copy.provenanceWarnings}
          </p>
          <ul className="grid list-disc gap-1 pl-5 text-xs leading-5 text-cal-muted">
            {provenance.warnings.map((code) => (
              <li key={code}>{warningLabel(code, copy)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {provenance ? (
        <details className="text-xs text-cal-muted">
          <summary className="cursor-pointer font-semibold text-cal-ink">
            {copy.provenanceAdvanced}
          </summary>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt>{copy.provenanceVersion}</dt>
            <dd className="break-all font-mono">{provenance.version}</dd>
            <dt>{copy.provenanceInputHash}</dt>
            <dd className="break-all font-mono">{provenance.input_sha256}</dd>
            <dt>{copy.provenanceOutputHash}</dt>
            <dd className="break-all font-mono">{provenance.output_sha256}</dd>
          </dl>
        </details>
      ) : (
        <p className="text-xs leading-5 text-cal-muted">
          {copy.provenanceNone}
        </p>
      )}
    </section>
  );
}

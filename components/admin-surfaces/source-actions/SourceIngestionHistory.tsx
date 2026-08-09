import { EmptyState, ErrorState, Pill } from "@/components/Status";
import { cn } from "@/lib/utils";
import {
  describeExtractionStage,
  extractionRunTone,
  InlineLoadingIndicator,
  isActiveExtractionRunStatus,
} from "../shared";
import type { SourceActionsLocalization, SourceExtractionRuns } from "./types";

type SourceIngestionHistoryProps = {
  className?: string;
  extractionRuns: SourceExtractionRuns;
  localization: SourceActionsLocalization;
};

export function SourceIngestionHistory({
  className,
  extractionRuns,
  localization,
}: SourceIngestionHistoryProps) {
  if (extractionRuns.isLoading) {
    return <InlineLoadingIndicator label={localization.common.loading} />;
  }

  if (extractionRuns.error) {
    return <ErrorState error={extractionRuns.error} />;
  }

  const runs = extractionRuns.data ?? [];

  if (runs.length === 0) {
    return (
      <EmptyState
        title={localization.documents.noExtractionRunsTitle}
        description={localization.documents.noExtractionRunsDescription}
      />
    );
  }

  return (
    <div className={cn("grid gap-2", className)}>
      {runs.map((run) => (
        <div
          key={run.id}
          className="rounded-xl bg-cal-surface-soft p-3 text-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Pill tone={extractionRunTone(run.status)}>{run.status}</Pill>
            {isActiveExtractionRunStatus(run.status) ? (
              <InlineLoadingIndicator
                label={localization.documents.ingestionLoading}
              />
            ) : null}
          </div>
          <p className="mt-2 break-all font-mono text-xs text-cal-muted">
            ID: {run.id}
          </p>
          <p className="mt-2 text-cal-muted">
            {run.chunk_count} {localization.common.chunks} · {run.entity_count}{" "}
            {localization.common.entities} · {run.relationship_count}{" "}
            {localization.common.relationships}
          </p>
          {run.stage ? (
            <p className="mt-1 text-xs text-cal-muted">
              {localization.documents.stageLabel}:{" "}
              {describeExtractionStage(run.stage, localization)}
            </p>
          ) : null}
          {run.error ? (
            <p className="mt-1 text-xs text-cal-error">{run.error}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

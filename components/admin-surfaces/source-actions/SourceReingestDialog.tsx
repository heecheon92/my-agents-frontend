"use client";

import { EmptyState, ErrorState, Pill } from "@/components/Status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ExtractionRun } from "@/model/my-agents";
import {
  extractionRunTone,
  InlineLoadingIndicator,
  isActiveExtractionRunStatus,
} from "../shared";
import type {
  SourceActionsLocalization,
  SourceDocumentContext,
  SourceIngestMutation,
} from "./types";

type SourceReingestDialogProps = SourceDocumentContext & {
  activeDocumentHasIngestion: boolean;
  extractionRuns: {
    data?: ExtractionRun[];
  };
  ingest: SourceIngestMutation;
  localization: SourceActionsLocalization;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function SourceReingestDialog({
  activeDocument,
  activeDocumentHasIngestion,
  activeDocumentId,
  displayKnowledgeBaseId,
  extractionRuns,
  ingest,
  localization,
  onOpenChange,
  open,
}: SourceReingestDialogProps) {
  async function handleRunIngest() {
    if (
      !activeDocumentId ||
      !displayKnowledgeBaseId ||
      ingest.isPending ||
      activeDocumentHasIngestion
    ) {
      return;
    }
    try {
      await ingest.mutateAsync();
    } catch {
      // React Query stores the API error; render it below.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {localization.documents.prepareRecoveryTitle}
          </DialogTitle>
          <DialogDescription>
            {localization.documents.prepareRecoveryHint}
          </DialogDescription>
        </DialogHeader>

        {activeDocument ? (
          <p className="break-words rounded-xl border border-cal-hairline bg-cal-canvas p-3 text-sm font-medium text-cal-ink">
            {activeDocument.title}
          </p>
        ) : null}

        <div className="grid gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleRunIngest()}
            disabled={
              !activeDocumentId ||
              !displayKnowledgeBaseId ||
              ingest.isPending ||
              activeDocumentHasIngestion
            }
          >
            {activeDocumentHasIngestion || ingest.isPending
              ? localization.documents.ingestionLoading
              : localization.documents.runIngest}
          </Button>
          {ingest.error ? <ErrorState error={ingest.error} /> : null}
        </div>

        <details className="rounded-2xl border border-cal-hairline bg-white p-4">
          <summary className="cursor-pointer font-semibold text-cal-ink">
            {localization.documents.extractionRuns}
          </summary>
          <div className="mt-3 grid gap-2">
            {extractionRuns.data?.length === 0 ? (
              <EmptyState
                title={localization.documents.noExtractionRunsTitle}
                description={localization.documents.noExtractionRunsDescription}
              />
            ) : null}
            {extractionRuns.data?.map((run) => (
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
                  {run.chunk_count} {localization.common.chunks} ·{" "}
                  {run.entity_count} {localization.common.entities} ·{" "}
                  {run.relationship_count} {localization.common.relationships}
                </p>
                {run.stage ? (
                  <p className="mt-1 text-xs text-cal-muted">
                    {localization.documents.stageLabel}: {run.stage}
                  </p>
                ) : null}
                {run.error ? (
                  <p className="mt-1 text-xs text-cal-error">{run.error}</p>
                ) : null}
              </div>
            ))}
          </div>
        </details>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {localization.common.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

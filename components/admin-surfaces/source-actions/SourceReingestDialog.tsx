"use client";

import { ErrorState } from "@/components/Status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SourceIngestionHistory } from "./SourceIngestionHistory";
import type {
  SourceActionsLocalization,
  SourceDocumentContext,
  SourceExtractionRuns,
  SourceIngestMutation,
} from "./types";

type SourceReingestDialogProps = SourceDocumentContext & {
  activeDocumentHasIngestion: boolean;
  extractionRuns: SourceExtractionRuns;
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

        <details className="rounded-2xl border border-cal-hairline bg-km-surface p-4">
          <summary className="cursor-pointer font-semibold text-cal-ink">
            {localization.documents.extractionRuns}
          </summary>
          <SourceIngestionHistory
            className="mt-3"
            extractionRuns={extractionRuns}
            localization={localization}
          />
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

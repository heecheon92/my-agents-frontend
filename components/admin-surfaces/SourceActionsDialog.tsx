"use client";

import { EmptyState, ErrorState, Pill } from "@/components/Status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Document, ExtractionRun } from "@/model/my-agents";
import { SourceDeleteAlertDialog } from "./SourceDeleteAlertDialog";
import {
  documentMeta,
  extractionRunTone,
  InlineLoadingIndicator,
  isActiveExtractionRunStatus,
} from "./shared";

type SourceActionsDialogLocalization = {
  common: {
    cancel: string;
    close: string;
    chunks: string;
    entities: string;
    relationships: string;
    knowledgeBasePrefix: string;
  };
  documents: {
    sourceActionsTitle: string;
    sourceActionsDescription: string;
    advancedDetails: string;
    noSelectedTitle: string;
    noSelectedDescription: string;
    prepareRecoveryTitle: string;
    prepareRecoveryHint: string;
    ingestionLoading: string;
    runIngest: string;
    deleteTitle: string;
    deleteDescription: string;
    deleteButton: string;
    deleteConfirm: string;
    extractionRuns: string;
    noExtractionRunsTitle: string;
    noExtractionRunsDescription: string;
    stageLabel: string;
    pdfSourcePrefix: string;
    pdfSource: string;
    markdownSourcePrefix: string;
    markdownSource: string;
    uploadedTextSourcePrefix: string;
    uploadedTextSource: string;
    spreadsheetSourcePrefix: string;
    spreadsheetSource: string;
    presentationSourcePrefix: string;
    presentationSource: string;
    textSource: string;
    pagesLabel: string;
  };
};

type SourceActionsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localization: SourceActionsDialogLocalization;
  activeDocument?: Document;
  activeDocumentId?: string;
  displayKnowledgeBaseId?: string;
  activeDocumentHasIngestion: boolean;
  ingest: {
    mutate: () => void;
    isPending: boolean;
    error: unknown;
  };
  deleteDocument: {
    isPending: boolean;
    error: unknown;
  };
  extractionRuns: {
    data?: ExtractionRun[];
  };
  onDeleteDocument: () => void;
};

export function SourceActionsDialog({
  open,
  onOpenChange,
  localization,
  activeDocument,
  activeDocumentId,
  displayKnowledgeBaseId,
  activeDocumentHasIngestion,
  ingest,
  deleteDocument,
  extractionRuns,
  onDeleteDocument,
}: SourceActionsDialogProps) {
  const documentTitle = activeDocument?.title ?? activeDocumentId ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{localization.documents.sourceActionsTitle}</DialogTitle>
          <DialogDescription>
            {localization.documents.sourceActionsDescription}
          </DialogDescription>
        </DialogHeader>

        {activeDocument ? (
          <div className="grid gap-3 rounded-xl border border-cal-hairline bg-cal-surface-soft p-3 text-sm">
            <div>
              <p className="break-words font-medium text-cal-ink">
                {activeDocument.title}
              </p>
              <p className="mt-1 break-words text-xs text-cal-muted">
                {documentMeta(activeDocument, localization)}
              </p>
            </div>
            <details className="rounded-lg bg-cal-canvas p-2 text-xs text-cal-muted">
              <summary className="cursor-pointer font-medium text-cal-ink">
                {localization.documents.advancedDetails}
              </summary>
              <p className="mt-2 break-all font-mono">
                ID: {activeDocument.id}
              </p>
            </details>
          </div>
        ) : (
          <EmptyState
            title={localization.documents.noSelectedTitle}
            description={localization.documents.noSelectedDescription}
          />
        )}

        <div className="grid gap-3 rounded-xl border border-cal-hairline bg-cal-canvas p-3">
          <div>
            <h3 className="font-semibold text-cal-ink">
              {localization.documents.prepareRecoveryTitle}
            </h3>
            <p className="mt-1 text-sm leading-6 text-cal-muted">
              {localization.documents.prepareRecoveryHint}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => ingest.mutate()}
            disabled={
              !activeDocumentId ||
              !displayKnowledgeBaseId ||
              ingest.isPending ||
              activeDocumentHasIngestion
            }
          >
            {activeDocumentHasIngestion
              ? localization.documents.ingestionLoading
              : localization.documents.runIngest}
          </Button>
          {ingest.error ? <ErrorState error={ingest.error} /> : null}
        </div>

        <div className="grid gap-3 rounded-xl border border-cal-error/20 bg-cal-error/5 p-3">
          <div>
            <h3 className="font-semibold text-cal-error">
              {localization.documents.deleteTitle}
            </h3>
            <p className="mt-1 text-sm leading-6 text-cal-muted">
              {localization.documents.deleteDescription}
            </p>
          </div>
          <SourceDeleteAlertDialog
            documentTitle={documentTitle}
            error={deleteDocument.error}
            isPending={deleteDocument.isPending}
            localization={localization}
            onConfirm={onDeleteDocument}
          >
            <Button
              type="button"
              variant="destructive"
              disabled={!activeDocumentId || deleteDocument.isPending}
            >
              {localization.documents.deleteButton}
            </Button>
          </SourceDeleteAlertDialog>
          {deleteDocument.error ? (
            <ErrorState error={deleteDocument.error} />
          ) : null}
        </div>

        <details className="border-t border-cal-hairline pt-4">
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
                className="rounded-lg bg-cal-surface-soft p-3 text-sm"
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

        <DialogFooter className="sm:justify-end">
          <DialogClose render={<Button type="button" variant="outline" />}>
            {localization.common.close}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

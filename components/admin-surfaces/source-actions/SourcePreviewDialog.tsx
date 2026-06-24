"use client";

import { AgentMarkdown } from "@/components/AgentMarkdown";
import { EmptyState, ErrorState } from "@/components/Status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useKnowledgeBaseDocumentPreview } from "@/hooks/use-knowledge";
import { documentMeta, InlineLoadingIndicator } from "../shared";
import type { SourceActionsLocalization, SourceDocumentContext } from "./types";

type SourcePreviewDialogProps = SourceDocumentContext & {
  localization: SourceActionsLocalization;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function SourcePreviewDialog({
  activeDocument,
  activeDocumentId,
  displayKnowledgeBaseId,
  localization,
  onOpenChange,
  open,
}: SourcePreviewDialogProps) {
  const preview = useKnowledgeBaseDocumentPreview(
    displayKnowledgeBaseId,
    activeDocumentId,
    open && Boolean(activeDocument),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{localization.documents.sourcePreviewTitle}</DialogTitle>
          <DialogDescription>
            {localization.documents.sourcePreviewDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {activeDocument ? (
            <section className="grid gap-3 rounded-2xl border border-cal-hairline bg-white p-4 text-sm">
              <div>
                <p className="break-words text-base font-semibold text-cal-ink">
                  {activeDocument.title}
                </p>
                <p className="mt-1 break-words text-sm leading-6 text-cal-muted">
                  {documentMeta(activeDocument, localization)}
                </p>
              </div>
              <details className="rounded-xl bg-cal-canvas p-3 text-xs text-cal-muted">
                <summary className="cursor-pointer font-medium text-cal-ink">
                  {localization.documents.advancedDetails}
                </summary>
                <p className="mt-2 break-all font-mono">
                  ID: {activeDocument.id}
                </p>
              </details>
            </section>
          ) : (
            <EmptyState
              title={localization.documents.noSelectedTitle}
              description={localization.documents.noSelectedDescription}
            />
          )}

          {preview.isLoading ? (
            <InlineLoadingIndicator label={localization.common.loading} />
          ) : preview.error ? (
            <div className="grid gap-2">
              <p className="text-sm font-semibold text-cal-error">
                {localization.documents.sourcePreviewErrorTitle}
              </p>
              <ErrorState error={preview.error} />
            </div>
          ) : preview.data?.content?.trim() ? (
            <div className="max-h-[52dvh] overflow-y-auto rounded-xl border border-cal-hairline bg-cal-canvas p-4 text-sm leading-6 text-cal-body">
              <AgentMarkdown content={preview.data.content} />
            </div>
          ) : (
            <EmptyState
              title={localization.documents.sourcePreviewEmptyTitle}
              description={localization.documents.sourcePreviewEmptyDescription}
            />
          )}
        </div>

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

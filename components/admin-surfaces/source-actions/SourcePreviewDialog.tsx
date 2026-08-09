"use client";

import { useEffect, useId, useState } from "react";
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
import { cn } from "@/lib/utils";
import { documentMeta, InlineLoadingIndicator } from "../shared";
import { SourceIngestionHistory } from "./SourceIngestionHistory";
import type {
  SourceActionsLocalization,
  SourceDocumentContext,
  SourceExtractionRuns,
} from "./types";

type SourcePreviewTab = "preview" | "advanced";

type SourcePreviewDialogProps = SourceDocumentContext & {
  extractionRuns: SourceExtractionRuns;
  localization: SourceActionsLocalization;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function SourcePreviewDialog({
  activeDocument,
  activeDocumentId,
  displayKnowledgeBaseId,
  extractionRuns,
  localization,
  onOpenChange,
  open,
}: SourcePreviewDialogProps) {
  const [activeTab, setActiveTab] = useState<SourcePreviewTab>("preview");
  const tabRootId = useId();
  const preview = useKnowledgeBaseDocumentPreview(
    displayKnowledgeBaseId,
    activeDocumentId,
    open && Boolean(activeDocument),
  );

  useEffect(() => {
    if (open) setActiveTab("preview");
  }, [open]);

  const previewTabId = `${tabRootId}-preview-tab`;
  const advancedTabId = `${tabRootId}-advanced-tab`;
  const previewPanelId = `${tabRootId}-preview-panel`;
  const advancedPanelId = `${tabRootId}-advanced-panel`;

  function renderTabButton(tab: SourcePreviewTab, label: string) {
    const selected = activeTab === tab;
    return (
      <button
        type="button"
        role="tab"
        id={tab === "preview" ? previewTabId : advancedTabId}
        aria-controls={tab === "preview" ? previewPanelId : advancedPanelId}
        aria-selected={selected}
        className={cn(
          "min-h-9 flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-cal-primary/20",
          selected
            ? "bg-km-surface text-cal-ink shadow-control"
            : "text-cal-muted hover:bg-km-surface/70 hover:text-cal-ink",
        )}
        onClick={() => setActiveTab(tab)}
      >
        {label}
      </button>
    );
  }

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
            <section className="grid gap-3 rounded-2xl border border-cal-hairline bg-km-surface p-4 text-sm">
              <div>
                <p className="break-words text-base font-semibold text-cal-ink">
                  {activeDocument.title}
                </p>
                <p className="mt-1 break-words text-sm leading-6 text-cal-muted">
                  {documentMeta(activeDocument, localization)}
                </p>
              </div>
            </section>
          ) : (
            <EmptyState
              title={localization.documents.noSelectedTitle}
              description={localization.documents.noSelectedDescription}
            />
          )}

          <div className="grid gap-3">
            <div
              role="tablist"
              aria-label={localization.documents.sourcePreviewTitle}
              className="flex rounded-xl border border-cal-hairline bg-cal-canvas p-1"
            >
              {renderTabButton(
                "preview",
                localization.documents.sourcePreviewTab,
              )}
              {renderTabButton(
                "advanced",
                localization.documents.sourceAdvancedTab,
              )}
            </div>

            <div
              id={previewPanelId}
              role="tabpanel"
              aria-labelledby={previewTabId}
              hidden={activeTab !== "preview"}
            >
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
                  description={
                    localization.documents.sourcePreviewEmptyDescription
                  }
                />
              )}
            </div>

            <div
              id={advancedPanelId}
              role="tabpanel"
              aria-labelledby={advancedTabId}
              hidden={activeTab !== "advanced"}
              className="rounded-xl border border-cal-hairline bg-km-surface p-4"
            >
              <h3 className="text-sm font-semibold text-cal-ink">
                {localization.documents.extractionRuns}
              </h3>
              <SourceIngestionHistory
                className="mt-3"
                extractionRuns={extractionRuns}
                localization={localization}
              />
            </div>
          </div>
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

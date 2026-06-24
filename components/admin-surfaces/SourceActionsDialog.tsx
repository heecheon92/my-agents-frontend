"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AgentMarkdown } from "@/components/AgentMarkdown";
import { Field, selectClassName } from "@/components/Field";
import { EmptyState, ErrorState, Pill } from "@/components/Status";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCreatePublishRequest } from "@/hooks/use-groups";
import { useKnowledgeBaseDocumentPreview } from "@/hooks/use-knowledge";
import type {
  Document,
  ExtractionRun,
  Group,
  KnowledgeBase,
} from "@/model/my-agents";
import { SourceDeleteAlertDialog } from "./SourceDeleteAlertDialog";
import {
  documentMeta,
  extractionRunTone,
  InlineLoadingIndicator,
  isActiveExtractionRunStatus,
} from "./shared";
import { groupSourceSpacesForShareTarget } from "./sources/source-space-actions";

type SourceActionsDialogLocalization = {
  common: {
    cancel: string;
    chunks: string;
    close: string;
    entities: string;
    knowledgeBasePrefix: string;
    loading: string;
    relationships: string;
  };
  documents: {
    sourceActionsTitle: string;
    sourceActionsDescription: string;
    sourcePreviewTitle: string;
    sourcePreviewDescription: string;
    sourcePreviewEmptyTitle: string;
    sourcePreviewEmptyDescription: string;
    sourcePreviewErrorTitle: string;
    shareSourceTitle: string;
    shareSourceDescription: string;
    shareSourceAction: string;
    shareSourcePending: string;
    shareSourceSuccess: string;
    shareSourceFailed: string;
    shareTargetGroupLabel: string;
    shareTargetSourceSpaceLabel: string;
    shareNoGroupsDescription: string;
    shareNoTargetSourceSpacesDescription: string;
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
    wordSourcePrefix: string;
    wordSource: string;
    textSource: string;
    pagesLabel: string;
  };
  groups: { roles: Record<string, string> };
};

type SourceActionsDialogProps = {
  allKnowledgeBases: KnowledgeBase[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localization: SourceActionsDialogLocalization;
  activeDocument?: Document;
  activeDocumentId?: string;
  displayKnowledgeBaseId?: string;
  activeDocumentHasIngestion: boolean;
  canShareDocument: boolean;
  teamGroups: Group[];
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
  allKnowledgeBases,
  open,
  onOpenChange,
  localization,
  activeDocument,
  activeDocumentId,
  displayKnowledgeBaseId,
  activeDocumentHasIngestion,
  canShareDocument,
  teamGroups,
  ingest,
  deleteDocument,
  extractionRuns,
  onDeleteDocument,
}: SourceActionsDialogProps) {
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedTargetKnowledgeBaseId, setSelectedTargetKnowledgeBaseId] =
    useState("");
  const preview = useKnowledgeBaseDocumentPreview(
    displayKnowledgeBaseId,
    activeDocumentId,
    open && Boolean(activeDocument),
  );
  const createPublishRequest = useCreatePublishRequest(selectedGroupId);
  const documentTitle = activeDocument?.title ?? activeDocumentId ?? "";
  const shareTargetSourceSpaces = useMemo(
    () =>
      groupSourceSpacesForShareTarget({
        groupId: selectedGroupId,
        knowledgeBases: allKnowledgeBases,
      }),
    [allKnowledgeBases, selectedGroupId],
  );

  useEffect(() => {
    if (!open) return;
    setSelectedGroupId(teamGroups[0]?.id ?? "");
  }, [open, teamGroups]);

  useEffect(() => {
    setSelectedTargetKnowledgeBaseId(shareTargetSourceSpaces[0]?.id ?? "");
  }, [shareTargetSourceSpaces]);

  async function handleShareDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !activeDocumentId ||
      !selectedGroupId ||
      !selectedTargetKnowledgeBaseId ||
      createPublishRequest.isPending
    ) {
      return;
    }
    try {
      await createPublishRequest.mutateAsync({
        source_document_id: activeDocumentId,
        target_knowledge_base_id: selectedTargetKnowledgeBaseId,
      });
      toast.success(localization.documents.shareSourceSuccess);
    } catch {
      toast.error(localization.documents.shareSourceFailed);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) createPublishRequest.reset();
        onOpenChange(nextOpen);
      }}
    >
      <SheetContent
        side="right"
        className="w-full max-w-full gap-0 border-l border-cal-hairline bg-white p-0 sm:max-w-2xl lg:max-w-3xl"
      >
        <SheetHeader className="border-b border-cal-hairline p-4 pr-14 text-left sm:p-5 sm:pr-14">
          <SheetTitle>{localization.documents.sourceActionsTitle}</SheetTitle>
          <SheetDescription>
            {localization.documents.sourceActionsDescription}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-cal-canvas/40 p-4 sm:p-5">
          <div className="grid gap-4">
            {activeDocument ? (
              <section className="grid gap-3 rounded-2xl border border-cal-hairline bg-white p-4 text-sm shadow-[0_10px_30px_rgb(20_22_23/0.06)]">
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

            <section className="grid gap-3 rounded-2xl border border-cal-hairline bg-white p-4 shadow-[0_10px_30px_rgb(20_22_23/0.06)]">
              <div>
                <h3 className="font-semibold text-cal-ink">
                  {localization.documents.sourcePreviewTitle}
                </h3>
                <p className="mt-1 text-sm leading-6 text-cal-muted">
                  {localization.documents.sourcePreviewDescription}
                </p>
              </div>
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
                <div className="max-h-[45dvh] overflow-y-auto rounded-xl border border-cal-hairline bg-cal-canvas p-4 text-sm leading-6 text-cal-body">
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
            </section>

            {canShareDocument ? (
              <form
                onSubmit={handleShareDocument}
                className="grid gap-3 rounded-2xl border border-cal-hairline bg-white p-4 shadow-[0_10px_30px_rgb(20_22_23/0.06)]"
              >
                <div>
                  <h3 className="font-semibold text-cal-ink">
                    {localization.documents.shareSourceTitle}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-cal-muted">
                    {localization.documents.shareSourceDescription}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={localization.documents.shareTargetGroupLabel}>
                    <select
                      className={selectClassName}
                      value={selectedGroupId}
                      onChange={(event) =>
                        setSelectedGroupId(event.currentTarget.value)
                      }
                      required
                    >
                      {teamGroups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name} · {localization.groups.roles[group.role]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label={localization.documents.shareTargetSourceSpaceLabel}
                  >
                    <select
                      className={selectClassName}
                      value={selectedTargetKnowledgeBaseId}
                      onChange={(event) =>
                        setSelectedTargetKnowledgeBaseId(
                          event.currentTarget.value,
                        )
                      }
                      required
                    >
                      {shareTargetSourceSpaces.map((knowledgeBase) => (
                        <option key={knowledgeBase.id} value={knowledgeBase.id}>
                          {knowledgeBase.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                {teamGroups.length === 0 ? (
                  <p className="rounded-xl border border-cal-hairline bg-cal-canvas p-3 text-sm leading-6 text-cal-muted">
                    {localization.documents.shareNoGroupsDescription}
                  </p>
                ) : shareTargetSourceSpaces.length === 0 ? (
                  <p className="rounded-xl border border-cal-hairline bg-cal-canvas p-3 text-sm leading-6 text-cal-muted">
                    {
                      localization.documents
                        .shareNoTargetSourceSpacesDescription
                    }
                  </p>
                ) : null}
                {createPublishRequest.error ? (
                  <ErrorState error={createPublishRequest.error} />
                ) : null}
                <Button
                  type="submit"
                  className="w-full sm:w-fit"
                  disabled={
                    !activeDocumentId ||
                    !selectedGroupId ||
                    !selectedTargetKnowledgeBaseId ||
                    createPublishRequest.isPending
                  }
                >
                  {createPublishRequest.isPending
                    ? localization.documents.shareSourcePending
                    : localization.documents.shareSourceAction}
                </Button>
              </form>
            ) : null}

            <section className="grid gap-3 rounded-2xl border border-cal-hairline bg-white p-4 shadow-[0_10px_30px_rgb(20_22_23/0.06)]">
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
            </section>

            <section className="grid gap-3 rounded-2xl border border-cal-error/20 bg-white p-4 shadow-[0_10px_30px_rgb(20_22_23/0.06)]">
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
            </section>

            <details className="rounded-2xl border border-cal-hairline bg-white p-4 shadow-[0_10px_30px_rgb(20_22_23/0.06)]">
              <summary className="cursor-pointer font-semibold text-cal-ink">
                {localization.documents.extractionRuns}
              </summary>
              <div className="mt-3 grid gap-2">
                {extractionRuns.data?.length === 0 ? (
                  <EmptyState
                    title={localization.documents.noExtractionRunsTitle}
                    description={
                      localization.documents.noExtractionRunsDescription
                    }
                  />
                ) : null}
                {extractionRuns.data?.map((run) => (
                  <div
                    key={run.id}
                    className="rounded-xl bg-cal-surface-soft p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Pill tone={extractionRunTone(run.status)}>
                        {run.status}
                      </Pill>
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
                      {run.relationship_count}{" "}
                      {localization.common.relationships}
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
          </div>
        </div>

        <SheetFooter className="border-t border-cal-hairline bg-white p-4">
          <SheetClose render={<Button type="button" variant="outline" />}>
            {localization.common.close}
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

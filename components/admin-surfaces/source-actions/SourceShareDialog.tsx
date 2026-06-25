"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Field, selectClassName } from "@/components/Field";
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
import { useCreatePublishRequest } from "@/hooks/use-groups";
import type { Group, KnowledgeBase } from "@/model/my-agents";
import { groupSourceSpacesForShareTarget } from "../sources/source-space-actions";
import type { SourceActionsLocalization, SourceDocumentContext } from "./types";

type SourceShareDialogProps = SourceDocumentContext & {
  allKnowledgeBases: KnowledgeBase[];
  canShareDocument: boolean;
  localization: SourceActionsLocalization;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  teamGroups: Group[];
};

export function SourceShareDialog({
  activeDocument,
  activeDocumentId,
  allKnowledgeBases,
  canShareDocument,
  localization,
  onOpenChange,
  open,
  teamGroups,
}: SourceShareDialogProps) {
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedTargetKnowledgeBaseId, setSelectedTargetKnowledgeBaseId] =
    useState("");
  const createPublishRequest = useCreatePublishRequest(selectedGroupId);
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
    createPublishRequest.reset();
  }, [createPublishRequest.reset, open, teamGroups]);

  useEffect(() => {
    setSelectedTargetKnowledgeBaseId(shareTargetSourceSpaces[0]?.id ?? "");
  }, [shareTargetSourceSpaces]);

  async function handleShareDocument(event: FormEvent<HTMLFormElement>) {
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
      onOpenChange(false);
    } catch {
      toast.error(localization.documents.shareSourceFailed);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) createPublishRequest.reset();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{localization.documents.shareSourceTitle}</DialogTitle>
          <DialogDescription>
            {localization.documents.shareSourceDescription}
          </DialogDescription>
        </DialogHeader>

        {activeDocument ? (
          <p className="break-words rounded-xl border border-cal-hairline bg-cal-canvas p-3 text-sm font-medium text-cal-ink">
            {activeDocument.title}
          </p>
        ) : null}

        {canShareDocument ? (
          <form onSubmit={handleShareDocument} className="grid gap-4">
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
              <Field label={localization.documents.shareTargetSourceSpaceLabel}>
                <select
                  className={selectClassName}
                  value={selectedTargetKnowledgeBaseId}
                  onChange={(event) =>
                    setSelectedTargetKnowledgeBaseId(event.currentTarget.value)
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
                {localization.documents.shareNoTargetSourceSpacesDescription}
              </p>
            ) : null}
            {createPublishRequest.error ? (
              <ErrorState error={createPublishRequest.error} />
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createPublishRequest.isPending}
              >
                {localization.common.cancel}
              </Button>
              <Button
                type="submit"
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
            </DialogFooter>
          </form>
        ) : (
          <EmptyState
            title={localization.documents.noSelectedTitle}
            description={localization.documents.noSelectedDescription}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

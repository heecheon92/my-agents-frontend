"use client";

import type { FormEvent } from "react";
import { Field, inputClassName, selectClassName } from "@/components/Field";
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
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { KnowledgeBase, KnowledgePublishRequest } from "@/model/my-agents";
import {
  PublishReviewSummary,
  PublishSourceViewer,
} from "../PublishReviewPanel";
import type { PublishSourceKind } from "../shared";
import type { MutationState, PublishSourceState } from "./dialogTypes";
import type { GroupsLocalization } from "./types";

type GroupsPublishDialogsProps = {
  activeGroupId?: string;
  activeGroupKnowledgeBases: KnowledgeBase[];
  approvePublishRequest: MutationState;
  createPublishRequest: MutationState;
  handleCreatePublishRequest: (event: FormEvent<HTMLFormElement>) => void;
  isPublishDialogOpen: boolean;
  localization: GroupsLocalization;
  publishablePersonalKnowledgeBases: KnowledgeBase[];
  publishReviewRequest?: KnowledgePublishRequest;
  publishReviewSource: PublishSourceState;
  publishRequestSourceLabel: (request: KnowledgePublishRequest) => string;
  publishRequestTargetLabel: (request: KnowledgePublishRequest) => string;
  publishSourceKind: PublishSourceKind;
  rejectPublishRequest: MutationState;
  setIsPublishDialogOpen: (open: boolean) => void;
  setPublishReviewRequest: (
    request: KnowledgePublishRequest | undefined,
  ) => void;
  setPublishSourceKind: (kind: PublishSourceKind) => void;
  setSourceDocumentId: (documentId: string) => void;
  setSourceKnowledgeBaseId: (knowledgeBaseId: string) => void;
  setTargetKnowledgeBaseId: (knowledgeBaseId: string) => void;
  sourceDocumentId: string;
  sourceKnowledgeBaseId: string;
  targetKnowledgeBaseId: string;
  onApprovePublishRequest: (requestId: string) => void;
  onRejectPublishRequest: (requestId: string) => void;
};

export function GroupsPublishDialogs({
  activeGroupId,
  activeGroupKnowledgeBases,
  approvePublishRequest,
  createPublishRequest,
  handleCreatePublishRequest,
  isPublishDialogOpen,
  localization,
  publishablePersonalKnowledgeBases,
  publishReviewRequest,
  publishReviewSource,
  publishRequestSourceLabel,
  publishRequestTargetLabel,
  publishSourceKind,
  rejectPublishRequest,
  setIsPublishDialogOpen,
  setPublishReviewRequest,
  setPublishSourceKind,
  setSourceDocumentId,
  setSourceKnowledgeBaseId,
  setTargetKnowledgeBaseId,
  sourceDocumentId,
  sourceKnowledgeBaseId,
  targetKnowledgeBaseId,
  onApprovePublishRequest,
  onRejectPublishRequest,
}: GroupsPublishDialogsProps) {
  return (
    <>
      <Dialog open={isPublishDialogOpen} onOpenChange={setIsPublishDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{localization.groups.requestShareAction}</DialogTitle>
            <DialogDescription>
              {localization.groups.publishBoundaryDescription}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreatePublishRequest} className="grid gap-3">
            <Field label={localization.groups.publishSourceKindLabel}>
              <select
                className={selectClassName}
                value={publishSourceKind}
                onChange={(event) => {
                  const nextKind = event.target.value as PublishSourceKind;
                  setPublishSourceKind(nextKind);
                  setSourceDocumentId("");
                  setSourceKnowledgeBaseId("");
                  setTargetKnowledgeBaseId("");
                }}
              >
                <option value="knowledge-base">
                  {localization.groups.publishSourceKnowledgeBaseOption}
                </option>
                <option value="document">
                  {localization.groups.publishSourceDocumentOption}
                </option>
              </select>
            </Field>
            {publishSourceKind === "knowledge-base" ? (
              <Field
                label={localization.groups.publishSourceKnowledgeBaseLabel}
                hint={localization.groups.publishSourceKnowledgeBaseHint}
              >
                <select
                  className={selectClassName}
                  value={sourceKnowledgeBaseId}
                  onChange={(event) =>
                    setSourceKnowledgeBaseId(event.target.value)
                  }
                >
                  <option value="">
                    {localization.groups.publishSourceKnowledgeBasePlaceholder}
                  </option>
                  {publishablePersonalKnowledgeBases.map((knowledgeBase) => (
                    <option key={knowledgeBase.id} value={knowledgeBase.id}>
                      {knowledgeBase.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <>
                <Field
                  label={localization.groups.publishSourceDocumentLabel}
                  hint={localization.groups.publishSourceDocumentHint}
                >
                  <input
                    className={inputClassName}
                    value={sourceDocumentId}
                    onChange={(event) =>
                      setSourceDocumentId(event.target.value)
                    }
                  />
                </Field>
                <Field
                  label={localization.groups.publishTargetKnowledgeBaseLabel}
                  hint={localization.groups.publishTargetKnowledgeBaseHint}
                >
                  <select
                    className={selectClassName}
                    value={targetKnowledgeBaseId}
                    onChange={(event) =>
                      setTargetKnowledgeBaseId(event.target.value)
                    }
                  >
                    <option value="">
                      {localization.groups.publishTargetPlaceholder}
                    </option>
                    {activeGroupKnowledgeBases.map((knowledgeBase) => (
                      <option key={knowledgeBase.id} value={knowledgeBase.id}>
                        {knowledgeBase.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            {createPublishRequest.error ? (
              <ErrorState error={createPublishRequest.error} />
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPublishDialogOpen(false)}
              >
                {localization.common.cancel}
              </Button>
              <Button
                type="submit"
                disabled={
                  !activeGroupId ||
                  (publishSourceKind === "knowledge-base"
                    ? !sourceKnowledgeBaseId
                    : !sourceDocumentId.trim() || !targetKnowledgeBaseId) ||
                  createPublishRequest.isPending
                }
              >
                {localization.groups.publishRequestButton}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Drawer
        direction="bottom"
        open={Boolean(publishReviewRequest)}
        onOpenChange={(open) => {
          if (!open) setPublishReviewRequest(undefined);
        }}
      >
        <DrawerContent className="max-h-[92dvh] bg-white">
          <DrawerHeader className="items-stretch border-b border-cal-hairline text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 text-left lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <DrawerTitle>
                  {localization.groups.reviewRequestAction}
                </DrawerTitle>
                <DrawerDescription>
                  {localization.groups.publishReviewHint}
                </DrawerDescription>
              </div>
              {publishReviewRequest ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={rejectPublishRequest.isPending}
                    onClick={() =>
                      onRejectPublishRequest(publishReviewRequest.id)
                    }
                  >
                    {localization.groups.publishRejectButton}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={approvePublishRequest.isPending}
                    onClick={() =>
                      onApprovePublishRequest(publishReviewRequest.id)
                    }
                  >
                    {localization.groups.publishApproveButton}
                  </Button>
                </div>
              ) : null}
            </div>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mx-auto grid max-w-5xl gap-3">
              <PublishReviewSummary
                request={publishReviewRequest}
                localization={localization}
                publishRequestSourceLabel={publishRequestSourceLabel}
                publishRequestTargetLabel={publishRequestTargetLabel}
              />
              <PublishSourceViewer
                source={publishReviewSource}
                localization={localization}
              />
              <details className="rounded-lg border border-cal-hairline bg-cal-surface-soft p-3 text-xs text-cal-muted">
                <summary className="cursor-pointer font-medium text-cal-ink">
                  {localization.groups.advancedGroupDetails}
                </summary>
                <p className="mt-2 break-all font-mono">
                  {publishReviewRequest?.id}
                </p>
              </details>
              {approvePublishRequest.error || rejectPublishRequest.error ? (
                <ErrorState
                  error={
                    approvePublishRequest.error ?? rejectPublishRequest.error
                  }
                />
              ) : null}
            </div>
          </div>
          <DrawerFooter className="border-t border-cal-hairline bg-white lg:hidden">
            <div className="grid grid-cols-3 gap-2">
              <DrawerClose asChild>
                <Button type="button" variant="outline">
                  {localization.common.cancel}
                </Button>
              </DrawerClose>
              {publishReviewRequest ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={rejectPublishRequest.isPending}
                    onClick={() =>
                      onRejectPublishRequest(publishReviewRequest.id)
                    }
                  >
                    {localization.groups.publishRejectNowButton}
                  </Button>
                  <Button
                    type="button"
                    disabled={approvePublishRequest.isPending}
                    onClick={() =>
                      onApprovePublishRequest(publishReviewRequest.id)
                    }
                  >
                    {localization.groups.publishApproveButton}
                  </Button>
                </>
              ) : null}
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}

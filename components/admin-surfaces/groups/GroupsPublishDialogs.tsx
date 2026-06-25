"use client";

import { ErrorState } from "@/components/Status";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { KnowledgePublishRequest } from "@/model/my-agents";
import {
  PublishReviewSummary,
  PublishSourceViewer,
} from "../PublishReviewPanel";
import type { MutationState, PublishSourceState } from "./dialogTypes";
import type { GroupsLocalization } from "./types";

type GroupsPublishDialogsProps = {
  approvePublishRequest: MutationState;
  localization: GroupsLocalization;
  publishReviewRequest?: KnowledgePublishRequest;
  publishReviewSource: PublishSourceState;
  publishRequestSourceLabel: (request: KnowledgePublishRequest) => string;
  publishRequestTargetLabel: (request: KnowledgePublishRequest) => string;
  rejectPublishRequest: MutationState;
  setPublishReviewRequest: (
    request: KnowledgePublishRequest | undefined,
  ) => void;
  onApprovePublishRequest: (requestId: string) => void;
  onRejectPublishRequest: (requestId: string) => void;
};

export function GroupsPublishDialogs({
  approvePublishRequest,
  localization,
  publishReviewRequest,
  publishReviewSource,
  publishRequestSourceLabel,
  publishRequestTargetLabel,
  rejectPublishRequest,
  setPublishReviewRequest,
  onApprovePublishRequest,
  onRejectPublishRequest,
}: GroupsPublishDialogsProps) {
  return (
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
  );
}

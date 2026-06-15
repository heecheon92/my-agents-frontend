"use client";

import { Field, inputClassName } from "@/components/Field";
import { OnboardingTarget } from "@/components/onboarding/OnboardingTarget";
import { Pill } from "@/components/Status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Localization } from "@/utils/localization";
import { formatFileSize } from "../shared";
import type { UploadQueueItem, UploadQueueStatus } from "../UploadQueueRow";
import { UploadQueueRow, uploadStatusTone } from "../UploadQueueRow";
import { MAX_UPLOAD_BYTES, UPLOAD_ACCEPT } from "./upload-config";

type UploadDialogProps = {
  failedQueueCount: number;
  handleFileSelection: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleProcessUploadQueue: () => void;
  handleQueueTitleChange: (localId: string, nextTitle: string) => void;
  handleRemoveQueueItem: (localId: string) => void;
  handleRetryQueueItem: (localId: string) => void;
  handleUploadDragEnter: (event: React.DragEvent<HTMLFieldSetElement>) => void;
  handleUploadDragLeave: (event: React.DragEvent<HTMLFieldSetElement>) => void;
  handleUploadDragOver: (event: React.DragEvent<HTMLFieldSetElement>) => void;
  handleUploadDrop: (event: React.DragEvent<HTMLFieldSetElement>) => void;
  hasActiveKnowledgeBase: boolean;
  isProcessingQueue: boolean;
  isUploadDropActive: boolean;
  localization: Localization["admin"];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pendingQueueCount: number;
  queueStatusCounts: Record<UploadQueueStatus, number>;
  queueSummary: string;
  uploadAnnouncement: string;
  uploadQueue: UploadQueueItem[];
};

export function UploadDialog({
  failedQueueCount,
  handleFileSelection,
  handleProcessUploadQueue,
  handleQueueTitleChange,
  handleRemoveQueueItem,
  handleRetryQueueItem,
  handleUploadDragEnter,
  handleUploadDragLeave,
  handleUploadDragOver,
  handleUploadDrop,
  hasActiveKnowledgeBase,
  isProcessingQueue,
  isUploadDropActive,
  localization,
  onOpenChange,
  open,
  pendingQueueCount,
  queueStatusCounts,
  queueSummary,
  uploadAnnouncement,
  uploadQueue,
}: UploadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{localization.documents.fileUploadTitle}</DialogTitle>
          <DialogDescription>
            {localization.documents.fileUploadHint}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <OnboardingTarget id="documents.upload-dropzone">
            <fieldset
              data-testid="document-upload-dropzone"
              onDragEnter={handleUploadDragEnter}
              onDragOver={handleUploadDragOver}
              onDragLeave={handleUploadDragLeave}
              onDrop={handleUploadDrop}
              aria-disabled={!hasActiveKnowledgeBase}
              className={cn(
                "grid gap-3 rounded-xl border border-dashed p-4 transition-colors",
                isUploadDropActive
                  ? "border-km-accent bg-km-accent/10"
                  : "border-cal-hairline bg-cal-canvas",
                !hasActiveKnowledgeBase && "cursor-not-allowed opacity-60",
              )}
            >
              <legend className="sr-only">
                {localization.documents.dropTitle}
              </legend>
              <div className="grid gap-1 text-sm leading-6">
                <p className="font-semibold text-cal-ink">
                  {isUploadDropActive
                    ? localization.documents.dropActiveTitle
                    : localization.documents.dropTitle}
                </p>
                <p className="text-cal-muted">
                  {localization.documents.dropDescription}
                </p>
              </div>
              <Field
                label={localization.documents.fileLabel}
                hint={localization.documents.multiFileUploadHint.replace(
                  "{maxSize}",
                  formatFileSize(MAX_UPLOAD_BYTES),
                )}
              >
                <input
                  className={inputClassName}
                  type="file"
                  accept={UPLOAD_ACCEPT}
                  multiple
                  onChange={handleFileSelection}
                  disabled={!hasActiveKnowledgeBase}
                />
              </Field>
            </fieldset>
          </OnboardingTarget>
          <p className="sr-only" aria-live="polite">
            {uploadAnnouncement}
          </p>
          {uploadQueue.length > 0 ? (
            <div className="grid gap-3" data-testid="upload-queue">
              <div className="grid gap-3 rounded-xl bg-cal-surface-soft p-3 text-sm text-cal-muted">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span>{queueSummary}</span>
                  <span>
                    {failedQueueCount > 0
                      ? localization.documents.uploadQueueFailedSummary.replace(
                          "{count}",
                          String(failedQueueCount),
                        )
                      : localization.documents.uploadQueueReadySummary.replace(
                          "{count}",
                          String(pendingQueueCount),
                        )}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(queueStatusCounts).map(([status, count]) =>
                    count > 0 ? (
                      <Pill
                        key={status}
                        tone={uploadStatusTone(status as UploadQueueStatus)}
                      >
                        {
                          localization.documents.uploadStatusLabels[
                            status as UploadQueueStatus
                          ]
                        }
                        : {count}
                      </Pill>
                    ) : null,
                  )}
                </div>
              </div>
              <div className="grid gap-2">
                {uploadQueue.map((item) => (
                  <UploadQueueRow
                    key={item.localId}
                    item={item}
                    localization={localization.documents}
                    onTitleChange={handleQueueTitleChange}
                    onRemove={handleRemoveQueueItem}
                    onRetry={handleRetryQueueItem}
                    disabled={isProcessingQueue}
                  />
                ))}
              </div>
            </div>
          ) : null}
          <p className="text-xs leading-5 text-cal-muted">
            {localization.documents.guestUploadLimitHint}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {localization.common.close}
            </Button>
            <Button
              type="button"
              onClick={handleProcessUploadQueue}
              disabled={
                isProcessingQueue ||
                pendingQueueCount === 0 ||
                !hasActiveKnowledgeBase
              }
            >
              {isProcessingQueue
                ? localization.documents.uploadProcessingButton
                : localization.documents.uploadAndIngestButton}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

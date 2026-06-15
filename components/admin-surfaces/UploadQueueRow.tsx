"use client";

import { inputClassName } from "@/components/Field";
import { Pill } from "@/components/Status";
import { Button } from "@/components/ui/button";
import {
  fileExtension,
  formatFileSize,
  InlineLoadingIndicator,
  type StatusTone,
} from "./shared";

export type UploadQueueStatus =
  | "selected"
  | "uploading"
  | "uploaded"
  | "queued"
  | "ingesting"
  | "publishing"
  | "completed"
  | "failed";

export type UploadQueueItem = {
  localId: string;
  file: File;
  title: string;
  status: UploadQueueStatus;
  progressPercent: number;
  documentId?: string;
  extractionRunId?: string;
  error?: string;
};

export const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const PPTX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export function UploadQueueRow({
  item,
  localization,
  onTitleChange,
  onRemove,
  onRetry,
  disabled,
}: {
  item: UploadQueueItem;
  localization: {
    uploadStatusLabels: Record<UploadQueueStatus, string>;
    advancedDetails: string;
    fileTypePdf: string;
    fileTypeMarkdown: string;
    fileTypeText: string;
    fileTypeSpreadsheet: string;
    fileTypePresentation: string;
    fileTitleLabel: string;
    retryUpload: string;
    removeUpload: string;
    ingestionLoading: string;
  };
  onTitleChange: (localId: string, title: string) => void;
  onRemove: (localId: string) => void;
  onRetry: (localId: string) => void;
  disabled: boolean;
}) {
  const canEdit = !disabled && ["selected", "failed"].includes(item.status);
  const isBusy = isUploadQueueItemBusy(item.status);

  return (
    <article className="rounded-xl border border-cal-hairline bg-cal-canvas p-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={uploadStatusTone(item.status)}>
              {localization.uploadStatusLabels[item.status]}
            </Pill>
            {isBusy ? (
              <InlineLoadingIndicator label={localization.ingestionLoading} />
            ) : null}
            <span className="rounded-full bg-cal-surface-soft px-2 py-1 text-xs font-medium text-cal-muted">
              {uploadFileTypeLabel(item.file, localization)}
            </span>
            <span className="text-xs text-cal-muted">
              {formatFileSize(item.file.size)}
            </span>
          </div>
          <p className="mt-2 break-words font-medium text-cal-ink">
            {item.file.name}
          </p>
          {item.documentId || item.extractionRunId ? (
            <details className="mt-2 rounded-lg bg-cal-surface-soft p-2 text-xs text-cal-muted">
              <summary className="cursor-pointer font-medium text-cal-ink">
                {localization.advancedDetails}
              </summary>
              <div className="mt-2 grid gap-1 font-mono text-[11px] leading-5">
                {item.documentId ? (
                  <span className="break-all">doc: {item.documentId}</span>
                ) : null}
                {item.extractionRunId ? (
                  <span className="break-all">run: {item.extractionRunId}</span>
                ) : null}
              </div>
            </details>
          ) : null}
          <label className="mt-2 grid gap-1 text-xs font-medium text-cal-muted">
            {localization.fileTitleLabel}
            <input
              className={inputClassName}
              value={item.title}
              onChange={(event) =>
                onTitleChange(item.localId, event.target.value)
              }
              disabled={!canEdit}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {item.status === "failed" ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onRetry(item.localId)}
              disabled={disabled}
            >
              {localization.retryUpload}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onRemove(item.localId)}
            disabled={disabled}
          >
            {localization.removeUpload}
          </Button>
        </div>
      </div>
      {item.error ? (
        <p className="mt-2 break-words text-xs text-cal-error">{item.error}</p>
      ) : null}
    </article>
  );
}

export function uploadStatusTone(status: UploadQueueStatus): StatusTone {
  if (status === "completed") return "green";
  if (status === "failed") return "rose";
  if (status === "queued" || status === "uploaded") return "amber";
  if (
    status === "uploading" ||
    status === "ingesting" ||
    status === "publishing"
  )
    return "blue";
  return "slate";
}

export function isUploadQueueItemBusy(status: UploadQueueStatus) {
  return (
    status === "uploading" ||
    status === "queued" ||
    status === "ingesting" ||
    status === "publishing"
  );
}

function uploadFileTypeLabel(
  file: File,
  localization: {
    fileTypePdf: string;
    fileTypeMarkdown: string;
    fileTypeText: string;
    fileTypeSpreadsheet: string;
    fileTypePresentation: string;
  },
) {
  const extension = fileExtension(file.name);
  if (extension === ".pdf" || file.type === "application/pdf") {
    return localization.fileTypePdf;
  }
  if (
    extension === ".md" ||
    extension === ".markdown" ||
    file.type === "text/markdown"
  ) {
    return localization.fileTypeMarkdown;
  }
  if (extension === ".xlsx" || file.type === XLSX_CONTENT_TYPE) {
    return localization.fileTypeSpreadsheet;
  }
  if (extension === ".pptx" || file.type === PPTX_CONTENT_TYPE) {
    return localization.fileTypePresentation;
  }
  return localization.fileTypeText;
}

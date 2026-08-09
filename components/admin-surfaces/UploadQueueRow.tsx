"use client";

import { inputClassName } from "@/components/Field";
import { Pill } from "@/components/Status";
import { Button } from "@/components/ui/button";
import {
  describeExtractionStage,
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
  /**
   * Backend extraction stage. Carried alongside the percentage because it is
   * what disambiguates 0%: `queued` means waiting for a worker, which reads
   * very differently from a bar stuck at zero.
   */
  stage?: string;
  documentId?: string;
  extractionRunId?: string;
  error?: string;
};

export const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const PPTX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export type UploadProgress = { label: string; percent: number | null };

/**
 * Decides what progress, if any, to show for a queued upload.
 *
 * Only where the number means something. The backend scale starts
 * `queued 0 → claimed 1`, so a bar at 0% would say "stuck" about a job that is
 * merely waiting for a worker — exactly what got the original progress bar
 * removed in `a081ef6`. While queued we show the stage in words and no bar.
 * Upload and publish have no real byte or request progress, so they stay
 * indeterminate too.
 *
 * The percentages are milestone commits, not elapsed time: 45 means "reached
 * embedding", so a step can hold for a while. Their spacing does encode
 * relative cost, which is why the number beats a plain step counter.
 */
export function resolveUploadProgress(
  item: Pick<UploadQueueItem, "status" | "stage" | "progressPercent">,
  localization: {
    progressWaitingForWorker: string;
    progressStageLabel: string;
    stages: Record<string, string>;
  },
): UploadProgress | null {
  if (item.status !== "ingesting") return null;

  const stageLabel = describeExtractionStage(item.stage, {
    documents: localization,
  });
  if (!item.stage || item.stage === "queued") {
    return {
      label: stageLabel || localization.progressWaitingForWorker,
      percent: null,
    };
  }

  const percent = Math.round(Math.min(Math.max(item.progressPercent, 0), 100));
  return {
    label: localization.progressStageLabel
      .replace("{stage}", stageLabel)
      .replace("{percent}", String(percent)),
    percent,
  };
}

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
    fileTypeWord: string;
    fileTitleLabel: string;
    retryUpload: string;
    removeUpload: string;
    ingestionLoading: string;
    progressWaitingForWorker: string;
    progressStageLabel: string;
    stages: Record<string, string>;
  };
  onTitleChange: (localId: string, title: string) => void;
  onRemove: (localId: string) => void;
  onRetry: (localId: string) => void;
  disabled: boolean;
}) {
  const canEdit = !disabled && ["selected", "failed"].includes(item.status);
  const isBusy = isUploadQueueItemBusy(item.status);

  const progress = resolveUploadProgress(item, localization);

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
          {progress ? (
            <div className="mt-2">
              <div className="flex items-center justify-between gap-2 text-xs text-cal-muted">
                <span>{progress.label}</span>
              </div>
              {progress.percent === null ? null : (
                <div
                  className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-cal-surface-strong"
                  role="progressbar"
                  aria-valuenow={progress.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={progress.label}
                >
                  <div
                    className="h-full rounded-full bg-km-accent transition-[width] duration-[var(--duration-panel)] ease-standard"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              )}
            </div>
          ) : null}
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
    fileTypeWord: string;
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
  if (extension === ".docx" || file.type === DOCX_CONTENT_TYPE) {
    return localization.fileTypeWord;
  }
  return localization.fileTypeText;
}

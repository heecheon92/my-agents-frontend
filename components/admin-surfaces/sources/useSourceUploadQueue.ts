import { useRef, useState } from "react";
import { toast } from "sonner";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import type { ExtractionRun, HealthResponse } from "@/model/my-agents";
import { documentUploadConcurrencyFromHealth } from "@/model/my-agents";
import { myAgentsAPI } from "@/services/my-agents";
import type { DocumentDestination } from "../shared";
import { formatFileSize, safeErrorMessage, wait } from "../shared";
import type { UploadQueueItem, UploadQueueStatus } from "../UploadQueueRow";
import { isUploadQueueItemBusy } from "../UploadQueueRow";
import {
  buildLocalUploadId,
  EXTRACTION_POLL_INTERVAL_MS,
  isSupportedUploadFile,
  MAX_UPLOAD_BYTES,
  TERMINAL_EXTRACTION_STATUSES,
  titleFromFileName,
} from "./upload-config";

type SourceUploadLocalization = {
  documents: {
    unsupportedFileError: string;
    fileTooLargeError: string;
    filesAddedAnnouncement: string;
    knowledgeBaseRequired: string;
    uploadRemovedAnnouncement: string;
    teamUploadApprovedAnnouncement: string;
    teamUploadRequestedAnnouncement: string;
    uploadStartedAnnouncement: string;
    uploadCompletedAnnouncement: string;
    uploadFailed: string;
    uploadFailedAnnouncement: string;
    uploadQueueFinishedAnnouncement: string;
    uploadQueueSummary: string;
    uploadQueueFailedSummary: string;
    uploadQueueReadySummary: string;
    uploadStatusLabels: Record<UploadQueueStatus, string>;
    undoRemoveUpload: string;
  };
};
type QueryInvalidator = {
  invalidateQueries: (options: {
    queryKey: readonly unknown[];
  }) => Promise<unknown>;
};
type PublishDocumentToTeam = (
  documentId: string,
) => Promise<
  | { status: "personal"; publishedDocumentId: undefined }
  | { status: "pending"; publishedDocumentId: undefined }
  | { status: "approved"; publishedDocumentId: string | undefined }
>;
type UseSourceUploadQueueOptions = {
  activeDocumentHasIngestion: boolean;
  activeDocumentId?: string;
  activeTeamKnowledgeBaseId?: string;
  directWriteKnowledgeBaseId?: string;
  displayKnowledgeBaseId?: string;
  effectiveDocumentDestination: DocumentDestination;
  hasActiveKnowledgeBase: boolean;
  health?: HealthResponse;
  localization: SourceUploadLocalization;
  publishDocumentToTeam: PublishDocumentToTeam;
  queryClient: QueryInvalidator;
  setSelectedDocumentId: (documentId: string | undefined) => void;
};
export function useSourceUploadQueue({
  activeDocumentHasIngestion,
  activeDocumentId,
  activeTeamKnowledgeBaseId,
  directWriteKnowledgeBaseId,
  displayKnowledgeBaseId,
  effectiveDocumentDestination,
  hasActiveKnowledgeBase,
  health,
  localization,
  publishDocumentToTeam,
  queryClient,
  setSelectedDocumentId,
}: UseSourceUploadQueueOptions) {
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [uploadAnnouncement, setUploadAnnouncement] = useState("");
  const [isUploadDropActive, setIsUploadDropActive] = useState(false);
  const uploadDragDepthRef = useRef(0);
  const pendingQueueCount = uploadQueue.filter(
    (item) =>
      item.status === "selected" ||
      item.status === "uploaded" ||
      (item.status === "failed" && Boolean(item.documentId)),
  ).length;
  const completedQueueCount = uploadQueue.filter(
    (item) => item.status === "completed",
  ).length;
  const failedQueueCount = uploadQueue.filter(
    (item) => item.status === "failed",
  ).length;
  const queueStatusCounts = uploadQueue.reduce(
    (counts, item) => {
      counts[item.status] += 1;
      return counts;
    },
    {
      selected: 0,
      uploading: 0,
      uploaded: 0,
      queued: 0,
      ingesting: 0,
      publishing: 0,
      completed: 0,
      failed: 0,
    } satisfies Record<UploadQueueStatus, number>,
  );
  const queueSummary = localization.documents.uploadQueueSummary
    .replace("{completed}", String(completedQueueCount))
    .replace("{total}", String(uploadQueue.length));
  const activeIngestionDocumentIds = new Set(
    uploadQueue
      .filter((item) => item.documentId && isUploadQueueItemBusy(item.status))
      .map((item) => item.documentId as string),
  );
  if (activeDocumentId && activeDocumentHasIngestion) {
    activeIngestionDocumentIds.add(activeDocumentId);
  }
  function announceUploadOutcome(
    message: string,
    tone: "success" | "error" | "info",
  ) {
    setUploadAnnouncement(message);
    if (tone === "success") toast.success(message);
    else if (tone === "error") toast.error(message);
    else toast.info(message);
  }
  function updateQueueItem(
    localId: string,
    update:
      | Partial<UploadQueueItem>
      | ((current: UploadQueueItem) => Partial<UploadQueueItem>),
  ) {
    setUploadQueue((current) =>
      current.map((item) => {
        if (item.localId !== localId) return item;
        const patch = typeof update === "function" ? update(item) : update;
        return { ...item, ...patch };
      }),
    );
  }
  function validateUploadFile(file: File) {
    if (!isSupportedUploadFile(file)) {
      return localization.documents.unsupportedFileError;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return localization.documents.fileTooLargeError.replace(
        "{maxSize}",
        formatFileSize(MAX_UPLOAD_BYTES),
      );
    }
    return undefined;
  }
  function addFilesToUploadQueue(selectedFiles: File[]) {
    if (selectedFiles.length === 0) return;
    const nextItems = selectedFiles.map((file) => {
      const error = validateUploadFile(file);
      return {
        localId: buildLocalUploadId(file),
        file,
        title: titleFromFileName(file.name),
        status: error ? "failed" : "selected",
        progressPercent: 0,
        error,
      } satisfies UploadQueueItem;
    });
    setUploadQueue((current) => [...current, ...nextItems]);
    setUploadAnnouncement(
      localization.documents.filesAddedAnnouncement.replace(
        "{count}",
        String(nextItems.length),
      ),
    );
  }
  function handleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    addFilesToUploadQueue(Array.from(event.target.files ?? []));
    event.currentTarget.value = "";
  }
  function handleUploadDragEnter(event: React.DragEvent<HTMLFieldSetElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!event.dataTransfer.types.includes("Files")) return;
    event.dataTransfer.dropEffect = hasActiveKnowledgeBase ? "copy" : "none";
    uploadDragDepthRef.current += 1;
    if (hasActiveKnowledgeBase) {
      setIsUploadDropActive(true);
    }
  }
  function handleUploadDragOver(event: React.DragEvent<HTMLFieldSetElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = hasActiveKnowledgeBase ? "copy" : "none";
  }
  function handleUploadDragLeave(event: React.DragEvent<HTMLFieldSetElement>) {
    event.preventDefault();
    event.stopPropagation();
    uploadDragDepthRef.current = Math.max(uploadDragDepthRef.current - 1, 0);
    if (uploadDragDepthRef.current === 0) {
      setIsUploadDropActive(false);
    }
  }
  function handleUploadDrop(event: React.DragEvent<HTMLFieldSetElement>) {
    event.preventDefault();
    event.stopPropagation();
    uploadDragDepthRef.current = 0;
    setIsUploadDropActive(false);
    if (!hasActiveKnowledgeBase) {
      setUploadAnnouncement(localization.documents.knowledgeBaseRequired);
      return;
    }
    addFilesToUploadQueue(Array.from(event.dataTransfer.files));
  }
  function handleQueueTitleChange(localId: string, nextTitle: string) {
    updateQueueItem(localId, { title: nextTitle });
  }
  function handleRemoveQueueItem(localId: string) {
    const removedIndex = uploadQueue.findIndex(
      (item) => item.localId === localId,
    );
    const removedItem = uploadQueue[removedIndex];
    setUploadQueue((current) =>
      current.filter((item) => item.localId !== localId),
    );
    setUploadAnnouncement(localization.documents.uploadRemovedAnnouncement);
    if (!removedItem) return;
    toast(localization.documents.uploadRemovedAnnouncement, {
      action: {
        label: localization.documents.undoRemoveUpload,
        onClick: () => {
          setUploadQueue((current) => {
            if (current.some((item) => item.localId === localId)) {
              return current;
            }
            const next = [...current];
            next.splice(Math.min(removedIndex, next.length), 0, removedItem);
            return next;
          });
        },
      },
    });
  }
  function handleRetryQueueItem(localId: string) {
    updateQueueItem(localId, (item) => ({
      status: item.documentId ? "uploaded" : "selected",
      error: undefined,
      progressPercent: 0,
    }));
  }
  async function refreshDocumentQueries(
    documentId?: string,
    knowledgeBaseId = displayKnowledgeBaseId,
  ) {
    if (!knowledgeBaseId) return;
    await queryClient.invalidateQueries({
      queryKey: MyAgentsQueryKeys.knowledgeBases.documents(knowledgeBaseId),
    });
    if (documentId) {
      await queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.knowledgeBases.extractionRuns(
          knowledgeBaseId,
          documentId,
        ),
      });
    }
  }
  async function pollExtractionRun(
    knowledgeBaseId: string,
    documentId: string,
    runId: string,
    localId?: string,
  ) {
    let latestRun: ExtractionRun | null = null;
    while (true) {
      const run = await myAgentsAPI.documents.extractionRunInKnowledgeBase(
        knowledgeBaseId,
        documentId,
        runId,
      );
      latestRun = run;
      if (localId) {
        updateQueueItem(localId, {
          extractionRunId: run.id,
          status: run.status === "failed" ? "failed" : "ingesting",
          progressPercent: 0,
          error: run.error ?? undefined,
        });
      }
      if (TERMINAL_EXTRACTION_STATUSES.has(run.status)) break;
      await wait(EXTRACTION_POLL_INTERVAL_MS);
    }
    return latestRun;
  }
  async function processQueueItem(item: UploadQueueItem) {
    if (!hasActiveKnowledgeBase) {
      updateQueueItem(item.localId, {
        status: "failed",
        error: localization.documents.knowledgeBaseRequired,
        progressPercent: 0,
      });
      return;
    }
    if (!item.documentId) {
      const validationError = validateUploadFile(item.file);
      if (validationError) {
        updateQueueItem(item.localId, {
          status: "failed",
          error: validationError,
          progressPercent: 0,
        });
        return;
      }
    }
    try {
      let documentId = item.documentId;
      if (!documentId) {
        updateQueueItem(item.localId, {
          status: "uploading",
          progressPercent: 10,
          error: undefined,
        });
        const uploadKnowledgeBaseId =
          effectiveDocumentDestination === "team"
            ? (await myAgentsAPI.knowledgeBases.ensureTeamUploadStaging()).id
            : directWriteKnowledgeBaseId;
        if (!uploadKnowledgeBaseId) {
          throw new Error(localization.documents.knowledgeBaseRequired);
        }
        const uploaded = await myAgentsAPI.documents.uploadToKnowledgeBase(
          uploadKnowledgeBaseId,
          {
            title: item.title.trim() || titleFromFileName(item.file.name),
            file: item.file,
          },
        );
        documentId = uploaded.id;
        if (effectiveDocumentDestination !== "team") {
          setSelectedDocumentId(uploaded.id);
        }
        updateQueueItem(item.localId, {
          documentId: uploaded.id,
          status: "uploaded",
          progressPercent: 0,
        });
        if (effectiveDocumentDestination !== "team") {
          await refreshDocumentQueries(uploaded.id, uploadKnowledgeBaseId);
        }
      }
      if (effectiveDocumentDestination === "team") {
        updateQueueItem(item.localId, {
          status: "publishing",
          progressPercent: 0,
          error: undefined,
        });
        const publishResult = await publishDocumentToTeam(documentId);
        if (publishResult.publishedDocumentId) {
          setSelectedDocumentId(publishResult.publishedDocumentId);
        }
        updateQueueItem(item.localId, {
          status: "completed",
          progressPercent: 0,
          error: undefined,
        });
        announceUploadOutcome(
          (publishResult.status === "approved"
            ? localization.documents.teamUploadApprovedAnnouncement
            : localization.documents.teamUploadRequestedAnnouncement
          ).replace("{file}", item.file.name),
          publishResult.status === "approved" ? "success" : "info",
        );
        await refreshDocumentQueries(
          publishResult.publishedDocumentId,
          activeTeamKnowledgeBaseId,
        );
        return;
      }
      const ingestionKnowledgeBaseId = directWriteKnowledgeBaseId;
      if (!ingestionKnowledgeBaseId) {
        throw new Error(localization.documents.knowledgeBaseRequired);
      }
      updateQueueItem(item.localId, {
        status: "queued",
        progressPercent: 0,
        error: undefined,
      });
      const run = await myAgentsAPI.documents.ingestAsyncInKnowledgeBase(
        ingestionKnowledgeBaseId,
        documentId,
      );
      updateQueueItem(item.localId, {
        extractionRunId: run.id,
        status: run.status === "pending" ? "queued" : "ingesting",
        progressPercent: 0,
      });
      const completedRun = TERMINAL_EXTRACTION_STATUSES.has(run.status)
        ? run
        : await pollExtractionRun(
            ingestionKnowledgeBaseId,
            documentId,
            run.id,
            item.localId,
          );
      if (completedRun?.status === "completed") {
        updateQueueItem(item.localId, {
          status: "completed",
          progressPercent: 0,
          error: undefined,
        });
        announceUploadOutcome(
          localization.documents.uploadCompletedAnnouncement.replace(
            "{file}",
            item.file.name,
          ),
          "success",
        );
        await refreshDocumentQueries(documentId);
        return;
      }
      updateQueueItem(item.localId, {
        status: "failed",
        error: completedRun?.error ?? localization.documents.uploadFailed,
        progressPercent: 0,
      });
      announceUploadOutcome(
        localization.documents.uploadFailedAnnouncement.replace(
          "{file}",
          item.file.name,
        ),
        "error",
      );
      await refreshDocumentQueries(documentId);
    } catch (error) {
      updateQueueItem(item.localId, {
        status: "failed",
        error: safeErrorMessage(error, localization.documents.uploadFailed),
      });
      announceUploadOutcome(
        localization.documents.uploadFailedAnnouncement.replace(
          "{file}",
          item.file.name,
        ),
        "error",
      );
    }
  }
  async function handleProcessUploadQueue() {
    const processableItems = uploadQueue.filter(
      (item) =>
        item.status === "selected" ||
        item.status === "uploaded" ||
        (item.status === "failed" && Boolean(item.documentId)),
    );
    if (
      processableItems.length === 0 ||
      isProcessingQueue ||
      !hasActiveKnowledgeBase
    ) {
      return;
    }
    setIsProcessingQueue(true);
    setUploadAnnouncement(localization.documents.uploadStartedAnnouncement);
    let nextIndex = 0;
    const workerCount = Math.min(
      documentUploadConcurrencyFromHealth(health),
      processableItems.length,
    );
    async function runWorker() {
      while (nextIndex < processableItems.length) {
        const item = processableItems[nextIndex];
        nextIndex += 1;
        if (item) await processQueueItem(item);
      }
    }
    await Promise.all(Array.from({ length: workerCount }, runWorker));
    setIsProcessingQueue(false);
    setUploadAnnouncement(
      localization.documents.uploadQueueFinishedAnnouncement,
    );
  }
  return {
    activeIngestionDocumentIds,
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
    isProcessingQueue,
    isUploadDropActive,
    pendingQueueCount,
    queueStatusCounts,
    queueSummary,
    pollExtractionRun,
    refreshDocumentQueries,
    setUploadAnnouncement,
    uploadAnnouncement,
    uploadQueue,
  };
}

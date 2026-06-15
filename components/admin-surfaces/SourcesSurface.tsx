"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DatabaseIcon,
  FileTextIcon,
  ListTreeIcon,
  PlusIcon,
  SearchIcon,
  UploadIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  canAutoApproveTeamDocumentUpload,
  groupKnowledgeBasesForGroup,
  systemKnowledgeBasesForManager,
  writableDocumentKnowledgeBases,
} from "@/components/document-knowledge-base";
import { Field, inputClassName } from "@/components/Field";
import {
  buildKnowledgeBaseCreateRequest,
  type KnowledgeBaseCreationScope,
} from "@/components/knowledge-base-create";
import { OnboardingTarget } from "@/components/onboarding/OnboardingTarget";
import { ErrorState, Pill } from "@/components/Status";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import { useCurrentUser } from "@/hooks/use-auth";
import { useGroups } from "@/hooks/use-groups";
import {
  useCreateKnowledgeBase,
  useCreateKnowledgeBaseDocument,
  useDeleteKnowledgeBaseDocument,
  useIngestKnowledgeBaseDocumentAsync,
  useKnowledgeBaseDocuments,
  useKnowledgeBaseExtractionRuns,
  useKnowledgeBases,
} from "@/hooks/use-knowledge";
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from "@/lib/utils";
import {
  canManageSystemKnowledge as canManageSystemKnowledgeForUser,
  documentUploadConcurrencyFromHealth,
  type ExtractionRun,
} from "@/model/my-agents";
import { myAgentsAPI } from "@/services/my-agents";
import { DocumentsTable } from "./DocumentsTable";
import { SourceActionsDialog } from "./SourceActionsDialog";
import { SourceSpaceCreateForm } from "./SourceSpaceCreateForm";
import { SourceSpaceTree } from "./SourceSpaceTree";
import {
  type DocumentDestination,
  decodeRouteSegment,
  fileExtension,
  formatFileSize,
  isActiveExtractionRunStatus,
  knowledgeSourceHref,
  PageCard,
  safeErrorMessage,
  wait,
} from "./shared";
import {
  isUploadQueueItemBusy,
  PPTX_CONTENT_TYPE,
  type UploadQueueItem,
  UploadQueueRow,
  type UploadQueueStatus,
  uploadStatusTone,
  XLSX_CONTENT_TYPE,
} from "./UploadQueueRow";

type SourcesSurfaceProps = {
  initialSourceId?: string;
};

type SourceActionsDialogState = {
  documentId: string;
};

const UPLOAD_ACCEPT = [
  "application/pdf",
  "text/markdown",
  "text/plain",
  XLSX_CONTENT_TYPE,
  PPTX_CONTENT_TYPE,
  ".pdf",
  ".md",
  ".markdown",
  ".txt",
  ".xlsx",
  ".pptx",
].join(",");
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const HEALTH_CONFIG_STALE_TIME_MS = 5 * 60 * 1000;
const EXTRACTION_POLL_INTERVAL_MS = 1000;
const TERMINAL_EXTRACTION_STATUSES = new Set(["completed", "failed"]);
const SUPPORTED_UPLOAD_EXTENSIONS = new Set([
  ".pdf",
  ".md",
  ".markdown",
  ".txt",
  ".xlsx",
  ".pptx",
]);
const SUPPORTED_UPLOAD_TYPES = new Set([
  "application/pdf",
  "text/markdown",
  "text/plain",
  XLSX_CONTENT_TYPE,
  PPTX_CONTENT_TYPE,
]);

function buildLocalUploadId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`;
}

function titleFromFileName(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  return baseName.trim() || fileName;
}

function isSupportedUploadFile(file: File) {
  return (
    SUPPORTED_UPLOAD_EXTENSIONS.has(fileExtension(file.name)) ||
    SUPPORTED_UPLOAD_TYPES.has(file.type)
  );
}

export function SourcesSurface({ initialSourceId }: SourcesSurfaceProps = {}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const groups = useGroups();
  const knowledgeBases = useKnowledgeBases();
  const currentUser = useCurrentUser();
  const createKnowledgeBase = useCreateKnowledgeBase();
  const canManageSystemKnowledge = canManageSystemKnowledgeForUser(
    currentUser.data,
  );
  const health = useQuery({
    queryKey: MyAgentsQueryKeys.health(),
    queryFn: () => myAgentsAPI.health(),
    staleTime: HEALTH_CONFIG_STALE_TIME_MS,
  });
  const [documentDestination, setDocumentDestination] =
    useState<DocumentDestination>("personal");
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] =
    useState<string>();
  const [selectedTeamGroupId, setSelectedTeamGroupId] = useState<string>();
  const [selectedTeamKnowledgeBaseId, setSelectedTeamKnowledgeBaseId] =
    useState<string>();
  const [selectedSystemKnowledgeBaseId, setSelectedSystemKnowledgeBaseId] =
    useState<string>();
  const [optimisticSourceId, setOptimisticSourceId] = useState<string>();
  const [sourceSpaceName, setSourceSpaceName] = useState("");
  const [sourceSpaceScope, setSourceSpaceScope] =
    useState<KnowledgeBaseCreationScope>("personal");
  const [sourceSpaceGroupId, setSourceSpaceGroupId] = useState("");
  const documentKnowledgeBases = writableDocumentKnowledgeBases(
    knowledgeBases.data ?? [],
    currentUser.data?.id,
  );
  const systemKnowledgeBases = systemKnowledgeBasesForManager(
    knowledgeBases.data ?? [],
    canManageSystemKnowledge,
  );
  const teamGroups = groups.data ?? [];
  const sourceSpaceGroupOptions = teamGroups.filter(
    (group) => group.role === "owner" || group.role === "admin",
  );
  const routeSourceId = decodeRouteSegment(initialSourceId);
  // The route segment changes after a link click, so keep the clicked source
  // active while Next remounts /knowledge/[sourceId] and the URL catches up.
  const effectiveRouteSourceId = optimisticSourceId ?? routeSourceId;
  const routePersonalKnowledgeBase = documentKnowledgeBases.find(
    (knowledgeBase) => knowledgeBase.id === effectiveRouteSourceId,
  );
  const routeTeamKnowledgeBase = (knowledgeBases.data ?? []).find(
    (knowledgeBase) =>
      knowledgeBase.scope === "group" &&
      knowledgeBase.purpose === "standard" &&
      knowledgeBase.id === effectiveRouteSourceId &&
      Boolean(knowledgeBase.group_id),
  );
  const routeSystemKnowledgeBase = systemKnowledgeBases.find(
    (knowledgeBase) => knowledgeBase.id === effectiveRouteSourceId,
  );
  const routeTeamGroup = teamGroups.find(
    (group) => group.id === effectiveRouteSourceId,
  );
  const routeDocumentDestination: DocumentDestination | undefined =
    routePersonalKnowledgeBase
      ? "personal"
      : routeSystemKnowledgeBase
        ? "system"
        : routeTeamKnowledgeBase || routeTeamGroup
          ? "team"
          : undefined;
  const effectiveDocumentDestination =
    routeDocumentDestination ?? documentDestination;
  const routeTeamGroupId =
    routeTeamKnowledgeBase?.group_id ?? routeTeamGroup?.id;
  const createSourceSpacePayload = buildKnowledgeBaseCreateRequest({
    canManageSystemKnowledge,
    groupId: sourceSpaceGroupId,
    name: sourceSpaceName,
    scope: sourceSpaceScope,
  });
  const isCreatingTeamSourceSpace = sourceSpaceScope === "group";
  const isCreatingSystemSourceSpace = sourceSpaceScope === "system";
  const selectedTeamGroupStillExists = Boolean(
    selectedTeamGroupId &&
      teamGroups.some((group) => group.id === selectedTeamGroupId),
  );
  const activeTeamGroupId =
    routeTeamGroupId ??
    (selectedTeamGroupStillExists ? selectedTeamGroupId : teamGroups[0]?.id);
  const activeTeamGroup = teamGroups.find(
    (group) => group.id === activeTeamGroupId,
  );
  const activeGroupKnowledgeBases = groupKnowledgeBasesForGroup(
    knowledgeBases.data ?? [],
    activeTeamGroupId,
  );
  const selectedTeamKnowledgeBaseStillExists = Boolean(
    selectedTeamKnowledgeBaseId &&
      activeGroupKnowledgeBases.some(
        (knowledgeBase) => knowledgeBase.id === selectedTeamKnowledgeBaseId,
      ),
  );
  const activeTeamKnowledgeBaseId =
    routeTeamKnowledgeBase?.id ??
    (routeTeamGroup ? activeGroupKnowledgeBases[0]?.id : undefined) ??
    (selectedTeamKnowledgeBaseStillExists
      ? selectedTeamKnowledgeBaseId
      : activeGroupKnowledgeBases[0]?.id);
  const selectedSystemKnowledgeBaseStillExists = Boolean(
    selectedSystemKnowledgeBaseId &&
      systemKnowledgeBases.some(
        (knowledgeBase) => knowledgeBase.id === selectedSystemKnowledgeBaseId,
      ),
  );
  const activeSystemKnowledgeBaseId =
    routeSystemKnowledgeBase?.id ??
    (selectedSystemKnowledgeBaseStillExists
      ? selectedSystemKnowledgeBaseId
      : systemKnowledgeBases[0]?.id);
  const selectedPersonalKnowledgeBaseStillExists = Boolean(
    selectedKnowledgeBaseId &&
      documentKnowledgeBases.some(
        (knowledgeBase) => knowledgeBase.id === selectedKnowledgeBaseId,
      ),
  );
  const activeKnowledgeBaseId =
    routePersonalKnowledgeBase?.id ??
    (selectedPersonalKnowledgeBaseStillExists
      ? selectedKnowledgeBaseId
      : documentKnowledgeBases[0]?.id);
  const displayKnowledgeBaseId =
    effectiveDocumentDestination === "team"
      ? activeTeamKnowledgeBaseId
      : effectiveDocumentDestination === "system"
        ? activeSystemKnowledgeBaseId
        : activeKnowledgeBaseId;
  const directWriteKnowledgeBaseId =
    effectiveDocumentDestination === "system"
      ? activeSystemKnowledgeBaseId
      : effectiveDocumentDestination === "personal"
        ? activeKnowledgeBaseId
        : undefined;
  const documents = useKnowledgeBaseDocuments(displayKnowledgeBaseId);
  const createDocument = useCreateKnowledgeBaseDocument(
    directWriteKnowledgeBaseId,
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [uploadAnnouncement, setUploadAnnouncement] = useState("");
  const [isUploadDropActive, setIsUploadDropActive] = useState(false);
  const [isSourceSpaceBrowserOpen, setIsSourceSpaceBrowserOpen] =
    useState(false);
  const [isCreateSourceSpaceDialogOpen, setIsCreateSourceSpaceDialogOpen] =
    useState(false);
  const [isTextSourceDialogOpen, setIsTextSourceDialogOpen] = useState(false);
  const [isFileUploadDialogOpen, setIsFileUploadDialogOpen] = useState(false);
  const [isPreparingTextSource, setIsPreparingTextSource] = useState(false);
  const [sourceActionsDialog, setSourceActionsDialog] =
    useState<SourceActionsDialogState>();
  const uploadDragDepthRef = useRef(0);
  const lastAppliedRouteSourceIdRef = useRef<string | undefined>(undefined);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>();
  const activeDocumentId =
    sourceActionsDialog?.documentId ?? selectedDocumentId;
  const activeDocument = documents.data?.find(
    (document) => document.id === activeDocumentId,
  );
  const extractionRuns = useKnowledgeBaseExtractionRuns(
    displayKnowledgeBaseId,
    activeDocumentId,
  );
  const ingest = useIngestKnowledgeBaseDocumentAsync(
    displayKnowledgeBaseId,
    activeDocumentId,
  );
  const deleteDocument = useDeleteKnowledgeBaseDocument(
    displayKnowledgeBaseId,
    activeDocumentId,
  );
  const { localization } = useLocalization((state) => state.localization.admin);
  const canAutoApproveTeamUpload =
    canAutoApproveTeamDocumentUpload(activeTeamGroup);
  const hasActiveKnowledgeBase =
    effectiveDocumentDestination === "team"
      ? Boolean(activeTeamGroupId && activeTeamKnowledgeBaseId)
      : Boolean(directWriteKnowledgeBaseId);
  const activeSourceSpace =
    effectiveDocumentDestination === "team"
      ? activeGroupKnowledgeBases.find(
          (knowledgeBase) => knowledgeBase.id === activeTeamKnowledgeBaseId,
        )
      : effectiveDocumentDestination === "system"
        ? systemKnowledgeBases.find(
            (knowledgeBase) => knowledgeBase.id === activeSystemKnowledgeBaseId,
          )
        : documentKnowledgeBases.find(
            (knowledgeBase) => knowledgeBase.id === activeKnowledgeBaseId,
          );
  const visibleTeamSourceSpaceCount = teamGroups.reduce(
    (count, group) =>
      count +
      groupKnowledgeBasesForGroup(knowledgeBases.data ?? [], group.id).length,
    0,
  );
  const sourceSpaceCount =
    documentKnowledgeBases.length +
    visibleTeamSourceSpaceCount +
    systemKnowledgeBases.length;

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
  const isKnowledgeBaseSelectionLocked =
    isProcessingQueue || pendingQueueCount > 0;
  const isCreateSourceSpaceDisabled =
    isKnowledgeBaseSelectionLocked ||
    createKnowledgeBase.isPending ||
    groups.isLoading ||
    !createSourceSpacePayload ||
    (isCreatingTeamSourceSpace && sourceSpaceGroupOptions.length === 0) ||
    (isCreatingSystemSourceSpace && !canManageSystemKnowledge);
  const shouldShowFirstSourceSpaceForm =
    !knowledgeBases.isLoading && sourceSpaceCount === 0;
  const activeDocumentHasIngestion = Boolean(
    extractionRuns.data?.some((run) => isActiveExtractionRunStatus(run.status)),
  );
  const activeIngestionDocumentIds = new Set(
    uploadQueue
      .filter((item) => item.documentId && isUploadQueueItemBusy(item.status))
      .map((item) => item.documentId as string),
  );
  if (activeDocumentId && activeDocumentHasIngestion) {
    activeIngestionDocumentIds.add(activeDocumentId);
  }
  const readyDocumentCount = Math.max(
    0,
    (documents.data?.length ?? 0) - activeIngestionDocumentIds.size,
  );

  useEffect(() => {
    if (!optimisticSourceId) return;
    if (!routeSourceId || routeSourceId === optimisticSourceId) {
      setOptimisticSourceId(undefined);
    }
  }, [optimisticSourceId, routeSourceId]);

  useEffect(() => {
    if (!routeSourceId) {
      lastAppliedRouteSourceIdRef.current = undefined;
      return;
    }

    if (
      lastAppliedRouteSourceIdRef.current === routeSourceId ||
      isKnowledgeBaseSelectionLocked ||
      knowledgeBases.isLoading ||
      groups.isLoading
    ) {
      return;
    }

    const personalKnowledgeBase = documentKnowledgeBases.find(
      (knowledgeBase) => knowledgeBase.id === routeSourceId,
    );
    if (personalKnowledgeBase) {
      setDocumentDestination("personal");
      setSelectedKnowledgeBaseId(personalKnowledgeBase.id);
      setSelectedDocumentId(undefined);
      lastAppliedRouteSourceIdRef.current = routeSourceId;
      return;
    }

    const systemKnowledgeBase = systemKnowledgeBases.find(
      (knowledgeBase) => knowledgeBase.id === routeSourceId,
    );
    if (systemKnowledgeBase) {
      setDocumentDestination("system");
      setSelectedSystemKnowledgeBaseId(systemKnowledgeBase.id);
      setSelectedDocumentId(undefined);
      lastAppliedRouteSourceIdRef.current = routeSourceId;
      return;
    }

    const teamKnowledgeBase = (knowledgeBases.data ?? []).find(
      (knowledgeBase) =>
        knowledgeBase.scope === "group" &&
        knowledgeBase.purpose === "standard" &&
        knowledgeBase.id === routeSourceId &&
        Boolean(knowledgeBase.group_id),
    );
    if (teamKnowledgeBase?.group_id) {
      setDocumentDestination("team");
      setSelectedTeamGroupId(teamKnowledgeBase.group_id);
      setSelectedTeamKnowledgeBaseId(teamKnowledgeBase.id);
      setSelectedDocumentId(undefined);
      lastAppliedRouteSourceIdRef.current = routeSourceId;
      return;
    }

    const teamGroup = teamGroups.find((group) => group.id === routeSourceId);
    if (teamGroup) {
      const groupSourceSpaces = groupKnowledgeBasesForGroup(
        knowledgeBases.data ?? [],
        teamGroup.id,
      );
      setDocumentDestination("team");
      setSelectedTeamGroupId(teamGroup.id);
      setSelectedTeamKnowledgeBaseId(groupSourceSpaces[0]?.id);
      setSelectedDocumentId(undefined);
      lastAppliedRouteSourceIdRef.current = routeSourceId;
    }
  }, [
    documentKnowledgeBases,
    groups.isLoading,
    isKnowledgeBaseSelectionLocked,
    knowledgeBases.data,
    knowledgeBases.isLoading,
    routeSourceId,
    systemKnowledgeBases,
    teamGroups,
  ]);

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
    setUploadQueue((current) =>
      current.filter((item) => item.localId !== localId),
    );
    setUploadAnnouncement(localization.documents.uploadRemovedAnnouncement);
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
    if (knowledgeBaseId) {
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

  async function publishDocumentToTeam(documentId: string) {
    if (
      effectiveDocumentDestination !== "team" ||
      !activeTeamGroupId ||
      !activeTeamKnowledgeBaseId
    ) {
      return { status: "personal", publishedDocumentId: undefined } as const;
    }

    const request = await myAgentsAPI.groups.createPublishRequest(
      activeTeamGroupId,
      {
        source_document_id: documentId,
        target_knowledge_base_id: activeTeamKnowledgeBaseId,
      },
    );
    await queryClient.invalidateQueries({
      queryKey: MyAgentsQueryKeys.groups.publishRequests(activeTeamGroupId),
    });

    if (!canAutoApproveTeamUpload) {
      return { status: "pending", publishedDocumentId: undefined } as const;
    }

    const approved = await myAgentsAPI.groups.approvePublishRequest(
      activeTeamGroupId,
      request.id,
    );
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.groups.publishRequests(activeTeamGroupId),
      }),
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.knowledgeBases.documents(
          activeTeamKnowledgeBaseId,
        ),
      }),
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.knowledgeBases.list(),
      }),
    ]);
    return {
      status: "approved",
      publishedDocumentId: approved.published_document_id ?? undefined,
    } as const;
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
        setUploadAnnouncement(
          (publishResult.status === "approved"
            ? localization.documents.teamUploadApprovedAnnouncement
            : localization.documents.teamUploadRequestedAnnouncement
          ).replace("{file}", item.file.name),
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
        setUploadAnnouncement(
          localization.documents.uploadCompletedAnnouncement.replace(
            "{file}",
            item.file.name,
          ),
        );
        await refreshDocumentQueries(documentId);
        return;
      }

      updateQueueItem(item.localId, {
        status: "failed",
        error: completedRun?.error ?? localization.documents.uploadFailed,
        progressPercent: 0,
      });
      setUploadAnnouncement(
        localization.documents.uploadFailedAnnouncement.replace(
          "{file}",
          item.file.name,
        ),
      );
      await refreshDocumentQueries(documentId);
    } catch (error) {
      updateQueueItem(item.localId, {
        status: "failed",
        error: safeErrorMessage(error, localization.documents.uploadFailed),
      });
      setUploadAnnouncement(
        localization.documents.uploadFailedAnnouncement.replace(
          "{file}",
          item.file.name,
        ),
      );
    }
  }

  async function handleCreateSourceSpace(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!createSourceSpacePayload || isCreateSourceSpaceDisabled) return;

    try {
      const created = await createKnowledgeBase.mutateAsync(
        createSourceSpacePayload,
      );
      setSourceSpaceName("");
      setSelectedDocumentId(undefined);
      if (created.scope === "group") {
        setDocumentDestination("team");
        setSelectedTeamGroupId(created.group_id ?? undefined);
        setSelectedTeamKnowledgeBaseId(created.id);
        setOptimisticSourceId(created.id);
        setIsCreateSourceSpaceDialogOpen(false);
        router.push(knowledgeSourceHref(created.id), { scroll: false });
        return;
      }
      if (created.scope === "system") {
        setDocumentDestination("system");
        setSelectedSystemKnowledgeBaseId(created.id);
        setOptimisticSourceId(created.id);
        setIsCreateSourceSpaceDialogOpen(false);
        router.push(knowledgeSourceHref(created.id), { scroll: false });
        return;
      }
      setDocumentDestination("personal");
      setSelectedKnowledgeBaseId(created.id);
      setOptimisticSourceId(created.id);
      setIsCreateSourceSpaceDialogOpen(false);
      router.push(knowledgeSourceHref(created.id), { scroll: false });
    } catch {
      // React Query stores the API error on the mutation; render it below.
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
      documentUploadConcurrencyFromHealth(health.data),
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

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasActiveKnowledgeBase || isPreparingTextSource) return;

    const sourceTitle = title.trim();
    setIsPreparingTextSource(true);
    try {
      const created =
        effectiveDocumentDestination === "team"
          ? await myAgentsAPI.documents.createInKnowledgeBase(
              (await myAgentsAPI.knowledgeBases.ensureTeamUploadStaging()).id,
              { title, content },
            )
          : await createDocument.mutateAsync({ title, content });
      if (effectiveDocumentDestination === "team") {
        const publishResult = await publishDocumentToTeam(created.id);
        setUploadAnnouncement(
          publishResult.status === "approved"
            ? localization.documents.teamTextApprovedAnnouncement
            : localization.documents.teamTextRequestedAnnouncement,
        );
        setSelectedDocumentId(publishResult.publishedDocumentId);
        await refreshDocumentQueries(
          publishResult.publishedDocumentId,
          activeTeamKnowledgeBaseId,
        );
      } else {
        if (!directWriteKnowledgeBaseId) {
          throw new Error(localization.documents.knowledgeBaseRequired);
        }
        setSelectedDocumentId(created.id);
        setUploadAnnouncement(localization.documents.uploadStartedAnnouncement);
        const run = await myAgentsAPI.documents.ingestAsyncInKnowledgeBase(
          directWriteKnowledgeBaseId,
          created.id,
        );
        const completedRun = TERMINAL_EXTRACTION_STATUSES.has(run.status)
          ? run
          : await pollExtractionRun(
              directWriteKnowledgeBaseId,
              created.id,
              run.id,
            );
        if (completedRun?.status === "completed") {
          setUploadAnnouncement(
            localization.documents.uploadCompletedAnnouncement.replace(
              "{file}",
              sourceTitle,
            ),
          );
        } else {
          setUploadAnnouncement(
            localization.documents.uploadFailedAnnouncement.replace(
              "{file}",
              sourceTitle,
            ),
          );
        }
        await refreshDocumentQueries(created.id, directWriteKnowledgeBaseId);
      }
      setTitle("");
      setContent("");
      setIsTextSourceDialogOpen(false);
    } catch {
      if (sourceTitle) {
        setUploadAnnouncement(
          localization.documents.uploadFailedAnnouncement.replace(
            "{file}",
            sourceTitle,
          ),
        );
      }
      // React Query stores the API error on the mutation; render it below.
    } finally {
      setIsPreparingTextSource(false);
    }
  }

  async function handleDeleteDocument() {
    if (!activeDocumentId) return;
    const selectedDocument = documents.data?.find(
      (document) => document.id === activeDocumentId,
    );
    const title = selectedDocument?.title ?? activeDocumentId;
    if (
      !window.confirm(
        localization.documents.deleteConfirm.replace("{title}", title),
      )
    ) {
      return;
    }

    try {
      const nextDocumentId = documents.data?.find(
        (document) => document.id !== activeDocumentId,
      )?.id;
      await deleteDocument.mutateAsync();
      await refreshDocumentQueries();
      setSelectedDocumentId(nextDocumentId);
      setSourceActionsDialog(undefined);
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  function openSourceActionsDialog(documentId: string) {
    setSelectedDocumentId(documentId);
    deleteDocument.reset();
    setSourceActionsDialog({ documentId });
  }

  function handleSourceActionsDialogOpenChange(open: boolean) {
    if (open) return;
    setSourceActionsDialog(undefined);
    deleteDocument.reset();
  }

  function selectPersonalSourceSpace(knowledgeBaseId: string) {
    if (isKnowledgeBaseSelectionLocked) return;
    setOptimisticSourceId(knowledgeBaseId);
    setDocumentDestination("personal");
    setSelectedKnowledgeBaseId(knowledgeBaseId);
    setSelectedDocumentId(undefined);
    setIsSourceSpaceBrowserOpen(false);
  }

  function selectSystemSourceSpace(knowledgeBaseId: string) {
    if (isKnowledgeBaseSelectionLocked) return;
    setOptimisticSourceId(knowledgeBaseId);
    setDocumentDestination("system");
    setSelectedSystemKnowledgeBaseId(knowledgeBaseId);
    setSelectedDocumentId(undefined);
    setIsSourceSpaceBrowserOpen(false);
  }

  function selectTeamGroup(groupId: string) {
    if (isKnowledgeBaseSelectionLocked) return;
    const groupSourceSpaces = groupKnowledgeBasesForGroup(
      knowledgeBases.data ?? [],
      groupId,
    );
    setOptimisticSourceId(groupId);
    setDocumentDestination("team");
    setSelectedTeamGroupId(groupId);
    setSelectedTeamKnowledgeBaseId(groupSourceSpaces[0]?.id);
    setSelectedDocumentId(undefined);
    setIsSourceSpaceBrowserOpen(false);
  }

  function selectTeamSourceSpace(groupId: string, knowledgeBaseId: string) {
    if (isKnowledgeBaseSelectionLocked) return;
    setOptimisticSourceId(knowledgeBaseId);
    setDocumentDestination("team");
    setSelectedTeamGroupId(groupId);
    setSelectedTeamKnowledgeBaseId(knowledgeBaseId);
    setSelectedDocumentId(undefined);
    setIsSourceSpaceBrowserOpen(false);
  }

  return (
    <>
      <PageCard
        fullWidth
        title={localization.documents.title}
        description={localization.documents.description}
      >
        <div className="flex min-h-[calc(100dvh-11rem)] flex-col overflow-hidden rounded-3xl border border-cal-hairline bg-white shadow-[0_18px_60px_rgb(20_22_23/0.08)] lg:grid lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="hidden min-h-0 border-r border-cal-hairline lg:flex">
            <OnboardingTarget
              id="documents.knowledge-destination"
              className="flex min-h-0 flex-1"
            >
              <SourceSpaceTree
                localization={localization}
                sourceSpaceCount={sourceSpaceCount}
                knowledgeBasesIsLoading={knowledgeBases.isLoading}
                knowledgeBasesError={knowledgeBases.error}
                groupsError={groups.error}
                documentKnowledgeBases={documentKnowledgeBases}
                systemKnowledgeBases={systemKnowledgeBases}
                allKnowledgeBases={knowledgeBases.data ?? []}
                teamGroups={teamGroups}
                canManageSystemKnowledge={canManageSystemKnowledge}
                isKnowledgeBaseSelectionLocked={isKnowledgeBaseSelectionLocked}
                effectiveDocumentDestination={effectiveDocumentDestination}
                activeKnowledgeBaseId={activeKnowledgeBaseId}
                activeSystemKnowledgeBaseId={activeSystemKnowledgeBaseId}
                activeTeamGroupId={activeTeamGroupId}
                activeTeamKnowledgeBaseId={activeTeamKnowledgeBaseId}
                onCreateSourceSpace={() =>
                  setIsCreateSourceSpaceDialogOpen(true)
                }
                onSelectPersonalSourceSpace={selectPersonalSourceSpace}
                onSelectSystemSourceSpace={selectSystemSourceSpace}
                onSelectTeamGroup={selectTeamGroup}
                onSelectTeamSourceSpace={selectTeamSourceSpace}
              />
            </OnboardingTarget>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-cal-hairline bg-cal-canvas/60 px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 text-left">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
                    <DatabaseIcon className="size-3.5" />
                    <span>
                      {effectiveDocumentDestination === "team"
                        ? localization.common.scopeGroup
                        : effectiveDocumentDestination === "system"
                          ? localization.common.scopeSystem
                          : localization.common.scopePersonal}
                    </span>
                  </div>
                  <h2 className="mt-2 truncate text-2xl font-semibold tracking-[-0.03em] text-cal-ink">
                    {activeSourceSpace?.name ??
                      localization.documents.noSelectedSourceSpaceTitle}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-cal-muted">
                    {localization.documents.sourceCountLabel
                      .replace("{count}", String(documents.data?.length ?? 0))
                      .replace("{ready}", String(readyDocumentCount))}
                  </p>
                  {effectiveDocumentDestination === "system" ? (
                    <p className="mt-2 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                      {localization.documents.systemSourcePublicWarning}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="lg:hidden"
                    onClick={() => setIsSourceSpaceBrowserOpen(true)}
                  >
                    <ListTreeIcon />
                    {localization.documents.browseSourceSpacesAction}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateSourceSpaceDialogOpen(true)}
                  >
                    <PlusIcon />
                    {localization.documents.addSourceSpaceAction}
                  </Button>
                  <OnboardingTarget id="documents.upload-action">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsFileUploadDialogOpen(true)}
                      disabled={!hasActiveKnowledgeBase}
                    >
                      <UploadIcon />
                      {localization.documents.uploadFilesAction}
                    </Button>
                  </OnboardingTarget>
                  <Button
                    type="button"
                    onClick={() => setIsTextSourceDialogOpen(true)}
                    disabled={!hasActiveKnowledgeBase}
                  >
                    <FileTextIcon />
                    {localization.documents.addTextSourceAction}
                  </Button>
                </div>
              </div>
              {(documents.data?.length ?? 0) > 0 ? (
                <div className="mt-4 flex flex-col gap-3 rounded-xl border border-cal-hairline bg-white p-4 text-sm text-cal-muted sm:flex-row sm:items-center sm:justify-between">
                  <p className="leading-6">
                    {localization.documents.askSourcesHint}
                  </p>
                  <Button
                    nativeButton={false}
                    render={<Link href="/chat" />}
                    size="sm"
                  >
                    {localization.documents.askSourcesAction}
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="grid min-h-0 flex-1 gap-4 overflow-auto bg-cal-canvas/40 p-4 xl:p-6">
              <section className="flex min-h-[28rem] min-w-0 flex-col rounded-2xl border border-cal-hairline bg-white shadow-[0_10px_30px_rgb(20_22_23/0.06)]">
                <div className="flex shrink-0 flex-col gap-3 border-b border-cal-hairline p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-cal-ink">
                      {localization.documents.sourceTableTitle}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-cal-muted">
                      {localization.documents.sourceTableDescription}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-cal-hairline bg-cal-canvas px-3 py-2 text-sm text-cal-muted">
                    <SearchIcon className="size-4" />
                    <span>{localization.documents.sourceTableSearchHint}</span>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  <DocumentsTable
                    documents={documents}
                    activeDocumentId={activeDocumentId}
                    activeIngestionDocumentIds={activeIngestionDocumentIds}
                    localization={localization}
                    onOpenSourceActions={openSourceActionsDialog}
                  />
                </div>
              </section>
            </div>
          </div>
        </div>
      </PageCard>

      <SourceActionsDialog
        open={Boolean(sourceActionsDialog)}
        onOpenChange={handleSourceActionsDialogOpenChange}
        localization={localization}
        activeDocument={activeDocument}
        activeDocumentId={activeDocumentId}
        displayKnowledgeBaseId={displayKnowledgeBaseId}
        activeDocumentHasIngestion={activeDocumentHasIngestion}
        ingest={ingest}
        deleteDocument={deleteDocument}
        extractionRuns={extractionRuns}
        onDeleteDocument={handleDeleteDocument}
      />

      <Sheet
        open={isSourceSpaceBrowserOpen}
        onOpenChange={setIsSourceSpaceBrowserOpen}
      >
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-full max-w-sm gap-0 border-r border-cal-hairline bg-white p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{localization.documents.sourceSpacesTitle}</SheetTitle>
            <SheetDescription>
              {localization.documents.sourceSpacesSheetDescription}
            </SheetDescription>
          </SheetHeader>
          <SourceSpaceTree
            localization={localization}
            sourceSpaceCount={sourceSpaceCount}
            knowledgeBasesIsLoading={knowledgeBases.isLoading}
            knowledgeBasesError={knowledgeBases.error}
            groupsError={groups.error}
            documentKnowledgeBases={documentKnowledgeBases}
            systemKnowledgeBases={systemKnowledgeBases}
            allKnowledgeBases={knowledgeBases.data ?? []}
            teamGroups={teamGroups}
            canManageSystemKnowledge={canManageSystemKnowledge}
            isKnowledgeBaseSelectionLocked={isKnowledgeBaseSelectionLocked}
            effectiveDocumentDestination={effectiveDocumentDestination}
            activeKnowledgeBaseId={activeKnowledgeBaseId}
            activeSystemKnowledgeBaseId={activeSystemKnowledgeBaseId}
            activeTeamGroupId={activeTeamGroupId}
            activeTeamKnowledgeBaseId={activeTeamKnowledgeBaseId}
            onCreateSourceSpace={() => setIsCreateSourceSpaceDialogOpen(true)}
            onSelectPersonalSourceSpace={selectPersonalSourceSpace}
            onSelectSystemSourceSpace={selectSystemSourceSpace}
            onSelectTeamGroup={selectTeamGroup}
            onSelectTeamSourceSpace={selectTeamSourceSpace}
          />
        </SheetContent>
      </Sheet>

      <Dialog
        open={isCreateSourceSpaceDialogOpen}
        onOpenChange={setIsCreateSourceSpaceDialogOpen}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {localization.documents.addSourceSpaceAction}
            </DialogTitle>
            <DialogDescription>
              {localization.documents.createSourceSpaceDialogDescription}
            </DialogDescription>
          </DialogHeader>
          <SourceSpaceCreateForm
            title={
              shouldShowFirstSourceSpaceForm
                ? localization.documents.createFirstSourceSpaceTitle
                : localization.documents.createSourceSpaceTitle
            }
            description={
              shouldShowFirstSourceSpaceForm
                ? localization.documents.createFirstSourceSpaceDescription
                : localization.documents.createSourceSpaceDescription
            }
            localization={localization}
            sourceSpaceName={sourceSpaceName}
            sourceSpaceScope={sourceSpaceScope}
            sourceSpaceGroupId={sourceSpaceGroupId}
            sourceSpaceGroupOptions={sourceSpaceGroupOptions}
            canManageSystemKnowledge={canManageSystemKnowledge}
            groupsIsLoading={groups.isLoading}
            isCreatingTeamSourceSpace={isCreatingTeamSourceSpace}
            isCreatingSystemSourceSpace={isCreatingSystemSourceSpace}
            isKnowledgeBaseSelectionLocked={isKnowledgeBaseSelectionLocked}
            isCreateSourceSpaceDisabled={isCreateSourceSpaceDisabled}
            createKnowledgeBaseError={createKnowledgeBase.error}
            onSubmit={handleCreateSourceSpace}
            onNameChange={setSourceSpaceName}
            onScopeChange={(nextScope) => {
              setSourceSpaceScope(nextScope);
              if (nextScope !== "group") setSourceSpaceGroupId("");
            }}
            onGroupChange={setSourceSpaceGroupId}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={isTextSourceDialogOpen}
        onOpenChange={setIsTextSourceDialogOpen}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{localization.documents.textCreateTitle}</DialogTitle>
            <DialogDescription>
              {localization.documents.contentHint}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="grid gap-4">
            <Field label={localization.documents.titleLabel}>
              <input
                className={inputClassName}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </Field>
            <Field
              label={localization.documents.contentLabel}
              hint={localization.documents.contentHint}
            >
              <textarea
                className={`${inputClassName} min-h-48`}
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
            </Field>
            {effectiveDocumentDestination !== "team" && createDocument.error ? (
              <ErrorState error={createDocument.error} />
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTextSourceDialogOpen(false)}
              >
                {localization.common.cancel}
              </Button>
              <Button
                type="submit"
                disabled={
                  isPreparingTextSource ||
                  (effectiveDocumentDestination !== "team" &&
                    createDocument.isPending) ||
                  !title.trim() ||
                  !hasActiveKnowledgeBase
                }
              >
                {isPreparingTextSource
                  ? localization.documents.ingestionLoading
                  : localization.documents.createButton}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isFileUploadDialogOpen}
        onOpenChange={setIsFileUploadDialogOpen}
      >
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
                onClick={() => setIsFileUploadDialogOpen(false)}
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
    </>
  );
}

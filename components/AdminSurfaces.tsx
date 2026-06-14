"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DatabaseIcon,
  FileTextIcon,
  FolderIcon,
  ListTreeIcon,
  NetworkIcon,
  PlusIcon,
  SearchIcon,
  UploadIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AgentMarkdown } from "@/components/AgentMarkdown";
import { OnboardingTarget } from "@/components/onboarding/OnboardingTarget";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import { useCurrentUser } from "@/hooks/use-auth";
import {
  useApprovePublishRequest,
  useCancelGroupInvitation,
  useCreateGroup,
  useCreateGroupInvitation,
  useCreatePublishRequest,
  useGroupInvitations,
  useGroupMembers,
  useGroups,
  usePublishRequestSource,
  usePublishRequests,
  useRejectPublishRequest,
  useResendGroupInvitation,
  useUpdateGroupInvitation,
  useUpdateMember,
} from "@/hooks/use-groups";
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
  documentUploadConcurrencyFromHealth,
  type ExtractionRun,
  type GroupInvitation,
  type GroupMember,
  type KnowledgeBase,
  type KnowledgePublishRequest,
  type KnowledgePublishRequestSourceDocument,
} from "@/model/my-agents";
import { myAgentsAPI } from "@/services/my-agents";
import {
  canAutoApproveTeamDocumentUpload,
  groupKnowledgeBasesForGroup,
  writableDocumentKnowledgeBases,
} from "./document-knowledge-base";
import { Field, inputClassName, selectClassName } from "./Field";
import {
  buildKnowledgeBaseCreateRequest,
  type KnowledgeBaseCreationScope,
} from "./knowledge-base-create";
import { EmptyState, ErrorState, Pill } from "./Status";

type GroupRole = "owner" | "admin" | "editor" | "viewer";
type PublishSourceKind = "document" | "knowledge-base";
type DocumentDestination = "personal" | "team";

type SourcesSurfaceProps = {
  initialSourceId?: string;
};

type SourceActionsDialogState = {
  documentId: string;
};

type UploadQueueStatus =
  | "selected"
  | "uploading"
  | "uploaded"
  | "queued"
  | "ingesting"
  | "publishing"
  | "completed"
  | "failed";

type StatusTone = NonNullable<React.ComponentProps<typeof Pill>["tone"]>;

type UploadQueueItem = {
  localId: string;
  file: File;
  title: string;
  status: UploadQueueStatus;
  progressPercent: number;
  documentId?: string;
  extractionRunId?: string;
  error?: string;
};

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PPTX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
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

function fileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex < 0) return "";
  return fileName.slice(dotIndex).toLowerCase();
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

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function safeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function knowledgeSourceHref(sourceId: string) {
  return `/knowledge/${encodeURIComponent(sourceId)}`;
}

function decodeRouteSegment(segment?: string) {
  if (!segment) return undefined;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function SourcesSurface({ initialSourceId }: SourcesSurfaceProps = {}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const groups = useGroups();
  const knowledgeBases = useKnowledgeBases();
  const currentUser = useCurrentUser();
  const createKnowledgeBase = useCreateKnowledgeBase();
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
  const [optimisticSourceId, setOptimisticSourceId] = useState<string>();
  const [sourceSpaceName, setSourceSpaceName] = useState("");
  const [sourceSpaceScope, setSourceSpaceScope] =
    useState<KnowledgeBaseCreationScope>("personal");
  const [sourceSpaceGroupId, setSourceSpaceGroupId] = useState("");
  const documentKnowledgeBases = writableDocumentKnowledgeBases(
    knowledgeBases.data ?? [],
    currentUser.data?.id,
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
  const routeTeamGroup = teamGroups.find(
    (group) => group.id === effectiveRouteSourceId,
  );
  const routeDocumentDestination: DocumentDestination | undefined =
    routePersonalKnowledgeBase
      ? "personal"
      : routeTeamKnowledgeBase || routeTeamGroup
        ? "team"
        : undefined;
  const effectiveDocumentDestination =
    routeDocumentDestination ?? documentDestination;
  const routeTeamGroupId =
    routeTeamKnowledgeBase?.group_id ?? routeTeamGroup?.id;
  const createSourceSpacePayload = buildKnowledgeBaseCreateRequest({
    groupId: sourceSpaceGroupId,
    name: sourceSpaceName,
    scope: sourceSpaceScope,
  });
  const isCreatingTeamSourceSpace = sourceSpaceScope === "group";
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
      : activeKnowledgeBaseId;
  const personalWriteKnowledgeBaseId =
    effectiveDocumentDestination === "personal"
      ? activeKnowledgeBaseId
      : undefined;
  const documents = useKnowledgeBaseDocuments(displayKnowledgeBaseId);
  const createDocument = useCreateKnowledgeBaseDocument(
    personalWriteKnowledgeBaseId,
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
      : Boolean(personalWriteKnowledgeBaseId);
  const activeSourceSpace =
    effectiveDocumentDestination === "team"
      ? activeGroupKnowledgeBases.find(
          (knowledgeBase) => knowledgeBase.id === activeTeamKnowledgeBaseId,
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
    documentKnowledgeBases.length + visibleTeamSourceSpaceCount;

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
    (isCreatingTeamSourceSpace && sourceSpaceGroupOptions.length === 0);
  const shouldShowFirstSourceSpaceForm =
    !knowledgeBases.isLoading && documentKnowledgeBases.length === 0;
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
    documentId: string,
    runId: string,
    localId: string,
  ) {
    let latestRun: ExtractionRun | null = null;
    while (true) {
      if (!personalWriteKnowledgeBaseId) {
        throw new Error(localization.documents.knowledgeBaseRequired);
      }
      const run = await myAgentsAPI.documents.extractionRunInKnowledgeBase(
        personalWriteKnowledgeBaseId,
        documentId,
        runId,
      );
      latestRun = run;
      updateQueueItem(localId, {
        extractionRunId: run.id,
        status: run.status === "failed" ? "failed" : "ingesting",
        progressPercent: 0,
        error: run.error ?? undefined,
      });
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
            : personalWriteKnowledgeBaseId;
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
        if (effectiveDocumentDestination === "personal") {
          setSelectedDocumentId(uploaded.id);
        }
        updateQueueItem(item.localId, {
          documentId: uploaded.id,
          status: "uploaded",
          progressPercent: 0,
        });
        if (effectiveDocumentDestination === "personal") {
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

      const ingestionKnowledgeBaseId = personalWriteKnowledgeBaseId;
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
        : await pollExtractionRun(documentId, run.id, item.localId);

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
    try {
      if (!hasActiveKnowledgeBase) return;
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
        setSelectedDocumentId(created.id);
      }
      setTitle("");
      setContent("");
      setIsTextSourceDialogOpen(false);
    } catch {
      // React Query stores the API error on the mutation; render it below.
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

  function renderSourceSpaceCreateForm({
    description,
    title,
  }: {
    description: string;
    title: string;
  }) {
    return (
      <form
        onSubmit={handleCreateSourceSpace}
        className="grid gap-3 rounded-xl border border-cal-hairline bg-cal-canvas p-3"
      >
        <div>
          <h3 className="font-semibold text-cal-ink">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-cal-muted">{description}</p>
        </div>
        <Field label={localization.knowledge.nameLabel}>
          <input
            className={inputClassName}
            value={sourceSpaceName}
            onChange={(event) => setSourceSpaceName(event.target.value)}
            required
          />
        </Field>
        <div className="grid gap-3 md:grid-cols-2 md:items-start">
          <Field
            className="min-w-0"
            label={localization.knowledge.scopeLabel}
            hint={localization.knowledge.scopeHint}
          >
            <select
              className={selectClassName}
              value={sourceSpaceScope}
              onChange={(event) => {
                const nextScope = event.target
                  .value as KnowledgeBaseCreationScope;
                setSourceSpaceScope(nextScope);
                if (nextScope === "personal") setSourceSpaceGroupId("");
              }}
              disabled={isKnowledgeBaseSelectionLocked}
            >
              <option value="personal">
                {localization.knowledge.scopePersonalOption}
              </option>
              <option value="group">
                {localization.knowledge.scopeGroupOption}
              </option>
            </select>
          </Field>
          <Field
            className="min-w-0"
            label={localization.knowledge.groupLabel}
            hint={
              isCreatingTeamSourceSpace
                ? localization.knowledge.groupHint
                : localization.knowledge.groupDisabledHint
            }
          >
            <select
              aria-invalid={
                isCreatingTeamSourceSpace && !sourceSpaceGroupId
                  ? true
                  : undefined
              }
              className={selectClassName}
              disabled={
                !isCreatingTeamSourceSpace ||
                groups.isLoading ||
                isKnowledgeBaseSelectionLocked
              }
              required={isCreatingTeamSourceSpace}
              value={sourceSpaceGroupId}
              onChange={(event) => setSourceSpaceGroupId(event.target.value)}
            >
              <option value="">
                {groups.isLoading
                  ? localization.knowledge.loadingGroupsOption
                  : localization.knowledge.groupPlaceholder}
              </option>
              {sourceSpaceGroupOptions.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} · {localization.groups.roles[group.role]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="rounded-lg border border-cal-hairline bg-cal-surface-soft p-3 text-xs leading-5 text-cal-muted">
          {localization.knowledge.scopeBoundaryNote}
        </p>
        {isCreatingTeamSourceSpace &&
        !groups.isLoading &&
        sourceSpaceGroupOptions.length === 0 ? (
          <EmptyState
            title={localization.knowledge.noGroupsTitle}
            description={localization.knowledge.noGroupsDescription}
          />
        ) : null}
        {createKnowledgeBase.error ? (
          <ErrorState error={createKnowledgeBase.error} />
        ) : null}
        <Button type="submit" disabled={isCreateSourceSpaceDisabled}>
          {isCreatingTeamSourceSpace
            ? localization.knowledge.createGroupButton
            : localization.knowledge.createPersonalButton}
        </Button>
      </form>
    );
  }

  function selectPersonalSourceSpace(knowledgeBaseId: string) {
    if (isKnowledgeBaseSelectionLocked) return;
    setOptimisticSourceId(knowledgeBaseId);
    setDocumentDestination("personal");
    setSelectedKnowledgeBaseId(knowledgeBaseId);
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

  function renderSourceSpaceButton({
    knowledgeBase,
    active,
    onSelect,
  }: {
    knowledgeBase: KnowledgeBase;
    active: boolean;
    onSelect: () => void;
  }) {
    return (
      <Link
        key={knowledgeBase.id}
        href={knowledgeSourceHref(knowledgeBase.id)}
        scroll={false}
        aria-current={active ? "page" : undefined}
        aria-disabled={isKnowledgeBaseSelectionLocked ? true : undefined}
        onClick={(event) => {
          if (isKnowledgeBaseSelectionLocked) {
            event.preventDefault();
            return;
          }
          onSelect();
        }}
        className={cn(
          "group flex w-full min-w-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors aria-disabled:pointer-events-none aria-disabled:opacity-60",
          active
            ? "bg-cal-primary text-white shadow-[0_10px_24px_rgb(20_33_61/0.16)]"
            : "text-cal-ink hover:bg-cal-surface-soft",
        )}
      >
        <FolderIcon className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-medium">
          {knowledgeBase.name}
        </span>
      </Link>
    );
  }

  function renderSourceSpaceTree() {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-white">
        <div className="shrink-0 border-b border-cal-hairline px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-cal-ink">
                {localization.documents.sourceSpacesTitle}
              </h2>
              <p className="mt-1 text-xs leading-5 text-cal-muted">
                {localization.documents.sourceSpacesDescription.replace(
                  "{count}",
                  String(sourceSpaceCount),
                )}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={localization.documents.addSourceSpaceAction}
              onClick={() => setIsCreateSourceSpaceDialogOpen(true)}
            >
              <PlusIcon />
            </Button>
          </div>
          {isKnowledgeBaseSelectionLocked ? (
            <p className="mt-3 rounded-lg bg-cal-surface-soft px-3 py-2 text-xs leading-5 text-cal-muted">
              {localization.documents.knowledgeBaseLockedHint}
            </p>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {knowledgeBases.isLoading ? (
            <p className="px-3 text-sm text-cal-muted">
              {localization.common.loading}
            </p>
          ) : null}
          {knowledgeBases.error ? (
            <ErrorState error={knowledgeBases.error} />
          ) : null}
          {!knowledgeBases.isLoading && sourceSpaceCount === 0 ? (
            <div className="px-1">
              <EmptyState
                title={localization.documents.noKnowledgeBaseTitle}
                description={localization.documents.noKnowledgeBaseDescription}
              />
              <Button
                type="button"
                className="mt-3 w-full"
                onClick={() => setIsCreateSourceSpaceDialogOpen(true)}
              >
                {localization.documents.addSourceSpaceAction}
              </Button>
            </div>
          ) : null}
          {documentKnowledgeBases.length > 0 ? (
            <section className="grid gap-1">
              <h3 className="px-3 pb-1 text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
                {localization.documents.personalSourceSpacesTitle}
              </h3>
              {documentKnowledgeBases.map((knowledgeBase) =>
                renderSourceSpaceButton({
                  knowledgeBase,
                  active:
                    effectiveDocumentDestination === "personal" &&
                    knowledgeBase.id === activeKnowledgeBaseId,
                  onSelect: () => selectPersonalSourceSpace(knowledgeBase.id),
                }),
              )}
            </section>
          ) : null}
          {teamGroups.length > 0 ? (
            <section className="mt-5 grid gap-3">
              <h3 className="px-3 text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
                {localization.documents.teamSourceSpacesTitle}
              </h3>
              {teamGroups.map((group) => {
                const groupSourceSpaces = groupKnowledgeBasesForGroup(
                  knowledgeBases.data ?? [],
                  group.id,
                );

                return (
                  <div key={group.id} className="grid gap-1">
                    <Link
                      href={knowledgeSourceHref(group.id)}
                      scroll={false}
                      aria-current={
                        effectiveDocumentDestination === "team" &&
                        activeTeamGroupId === group.id
                          ? "page"
                          : undefined
                      }
                      aria-disabled={
                        isKnowledgeBaseSelectionLocked ? true : undefined
                      }
                      onClick={(event) => {
                        if (isKnowledgeBaseSelectionLocked) {
                          event.preventDefault();
                          return;
                        }
                        selectTeamGroup(group.id);
                      }}
                      className={cn(
                        "flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors aria-disabled:pointer-events-none aria-disabled:opacity-60",
                        effectiveDocumentDestination === "team" &&
                          activeTeamGroupId === group.id
                          ? "bg-cal-surface-soft text-cal-ink"
                          : "text-cal-muted hover:bg-cal-surface-soft/80 hover:text-cal-ink",
                      )}
                    >
                      <NetworkIcon className="size-3.5 shrink-0" />
                      <span className="truncate">{group.name}</span>
                      <span className="shrink-0">
                        · {localization.groups.roles[group.role]}
                      </span>
                    </Link>
                    {groupSourceSpaces.length > 0 ? (
                      groupSourceSpaces.map((knowledgeBase) =>
                        renderSourceSpaceButton({
                          knowledgeBase,
                          active:
                            effectiveDocumentDestination === "team" &&
                            knowledgeBase.id === activeTeamKnowledgeBaseId,
                          onSelect: () =>
                            selectTeamSourceSpace(group.id, knowledgeBase.id),
                        }),
                      )
                    ) : (
                      <p className="px-3 py-2 text-xs leading-5 text-cal-muted">
                        {localization.documents.noTeamKnowledgeBaseDescription}
                      </p>
                    )}
                  </div>
                );
              })}
            </section>
          ) : null}
          {groups.error ? <ErrorState error={groups.error} /> : null}
        </div>
      </div>
    );
  }

  function renderDocumentsTable() {
    return (
      <Table className="min-w-[56rem]">
        <TableHeader>
          <TableRow className="border-cal-hairline bg-cal-surface-soft hover:bg-cal-surface-soft">
            <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
              {localization.documents.sourceTableSource}
            </TableHead>
            <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
              {localization.documents.sourceTableType}
            </TableHead>
            <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
              {localization.documents.sourceTableStatus}
            </TableHead>
            <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
              {localization.documents.sourceTableDetails}
            </TableHead>
            <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
              {localization.documents.sourceTableActions}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.isLoading ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={5}
                className="px-4 py-14 text-center text-sm text-cal-muted"
              >
                {localization.common.loading}
              </TableCell>
            </TableRow>
          ) : null}
          {documents.error ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="px-4 py-6 whitespace-normal">
                <ErrorState error={documents.error} />
              </TableCell>
            </TableRow>
          ) : null}
          {!documents.isLoading &&
          !documents.error &&
          (documents.data?.length ?? 0) === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="px-4 py-12 whitespace-normal">
                <EmptyState
                  title={localization.documents.empty}
                  description={localization.common.emptyListDescription}
                />
              </TableCell>
            </TableRow>
          ) : null}
          {documents.data?.map((document) => {
            const isActive = document.id === activeDocumentId;
            const isPreparing = activeIngestionDocumentIds.has(document.id);

            return (
              <TableRow
                key={document.id}
                data-state={isActive ? "selected" : undefined}
                className={cn(
                  "border-cal-hairline bg-white",
                  isActive
                    ? "bg-cal-surface-soft/80 hover:bg-cal-surface-soft"
                    : "",
                )}
              >
                <TableCell className="px-4 py-4 whitespace-normal">
                  <button
                    type="button"
                    onClick={() => openSourceActionsDialog(document.id)}
                    className="grid min-w-0 gap-1 text-left"
                    aria-label={localization.documents.openSourceDetails.replace(
                      "{title}",
                      document.title,
                    )}
                  >
                    <span className="break-words text-[15px] font-semibold leading-6 text-cal-ink">
                      {document.title}
                    </span>
                    <span className="break-all text-xs text-cal-muted">
                      {document.id}
                    </span>
                  </button>
                </TableCell>
                <TableCell className="px-4 py-4 whitespace-normal text-sm text-cal-body">
                  {documentSourceLabel(document, localization.documents)}
                </TableCell>
                <TableCell className="px-4 py-4 whitespace-nowrap">
                  {isPreparing ? (
                    <InlineLoadingIndicator
                      label={localization.documents.ingestionLoading}
                    />
                  ) : (
                    <Pill tone="green">
                      {localization.documents.sourceReadyStatus}
                    </Pill>
                  )}
                </TableCell>
                <TableCell className="px-4 py-4 whitespace-normal text-sm text-cal-muted">
                  {documentMeta(document, localization)}
                </TableCell>
                <TableCell className="px-4 py-4 whitespace-normal">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openSourceActionsDialog(document.id)}
                    aria-label={localization.documents.sourceRowActionsLabel.replace(
                      "{title}",
                      document.title,
                    )}
                  >
                    {localization.documents.sourceRowActions}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  function renderSourceActionsDialog() {
    return (
      <Dialog
        open={Boolean(sourceActionsDialog)}
        onOpenChange={handleSourceActionsDialogOpenChange}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {localization.documents.sourceActionsTitle}
            </DialogTitle>
            <DialogDescription>
              {localization.documents.sourceActionsDescription}
            </DialogDescription>
          </DialogHeader>

          {activeDocument ? (
            <div className="grid gap-3 rounded-xl border border-cal-hairline bg-cal-surface-soft p-3 text-sm">
              <div>
                <p className="break-words font-medium text-cal-ink">
                  {activeDocument.title}
                </p>
                <p className="mt-1 break-words text-xs text-cal-muted">
                  {documentMeta(activeDocument, localization)}
                </p>
              </div>
              <details className="rounded-lg bg-cal-canvas p-2 text-xs text-cal-muted">
                <summary className="cursor-pointer font-medium text-cal-ink">
                  {localization.documents.advancedDetails}
                </summary>
                <p className="mt-2 break-all font-mono">
                  ID: {activeDocument.id}
                </p>
              </details>
            </div>
          ) : (
            <EmptyState
              title={localization.documents.noSelectedTitle}
              description={localization.documents.noSelectedDescription}
            />
          )}

          <div className="grid gap-3 rounded-xl border border-cal-hairline bg-cal-canvas p-3">
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
          </div>

          <div className="grid gap-3 rounded-xl border border-cal-error/20 bg-cal-error/5 p-3">
            <div>
              <h3 className="font-semibold text-cal-error">
                {localization.documents.deleteTitle}
              </h3>
              <p className="mt-1 text-sm leading-6 text-cal-muted">
                {localization.documents.deleteDescription}
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteDocument}
              disabled={!activeDocumentId || deleteDocument.isPending}
            >
              {localization.documents.deleteButton}
            </Button>
            {deleteDocument.error ? (
              <ErrorState error={deleteDocument.error} />
            ) : null}
          </div>

          <details className="border-t border-cal-hairline pt-4">
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
                  className="rounded-lg bg-cal-surface-soft p-3 text-sm"
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
                    {run.relationship_count} {localization.common.relationships}
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

          <DialogFooter className="sm:justify-end">
            <DialogClose render={<Button type="button" variant="outline" />}>
              {localization.common.close}
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
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
              {renderSourceSpaceTree()}
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
                  {renderDocumentsTable()}
                </div>
              </section>
            </div>
          </div>
        </div>
      </PageCard>

      {renderSourceActionsDialog()}

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
          {renderSourceSpaceTree()}
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
          {renderSourceSpaceCreateForm({
            title: shouldShowFirstSourceSpaceForm
              ? localization.documents.createFirstSourceSpaceTitle
              : localization.documents.createSourceSpaceTitle,
            description: shouldShowFirstSourceSpaceForm
              ? localization.documents.createFirstSourceSpaceDescription
              : localization.documents.createSourceSpaceDescription,
          })}
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
            {effectiveDocumentDestination === "personal" &&
            createDocument.error ? (
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
                  (effectiveDocumentDestination === "personal" &&
                    createDocument.isPending) ||
                  !title.trim() ||
                  !hasActiveKnowledgeBase
                }
              >
                {localization.documents.createButton}
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

function UploadQueueRow({
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

function uploadStatusTone(status: UploadQueueStatus): StatusTone {
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

function extractionRunTone(status: string): StatusTone {
  if (status === "completed") return "green";
  if (status === "failed") return "rose";
  if (status === "pending") return "amber";
  return "blue";
}

function isActiveExtractionRunStatus(status: string) {
  return status === "pending" || status === "running";
}

function isUploadQueueItemBusy(status: UploadQueueStatus) {
  return (
    status === "uploading" ||
    status === "queued" ||
    status === "ingesting" ||
    status === "publishing"
  );
}

function InlineLoadingIndicator({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-cal-muted">
      <span
        aria-hidden="true"
        className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
      />
      {label}
    </span>
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

export function GroupsSurface() {
  const groups = useGroups();
  const knowledgeBases = useKnowledgeBases();
  const currentUser = useCurrentUser();
  const createGroup = useCreateGroup();
  const [name, setName] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>();
  const [isGroupBrowserOpen, setIsGroupBrowserOpen] = useState(false);
  const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [invitationAction, setInvitationAction] = useState<
    | { invitation: GroupInvitation; type: "update" | "resend" | "cancel" }
    | undefined
  >();
  const [memberAction, setMemberAction] = useState<GroupMember>();
  const [publishReviewRequest, setPublishReviewRequest] =
    useState<KnowledgePublishRequest>();
  const activeGroupId = selectedGroupId ?? groups.data?.[0]?.id;
  const activeGroup = groups.data?.find((group) => group.id === activeGroupId);
  const canManageMembers =
    activeGroup?.role === "owner" || activeGroup?.role === "admin";
  const canReviewPublishRequests =
    activeGroup?.role === "owner" || activeGroup?.role === "admin";
  const activeGroupKnowledgeBases = (knowledgeBases.data ?? []).filter(
    (knowledgeBase) =>
      knowledgeBase.scope === "group" &&
      (!activeGroupId || knowledgeBase.group_id === activeGroupId),
  );
  const publishablePersonalKnowledgeBases = writableDocumentKnowledgeBases(
    knowledgeBases.data ?? [],
    currentUser.data?.id,
  );
  const publishRequests = usePublishRequests(activeGroupId);
  const publishReviewSource = usePublishRequestSource(
    activeGroupId,
    publishReviewRequest?.id,
    Boolean(publishReviewRequest) && canReviewPublishRequests,
  );
  const createPublishRequest = useCreatePublishRequest(activeGroupId);
  const approvePublishRequest = useApprovePublishRequest(activeGroupId);
  const rejectPublishRequest = useRejectPublishRequest(activeGroupId);
  const invitations = useGroupInvitations(activeGroupId, canManageMembers);
  const members = useGroupMembers(activeGroupId, canManageMembers);
  const createInvitation = useCreateGroupInvitation(activeGroupId);
  const [invitationEmail, setInvitationEmail] = useState("");
  const [invitationRole, setInvitationRole] = useState<GroupRole>("viewer");
  const [invitationActionId, setInvitationActionId] = useState("");
  const [invitationActionRole, setInvitationActionRole] =
    useState<GroupRole>("viewer");
  const updateInvitation = useUpdateGroupInvitation(
    activeGroupId,
    invitationActionId,
  );
  const resendInvitation = useResendGroupInvitation(
    activeGroupId,
    invitationActionId,
  );
  const cancelInvitation = useCancelGroupInvitation(
    activeGroupId,
    invitationActionId,
  );
  const [updateUserId, setUpdateUserId] = useState("");
  const [updateRole, setUpdateRole] = useState<GroupRole>("viewer");
  const [publishSourceKind, setPublishSourceKind] =
    useState<PublishSourceKind>("knowledge-base");
  const [sourceDocumentId, setSourceDocumentId] = useState("");
  const [sourceKnowledgeBaseId, setSourceKnowledgeBaseId] = useState("");
  const [targetKnowledgeBaseId, setTargetKnowledgeBaseId] = useState("");
  const updateMember = useUpdateMember(activeGroupId, updateUserId);
  const { localization } = useLocalization((state) => state.localization.admin);
  const groupCount = groups.data?.length ?? 0;
  const invitationCount = invitations.data?.length ?? 0;
  const memberCount = members.data?.length ?? 0;
  const publishRequestCount = publishRequests.data?.length ?? 0;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const created = await createGroup.mutateAsync({ name });
      setName("");
      setSelectedGroupId(created.id);
      setIsCreateGroupDialogOpen(false);
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  async function handleCreateInvitation(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!canManageMembers) return;
    try {
      await createInvitation.mutateAsync({
        email: invitationEmail,
        role: invitationRole,
      });
      setInvitationEmail("");
      setIsInviteDialogOpen(false);
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  async function handleUpdateInvitation(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!canManageMembers || !invitationActionId.trim()) return;
    try {
      await updateInvitation.mutateAsync({ role: invitationActionRole });
      setInvitationAction(undefined);
      setInvitationActionId("");
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  async function handleResendInvitation() {
    if (!canManageMembers || !invitationActionId.trim()) return;
    try {
      await resendInvitation.mutateAsync();
      setInvitationAction(undefined);
      setInvitationActionId("");
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  async function handleCancelInvitation() {
    if (!canManageMembers || !invitationActionId.trim()) return;
    try {
      await cancelInvitation.mutateAsync();
      setInvitationAction(undefined);
      setInvitationActionId("");
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  async function handleUpdateMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageMembers) return;
    try {
      await updateMember.mutateAsync({ role: updateRole });
      setUpdateUserId("");
      setMemberAction(undefined);
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  async function handleCreatePublishRequest(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    try {
      await (publishSourceKind === "knowledge-base"
        ? createPublishRequest.mutateAsync({
            source_knowledge_base_id: sourceKnowledgeBaseId,
          })
        : createPublishRequest.mutateAsync({
            source_document_id: sourceDocumentId,
            target_knowledge_base_id: targetKnowledgeBaseId,
          }));
      setSourceDocumentId("");
      setSourceKnowledgeBaseId("");
      setTargetKnowledgeBaseId("");
      setIsPublishDialogOpen(false);
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  async function handleApprovePublishRequest(requestId: string) {
    try {
      await approvePublishRequest.mutateAsync(requestId);
      setPublishReviewRequest(undefined);
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  async function handleRejectPublishRequest(requestId: string) {
    try {
      await rejectPublishRequest.mutateAsync(requestId);
      setPublishReviewRequest(undefined);
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  function selectGroup(groupId: string) {
    setSelectedGroupId(groupId);
    setIsGroupBrowserOpen(false);
  }

  function openInvitationAction(
    invitation: GroupInvitation,
    type: "update" | "resend" | "cancel",
  ) {
    setInvitationActionId(invitation.id);
    setInvitationActionRole(invitation.role);
    setInvitationAction({ invitation, type });
  }

  function openMemberAction(member: GroupMember) {
    setUpdateUserId(member.user_id);
    setUpdateRole(member.role);
    setMemberAction(member);
  }

  function publishRequestSourceLabel(request: KnowledgePublishRequest) {
    return (
      request.source_document_title ??
      request.source_document_filename ??
      request.source_knowledge_base_name ??
      request.source_document_id ??
      request.source_knowledge_base_id ??
      localization.groups.publishReviewFallbackSource
    );
  }

  function publishRequestTargetLabel(request: KnowledgePublishRequest) {
    return (
      request.target_knowledge_base_name ??
      request.target_knowledge_base_id ??
      request.target_group_id
    );
  }

  function renderPublishReviewSummary() {
    const request = publishReviewRequest;
    if (!request) return null;
    return (
      <section className="grid gap-3 rounded-lg border border-cal-hairline bg-cal-surface-soft p-3 text-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-cal-muted">
            {localization.groups.publishReviewSourceLabel}
          </p>
          <p className="mt-1 break-words font-medium text-cal-ink">
            {publishRequestSourceLabel(request)}
          </p>
          {request.source_document_filename &&
          request.source_document_filename !== request.source_document_title ? (
            <p className="mt-1 break-words text-xs text-cal-muted">
              {request.source_document_filename}
            </p>
          ) : null}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-cal-muted">
            {localization.groups.publishReviewTargetLabel}
          </p>
          <p className="mt-1 break-words text-cal-ink">
            {publishRequestTargetLabel(request)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-cal-muted">
            {localization.groups.publishReviewPreviewLabel}
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words rounded-md bg-cal-canvas p-2 text-cal-ink">
            {request.source_document_excerpt ||
              localization.groups.publishReviewNoPreview}
          </p>
        </div>
      </section>
    );
  }

  function renderPublishSourceDocument(
    document: KnowledgePublishRequestSourceDocument,
  ) {
    return (
      <article
        key={document.id}
        className="rounded-lg border border-cal-hairline bg-cal-canvas p-3"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h4 className="break-words text-sm font-semibold text-cal-ink">
              {document.title}
            </h4>
            <p className="mt-1 break-words text-xs text-cal-muted">
              {document.source_filename ?? document.source_type}
              {document.source_page_count
                ? ` · ${document.source_page_count} pages`
                : ""}
            </p>
          </div>
          <Pill tone="slate">{document.source_type}</Pill>
        </div>
        <div className="mt-3 max-h-96 overflow-auto rounded-md border border-cal-hairline bg-white p-3 text-sm leading-6 text-cal-ink">
          <AgentMarkdown
            content={
              document.content || localization.groups.publishReviewNoPreview
            }
          />
        </div>
      </article>
    );
  }

  function renderPublishSourceViewer() {
    if (publishReviewSource.isLoading) {
      return (
        <p className="rounded-lg border border-cal-hairline bg-cal-surface-soft p-3 text-sm text-cal-muted">
          {localization.groups.publishReviewSourceLoading}
        </p>
      );
    }
    if (publishReviewSource.error) {
      return <ErrorState error={publishReviewSource.error} />;
    }
    const source = publishReviewSource.data;
    if (!source) return null;
    return (
      <section className="grid gap-3 rounded-lg border border-cal-hairline bg-cal-surface-soft p-3">
        <div>
          <h3 className="text-sm font-semibold text-cal-ink">
            {localization.groups.publishReviewFullContentTitle}
          </h3>
          <p className="mt-1 text-xs leading-5 text-cal-muted">
            {localization.groups.publishReviewExtractedContentHint}
          </p>
          {source.source_knowledge_base_name ? (
            <p className="mt-2 break-words text-sm font-medium text-cal-ink">
              {source.source_knowledge_base_name}
            </p>
          ) : null}
        </div>
        {source.documents.length > 0 ? (
          <div className="grid gap-3">
            {source.documents.map((document) =>
              renderPublishSourceDocument(document),
            )}
          </div>
        ) : (
          <p className="rounded-md bg-cal-canvas p-3 text-sm text-cal-muted">
            {localization.groups.publishReviewNoDocuments}
          </p>
        )}
      </section>
    );
  }

  function renderGroupBrowser() {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-white">
        <div className="shrink-0 border-b border-cal-hairline px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-cal-ink">
                {localization.groups.title}
              </h2>
              <p className="mt-1 text-xs leading-5 text-cal-muted">
                {localization.groups.groupCountDescription.replace(
                  "{count}",
                  String(groupCount),
                )}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={localization.groups.createButton}
              onClick={() => setIsCreateGroupDialogOpen(true)}
            >
              <PlusIcon />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {groups.isLoading ? (
            <p className="px-3 text-sm text-cal-muted">
              {localization.common.loading}
            </p>
          ) : null}
          {groups.error ? <ErrorState error={groups.error} /> : null}
          {!groups.isLoading && groupCount === 0 ? (
            <div className="px-1">
              <EmptyState
                title={localization.groups.empty}
                description={localization.groups.emptyDescription}
              />
              <Button
                type="button"
                className="mt-3 w-full"
                onClick={() => setIsCreateGroupDialogOpen(true)}
              >
                {localization.groups.createButton}
              </Button>
            </div>
          ) : null}
          <div className="grid gap-1">
            {groups.data?.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => selectGroup(group.id)}
                aria-current={activeGroupId === group.id ? "page" : undefined}
                className={cn(
                  "flex w-full min-w-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                  activeGroupId === group.id
                    ? "bg-cal-primary text-white shadow-[0_10px_24px_rgb(20_33_61/0.16)]"
                    : "text-cal-ink hover:bg-cal-surface-soft",
                )}
              >
                <NetworkIcon className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {group.name}
                </span>
                <span className="shrink-0 text-xs opacity-80">
                  {localization.groups.roles[group.role]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderSummaryCard({
    title,
    value,
    description,
    action,
  }: {
    title: string;
    value: string;
    description: string;
    action?: React.ReactNode;
  }) {
    return (
      <section className="rounded-2xl border border-cal-hairline bg-white p-4 shadow-[0_10px_30px_rgb(20_22_23/0.05)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
              {title}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-cal-ink">
              {value}
            </p>
          </div>
          {action}
        </div>
        <p className="mt-2 text-sm leading-6 text-cal-muted">{description}</p>
      </section>
    );
  }

  function renderInvitationRows() {
    if (invitations.isLoading) {
      return (
        <InlineLoadingIndicator
          label={localization.groups.invitationsLoading}
        />
      );
    }
    if (invitations.error) return <ErrorState error={invitations.error} />;
    if ((invitations.data ?? []).length === 0) {
      return (
        <EmptyState
          title={localization.groups.noInvitationsTitle}
          description={localization.groups.noInvitationsDescription}
        />
      );
    }
    return (
      <div className="grid gap-2">
        {invitations.data?.map((invitation) => (
          <article
            key={invitation.id}
            className="rounded-xl border border-cal-hairline bg-cal-surface-soft p-3 text-sm"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={invitationStatusTone(invitation.status)}>
                    {localization.groups.invitationStatuses[invitation.status]}
                  </Pill>
                  <span className="font-medium text-cal-ink">
                    {invitation.invited_email}
                  </span>
                  <span className="text-cal-muted">
                    {localization.groups.roles[invitation.role]}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-cal-muted">
                  {localization.groups.invitationExpiryLabel}:{" "}
                  {invitation.expires_at}
                </p>
                <details className="mt-2 text-xs text-cal-muted">
                  <summary className="cursor-pointer font-medium text-cal-ink">
                    {localization.groups.advancedGroupDetails}
                  </summary>
                  <p className="mt-1 break-all font-mono">
                    {localization.groups.invitationIdLabel}: {invitation.id}
                  </p>
                </details>
              </div>
              {canManageMembers ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openInvitationAction(invitation, "update")}
                >
                  {localization.groups.manageInvitationAction}
                </Button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    );
  }

  function renderMemberRows() {
    if (members.isLoading) {
      return (
        <InlineLoadingIndicator label={localization.groups.membersLoading} />
      );
    }
    if (members.error) return <ErrorState error={members.error} />;
    if ((members.data ?? []).length === 0) {
      return (
        <EmptyState
          title={localization.groups.noMembersTitle}
          description={localization.groups.noMembersDescription}
        />
      );
    }
    return (
      <div className="grid gap-2">
        {members.data?.map((member) => (
          <article
            key={member.member_id}
            className="rounded-xl border border-cal-hairline bg-cal-surface-soft p-3 text-sm"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-cal-ink">
                    {member.nickname}
                  </p>
                  <Pill tone="info">
                    {localization.groups.roles[member.role]}
                  </Pill>
                </div>
                <p className="mt-2 text-xs leading-5 text-cal-muted">
                  {localization.groups.memberJoinedLabel}: {member.created_at}
                </p>
                <details className="mt-2 text-xs text-cal-muted">
                  <summary className="cursor-pointer font-medium text-cal-ink">
                    {localization.groups.advancedGroupDetails}
                  </summary>
                  <p className="mt-1 break-all font-mono">
                    {localization.groups.memberUserIdLabel}: {member.user_id}
                  </p>
                </details>
              </div>
              {canManageMembers ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openMemberAction(member)}
                >
                  {localization.groups.updateMemberRoleAction}
                </Button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    );
  }

  function renderPublishRequestRows() {
    if (publishRequests.error)
      return <ErrorState error={publishRequests.error} />;
    if ((publishRequests.data ?? []).length === 0) {
      return (
        <EmptyState
          title={localization.groups.noPublishRequestsTitle}
          description={localization.groups.noPublishRequestsDescription}
        />
      );
    }
    return (
      <div className="grid gap-2">
        {publishRequests.data?.map((request) => (
          <article
            key={request.id}
            className="rounded-xl border border-cal-hairline bg-cal-surface-soft p-3 text-sm"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill
                    tone={
                      request.status === "approved"
                        ? "green"
                        : request.status === "rejected"
                          ? "rose"
                          : "amber"
                    }
                  >
                    {request.status}
                  </Pill>
                  <span className="font-medium text-cal-ink">
                    {request.source_knowledge_base_id
                      ? localization.groups.publishSourceKnowledgeBaseOption
                      : localization.groups.publishSourceDocumentOption}
                  </span>
                </div>
                <p className="mt-2 break-words font-medium text-cal-ink">
                  {publishRequestSourceLabel(request)}
                </p>
                <p className="mt-1 text-xs leading-5 text-cal-muted">
                  {localization.groups.publishReviewTargetLabel}:{" "}
                  {publishRequestTargetLabel(request)}
                </p>
                <p className="mt-1 text-xs leading-5 text-cal-muted">
                  {request.created_at}
                </p>
                <details className="mt-2 rounded-lg bg-cal-canvas p-2 text-xs text-cal-muted">
                  <summary className="cursor-pointer font-medium text-cal-ink">
                    {localization.groups.advancedGroupDetails}
                  </summary>
                  <div className="mt-2 grid gap-1 font-mono">
                    <span className="break-all">{request.id}</span>
                    <span className="break-all">
                      {request.source_document_id ??
                        request.source_knowledge_base_id}{" "}
                      →{" "}
                      {request.target_knowledge_base_id ??
                        request.target_group_id}
                    </span>
                  </div>
                </details>
              </div>
              {canReviewPublishRequests && request.status === "pending" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPublishReviewRequest(request)}
                  >
                    {localization.groups.reviewRequestAction}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      approvePublishRequest.isPending ||
                      rejectPublishRequest.isPending
                    }
                    onClick={() => void handleApprovePublishRequest(request.id)}
                  >
                    {localization.groups.publishApproveNowButton}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={
                      approvePublishRequest.isPending ||
                      rejectPublishRequest.isPending
                    }
                    onClick={() => void handleRejectPublishRequest(request.id)}
                  >
                    {localization.groups.publishRejectNowButton}
                  </Button>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    );
  }

  function renderGroupWorkspace() {
    if (!activeGroupId) {
      return (
        <div className="grid min-h-[28rem] place-items-center bg-cal-canvas/40 p-6">
          <EmptyState
            title={localization.groups.noSelectedTitle}
            description={localization.groups.emptyDescription}
          />
          <Button
            type="button"
            onClick={() => setIsCreateGroupDialogOpen(true)}
          >
            {localization.groups.createButton}
          </Button>
        </div>
      );
    }

    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-cal-hairline bg-cal-canvas/60 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
                <NetworkIcon className="size-3.5" />
                <span>{localization.groups.activeGroupLabel}</span>
                {activeGroup ? (
                  <Pill tone="info">
                    {localization.groups.roles[activeGroup.role]}
                  </Pill>
                ) : null}
              </div>
              <h2 className="mt-2 truncate text-2xl font-semibold tracking-[-0.03em] text-cal-ink">
                {activeGroup?.name ?? localization.groups.noSelectedDescription}
              </h2>
              <p className="mt-2 text-sm leading-6 text-cal-muted">
                {localization.groups.publishBoundaryDescription}
              </p>
              <details className="mt-3 max-w-xl rounded-lg border border-cal-hairline bg-white p-3 text-xs text-cal-muted">
                <summary className="cursor-pointer font-medium text-cal-ink">
                  {localization.groups.advancedGroupDetails}
                </summary>
                <p className="mt-2 break-all font-mono">
                  {localization.groups.groupIdLabel}: {activeGroupId}
                </p>
              </details>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="lg:hidden"
                onClick={() => setIsGroupBrowserOpen(true)}
              >
                <ListTreeIcon />
                {localization.groups.browseGroupsAction}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateGroupDialogOpen(true)}
              >
                <PlusIcon />
                {localization.groups.createButton}
              </Button>
              <Button
                type="button"
                onClick={() => setIsInviteDialogOpen(true)}
                disabled={!canManageMembers}
              >
                {localization.groups.inviteMemberAction}
              </Button>
            </div>
          </div>
          {!canManageMembers ? (
            <p className="mt-4 rounded-xl border border-cal-warning/40 bg-cal-warning/10 p-3 text-sm leading-6 text-cal-body">
              {localization.groups.membershipManagerOnlyHint}
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-cal-canvas/40 p-4 xl:p-6">
          <div className="grid gap-4 xl:grid-cols-4">
            {renderSummaryCard({
              title: localization.groups.membersTitle,
              value: String(memberCount),
              description: localization.groups.membersSummary,
            })}
            {renderSummaryCard({
              title: localization.groups.invitationsTitle,
              value: String(invitationCount),
              description: localization.groups.invitationsSummary,
            })}
            {renderSummaryCard({
              title: localization.groups.sourceSpacesTitle,
              value: String(activeGroupKnowledgeBases.length),
              description: localization.groups.sourceSpacesDescription,
            })}
            {renderSummaryCard({
              title: localization.groups.publishRequestsTitle,
              value: String(publishRequestCount),
              description: localization.groups.publishRequestsSummary,
            })}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <section className="rounded-2xl border border-cal-hairline bg-white p-4 shadow-[0_10px_30px_rgb(20_22_23/0.06)]">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-cal-ink">
                    {localization.groups.membersTitle}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-cal-muted">
                    {localization.groups.membersSummary}
                  </p>
                </div>
              </div>
              {renderMemberRows()}
            </section>

            <section className="rounded-2xl border border-cal-hairline bg-white p-4 shadow-[0_10px_30px_rgb(20_22_23/0.06)]">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-cal-ink">
                    {localization.groups.invitationsTitle}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-cal-muted">
                    {localization.groups.invitationsSummary}
                  </p>
                </div>
                {canManageMembers ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsInviteDialogOpen(true)}
                  >
                    {localization.groups.inviteMemberAction}
                  </Button>
                ) : null}
              </div>
              {renderInvitationRows()}
            </section>

            <section className="rounded-2xl border border-cal-hairline bg-white p-4 shadow-[0_10px_30px_rgb(20_22_23/0.06)]">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-cal-ink">
                    {localization.groups.sourceSpacesTitle}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-cal-muted">
                    {localization.groups.sourceSpacesDescription}
                  </p>
                </div>
                <Button
                  nativeButton={false}
                  render={<Link href="/knowledge" />}
                  size="sm"
                  variant="outline"
                >
                  {localization.documents.addSourceSpaceAction}
                </Button>
              </div>
              {activeGroupKnowledgeBases.length > 0 ? (
                <div className="grid gap-2">
                  {activeGroupKnowledgeBases.map((knowledgeBase) => (
                    <Link
                      key={knowledgeBase.id}
                      href={knowledgeSourceHref(knowledgeBase.id)}
                      className="flex min-w-0 items-center gap-2 rounded-xl border border-cal-hairline bg-cal-surface-soft p-3 text-sm text-cal-ink transition-colors hover:bg-cal-canvas"
                    >
                      <FolderIcon className="size-4 shrink-0" />
                      <span className="truncate font-medium">
                        {knowledgeBase.name}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={localization.groups.noSourceSpacesTitle}
                  description={localization.groups.noSourceSpacesDescription}
                />
              )}
            </section>

            <section className="rounded-2xl border border-cal-hairline bg-white p-4 shadow-[0_10px_30px_rgb(20_22_23/0.06)]">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-cal-ink">
                    {localization.groups.publishRequestsTitle}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-cal-muted">
                    {localization.groups.publishOpenApiNote}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPublishDialogOpen(true)}
                >
                  {localization.groups.requestShareAction}
                </Button>
              </div>
              {renderPublishRequestRows()}
            </section>
          </div>
        </div>
      </div>
    );
  }

  function handleInvitationActionOpenChange(open: boolean) {
    if (open) return;
    setInvitationAction(undefined);
    setInvitationActionId("");
  }

  function handleMemberActionOpenChange(open: boolean) {
    if (open) return;
    setMemberAction(undefined);
    setUpdateUserId("");
  }

  return (
    <>
      <PageCard
        fullWidth
        title={localization.groups.title}
        description={localization.groups.description}
      >
        <div className="flex min-h-[calc(100dvh-11rem)] flex-col overflow-hidden rounded-3xl border border-cal-hairline bg-white shadow-[0_18px_60px_rgb(20_22_23/0.08)] lg:grid lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="hidden min-h-0 border-r border-cal-hairline lg:flex">
            {renderGroupBrowser()}
          </aside>
          {renderGroupWorkspace()}
        </div>
      </PageCard>

      <Sheet open={isGroupBrowserOpen} onOpenChange={setIsGroupBrowserOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-full max-w-sm gap-0 border-r border-cal-hairline bg-white p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{localization.groups.title}</SheetTitle>
            <SheetDescription>
              {localization.groups.groupCountDescription.replace(
                "{count}",
                String(groupCount),
              )}
            </SheetDescription>
          </SheetHeader>
          {renderGroupBrowser()}
        </SheetContent>
      </Sheet>

      <Dialog
        open={isCreateGroupDialogOpen}
        onOpenChange={setIsCreateGroupDialogOpen}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{localization.groups.createButton}</DialogTitle>
            <DialogDescription>
              {localization.groups.createGroupDialogDescription}
            </DialogDescription>
          </DialogHeader>
          <form
            data-testid="group-create-form"
            onSubmit={handleSubmit}
            className="grid gap-3"
          >
            <Field className="min-w-0" label={localization.groups.nameLabel}>
              <input
                className={inputClassName}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </Field>
            {createGroup.error ? (
              <ErrorState error={createGroup.error} />
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateGroupDialogOpen(false)}
              >
                {localization.common.cancel}
              </Button>
              <Button
                type="submit"
                disabled={createGroup.isPending || !name.trim()}
              >
                {localization.groups.createButton}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{localization.groups.inviteMemberAction}</DialogTitle>
            <DialogDescription>
              {localization.groups.inviteEmailHint}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateInvitation} className="grid gap-3">
            <Field
              label={localization.groups.inviteEmailLabel}
              hint={localization.groups.inviteEmailHint}
            >
              <input
                className={inputClassName}
                type="email"
                autoComplete="email"
                value={invitationEmail}
                onChange={(event) => setInvitationEmail(event.target.value)}
                disabled={!canManageMembers}
                required
              />
            </Field>
            <RoleSelect
              label={localization.groups.roleLabel}
              labels={localization.groups.roles}
              value={invitationRole}
              onChange={setInvitationRole}
              disabled={!canManageMembers}
            />
            {createInvitation.error ? (
              <ErrorState error={createInvitation.error} />
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsInviteDialogOpen(false)}
              >
                {localization.common.cancel}
              </Button>
              <Button
                type="submit"
                disabled={
                  !canManageMembers ||
                  !activeGroupId ||
                  !invitationEmail.trim() ||
                  createInvitation.isPending
                }
              >
                {localization.groups.sendInvitation}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(invitationAction)}
        onOpenChange={handleInvitationActionOpenChange}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {localization.groups.manageInvitationAction}
            </DialogTitle>
            <DialogDescription>
              {invitationAction?.invitation.invited_email}
            </DialogDescription>
          </DialogHeader>
          {invitationAction?.type === "update" ? (
            <form onSubmit={handleUpdateInvitation} className="grid gap-3">
              <RoleSelect
                label={localization.groups.roleLabel}
                labels={localization.groups.roles}
                value={invitationActionRole}
                onChange={setInvitationActionRole}
                disabled={!canManageMembers}
              />
              {updateInvitation.error ? (
                <ErrorState error={updateInvitation.error} />
              ) : null}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleInvitationActionOpenChange(false)}
                >
                  {localization.common.cancel}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!canManageMembers || cancelInvitation.isPending}
                  onClick={handleCancelInvitation}
                >
                  {localization.groups.cancelInvitation}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canManageMembers || resendInvitation.isPending}
                  onClick={handleResendInvitation}
                >
                  {localization.groups.resendInvitation}
                </Button>
                <Button
                  type="submit"
                  disabled={!canManageMembers || updateInvitation.isPending}
                >
                  {localization.groups.updateInvitationRole}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="grid gap-3">
              <p className="rounded-lg border border-cal-hairline bg-cal-surface-soft p-3 text-sm leading-6 text-cal-muted">
                {localization.groups.invitationActionHint}
              </p>
              {resendInvitation.error ? (
                <ErrorState error={resendInvitation.error} />
              ) : null}
              {cancelInvitation.error ? (
                <ErrorState error={cancelInvitation.error} />
              ) : null}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleInvitationActionOpenChange(false)}
                >
                  {localization.common.cancel}
                </Button>
                <Button
                  type="button"
                  variant={
                    invitationAction?.type === "cancel"
                      ? "secondary"
                      : "default"
                  }
                  onClick={
                    invitationAction?.type === "resend"
                      ? handleResendInvitation
                      : handleCancelInvitation
                  }
                  disabled={
                    invitationAction?.type === "resend"
                      ? resendInvitation.isPending
                      : cancelInvitation.isPending
                  }
                >
                  {invitationAction?.type === "resend"
                    ? localization.groups.resendInvitation
                    : localization.groups.cancelInvitation}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(memberAction)}
        onOpenChange={handleMemberActionOpenChange}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {localization.groups.updateMemberRoleAction}
            </DialogTitle>
            <DialogDescription>{memberAction?.nickname}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateMember} className="grid gap-3">
            <RoleSelect
              label={localization.groups.roleLabel}
              labels={localization.groups.roles}
              value={updateRole}
              onChange={setUpdateRole}
              disabled={!canManageMembers}
            />
            <p className="rounded-lg border border-cal-hairline bg-cal-surface-soft p-3 text-sm leading-6 text-cal-muted">
              {localization.groups.memberIdNote}
            </p>
            {updateMember.error ? (
              <ErrorState error={updateMember.error} />
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleMemberActionOpenChange(false)}
              >
                {localization.common.cancel}
              </Button>
              <Button
                type="submit"
                disabled={
                  !canManageMembers ||
                  !updateUserId.trim() ||
                  updateMember.isPending
                }
              >
                {localization.groups.patchRole}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                      void handleRejectPublishRequest(publishReviewRequest.id)
                    }
                  >
                    {localization.groups.publishRejectButton}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={approvePublishRequest.isPending}
                    onClick={() =>
                      void handleApprovePublishRequest(publishReviewRequest.id)
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
              {renderPublishReviewSummary()}
              {renderPublishSourceViewer()}
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
                      void handleRejectPublishRequest(publishReviewRequest.id)
                    }
                  >
                    {localization.groups.publishRejectNowButton}
                  </Button>
                  <Button
                    type="button"
                    disabled={approvePublishRequest.isPending}
                    onClick={() =>
                      void handleApprovePublishRequest(publishReviewRequest.id)
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

function invitationStatusTone(status: string): StatusTone {
  if (status === "accepted") return "green";
  if (status === "cancelled" || status === "expired") return "rose";
  return "amber";
}

function RoleSelect({
  label,
  labels,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  labels: Record<GroupRole, string>;
  value: GroupRole;
  onChange: (value: GroupRole) => void;
  disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <select
        className={selectClassName}
        value={value}
        onChange={(event) => onChange(event.target.value as GroupRole)}
        disabled={disabled}
      >
        {Object.entries(labels).map(([role, roleLabel]) => (
          <option key={role} value={role}>
            {roleLabel}
          </option>
        ))}
      </select>
    </Field>
  );
}

function PageCard({
  title,
  description,
  children,
  fullWidth = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-6",
        fullWidth ? "w-full max-w-none" : "mx-auto max-w-6xl",
      )}
    >
      <header>
        <h1 className="cal-heading cal-fluid-title">{title}</h1>
        <p className="cal-subcopy mt-3 max-w-3xl">{description}</p>
      </header>
      {children}
    </div>
  );
}

function documentMeta(
  doc: {
    knowledge_base_id: string | null;
    source_type?: string;
    source_filename?: string | null;
    source_page_count?: number | null;
  },
  localization: {
    common: { knowledgeBasePrefix: string };
    documents: {
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
      textSource: string;
      pagesLabel: string;
    };
  },
) {
  const source = documentSourceLabel(doc, localization.documents);
  const pages = doc.source_page_count
    ? ` · ${doc.source_page_count} ${localization.documents.pagesLabel}`
    : "";
  return `${source}${pages}`;
}

function documentSourceLabel(
  doc: {
    source_type?: string;
    source_filename?: string | null;
  },
  localization: {
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
    textSource: string;
  },
) {
  const extension = doc.source_filename
    ? fileExtension(doc.source_filename)
    : "";
  if (doc.source_type === "pdf") {
    return doc.source_filename
      ? `${localization.pdfSourcePrefix} ${doc.source_filename}`
      : localization.pdfSource;
  }
  if (doc.source_type === "markdown") {
    return doc.source_filename
      ? `${localization.markdownSourcePrefix} ${doc.source_filename}`
      : localization.markdownSource;
  }
  if (doc.source_type === "spreadsheet" || extension === ".xlsx") {
    return doc.source_filename
      ? `${localization.spreadsheetSourcePrefix} ${doc.source_filename}`
      : localization.spreadsheetSource;
  }
  if (doc.source_type === "presentation" || extension === ".pptx") {
    return doc.source_filename
      ? `${localization.presentationSourcePrefix} ${doc.source_filename}`
      : localization.presentationSource;
  }
  if (doc.source_filename) {
    return `${localization.uploadedTextSourcePrefix} ${doc.source_filename}`;
  }
  if (doc.source_type === "text" && doc.source_filename) {
    return localization.uploadedTextSource;
  }
  return localization.textSource;
}

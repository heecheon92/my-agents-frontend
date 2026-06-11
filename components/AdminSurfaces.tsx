"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRef, useState } from "react";
import { OnboardingTarget } from "@/components/onboarding/OnboardingTarget";
import { Button } from "@/components/ui/button";
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
  usePatchDocumentPermission,
} from "@/hooks/use-knowledge";
import { useLocalization } from "@/hooks/useLocalization";
import {
  documentUploadConcurrencyFromHealth,
  type ExtractionRun,
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

export function KnowledgeSurface() {
  const groups = useGroups();
  const knowledgeBases = useKnowledgeBases();
  const createKnowledgeBase = useCreateKnowledgeBase();
  const [name, setName] = useState("");
  const [scope, setScope] = useState<KnowledgeBaseCreationScope>("personal");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const { localization } = useLocalization((state) => state.localization.admin);
  const groupOptions = (groups.data ?? []).filter(
    (group) => group.role === "owner" || group.role === "admin",
  );
  const createPayload = buildKnowledgeBaseCreateRequest({
    groupId: selectedGroupId,
    name,
    scope,
  });
  const isGroupScope = scope === "group";
  const isSubmitDisabled =
    createKnowledgeBase.isPending ||
    groups.isLoading ||
    !createPayload ||
    (isGroupScope && groupOptions.length === 0);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createPayload) return;
    try {
      await createKnowledgeBase.mutateAsync(createPayload);
      setName("");
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  return (
    <PageCard
      title={localization.knowledge.title}
      description={localization.knowledge.description}
    >
      <section className="responsive-card-grid">
        {localization.knowledge.journeySteps.map((step, index) => (
          <article
            key={step}
            className="flex items-start gap-3 rounded-xl border border-cal-hairline bg-cal-canvas p-4 text-sm leading-6 text-cal-body"
          >
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-cal-primary text-sm font-semibold text-white">
              {index + 1}
            </span>
            <p className="min-w-0 pt-1">{step}</p>
          </article>
        ))}
      </section>
      <OnboardingTarget id="knowledge.create-form">
        <form
          onSubmit={handleSubmit}
          className="cal-card grid gap-3 rounded-xl p-4"
        >
          <Field label={localization.knowledge.nameLabel}>
            <input
              className={inputClassName}
              value={name}
              onChange={(event) => setName(event.target.value)}
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
                value={scope}
                onChange={(event) => {
                  const nextScope = event.target
                    .value as KnowledgeBaseCreationScope;
                  setScope(nextScope);
                  if (nextScope === "personal") {
                    setSelectedGroupId("");
                  }
                }}
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
                isGroupScope
                  ? localization.knowledge.groupHint
                  : localization.knowledge.groupDisabledHint
              }
            >
              <select
                aria-invalid={
                  isGroupScope && !selectedGroupId ? true : undefined
                }
                className={selectClassName}
                disabled={!isGroupScope || groups.isLoading}
                required={isGroupScope}
                value={selectedGroupId}
                onChange={(event) => setSelectedGroupId(event.target.value)}
              >
                <option value="">
                  {groups.isLoading
                    ? localization.knowledge.loadingGroupsOption
                    : localization.knowledge.groupPlaceholder}
                </option>
                {groupOptions.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} · {group.role}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="rounded-lg border border-cal-hairline bg-cal-canvas p-3 text-xs leading-5 text-cal-muted">
            {localization.knowledge.scopeBoundaryNote}
          </p>
          {isGroupScope && !groups.isLoading && groupOptions.length === 0 ? (
            <EmptyState
              title={localization.knowledge.noGroupsTitle}
              description={localization.knowledge.noGroupsDescription}
            />
          ) : null}
          {groups.error ? <ErrorState error={groups.error} /> : null}
          <Button type="submit" disabled={isSubmitDisabled}>
            {isGroupScope
              ? localization.knowledge.createGroupButton
              : localization.knowledge.createPersonalButton}
          </Button>
          {createKnowledgeBase.error ? (
            <ErrorState error={createKnowledgeBase.error} />
          ) : null}
        </form>
      </OnboardingTarget>
      <ResourceList
        loading={knowledgeBases.isLoading}
        error={knowledgeBases.error}
        empty={localization.knowledge.empty}
      >
        {knowledgeBases.data?.map((kb) => {
          const isGroupKnowledgeBase = kb.scope === "group";

          return (
            <ResourceRow
              key={kb.id}
              title={kb.name}
              subtitle={
                isGroupKnowledgeBase
                  ? localization.knowledge.listGroupSubtitle
                  : localization.knowledge.listPersonalSubtitle
              }
              meta={
                isGroupKnowledgeBase
                  ? localization.common.scopeGroup
                  : localization.common.scopePersonal
              }
            />
          );
        })}
      </ResourceList>
    </PageCard>
  );
}

export function DocumentsSurface() {
  const queryClient = useQueryClient();
  const groups = useGroups();
  const knowledgeBases = useKnowledgeBases();
  const currentUser = useCurrentUser();
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
  const documentKnowledgeBases = writableDocumentKnowledgeBases(
    knowledgeBases.data ?? [],
    currentUser.data?.id,
  );
  const teamGroups = groups.data ?? [];
  const activeTeamGroupId =
    selectedTeamGroupId &&
    teamGroups.some((group) => group.id === selectedTeamGroupId)
      ? selectedTeamGroupId
      : teamGroups[0]?.id;
  const activeTeamGroup = teamGroups.find(
    (group) => group.id === activeTeamGroupId,
  );
  const activeGroupKnowledgeBases = groupKnowledgeBasesForGroup(
    knowledgeBases.data ?? [],
    activeTeamGroupId,
  );
  const activeTeamKnowledgeBaseId =
    selectedTeamKnowledgeBaseId &&
    activeGroupKnowledgeBases.some(
      (knowledgeBase) => knowledgeBase.id === selectedTeamKnowledgeBaseId,
    )
      ? selectedTeamKnowledgeBaseId
      : activeGroupKnowledgeBases[0]?.id;
  const activeKnowledgeBaseId =
    selectedKnowledgeBaseId &&
    documentKnowledgeBases.some(
      (knowledgeBase) => knowledgeBase.id === selectedKnowledgeBaseId,
    )
      ? selectedKnowledgeBaseId
      : documentKnowledgeBases[0]?.id;
  const displayKnowledgeBaseId =
    documentDestination === "team"
      ? activeTeamKnowledgeBaseId
      : activeKnowledgeBaseId;
  const personalWriteKnowledgeBaseId =
    documentDestination === "personal" ? activeKnowledgeBaseId : undefined;
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
  const uploadDragDepthRef = useRef(0);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>();
  const activeDocumentId = selectedDocumentId ?? documents.data?.[0]?.id;
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
  const patchPermission = usePatchDocumentPermission(activeDocumentId);
  const [permissionUserId, setPermissionUserId] = useState("");
  const { localization } = useLocalization((state) => state.localization.admin);
  const canAutoApproveTeamUpload =
    canAutoApproveTeamDocumentUpload(activeTeamGroup);
  const hasActiveKnowledgeBase =
    documentDestination === "team"
      ? Boolean(activeTeamGroupId && activeTeamKnowledgeBaseId)
      : Boolean(personalWriteKnowledgeBaseId);

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
      documentDestination !== "team" ||
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
          documentDestination === "team"
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
        if (documentDestination === "personal") {
          setSelectedDocumentId(uploaded.id);
        }
        updateQueueItem(item.localId, {
          documentId: uploaded.id,
          status: "uploaded",
          progressPercent: 0,
        });
        if (documentDestination === "personal") {
          await refreshDocumentQueries(uploaded.id, uploadKnowledgeBaseId);
        }
      }

      if (documentDestination === "team") {
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
        documentDestination === "team"
          ? await myAgentsAPI.documents.createInKnowledgeBase(
              (await myAgentsAPI.knowledgeBases.ensureTeamUploadStaging()).id,
              { title, content },
            )
          : await createDocument.mutateAsync({ title, content });
      if (documentDestination === "team") {
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
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  async function handlePatchPermission(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    try {
      await patchPermission.mutateAsync({
        user_id: permissionUserId,
        can_read: true,
        can_write: false,
        can_manage: false,
        can_ingest: false,
      });
      setPermissionUserId("");
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  return (
    <PageCard
      title={localization.documents.title}
      description={localization.documents.description}
    >
      <div className="responsive-panel">
        <div className="responsive-panel-grid" data-layout="form-aside">
          <div className="grid gap-4">
            <OnboardingTarget id="documents.knowledge-destination">
              <section className="cal-card grid gap-3 rounded-xl p-4">
                <div>
                  <h2 className="font-semibold">
                    {localization.documents.knowledgeBaseTitle}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-cal-muted">
                    {localization.documents.knowledgeBaseHint}
                  </p>
                </div>
                <Field label={localization.documents.destinationLabel}>
                  <select
                    className={selectClassName}
                    value={documentDestination}
                    onChange={(event) => {
                      setDocumentDestination(
                        event.target.value as DocumentDestination,
                      );
                      setSelectedDocumentId(undefined);
                    }}
                    disabled={isKnowledgeBaseSelectionLocked}
                  >
                    <option value="personal">
                      {localization.documents.destinationPersonalOption}
                    </option>
                    <option value="team">
                      {localization.documents.destinationTeamOption}
                    </option>
                  </select>
                </Field>
                {documentDestination === "team" ? (
                  <div className="grid gap-3 rounded-xl border border-cal-hairline bg-cal-canvas p-3">
                    <Field label={localization.documents.teamGroupLabel}>
                      <select
                        className={selectClassName}
                        value={activeTeamGroupId ?? ""}
                        onChange={(event) => {
                          setSelectedTeamGroupId(
                            event.target.value || undefined,
                          );
                          setSelectedTeamKnowledgeBaseId(undefined);
                          setSelectedDocumentId(undefined);
                        }}
                        disabled={
                          groups.isLoading || isKnowledgeBaseSelectionLocked
                        }
                        required
                      >
                        <option value="">
                          {localization.documents.teamGroupPlaceholder}
                        </option>
                        {teamGroups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name} ·{" "}
                            {localization.groups.roles[group.role]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label={localization.documents.teamKnowledgeBaseLabel}
                    >
                      <select
                        className={selectClassName}
                        value={activeTeamKnowledgeBaseId ?? ""}
                        onChange={(event) =>
                          setSelectedTeamKnowledgeBaseId(
                            event.target.value || undefined,
                          )
                        }
                        disabled={
                          knowledgeBases.isLoading ||
                          isKnowledgeBaseSelectionLocked
                        }
                        required
                      >
                        <option value="">
                          {localization.documents.teamKnowledgeBasePlaceholder}
                        </option>
                        {activeGroupKnowledgeBases.map((knowledgeBase) => (
                          <option
                            key={knowledgeBase.id}
                            value={knowledgeBase.id}
                          >
                            {knowledgeBase.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <p className="text-xs leading-5 text-cal-muted">
                      {canAutoApproveTeamUpload
                        ? localization.documents.teamUploadAutoApproveHint
                        : localization.documents.teamUploadApprovalHint}
                    </p>
                    {groups.error ? <ErrorState error={groups.error} /> : null}
                    {!groups.isLoading && teamGroups.length === 0 ? (
                      <EmptyState
                        title={localization.documents.noTeamTitle}
                        description={localization.documents.noTeamDescription}
                      />
                    ) : null}
                    {!knowledgeBases.isLoading &&
                    activeTeamGroupId &&
                    activeGroupKnowledgeBases.length === 0 ? (
                      <EmptyState
                        title={localization.documents.noTeamKnowledgeBaseTitle}
                        description={
                          localization.documents.noTeamKnowledgeBaseDescription
                        }
                      />
                    ) : null}
                  </div>
                ) : (
                  <Field label={localization.documents.knowledgeBaseLabel}>
                    <select
                      className={selectClassName}
                      value={activeKnowledgeBaseId ?? ""}
                      onChange={(event) => {
                        setSelectedKnowledgeBaseId(
                          event.target.value || undefined,
                        );
                        setSelectedDocumentId(undefined);
                      }}
                      disabled={
                        knowledgeBases.isLoading ||
                        isKnowledgeBaseSelectionLocked
                      }
                      required
                    >
                      <option value="">
                        {localization.documents.knowledgeBasePlaceholder}
                      </option>
                      {documentKnowledgeBases.map((knowledgeBase) => (
                        <option key={knowledgeBase.id} value={knowledgeBase.id}>
                          {knowledgeBase.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {isKnowledgeBaseSelectionLocked ? (
                  <p className="text-xs leading-5 text-cal-muted">
                    {localization.documents.knowledgeBaseLockedHint}
                  </p>
                ) : null}
                {knowledgeBases.error ? (
                  <ErrorState error={knowledgeBases.error} />
                ) : null}
                {!knowledgeBases.isLoading &&
                documentKnowledgeBases.length === 0 ? (
                  <EmptyState
                    title={localization.documents.noKnowledgeBaseTitle}
                    description={
                      localization.documents.noKnowledgeBaseDescription
                    }
                    action={
                      <Button
                        nativeButton={false}
                        render={<Link href="/knowledge" />}
                        size="sm"
                      >
                        {localization.documents.createKnowledgeBaseAction}
                      </Button>
                    }
                  />
                ) : null}
              </section>
            </OnboardingTarget>
            <form
              onSubmit={handleCreate}
              className="cal-card grid gap-3 rounded-xl p-4"
            >
              <h2 className="font-semibold">
                {localization.documents.textCreateTitle}
              </h2>
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
                  className={`${inputClassName} min-h-40`}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                />
              </Field>
              <Button
                type="submit"
                disabled={
                  (documentDestination === "personal" &&
                    createDocument.isPending) ||
                  !title.trim() ||
                  !hasActiveKnowledgeBase
                }
              >
                {localization.documents.createButton}
              </Button>
              {documentDestination === "personal" && createDocument.error ? (
                <ErrorState error={createDocument.error} />
              ) : null}
            </form>
            <section className="cal-card grid gap-3 rounded-xl p-4">
              <div>
                <h2 className="font-semibold">
                  {localization.documents.fileUploadTitle}
                </h2>
                <p className="mt-1 text-sm leading-6 text-cal-muted">
                  {localization.documents.fileUploadHint}
                </p>
              </div>
              <OnboardingTarget id="documents.upload-dropzone">
                <fieldset
                  data-testid="document-upload-dropzone"
                  onDragEnter={handleUploadDragEnter}
                  onDragOver={handleUploadDragOver}
                  onDragLeave={handleUploadDragLeave}
                  onDrop={handleUploadDrop}
                  aria-disabled={!hasActiveKnowledgeBase}
                  className={`grid gap-3 rounded-xl border border-dashed p-4 transition-colors ${
                    isUploadDropActive
                      ? "border-km-accent bg-km-accent/10"
                      : "border-cal-hairline bg-cal-canvas"
                  } ${hasActiveKnowledgeBase ? "" : "cursor-not-allowed opacity-60"}`}
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
                      {Object.entries(queueStatusCounts).map(
                        ([status, count]) =>
                          count > 0 ? (
                            <Pill
                              key={status}
                              tone={uploadStatusTone(
                                status as UploadQueueStatus,
                              )}
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
              <p className="text-xs leading-5 text-cal-muted">
                {localization.documents.guestUploadLimitHint}
              </p>
            </section>
          </div>
          <section className="cal-card rounded-xl p-4">
            <h2 className="font-semibold">
              {localization.documents.selectedActions}
            </h2>
            {activeDocumentId ? (
              <div className="mt-3 grid gap-3 rounded-xl border border-cal-hairline bg-cal-surface-soft p-3 text-sm">
                {activeDocument ? (
                  <div>
                    <p className="break-words font-medium text-cal-ink">
                      {activeDocument.title}
                    </p>
                    <p className="mt-1 break-words text-xs text-cal-muted">
                      {documentMeta(activeDocument, localization)}
                    </p>
                  </div>
                ) : null}
                <details className="rounded-lg bg-cal-canvas p-2 text-xs text-cal-muted">
                  <summary className="cursor-pointer font-medium text-cal-ink">
                    {localization.documents.advancedDetails}
                  </summary>
                  <p className="mt-2 break-all font-mono">
                    ID: {activeDocumentId}
                  </p>
                </details>
              </div>
            ) : (
              <EmptyState
                title={localization.documents.noSelectedTitle}
                description={localization.documents.noSelectedDescription}
              />
            )}
            <Button
              className="mt-4 w-full"
              onClick={() => ingest.mutate()}
              disabled={
                !activeDocumentId ||
                ingest.isPending ||
                activeDocumentHasIngestion
              }
            >
              {activeDocumentHasIngestion
                ? localization.documents.ingestionLoading
                : localization.documents.runIngest}
            </Button>
            {ingest.error ? (
              <div className="mt-3">
                <ErrorState error={ingest.error} />
              </div>
            ) : null}
            <details className="mt-4 border-t border-cal-hairline pt-4">
              <summary className="cursor-pointer text-sm font-semibold text-cal-ink">
                {localization.documents.permissionAdvancedTitle}
              </summary>
              <form
                onSubmit={handlePatchPermission}
                className="mt-3 grid gap-3"
              >
                <Field
                  label={localization.documents.permissionLabel}
                  hint={localization.documents.permissionHint}
                >
                  <input
                    className={inputClassName}
                    value={permissionUserId}
                    onChange={(event) =>
                      setPermissionUserId(event.target.value)
                    }
                  />
                </Field>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={
                    !activeDocumentId ||
                    !permissionUserId.trim() ||
                    patchPermission.isPending
                  }
                >
                  {localization.documents.patchPermission}
                </Button>
              </form>
            </details>
            {patchPermission.error ? (
              <div className="mt-3">
                <ErrorState error={patchPermission.error} />
              </div>
            ) : null}
            <div className="mt-4 grid gap-3 border-t border-cal-hairline pt-4">
              <div>
                <h3 className="font-semibold">
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
            <details className="mt-6 border-t border-cal-hairline pt-4">
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
          </section>
          <ResourceList
            loading={documents.isLoading}
            error={documents.error}
            empty={localization.documents.empty}
          >
            {documents.data?.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSelectedDocumentId(doc.id)}
                className={`rounded-lg border p-3 text-left text-sm ${
                  doc.id === activeDocumentId
                    ? "border-cal-primary bg-cal-primary text-white"
                    : "border-cal-hairline bg-cal-canvas text-cal-ink"
                }`}
              >
                <span className="block break-words font-medium">
                  {doc.title}
                </span>
                <span className="mt-1 block break-words text-xs opacity-70">
                  {documentMeta(doc, localization)}
                </span>
                {activeIngestionDocumentIds.has(doc.id) ? (
                  <span className="mt-2 inline-flex">
                    <InlineLoadingIndicator
                      label={localization.documents.ingestionLoading}
                    />
                  </span>
                ) : null}
              </button>
            ))}
          </ResourceList>
        </div>
      </div>
    </PageCard>
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
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-cal-muted">
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
  const [publishRequestId, setPublishRequestId] = useState("");
  const updateMember = useUpdateMember(activeGroupId, updateUserId);
  const { localization } = useLocalization((state) => state.localization.admin);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const created = await createGroup.mutateAsync({ name });
      setName("");
      setSelectedGroupId(created.id);
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
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  async function handleResendInvitation() {
    if (!canManageMembers || !invitationActionId.trim()) return;
    try {
      await resendInvitation.mutateAsync();
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  async function handleCancelInvitation() {
    if (!canManageMembers || !invitationActionId.trim()) return;
    try {
      await cancelInvitation.mutateAsync();
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
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  async function handleCreatePublishRequest(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    try {
      const request =
        publishSourceKind === "knowledge-base"
          ? await createPublishRequest.mutateAsync({
              source_knowledge_base_id: sourceKnowledgeBaseId,
            })
          : await createPublishRequest.mutateAsync({
              source_document_id: sourceDocumentId,
              target_knowledge_base_id: targetKnowledgeBaseId,
            });
      setSourceDocumentId("");
      setSourceKnowledgeBaseId("");
      setTargetKnowledgeBaseId("");
      setPublishRequestId(request.id);
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  async function handleApprovePublishRequest() {
    try {
      await approvePublishRequest.mutateAsync(publishRequestId);
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  async function handleRejectPublishRequest() {
    try {
      await rejectPublishRequest.mutateAsync(publishRequestId);
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  return (
    <PageCard
      title={localization.groups.title}
      description={localization.groups.description}
    >
      <form
        data-testid="group-create-form"
        onSubmit={handleSubmit}
        className="cal-card mb-4 grid max-w-2xl gap-3 rounded-xl p-4 sm:grid-cols-[minmax(0,22rem)_auto] sm:items-end sm:justify-start"
      >
        <Field className="min-w-0" label={localization.groups.nameLabel}>
          <input
            className={selectClassName}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </Field>
        <Button
          type="submit"
          className="w-full sm:w-auto"
          disabled={createGroup.isPending || !name.trim()}
        >
          {localization.groups.createButton}
        </Button>
        {createGroup.error ? <ErrorState error={createGroup.error} /> : null}
      </form>
      <div className="responsive-panel">
        <div className="responsive-panel-grid" data-layout="form-aside">
          <section className="cal-card rounded-xl p-4">
            <h2 className="font-semibold">
              {localization.groups.membershipActions}
            </h2>
            {activeGroupId ? (
              <div className="mt-3 rounded-xl border border-cal-hairline bg-cal-surface-soft p-3 text-sm">
                <p className="font-medium text-cal-ink">
                  {localization.groups.activeGroupLabel}
                </p>
                <p className="mt-1 text-sm text-cal-body">
                  {activeGroup?.name ??
                    localization.groups.noSelectedDescription}
                </p>
                <details className="mt-2 rounded-lg bg-cal-canvas p-2 text-xs text-cal-muted">
                  <summary className="cursor-pointer font-medium text-cal-ink">
                    {localization.groups.advancedGroupDetails}
                  </summary>
                  <p className="mt-2 break-all font-mono">
                    {localization.groups.groupIdLabel}: {activeGroupId}
                  </p>
                </details>
              </div>
            ) : (
              <EmptyState
                title={localization.groups.noSelectedTitle}
                description={localization.groups.noSelectedDescription}
              />
            )}
            <details className="mt-4 border-t border-cal-hairline pt-4" open>
              <summary className="cursor-pointer text-sm font-semibold text-cal-ink">
                {localization.groups.advancedMembershipTitle}
              </summary>
              <div className="mt-3 grid gap-4">
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
                      onChange={(event) =>
                        setInvitationEmail(event.target.value)
                      }
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
                </form>
                {createInvitation.error ? (
                  <div>
                    <ErrorState error={createInvitation.error} />
                  </div>
                ) : null}

                <section className="rounded-xl border border-cal-hairline bg-cal-canvas p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-cal-ink">
                      {localization.groups.invitationsTitle}
                    </h3>
                    {invitations.isLoading ? (
                      <InlineLoadingIndicator
                        label={localization.groups.invitationsLoading}
                      />
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-2">
                    {(invitations.data ?? []).length > 0 ? (
                      (invitations.data ?? []).map((invitation) => (
                        <article
                          key={invitation.id}
                          className="rounded-lg border border-cal-hairline bg-cal-surface-soft p-3 text-sm"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Pill
                              tone={invitationStatusTone(invitation.status)}
                            >
                              {
                                localization.groups.invitationStatuses[
                                  invitation.status
                                ]
                              }
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
                              {localization.groups.invitationIdLabel}:{" "}
                              {invitation.id}
                            </p>
                          </details>
                        </article>
                      ))
                    ) : (
                      <EmptyState
                        title={localization.groups.noInvitationsTitle}
                        description={
                          localization.groups.noInvitationsDescription
                        }
                      />
                    )}
                  </div>
                  {invitations.error ? (
                    <div className="mt-3">
                      <ErrorState error={invitations.error} />
                    </div>
                  ) : null}
                </section>

                <section className="rounded-xl border border-cal-hairline bg-cal-canvas p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-cal-ink">
                      {localization.groups.membersTitle}
                    </h3>
                    {members.isLoading ? (
                      <InlineLoadingIndicator
                        label={localization.groups.membersLoading}
                      />
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-2">
                    {(members.data ?? []).length > 0 ? (
                      (members.data ?? []).map((member) => (
                        <article
                          key={member.member_id}
                          className="rounded-lg border border-cal-hairline bg-cal-surface-soft p-3 text-sm"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Pill tone="info">
                              {localization.groups.roles[member.role]}
                            </Pill>
                            <span className="break-all font-mono text-xs text-cal-ink">
                              {localization.groups.memberUserIdLabel}:{" "}
                              {member.user_id}
                            </span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-cal-muted">
                            {localization.groups.memberJoinedLabel}:{" "}
                            {member.created_at}
                          </p>
                        </article>
                      ))
                    ) : (
                      <EmptyState
                        title={localization.groups.noMembersTitle}
                        description={localization.groups.noMembersDescription}
                      />
                    )}
                  </div>
                  {members.error ? (
                    <div className="mt-3">
                      <ErrorState error={members.error} />
                    </div>
                  ) : null}
                </section>

                <form
                  onSubmit={handleUpdateInvitation}
                  className="grid gap-3 border-t border-cal-hairline pt-4"
                >
                  <Field
                    label={localization.groups.invitationActionIdLabel}
                    hint={localization.groups.invitationActionHint}
                  >
                    <input
                      className={inputClassName}
                      value={invitationActionId}
                      onChange={(event) =>
                        setInvitationActionId(event.target.value)
                      }
                      disabled={!canManageMembers}
                    />
                  </Field>
                  <RoleSelect
                    label={localization.groups.roleLabel}
                    labels={localization.groups.roles}
                    value={invitationActionRole}
                    onChange={setInvitationActionRole}
                    disabled={!canManageMembers}
                  />
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={
                        !canManageMembers ||
                        !activeGroupId ||
                        !invitationActionId.trim() ||
                        updateInvitation.isPending
                      }
                    >
                      {localization.groups.updateInvitationRole}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        !canManageMembers ||
                        !activeGroupId ||
                        !invitationActionId.trim() ||
                        resendInvitation.isPending
                      }
                      onClick={handleResendInvitation}
                    >
                      {localization.groups.resendInvitation}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={
                        !canManageMembers ||
                        !activeGroupId ||
                        !invitationActionId.trim() ||
                        cancelInvitation.isPending
                      }
                      onClick={handleCancelInvitation}
                    >
                      {localization.groups.cancelInvitation}
                    </Button>
                  </div>
                </form>
                {updateInvitation.error ? (
                  <div>
                    <ErrorState error={updateInvitation.error} />
                  </div>
                ) : null}
                {resendInvitation.error ? (
                  <div>
                    <ErrorState error={resendInvitation.error} />
                  </div>
                ) : null}
                {cancelInvitation.error ? (
                  <div>
                    <ErrorState error={cancelInvitation.error} />
                  </div>
                ) : null}

                <form
                  onSubmit={handleUpdateMember}
                  className="grid gap-3 border-t border-cal-hairline pt-4"
                >
                  <Field
                    label={localization.groups.patchMemberLabel}
                    hint={localization.groups.patchMemberHint}
                  >
                    <input
                      className={inputClassName}
                      value={updateUserId}
                      onChange={(event) => setUpdateUserId(event.target.value)}
                      disabled={!canManageMembers}
                    />
                  </Field>
                  <RoleSelect
                    label={localization.groups.roleLabel}
                    labels={localization.groups.roles}
                    value={updateRole}
                    onChange={setUpdateRole}
                    disabled={!canManageMembers}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={
                      !canManageMembers ||
                      !activeGroupId ||
                      !updateUserId.trim() ||
                      updateMember.isPending
                    }
                  >
                    {localization.groups.patchRole}
                  </Button>
                </form>
                {updateMember.error ? (
                  <div>
                    <ErrorState error={updateMember.error} />
                  </div>
                ) : null}
                <p className="rounded-lg border border-cal-hairline bg-cal-surface-strong p-3 text-sm leading-6 text-cal-body">
                  {localization.groups.memberIdNote}
                </p>
              </div>
            </details>
            {!canManageMembers ? (
              <p className="mt-4 rounded-lg border border-cal-warning/40 bg-cal-warning/10 p-3 text-sm leading-6 text-cal-body">
                {localization.groups.membershipManagerOnlyHint}
              </p>
            ) : null}
          </section>
          <section className="cal-card rounded-xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">
                  {localization.groups.publishBoundaryTitle}
                </h2>
                <p className="mt-1 text-sm leading-6 text-cal-muted">
                  {localization.groups.publishBoundaryDescription}
                </p>
              </div>
              <Pill tone="green">{localization.groups.openApiPendingPill}</Pill>
            </div>
            <div className="mt-4 rounded-xl border border-cal-hairline bg-cal-surface-soft p-3 text-sm">
              <p className="font-medium text-cal-ink">
                {localization.groups.publishActiveGroup}
              </p>
              <p className="mt-2 rounded-lg bg-cal-canvas p-2 text-sm text-cal-body">
                {activeGroup?.name ?? localization.groups.noSelectedDescription}
              </p>
            </div>
            <form
              onSubmit={handleCreatePublishRequest}
              className="mt-4 grid gap-3 border-t border-cal-hairline pt-4"
            >
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
                      {
                        localization.groups
                          .publishSourceKnowledgeBasePlaceholder
                      }
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
              {createPublishRequest.error ? (
                <ErrorState error={createPublishRequest.error} />
              ) : null}
            </form>
            {canReviewPublishRequests ? (
              <form className="mt-4 grid gap-3 border-t border-cal-hairline pt-4">
                <Field
                  label={localization.groups.publishReviewRequestLabel}
                  hint={localization.groups.publishReviewHint}
                >
                  <input
                    className={inputClassName}
                    value={publishRequestId}
                    onChange={(event) =>
                      setPublishRequestId(event.target.value)
                    }
                  />
                </Field>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      !publishRequestId.trim() ||
                      approvePublishRequest.isPending
                    }
                    onClick={handleApprovePublishRequest}
                  >
                    {localization.groups.publishApproveButton}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={
                      !publishRequestId.trim() || rejectPublishRequest.isPending
                    }
                    onClick={handleRejectPublishRequest}
                  >
                    {localization.groups.publishRejectButton}
                  </Button>
                </div>
              </form>
            ) : (
              <p className="mt-4 rounded-lg border border-cal-hairline bg-cal-surface-soft p-3 text-sm leading-6 text-cal-muted">
                {localization.groups.publishReviewHint}
              </p>
            )}
            {approvePublishRequest.error || rejectPublishRequest.error ? (
              <div className="mt-3">
                <ErrorState
                  error={
                    approvePublishRequest.error ?? rejectPublishRequest.error
                  }
                />
              </div>
            ) : null}
            <div className="mt-4 rounded-lg border border-cal-primary/20 bg-cal-primary/10 p-3 text-sm leading-6 text-cal-body">
              <p>{localization.groups.publishOpenApiNote}</p>
              {publishRequests.error ? (
                <div className="mt-3">
                  <ErrorState error={publishRequests.error} />
                </div>
              ) : null}
              {publishRequests.data?.length ? (
                <div className="mt-3 grid gap-2">
                  {publishRequests.data.map((request) => (
                    <article
                      key={request.id}
                      className="rounded-lg border border-cal-hairline bg-cal-canvas p-3 text-xs leading-5 text-cal-muted"
                    >
                      <button
                        type="button"
                        className="block w-full text-left font-semibold text-cal-ink"
                        onClick={() => setPublishRequestId(request.id)}
                      >
                        {request.status}
                      </button>
                      <details className="mt-2 rounded-md bg-cal-surface-soft p-2">
                        <summary className="cursor-pointer font-medium text-cal-ink">
                          {localization.groups.advancedGroupDetails}
                        </summary>
                        <div className="mt-2 grid gap-1 font-mono">
                          <span className="break-all">{request.id}</span>
                          <span className="break-all">
                            {request.source_document_id} →{" "}
                            {request.target_knowledge_base_id}
                          </span>
                        </div>
                      </details>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
      <ResourceList
        loading={groups.isLoading}
        error={groups.error}
        empty={localization.groups.empty}
      >
        {groups.data?.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => setSelectedGroupId(group.id)}
            className="text-left"
          >
            <ResourceRow
              title={group.name}
              subtitle={localization.groups.sharedKnowledgeSpaceLabel}
              meta={
                localization.groups.roles[
                  group.role as keyof typeof localization.groups.roles
                ] ?? group.role
              }
              active={activeGroupId === group.id}
            />
          </button>
        ))}
      </ResourceList>
    </PageCard>
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
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
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

function ResourceList({
  loading,
  error,
  empty,
  children,
}: {
  loading: boolean;
  error: unknown;
  empty: string;
  children: React.ReactNode;
}) {
  const { localization } = useLocalization((state) => state.localization.admin);
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);
  return (
    <section className="cal-card grid min-w-0 gap-3 rounded-xl p-4">
      {loading ? (
        <p className="text-sm text-cal-muted">{localization.common.loading}</p>
      ) : null}
      {error ? <ErrorState error={error} /> : null}
      {!loading && !error && !hasChildren ? (
        <EmptyState
          title={empty}
          description={localization.common.emptyListDescription}
        />
      ) : null}
      <div className="grid min-w-0 gap-2">{children}</div>
    </section>
  );
}

function ResourceRow({
  title,
  subtitle,
  meta,
  active,
}: {
  title: string;
  subtitle: string;
  meta: string;
  active?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-lg border p-3 ${active ? "border-cal-primary bg-cal-primary text-white" : "border-cal-hairline bg-cal-canvas"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 break-words font-medium">{title}</p>
        <Pill>{meta}</Pill>
      </div>
      <p
        className={`mt-1 break-all text-xs ${active ? "text-white/70" : "text-cal-muted"}`}
      >
        {subtitle}
      </p>
    </div>
  );
}

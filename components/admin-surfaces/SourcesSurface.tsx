"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  canAutoApproveTeamDocumentUpload,
  groupKnowledgeBasesForGroup,
  systemKnowledgeBasesForManager,
  writableDocumentKnowledgeBases,
} from "@/components/document-knowledge-base";
import {
  buildKnowledgeBaseCreateRequest,
  type KnowledgeBaseCreationScope,
} from "@/components/knowledge-base-create";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import { useCurrentUser } from "@/hooks/use-auth";
import { useGroups } from "@/hooks/use-groups";
import {
  useCreateKnowledgeBase,
  useCreateKnowledgeBaseDocument,
  useDeleteKnowledgeBase,
  useDeleteKnowledgeBaseDocument,
  useIngestKnowledgeBaseDocumentAsync,
  useKnowledgeBaseDocuments,
  useKnowledgeBaseExtractionRuns,
  useKnowledgeBases,
  useUpdateKnowledgeBase,
} from "@/hooks/use-knowledge";
import { useLocalization } from "@/hooks/useLocalization";
import {
  canManageSystemKnowledge as canManageSystemKnowledgeForUser,
  type KnowledgeBase,
} from "@/model/my-agents";
import { myAgentsAPI } from "@/services/my-agents";
import {
  type DocumentDestination,
  decodeRouteSegment,
  knowledgeSourceHref,
  PageCard,
} from "./shared";
import { SourcesSurfaceOverlays } from "./sources/SourcesSurfaceOverlays";
import { SourcesWorkspace } from "./sources/SourcesWorkspace";
import {
  canManageSourceSpace,
  canSharePersonalSourceSpace,
} from "./sources/source-space-actions";
import { TERMINAL_EXTRACTION_STATUSES } from "./sources/upload-config";
import { useSourceUploadQueue } from "./sources/useSourceUploadQueue";

type SourcesSurfaceProps = { initialSourceId?: string };
type SourceActionsDialogState = { documentId: string };
type SourceSpaceDialogType = "rename" | "delete" | "share";
type SourceSpaceDialogState = {
  sourceSpaceId: string;
  type: SourceSpaceDialogType;
};
const HEALTH_CONFIG_STALE_TIME_MS = 5 * 60 * 1000;
// biome-ignore format: preserve line-budgeted orchestration shell
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
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSourceSpaceBrowserOpen, setIsSourceSpaceBrowserOpen] =
    useState(false);
  const [isCreateSourceSpaceDialogOpen, setIsCreateSourceSpaceDialogOpen] =
    useState(false);
  const [isTextSourceDialogOpen, setIsTextSourceDialogOpen] = useState(false);
  const [isFileUploadDialogOpen, setIsFileUploadDialogOpen] = useState(false);
  const [isPreparingTextSource, setIsPreparingTextSource] = useState(false);
  const [sourceActionsDialog, setSourceActionsDialog] =
    useState<SourceActionsDialogState>();
  const [sourceSpaceDialog, setSourceSpaceDialog] =
    useState<SourceSpaceDialogState>();
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>();
  const lastAppliedRouteSourceIdRef = useRef<string | undefined>(undefined);
  const { localization } = useLocalization((state) => state.localization.admin);
  const teamGroups = groups.data ?? [];
  const documentKnowledgeBases = writableDocumentKnowledgeBases(
    knowledgeBases.data ?? [],
    currentUser.data?.id,
  );
  const systemKnowledgeBases = systemKnowledgeBasesForManager(
    knowledgeBases.data ?? [],
    canManageSystemKnowledge,
  );
  const sourceSpaceGroupOptions = teamGroups.filter(
    (group) => group.role === "owner" || group.role === "admin",
  );
  const routeSourceId = decodeRouteSegment(initialSourceId);
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
  const activeTeamGroupId =
    routeTeamGroupId ??
    (selectedTeamGroupId && teamGroups.some((group) => group.id === selectedTeamGroupId)
      ? selectedTeamGroupId
      : teamGroups[0]?.id);
  const activeTeamGroup = teamGroups.find((group) => group.id === activeTeamGroupId);
  const activeGroupKnowledgeBases = groupKnowledgeBasesForGroup(
    knowledgeBases.data ?? [],
    activeTeamGroupId,
  );
  const activeTeamKnowledgeBaseId =
    routeTeamKnowledgeBase?.id ??
    (routeTeamGroup ? activeGroupKnowledgeBases[0]?.id : undefined) ??
    (selectedTeamKnowledgeBaseId &&
    activeGroupKnowledgeBases.some((kb) => kb.id === selectedTeamKnowledgeBaseId)
      ? selectedTeamKnowledgeBaseId
      : activeGroupKnowledgeBases[0]?.id);
  const activeSystemKnowledgeBaseId =
    routeSystemKnowledgeBase?.id ??
    (selectedSystemKnowledgeBaseId &&
    systemKnowledgeBases.some((kb) => kb.id === selectedSystemKnowledgeBaseId)
      ? selectedSystemKnowledgeBaseId
      : systemKnowledgeBases[0]?.id);
  const activeKnowledgeBaseId =
    routePersonalKnowledgeBase?.id ??
    (selectedKnowledgeBaseId &&
    documentKnowledgeBases.some((kb) => kb.id === selectedKnowledgeBaseId)
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
  const createDocument = useCreateKnowledgeBaseDocument(directWriteKnowledgeBaseId);
  const activeDocumentId = sourceActionsDialog?.documentId ?? selectedDocumentId;
  const activeDocument = documents.data?.find((document) => document.id === activeDocumentId);
  const extractionRuns = useKnowledgeBaseExtractionRuns(displayKnowledgeBaseId, activeDocumentId);
  const ingest = useIngestKnowledgeBaseDocumentAsync(displayKnowledgeBaseId, activeDocumentId);
  const deleteDocument = useDeleteKnowledgeBaseDocument(displayKnowledgeBaseId, activeDocumentId);
  const canAutoApproveTeamUpload = canAutoApproveTeamDocumentUpload(activeTeamGroup);
  const hasActiveKnowledgeBase =
    effectiveDocumentDestination === "team"
      ? Boolean(activeTeamGroupId && activeTeamKnowledgeBaseId)
      : Boolean(directWriteKnowledgeBaseId);
  const activeSourceSpace =
    effectiveDocumentDestination === "team"
      ? activeGroupKnowledgeBases.find((kb) => kb.id === activeTeamKnowledgeBaseId)
      : effectiveDocumentDestination === "system"
        ? systemKnowledgeBases.find((kb) => kb.id === activeSystemKnowledgeBaseId)
        : documentKnowledgeBases.find((kb) => kb.id === activeKnowledgeBaseId);
  const sourceSpaceDialogTarget = (knowledgeBases.data ?? []).find(
    (knowledgeBase) => knowledgeBase.id === sourceSpaceDialog?.sourceSpaceId,
  );
  const updateKnowledgeBase = useUpdateKnowledgeBase(
    sourceSpaceDialogTarget?.id,
  );
  const deleteKnowledgeBase = useDeleteKnowledgeBase(
    sourceSpaceDialogTarget?.id,
  );
  const canShareActiveSourceSpace = canSharePersonalSourceSpace({
    currentUserId: currentUser.data?.id,
    knowledgeBase: activeSourceSpace,
  });
  const canShareActiveDocument = canShareActiveSourceSpace;
  const sourceSpaceCount =
    documentKnowledgeBases.length +
    teamGroups.reduce(
      (count, group) =>
        count + groupKnowledgeBasesForGroup(knowledgeBases.data ?? [], group.id).length,
      0,
    ) +
    systemKnowledgeBases.length;
  const isCreateSourceSpaceDisabled =
    createKnowledgeBase.isPending ||
    groups.isLoading ||
    !createSourceSpacePayload ||
    (isCreatingTeamSourceSpace && sourceSpaceGroupOptions.length === 0) ||
    (isCreatingSystemSourceSpace && !canManageSystemKnowledge);
  const shouldShowFirstSourceSpaceForm = !knowledgeBases.isLoading && sourceSpaceCount === 0;
  const activeDocumentHasIngestion = Boolean(
    extractionRuns.data?.some((run) => run.status !== "completed" && run.status !== "failed"),
  );
  const uploadManager = useSourceUploadQueue({
    activeDocumentHasIngestion,
    activeDocumentId,
    activeTeamKnowledgeBaseId,
    directWriteKnowledgeBaseId,
    displayKnowledgeBaseId,
    effectiveDocumentDestination,
    hasActiveKnowledgeBase,
    health: health.data,
    localization,
    publishDocumentToTeam,
    queryClient,
    setSelectedDocumentId,
  });
  const isKnowledgeBaseSelectionLocked =
    uploadManager.isProcessingQueue || uploadManager.pendingQueueCount > 0;
  const readyDocumentCount = Math.max(
    0,
    (documents.data?.length ?? 0) - uploadManager.activeIngestionDocumentIds.size,
  );
  useEffect(() => {
    if (!optimisticSourceId) return;
    if (!routeSourceId || routeSourceId === optimisticSourceId) {
      setOptimisticSourceId(undefined);
    }
  }, [optimisticSourceId, routeSourceId]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: route sync intentionally uses local selection helpers to preserve existing behavior
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
    ) return;
    const personalKnowledgeBase = documentKnowledgeBases.find((kb) => kb.id === routeSourceId);
    if (personalKnowledgeBase) return applyRouteSource("personal", personalKnowledgeBase.id);
    const systemKnowledgeBase = systemKnowledgeBases.find((kb) => kb.id === routeSourceId);
    if (systemKnowledgeBase) return applyRouteSource("system", systemKnowledgeBase.id);
    if (routeTeamKnowledgeBase?.group_id) {
      setDocumentDestination("team");
      setSelectedTeamGroupId(routeTeamKnowledgeBase.group_id);
      setSelectedTeamKnowledgeBaseId(routeTeamKnowledgeBase.id);
      setSelectedDocumentId(undefined);
      lastAppliedRouteSourceIdRef.current = routeSourceId;
      return;
    }
    if (routeTeamGroup) selectTeamGroup(routeTeamGroup.id, true);
  }, [
    documentKnowledgeBases,
    groups.isLoading,
    isKnowledgeBaseSelectionLocked,
    knowledgeBases.isLoading,
    routeSourceId,
    routeTeamGroup,
    routeTeamKnowledgeBase,
    systemKnowledgeBases,
  ]);
  function applyRouteSource(destination: DocumentDestination, sourceId: string) {
    setDocumentDestination(destination);
    if (destination === "personal") setSelectedKnowledgeBaseId(sourceId);
    if (destination === "system") setSelectedSystemKnowledgeBaseId(sourceId);
    setSelectedDocumentId(undefined);
    lastAppliedRouteSourceIdRef.current = sourceId;
  }
  async function publishDocumentToTeam(documentId: string) {
    if (effectiveDocumentDestination !== "team" || !activeTeamGroupId || !activeTeamKnowledgeBaseId) {
      return { status: "personal", publishedDocumentId: undefined } as const;
    }
    const request = await myAgentsAPI.groups.createPublishRequest(activeTeamGroupId, {
      source_document_id: documentId,
      target_knowledge_base_id: activeTeamKnowledgeBaseId,
    });
    await queryClient.invalidateQueries({ queryKey: MyAgentsQueryKeys.groups.publishRequests(activeTeamGroupId) });
    if (!canAutoApproveTeamUpload) return { status: "pending", publishedDocumentId: undefined } as const;
    const approved = await myAgentsAPI.groups.approvePublishRequest(activeTeamGroupId, request.id);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: MyAgentsQueryKeys.groups.publishRequests(activeTeamGroupId) }),
      queryClient.invalidateQueries({ queryKey: MyAgentsQueryKeys.knowledgeBases.documents(activeTeamKnowledgeBaseId) }),
      queryClient.invalidateQueries({ queryKey: MyAgentsQueryKeys.knowledgeBases.list() }),
    ]);
    return { status: "approved", publishedDocumentId: approved.published_document_id ?? undefined } as const;
  }
  async function handleCreateSourceSpace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createSourceSpacePayload || isCreateSourceSpaceDisabled) return;
    try {
      const created = await createKnowledgeBase.mutateAsync(createSourceSpacePayload);
      setSourceSpaceName("");
      setSelectedDocumentId(undefined);
      setDocumentDestination(created.scope === "group" ? "team" : created.scope === "system" ? "system" : "personal");
      if (created.scope === "group") {
        setSelectedTeamGroupId(created.group_id ?? undefined);
        setSelectedTeamKnowledgeBaseId(created.id);
      } else if (created.scope === "system") setSelectedSystemKnowledgeBaseId(created.id);
      else setSelectedKnowledgeBaseId(created.id);
      setOptimisticSourceId(created.id);
      setIsCreateSourceSpaceDialogOpen(false);
      router.push(knowledgeSourceHref(created.id), { scroll: false });
      toast.success(localization.documents.createSourceSpaceSuccessAnnouncement);
    } catch {
      toast.error(localization.documents.createSourceSpaceFailedAnnouncement);
    }
  }
  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasActiveKnowledgeBase || isPreparingTextSource) return;
    const sourceTitle = title.trim();
    setIsPreparingTextSource(true);
    try {
      const created = effectiveDocumentDestination === "team"
        ? await myAgentsAPI.documents.createInKnowledgeBase((await myAgentsAPI.knowledgeBases.ensureTeamUploadStaging()).id, { title, content })
        : await createDocument.mutateAsync({ title, content });
      if (effectiveDocumentDestination === "team") {
        const publishResult = await publishDocumentToTeam(created.id);
        const message = publishResult.status === "approved" ? localization.documents.teamTextApprovedAnnouncement : localization.documents.teamTextRequestedAnnouncement;
        uploadManager.setUploadAnnouncement(message);
        if (publishResult.status === "approved") toast.success(message);
        else toast.info(message);
        setSelectedDocumentId(publishResult.publishedDocumentId);
        await uploadManager.refreshDocumentQueries(publishResult.publishedDocumentId, activeTeamKnowledgeBaseId);
      } else if (directWriteKnowledgeBaseId) {
        setSelectedDocumentId(created.id);
        uploadManager.setUploadAnnouncement(localization.documents.uploadStartedAnnouncement);
        const run = await myAgentsAPI.documents.ingestAsyncInKnowledgeBase(directWriteKnowledgeBaseId, created.id);
        const completedRun = TERMINAL_EXTRACTION_STATUSES.has(run.status)
? run
: await uploadManager.pollExtractionRun(directWriteKnowledgeBaseId, created.id, run.id);
        const message = (completedRun?.status === "completed" ? localization.documents.uploadCompletedAnnouncement : localization.documents.uploadFailedAnnouncement).replace("{file}", sourceTitle);
        uploadManager.setUploadAnnouncement(message);
        if (completedRun?.status === "completed") toast.success(message);
        else toast.error(message);
        await uploadManager.refreshDocumentQueries(created.id, directWriteKnowledgeBaseId);
      }
      setTitle("");
      setContent("");
      setIsTextSourceDialogOpen(false);
    } catch {
      if (sourceTitle) {
        const message = localization.documents.uploadFailedAnnouncement.replace("{file}", sourceTitle);
        uploadManager.setUploadAnnouncement(message);
        toast.error(message);
      }
    } finally {
      setIsPreparingTextSource(false);
    }
  }
  async function handleDeleteDocument() {
    if (!activeDocumentId) return;
    try {
      const nextDocumentId = documents.data?.find((document) => document.id !== activeDocumentId)?.id;
      await deleteDocument.mutateAsync();
      await uploadManager.refreshDocumentQueries();
      setSelectedDocumentId(nextDocumentId);
      setSourceActionsDialog(undefined);
      toast.success(localization.documents.deleteSuccessAnnouncement);
    } catch {
      toast.error(localization.documents.deleteFailedAnnouncement);
    }
  }
  async function handleRenameSourceSpace(name: string) {
    if (
      !sourceSpaceDialogTarget ||
      !sourceSpaceActions(sourceSpaceDialogTarget).canManage
    ) {
      return;
    }
    try {
      const updated = await updateKnowledgeBase.mutateAsync({ name });
      setSourceSpaceDialog(undefined);
      if (activeSourceSpace?.id === updated.id) setOptimisticSourceId(updated.id);
      toast.success(localization.documents.renameSourceSpaceSuccess);
    } catch {
      toast.error(localization.documents.renameSourceSpaceFailed);
    }
  }
  async function handleDeleteSourceSpace() {
    if (
      !sourceSpaceDialogTarget ||
      !sourceSpaceActions(sourceSpaceDialogTarget).canManage
    ) {
      return;
    }
    const deletedSourceSpaceId = sourceSpaceDialogTarget.id;
    const isDeletingActiveSourceSpace =
      activeSourceSpace?.id === deletedSourceSpaceId;
    const fallbackSourceSpace = [
      ...documentKnowledgeBases,
      ...teamGroups.flatMap((group) =>
        groupKnowledgeBasesForGroup(knowledgeBases.data ?? [], group.id),
      ),
      ...systemKnowledgeBases,
    ].find((knowledgeBase) => knowledgeBase.id !== deletedSourceSpaceId);
    try {
      await deleteKnowledgeBase.mutateAsync();
      setSourceSpaceDialog(undefined);
      setSelectedDocumentId(undefined);
      toast.success(localization.documents.deleteSourceSpaceSuccess);
      if (!isDeletingActiveSourceSpace) return;
      if (!fallbackSourceSpace) {
        setOptimisticSourceId(undefined);
        router.push("/knowledge", { scroll: false });
        return;
      }
      setOptimisticSourceId(fallbackSourceSpace.id);
      if (fallbackSourceSpace.scope === "group") {
        setDocumentDestination("team");
        setSelectedTeamGroupId(fallbackSourceSpace.group_id ?? undefined);
        setSelectedTeamKnowledgeBaseId(fallbackSourceSpace.id);
      } else if (fallbackSourceSpace.scope === "system") {
        setDocumentDestination("system");
        setSelectedSystemKnowledgeBaseId(fallbackSourceSpace.id);
      } else {
        setDocumentDestination("personal");
        setSelectedKnowledgeBaseId(fallbackSourceSpace.id);
      }
      router.push(knowledgeSourceHref(fallbackSourceSpace.id), { scroll: false });
    } catch {
      toast.error(localization.documents.deleteSourceSpaceFailed);
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
  function sourceSpaceActions(knowledgeBase: KnowledgeBase) {
    return {
      canManage: canManageSourceSpace({
        canManageSystemKnowledge,
        currentUserId: currentUser.data?.id,
        groups: teamGroups,
        knowledgeBase,
      }),
      canShare: canSharePersonalSourceSpace({
        currentUserId: currentUser.data?.id,
        knowledgeBase,
      }),
    };
  }
  function openSourceSpaceDialog(
    type: SourceSpaceDialogType,
    knowledgeBase: KnowledgeBase,
  ) {
    setSourceSpaceDialog({ sourceSpaceId: knowledgeBase.id, type });
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
  function selectTeamGroup(groupId: string, fromRoute = false) {
    if (isKnowledgeBaseSelectionLocked) return;
    const groupSourceSpaces = groupKnowledgeBasesForGroup(knowledgeBases.data ?? [], groupId);
    setOptimisticSourceId(groupId);
    setDocumentDestination("team");
    setSelectedTeamGroupId(groupId);
    setSelectedTeamKnowledgeBaseId(groupSourceSpaces[0]?.id);
    setSelectedDocumentId(undefined);
    setIsSourceSpaceBrowserOpen(false);
    if (fromRoute) lastAppliedRouteSourceIdRef.current = groupId;
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
      <PageCard fullWidth title={localization.documents.title} description={localization.documents.description}>
        <SourcesWorkspace
          activeDocumentId={activeDocumentId}
          activeIngestionDocumentIds={uploadManager.activeIngestionDocumentIds}
          activeKnowledgeBaseId={activeKnowledgeBaseId}
          activeSourceSpace={activeSourceSpace}
          activeSystemKnowledgeBaseId={activeSystemKnowledgeBaseId}
          activeTeamGroupId={activeTeamGroupId}
          activeTeamKnowledgeBaseId={activeTeamKnowledgeBaseId}
          allKnowledgeBases={knowledgeBases.data ?? []}
          canManageSystemKnowledge={canManageSystemKnowledge}
          documentKnowledgeBases={documentKnowledgeBases}
          documents={documents}
          effectiveDocumentDestination={effectiveDocumentDestination}
          getSourceSpaceActions={sourceSpaceActions}
          groupsError={groups.error}
          hasActiveKnowledgeBase={hasActiveKnowledgeBase}
          isKnowledgeBaseSelectionLocked={isKnowledgeBaseSelectionLocked}
          knowledgeBasesError={knowledgeBases.error}
          knowledgeBasesIsLoading={knowledgeBases.isLoading}
          localization={localization}
          onCreateSourceSpace={() => setIsCreateSourceSpaceDialogOpen(true)}
          onDeleteSourceSpace={(knowledgeBase) =>
            openSourceSpaceDialog("delete", knowledgeBase)
          }
          onOpenFileUploadDialog={() => setIsFileUploadDialogOpen(true)}
          onOpenSourceActions={openSourceActionsDialog}
          onOpenSourceSpaceBrowser={() => setIsSourceSpaceBrowserOpen(true)}
          onOpenTextSourceDialog={() => setIsTextSourceDialogOpen(true)}
          onRenameSourceSpace={(knowledgeBase) =>
            openSourceSpaceDialog("rename", knowledgeBase)
          }
          onSelectPersonalSourceSpace={selectPersonalSourceSpace}
          onSelectSystemSourceSpace={selectSystemSourceSpace}
          onSelectTeamGroup={selectTeamGroup}
          onSelectTeamSourceSpace={selectTeamSourceSpace}
          onShareSourceSpace={(knowledgeBase) =>
            openSourceSpaceDialog("share", knowledgeBase)
          }
          readyDocumentCount={readyDocumentCount}
          sourceSpaceCount={sourceSpaceCount}
          systemKnowledgeBases={systemKnowledgeBases}
          teamGroups={teamGroups}
        />
      </PageCard>
      <SourcesSurfaceOverlays
        sourceActions={{
          open: Boolean(sourceActionsDialog), onOpenChange: handleSourceActionsDialogOpenChange,
          localization, activeDocument, activeDocumentId, displayKnowledgeBaseId,
          allKnowledgeBases: knowledgeBases.data ?? [], canShareDocument: canShareActiveDocument,
          teamGroups,
          activeDocumentHasIngestion, ingest, deleteDocument, extractionRuns,
          onDeleteDocument: handleDeleteDocument,
        }}
        sourceSpaceLifecycle={{
          activeSourceSpace: sourceSpaceDialogTarget, deleteKnowledgeBase, groups: teamGroups,
          localization, onDelete: handleDeleteSourceSpace,
          onOpenChange: (open) => { if (!open) setSourceSpaceDialog(undefined); },
          onRename: handleRenameSourceSpace, openDialog: sourceSpaceDialog?.type,
          updateKnowledgeBase,
        }}
        browserSheet={{
          activeKnowledgeBaseId, activeSystemKnowledgeBaseId, activeTeamGroupId,
          activeTeamKnowledgeBaseId, allKnowledgeBases: knowledgeBases.data ?? [],
          canManageSystemKnowledge, documentKnowledgeBases, effectiveDocumentDestination,
          getSourceSpaceActions: sourceSpaceActions,
          groupsError: groups.error, isKnowledgeBaseSelectionLocked,
          knowledgeBasesError: knowledgeBases.error, knowledgeBasesIsLoading: knowledgeBases.isLoading,
          onDeleteSourceSpace: (knowledgeBase) => openSourceSpaceDialog("delete", knowledgeBase),
          localization, onCreateSourceSpace: () => setIsCreateSourceSpaceDialogOpen(true),
          onRenameSourceSpace: (knowledgeBase) => openSourceSpaceDialog("rename", knowledgeBase),
          onOpenChange: setIsSourceSpaceBrowserOpen, onSelectPersonalSourceSpace: selectPersonalSourceSpace,
          onSelectSystemSourceSpace: selectSystemSourceSpace, onSelectTeamGroup: selectTeamGroup,
          onSelectTeamSourceSpace: selectTeamSourceSpace,
          onShareSourceSpace: (knowledgeBase) => openSourceSpaceDialog("share", knowledgeBase),
          open: isSourceSpaceBrowserOpen,
          sourceSpaceCount, systemKnowledgeBases, teamGroups,
        }}
        createSourceSpaceDialog={{
          canManageSystemKnowledge, createKnowledgeBaseError: createKnowledgeBase.error,
          groupsIsLoading: groups.isLoading, isCreateSourceSpaceDisabled,
          isCreatingSystemSourceSpace, isCreatingTeamSourceSpace, isKnowledgeBaseSelectionLocked,
          localization, onGroupChange: setSourceSpaceGroupId, onNameChange: setSourceSpaceName,
          onOpenChange: setIsCreateSourceSpaceDialogOpen,
          onScopeChange: (nextScope) => { setSourceSpaceScope(nextScope); if (nextScope !== "group") setSourceSpaceGroupId(""); },
          onSubmit: handleCreateSourceSpace, open: isCreateSourceSpaceDialogOpen,
          shouldShowFirstSourceSpaceForm, sourceSpaceGroupId, sourceSpaceGroupOptions,
          sourceSpaceName, sourceSpaceScope,
        }}
        textSourceDialog={{
          content, createDocumentError: createDocument.error, createDocumentIsPending: createDocument.isPending,
          effectiveDocumentDestination, hasActiveKnowledgeBase, isPreparingTextSource, localization,
          onContentChange: setContent, onOpenChange: setIsTextSourceDialogOpen, onSubmit: handleCreate,
          onTitleChange: setTitle, open: isTextSourceDialogOpen, title,
        }}
        uploadDialog={{ ...uploadManager, hasActiveKnowledgeBase, localization, onOpenChange: setIsFileUploadDialogOpen, open: isFileUploadDialogOpen }}
      />
    </>
  );
}

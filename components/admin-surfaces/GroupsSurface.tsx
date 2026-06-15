"use client";

import { ListTreeIcon, NetworkIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { writableDocumentKnowledgeBases } from "@/components/document-knowledge-base";
import { Field, inputClassName, selectClassName } from "@/components/Field";
import { EmptyState, ErrorState, Pill } from "@/components/Status";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { useKnowledgeBases } from "@/hooks/use-knowledge";
import { useLocalization } from "@/hooks/useLocalization";
import type {
  GroupInvitation,
  GroupInvitationStatus,
  GroupMember,
  KnowledgePublishRequest,
  KnowledgePublishRequestStatus,
} from "@/model/my-agents";
import {
  GroupBrowser,
  GroupSummaryCard,
  renderStatusFilterButton,
} from "./GroupChrome";
import {
  GroupSourceSpaceRows,
  InvitationRows,
  MemberRows,
  PublishRequestRows,
} from "./GroupRows";
import {
  PublishReviewSummary,
  PublishSourceViewer,
} from "./PublishReviewPanel";
import {
  decodeRouteSegment,
  type GroupManagementSection,
  type GroupRole,
  groupHref,
  groupManagementHref,
  PageCard,
  type PublishSourceKind,
  RoleSelect,
} from "./shared";

export type { GroupManagementSection } from "./shared";

type GroupsSurfaceProps = {
  initialGroupId?: string;
  initialSection?: GroupManagementSection;
};

type PublishRequestStatusFilter = KnowledgePublishRequestStatus | "all";
type InvitationStatusFilter = GroupInvitationStatus | "all";

const GROUP_PREVIEW_LIMIT = 3;
const PUBLISH_REQUEST_STATUS_ORDER: Record<
  KnowledgePublishRequestStatus,
  number
> = {
  pending: 0,
  approved: 1,
  rejected: 2,
};

function previewRows<T>(rows: T[], limit = GROUP_PREVIEW_LIMIT) {
  return rows.slice(0, limit);
}

function sortPublishRequestsForReview(
  requests: KnowledgePublishRequest[],
): KnowledgePublishRequest[] {
  return [...requests].sort((left, right) => {
    const statusDelta =
      PUBLISH_REQUEST_STATUS_ORDER[left.status] -
      PUBLISH_REQUEST_STATUS_ORDER[right.status];
    if (statusDelta !== 0) return statusDelta;
    return (
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    );
  });
}

export function GroupsSurface({
  initialGroupId,
  initialSection,
}: GroupsSurfaceProps = {}) {
  const groups = useGroups();
  const knowledgeBases = useKnowledgeBases();
  const currentUser = useCurrentUser();
  const createGroup = useCreateGroup();
  const router = useRouter();
  const [name, setName] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>();
  const [optimisticGroupId, setOptimisticGroupId] = useState<string>();
  const [isGroupBrowserOpen, setIsGroupBrowserOpen] = useState(false);
  const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [publishRequestStatusFilter, setPublishRequestStatusFilter] =
    useState<PublishRequestStatusFilter>("pending");
  const [publishRequestSearch, setPublishRequestSearch] = useState("");
  const [invitationStatusFilter, setInvitationStatusFilter] =
    useState<InvitationStatusFilter>("pending");
  const [invitationSearch, setInvitationSearch] = useState("");
  const [invitationAction, setInvitationAction] = useState<
    | { invitation: GroupInvitation; type: "update" | "resend" | "cancel" }
    | undefined
  >();
  const [memberAction, setMemberAction] = useState<GroupMember>();
  const [publishReviewRequest, setPublishReviewRequest] =
    useState<KnowledgePublishRequest>();
  const lastActiveGroupIdRef = useRef<string | undefined>(undefined);
  const routeGroupId = decodeRouteSegment(initialGroupId);
  // Keep a clicked group active while Next remounts /groups/[groupId] and the
  // route segment catches up, mirroring the Knowledge page route-selection UX.
  const effectiveRouteGroupId = optimisticGroupId ?? routeGroupId;
  const routeGroup = groups.data?.find(
    (group) => group.id === effectiveRouteGroupId,
  );
  const selectedGroupStillExists = Boolean(
    selectedGroupId &&
      groups.data?.some((group) => group.id === selectedGroupId),
  );
  const activeGroupId =
    routeGroup?.id ??
    (selectedGroupStillExists ? selectedGroupId : groups.data?.[0]?.id);
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
  const sortedPublishRequests = sortPublishRequestsForReview(
    publishRequests.data ?? [],
  );
  const memberPreviewRows = previewRows(members.data ?? []);
  const invitationPreviewRows = previewRows(invitations.data ?? []);
  const sourceSpacePreviewRows = previewRows(activeGroupKnowledgeBases);
  const publishRequestPreviewRows = previewRows(sortedPublishRequests);

  useEffect(() => {
    if (!optimisticGroupId) return;
    if (!routeGroupId || routeGroupId === optimisticGroupId) {
      setOptimisticGroupId(undefined);
    }
  }, [optimisticGroupId, routeGroupId]);

  useEffect(() => {
    if (lastActiveGroupIdRef.current === activeGroupId) return;
    if (lastActiveGroupIdRef.current !== undefined) {
      setInvitationAction(undefined);
      setInvitationActionId("");
      setMemberAction(undefined);
      setUpdateUserId("");
      setPublishReviewRequest(undefined);
      setPublishRequestSearch("");
      setPublishRequestStatusFilter("pending");
      setInvitationSearch("");
      setInvitationStatusFilter("pending");
    }
    lastActiveGroupIdRef.current = activeGroupId;
  }, [activeGroupId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const created = await createGroup.mutateAsync({ name });
      setName("");
      setSelectedGroupId(created.id);
      setOptimisticGroupId(created.id);
      setIsCreateGroupDialogOpen(false);
      router.push(groupHref(created.id));
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
    setOptimisticGroupId(groupId);
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

  function publishRequestStatusLabel(status: KnowledgePublishRequestStatus) {
    return localization.groups.publishRequestStatuses[status];
  }

  function publishRequestMatchesSearch(
    request: KnowledgePublishRequest,
    search: string,
  ) {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return [
      request.id,
      request.created_at,
      publishRequestSourceLabel(request),
      publishRequestTargetLabel(request),
      request.source_document_filename,
      request.source_document_title,
      request.source_knowledge_base_name,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  }

  function invitationMatchesSearch(
    invitation: GroupInvitation,
    search: string,
  ) {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return [
      invitation.id,
      invitation.invited_email,
      invitation.role,
      invitation.status,
      invitation.created_at,
      invitation.expires_at,
    ].some((value) => String(value).toLowerCase().includes(needle));
  }

  function filterPublishRequests(
    requests: KnowledgePublishRequest[],
    status: PublishRequestStatusFilter,
    search: string,
  ) {
    return requests.filter(
      (request) =>
        (status === "all" || request.status === status) &&
        publishRequestMatchesSearch(request, search),
    );
  }

  function filterInvitations(
    rows: GroupInvitation[],
    status: InvitationStatusFilter,
    search: string,
  ) {
    return rows.filter(
      (invitation) =>
        (status === "all" || invitation.status === status) &&
        invitationMatchesSearch(invitation, search),
    );
  }

  function hiddenRowsHint(hiddenCount: number) {
    if (hiddenCount <= 0) return null;
    return (
      <p className="mt-3 rounded-lg border border-cal-hairline bg-cal-surface-soft p-3 text-xs text-cal-muted">
        {localization.groups.hiddenRowsHint.replace(
          "{count}",
          String(hiddenCount),
        )}
      </p>
    );
  }

  function renderManagementPageContent() {
    if (!initialSection) return null;
    if (initialSection === "members") {
      return {
        title: localization.groups.manageMembersAction,
        description: localization.groups.membersDrawerDescription.replace(
          "{groupName}",
          activeGroup?.name ?? localization.groups.noSelectedDescription,
        ),
        body: (
          <div className="grid gap-4">
            <p className="text-sm text-cal-muted">
              {localization.groups.drawerCountLabel.replace(
                "{count}",
                String(memberCount),
              )}
            </p>
            <MemberRows
              rows={members.data ?? []}
              isLoading={members.isLoading}
              error={members.error}
              canManageMembers={canManageMembers}
              localization={localization}
              onUpdateMemberRole={openMemberAction}
            />
          </div>
        ),
        footer: canManageMembers ? (
          <Button type="button" onClick={() => setIsInviteDialogOpen(true)}>
            {localization.groups.inviteMemberAction}
          </Button>
        ) : null,
      };
    }
    if (initialSection === "invitations") {
      const filteredRows = filterInvitations(
        invitations.data ?? [],
        invitationStatusFilter,
        invitationSearch,
      );
      return {
        title: localization.groups.viewInvitationsAction,
        description: localization.groups.invitationsDrawerDescription.replace(
          "{groupName}",
          activeGroup?.name ?? localization.groups.noSelectedDescription,
        ),
        body: (
          <div className="grid gap-4">
            <div className="grid gap-3 rounded-xl border border-cal-hairline bg-white p-3">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    "pending",
                    "accepted",
                    "cancelled",
                    "expired",
                    "all",
                  ] as InvitationStatusFilter[]
                ).map((status) =>
                  renderStatusFilterButton({
                    value: status,
                    activeValue: invitationStatusFilter,
                    label:
                      status === "all"
                        ? localization.groups.allStatusFilter
                        : localization.groups.invitationStatuses[status],
                    onSelect: setInvitationStatusFilter,
                  }),
                )}
              </div>
              <Field label={localization.groups.invitationSearchLabel}>
                <input
                  className={inputClassName}
                  placeholder={localization.groups.invitationSearchPlaceholder}
                  value={invitationSearch}
                  onChange={(event) => setInvitationSearch(event.target.value)}
                />
              </Field>
            </div>
            <InvitationRows
              rows={filteredRows}
              isLoading={invitations.isLoading}
              error={invitations.error}
              emptyFiltered={
                (invitations.data ?? []).length > 0 && filteredRows.length === 0
              }
              canManageMembers={canManageMembers}
              localization={localization}
              onManageInvitation={(invitation) =>
                openInvitationAction(invitation, "update")
              }
            />
          </div>
        ),
        footer: canManageMembers ? (
          <Button type="button" onClick={() => setIsInviteDialogOpen(true)}>
            {localization.groups.inviteMemberAction}
          </Button>
        ) : null,
      };
    }
    if (initialSection === "source-spaces") {
      return {
        title: localization.groups.manageSourceSpacesAction,
        description: localization.groups.sourceSpacesDrawerDescription.replace(
          "{groupName}",
          activeGroup?.name ?? localization.groups.noSelectedDescription,
        ),
        body: (
          <div className="grid gap-4">
            <p className="text-sm text-cal-muted">
              {localization.groups.drawerCountLabel.replace(
                "{count}",
                String(activeGroupKnowledgeBases.length),
              )}
            </p>
            <GroupSourceSpaceRows
              rows={activeGroupKnowledgeBases}
              isLoading={knowledgeBases.isLoading}
              error={knowledgeBases.error}
              localization={localization}
            />
          </div>
        ),
        footer: (
          <Button
            nativeButton={false}
            render={<Link href="/knowledge" />}
            type="button"
          >
            {localization.documents.addSourceSpaceAction}
          </Button>
        ),
      };
    }
    const filteredRows = filterPublishRequests(
      sortedPublishRequests,
      publishRequestStatusFilter,
      publishRequestSearch,
    );
    return {
      title: localization.groups.viewPublishRequestsAction,
      description: localization.groups.publishRequestsDrawerDescription.replace(
        "{groupName}",
        activeGroup?.name ?? localization.groups.noSelectedDescription,
      ),
      body: (
        <div className="grid gap-4">
          <div className="grid gap-3 rounded-xl border border-cal-hairline bg-white p-3">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  "pending",
                  "approved",
                  "rejected",
                  "all",
                ] as PublishRequestStatusFilter[]
              ).map((status) =>
                renderStatusFilterButton({
                  value: status,
                  activeValue: publishRequestStatusFilter,
                  label:
                    status === "all"
                      ? localization.groups.allStatusFilter
                      : localization.groups.publishRequestStatuses[status],
                  onSelect: setPublishRequestStatusFilter,
                }),
              )}
            </div>
            <Field label={localization.groups.publishRequestSearchLabel}>
              <input
                className={inputClassName}
                placeholder={
                  localization.groups.publishRequestSearchPlaceholder
                }
                value={publishRequestSearch}
                onChange={(event) =>
                  setPublishRequestSearch(event.target.value)
                }
              />
            </Field>
          </div>
          <PublishRequestRows
            rows={filteredRows}
            error={publishRequests.error}
            emptyFiltered={
              sortedPublishRequests.length > 0 && filteredRows.length === 0
            }
            canReviewPublishRequests={canReviewPublishRequests}
            approvePending={approvePublishRequest.isPending}
            rejectPending={rejectPublishRequest.isPending}
            localization={localization}
            publishRequestStatusLabel={publishRequestStatusLabel}
            publishRequestSourceLabel={publishRequestSourceLabel}
            publishRequestTargetLabel={publishRequestTargetLabel}
            onReviewRequest={setPublishReviewRequest}
            onApproveRequest={(requestId) => {
              void handleApprovePublishRequest(requestId);
            }}
            onRejectRequest={(requestId) => {
              void handleRejectPublishRequest(requestId);
            }}
          />
        </div>
      ),
      footer: (
        <Button type="button" onClick={() => setIsPublishDialogOpen(true)}>
          {localization.groups.requestShareAction}
        </Button>
      ),
    };
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

        {managementPageContent ? (
          <div className="min-h-0 flex-1 overflow-auto bg-cal-canvas/40 p-4 xl:p-6">
            <section className="mx-auto grid max-w-5xl gap-4 rounded-2xl border border-cal-hairline bg-white p-4 shadow-[0_10px_30px_rgb(20_22_23/0.06)] sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <Button
                    nativeButton={false}
                    render={<Link href={groupHref(activeGroupId)} />}
                    variant="outline"
                    size="sm"
                  >
                    {localization.groups.backToGroupOverviewAction}
                  </Button>
                  <h3 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-cal-ink">
                    {managementPageContent.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-cal-muted">
                    {managementPageContent.description}
                  </p>
                </div>
                {managementPageContent.footer ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {managementPageContent.footer}
                  </div>
                ) : null}
              </div>
              <div className="grid gap-3">{managementPageContent.body}</div>
            </section>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto bg-cal-canvas/40 p-4 xl:p-6">
            <div className="grid gap-4 xl:grid-cols-4">
              <GroupSummaryCard
                title={localization.groups.membersTitle}
                value={String(memberCount)}
                description={localization.groups.membersSummary}
              />
              <GroupSummaryCard
                title={localization.groups.invitationsTitle}
                value={String(invitationCount)}
                description={localization.groups.invitationsSummary}
              />
              <GroupSummaryCard
                title={localization.groups.sourceSpacesTitle}
                value={String(activeGroupKnowledgeBases.length)}
                description={localization.groups.sourceSpacesDescription}
              />
              <GroupSummaryCard
                title={localization.groups.publishRequestsTitle}
                value={String(publishRequestCount)}
                description={localization.groups.publishRequestsSummary}
              />
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
                  {canManageMembers ? (
                    <Button
                      nativeButton={false}
                      render={
                        <Link
                          href={groupManagementHref(activeGroupId, "members")}
                        />
                      }
                      variant="outline"
                      size="sm"
                    >
                      {localization.groups.manageMembersAction}
                    </Button>
                  ) : null}
                </div>
                <MemberRows
                  rows={memberPreviewRows}
                  isLoading={members.isLoading}
                  error={members.error}
                  canManageMembers={canManageMembers}
                  localization={localization}
                  onUpdateMemberRole={openMemberAction}
                />
                {hiddenRowsHint(memberCount - memberPreviewRows.length)}
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
                  <div className="flex flex-wrap gap-2">
                    {canManageMembers ? (
                      <>
                        <Button
                          nativeButton={false}
                          render={
                            <Link
                              href={groupManagementHref(
                                activeGroupId,
                                "invitations",
                              )}
                            />
                          }
                          variant="outline"
                          size="sm"
                        >
                          {localization.groups.viewInvitationsAction}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsInviteDialogOpen(true)}
                        >
                          {localization.groups.inviteMemberAction}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
                <InvitationRows
                  rows={invitationPreviewRows}
                  isLoading={invitations.isLoading}
                  error={invitations.error}
                  mode="preview"
                  canManageMembers={canManageMembers}
                  localization={localization}
                  onManageInvitation={(invitation) =>
                    openInvitationAction(invitation, "update")
                  }
                />
                {hiddenRowsHint(invitationCount - invitationPreviewRows.length)}
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
                  <div className="flex flex-wrap gap-2">
                    <Button
                      nativeButton={false}
                      render={
                        <Link
                          href={groupManagementHref(
                            activeGroupId,
                            "source-spaces",
                          )}
                        />
                      }
                      variant="outline"
                      size="sm"
                    >
                      {localization.groups.manageSourceSpacesAction}
                    </Button>
                    <Button
                      nativeButton={false}
                      render={<Link href="/knowledge" />}
                      size="sm"
                      variant="outline"
                    >
                      {localization.documents.addSourceSpaceAction}
                    </Button>
                  </div>
                </div>
                <GroupSourceSpaceRows
                  rows={sourceSpacePreviewRows}
                  isLoading={knowledgeBases.isLoading}
                  error={knowledgeBases.error}
                  localization={localization}
                />
                {hiddenRowsHint(
                  activeGroupKnowledgeBases.length -
                    sourceSpacePreviewRows.length,
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
                  <div className="flex flex-wrap gap-2">
                    <Button
                      nativeButton={false}
                      render={
                        <Link
                          href={groupManagementHref(
                            activeGroupId,
                            "publish-requests",
                          )}
                        />
                      }
                      variant="outline"
                      size="sm"
                    >
                      {localization.groups.viewPublishRequestsAction}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsPublishDialogOpen(true)}
                    >
                      {localization.groups.requestShareAction}
                    </Button>
                  </div>
                </div>
                <PublishRequestRows
                  rows={publishRequestPreviewRows}
                  error={publishRequests.error}
                  canReviewPublishRequests={canReviewPublishRequests}
                  approvePending={approvePublishRequest.isPending}
                  rejectPending={rejectPublishRequest.isPending}
                  localization={localization}
                  publishRequestStatusLabel={publishRequestStatusLabel}
                  publishRequestSourceLabel={publishRequestSourceLabel}
                  publishRequestTargetLabel={publishRequestTargetLabel}
                  onReviewRequest={setPublishReviewRequest}
                  onApproveRequest={(requestId) => {
                    void handleApprovePublishRequest(requestId);
                  }}
                  onRejectRequest={(requestId) => {
                    void handleRejectPublishRequest(requestId);
                  }}
                />
                {hiddenRowsHint(
                  publishRequestCount - publishRequestPreviewRows.length,
                )}
              </section>
            </div>
          </div>
        )}
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

  const managementPageContent = renderManagementPageContent();

  return (
    <>
      <PageCard
        fullWidth
        title={localization.groups.title}
        description={localization.groups.description}
      >
        <div className="flex min-h-[calc(100dvh-11rem)] flex-col overflow-hidden rounded-3xl border border-cal-hairline bg-white shadow-[0_18px_60px_rgb(20_22_23/0.08)] lg:grid lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="hidden min-h-0 border-r border-cal-hairline lg:flex">
            <GroupBrowser
              groups={groups}
              groupCount={groupCount}
              activeGroupId={activeGroupId}
              localization={localization}
              onCreateGroup={() => setIsCreateGroupDialogOpen(true)}
              onSelectGroup={selectGroup}
            />
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
          <GroupBrowser
            groups={groups}
            groupCount={groupCount}
            activeGroupId={activeGroupId}
            localization={localization}
            onCreateGroup={() => setIsCreateGroupDialogOpen(true)}
            onSelectGroup={selectGroup}
          />
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

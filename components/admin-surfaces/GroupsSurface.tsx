"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/hooks/use-auth";
import {
  useApprovePublishRequest,
  useCancelGroupInvitation,
  useCancelPublishRequest,
  useCreateGroup,
  useCreateGroupInvitation,
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
  GroupMember,
  KnowledgePublishRequest,
  KnowledgePublishRequestStatus,
} from "@/model/my-agents";
import { buildGroupManagementContent } from "./groups/GroupManagementContent";
import { GroupsChrome } from "./groups/GroupsChrome";
import { GroupsDialogs } from "./groups/GroupsDialogs";
import { GroupsWorkspace } from "./groups/GroupsWorkspace";
import {
  publishRequestSourceLabel as getPublishRequestSourceLabel,
  publishRequestTargetLabel as getPublishRequestTargetLabel,
  type InvitationStatusFilter,
  invitationMatchesSearch,
  type PublishRequestStatusFilter,
  previewRows,
  publishRequestMatchesSearch,
  sortPublishRequestsForReview,
} from "./groups/helpers";
import {
  decodeRouteSegment,
  type GroupManagementSection,
  type GroupRole,
  groupHref,
} from "./shared";

export type { GroupManagementSection } from "./shared";

export function GroupsSurface({
  initialGroupId,
  initialSection,
}: {
  initialGroupId?: string;
  initialSection?: GroupManagementSection;
} = {}) {
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
  const [publishRequestStatusFilter, setPublishRequestStatusFilter] =
    useState<PublishRequestStatusFilter>("pending");
  const [publishRequestSearch, setPublishRequestSearch] = useState("");
  const [invitationStatusFilter, setInvitationStatusFilter] =
    useState<InvitationStatusFilter>("pending");
  const [invitationSearch, setInvitationSearch] = useState("");
  const [invitationAction, setInvitationAction] = useState<{
    invitation: GroupInvitation;
    type: "update" | "resend" | "cancel";
  }>();
  const [memberAction, setMemberAction] = useState<GroupMember>();
  const [publishReviewRequest, setPublishReviewRequest] =
    useState<KnowledgePublishRequest>();
  const lastActiveGroupIdRef = useRef<string | undefined>(undefined);
  const routeGroupId = decodeRouteSegment(initialGroupId);
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
  const publishRequests = usePublishRequests(activeGroupId);
  const publishReviewSource = usePublishRequestSource(
    activeGroupId,
    publishReviewRequest?.id,
    Boolean(publishReviewRequest) && canReviewPublishRequests,
  );
  const approvePublishRequest = useApprovePublishRequest(activeGroupId);
  const cancelPublishRequest = useCancelPublishRequest(activeGroupId);
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
    if (!routeGroupId || routeGroupId === optimisticGroupId)
      setOptimisticGroupId(undefined);
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
    } catch {}
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
    } catch {}
  }

  async function handleUpdateInvitation(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!canManageMembers || !invitationActionId.trim()) return;
    try {
      await updateInvitation.mutateAsync({ role: invitationActionRole });
      closeInvitationAction();
    } catch {}
  }

  async function handleResendInvitation() {
    if (!canManageMembers || !invitationActionId.trim()) return;
    try {
      await resendInvitation.mutateAsync();
      closeInvitationAction();
    } catch {}
  }

  async function handleCancelInvitation() {
    if (!canManageMembers || !invitationActionId.trim()) return;
    try {
      await cancelInvitation.mutateAsync();
      closeInvitationAction();
    } catch {}
  }

  async function handleUpdateMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageMembers) return;
    try {
      await updateMember.mutateAsync({ role: updateRole });
      setUpdateUserId("");
      setMemberAction(undefined);
    } catch {}
  }

  async function handleApprovePublishRequest(requestId: string) {
    try {
      await approvePublishRequest.mutateAsync(requestId);
      setPublishReviewRequest(undefined);
    } catch {}
  }

  async function handleRejectPublishRequest(requestId: string) {
    try {
      await rejectPublishRequest.mutateAsync(requestId);
      setPublishReviewRequest(undefined);
    } catch {}
  }

  async function handleCancelPublishRequest(requestId: string) {
    try {
      await cancelPublishRequest.mutateAsync(requestId);
      setPublishReviewRequest(undefined);
    } catch {}
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

  function closeInvitationAction() {
    setInvitationAction(undefined);
    setInvitationActionId("");
  }

  function handleInvitationActionOpenChange(open: boolean) {
    if (!open) closeInvitationAction();
  }

  function handleMemberActionOpenChange(open: boolean) {
    if (open) return;
    setMemberAction(undefined);
    setUpdateUserId("");
  }

  const publishRequestSourceLabel = (request: KnowledgePublishRequest) =>
    getPublishRequestSourceLabel(
      request,
      localization.groups.publishReviewFallbackSource,
    );
  const publishRequestTargetLabel = getPublishRequestTargetLabel;
  const publishRequestStatusLabel = (status: KnowledgePublishRequestStatus) =>
    localization.groups.publishRequestStatuses[status];
  const canCancelPublishRequest = (request: KnowledgePublishRequest) =>
    request.status === "pending" &&
    Boolean(currentUser.data?.id) &&
    request.requester_user_id === currentUser.data?.id;
  const managementPageContent = buildGroupManagementContent({
    activeGroupKnowledgeBases,
    activeGroupName:
      activeGroup?.name ?? localization.groups.noSelectedDescription,
    canManageMembers,
    canReviewPublishRequests,
    invitationSearch,
    invitationStatusFilter,
    invitations,
    knowledgeBasesError: knowledgeBases.error,
    knowledgeBasesLoading: knowledgeBases.isLoading,
    localization,
    memberCount,
    members,
    publishRequestSearch,
    publishRequestStatusFilter,
    publishRequests,
    section: initialSection,
    sortedPublishRequests,
    approvePending: approvePublishRequest.isPending,
    cancelPending: cancelPublishRequest.isPending,
    rejectPending: rejectPublishRequest.isPending,
    setInvitationSearch,
    setInvitationStatusFilter,
    setPublishRequestSearch,
    setPublishRequestStatusFilter,
    onApprovePublishRequest: handleApprovePublishRequest,
    onCancelPublishRequest: handleCancelPublishRequest,
    canCancelPublishRequest,
    onInviteMember: () => setIsInviteDialogOpen(true),
    onManageInvitation: (invitation) =>
      openInvitationAction(invitation, "update"),
    onRejectPublishRequest: handleRejectPublishRequest,
    onReviewRequest: setPublishReviewRequest,
    onUpdateMemberRole: openMemberAction,
    filterInvitations: (rows, status, search) =>
      rows.filter(
        (invitation) =>
          (status === "all" || invitation.status === status) &&
          invitationMatchesSearch(invitation, search),
      ),
    filterPublishRequests: (requests, status, search) =>
      requests.filter(
        (request) =>
          (status === "all" || request.status === status) &&
          publishRequestMatchesSearch({
            request,
            search,
            sourceLabel: publishRequestSourceLabel(request),
            targetLabel: publishRequestTargetLabel(request),
          }),
      ),
    publishRequestStatusLabel,
    publishRequestSourceLabel,
    publishRequestTargetLabel,
  });

  return (
    <>
      <GroupsChrome
        groups={groups}
        groupCount={groupCount}
        activeGroupId={activeGroupId}
        localization={localization}
        isGroupBrowserOpen={isGroupBrowserOpen}
        onCreateGroup={() => setIsCreateGroupDialogOpen(true)}
        onGroupBrowserOpenChange={setIsGroupBrowserOpen}
        onSelectGroup={selectGroup}
      >
        <GroupsWorkspace
          activeGroupId={activeGroupId}
          activeGroup={activeGroup}
          canManageMembers={canManageMembers}
          canReviewPublishRequests={canReviewPublishRequests}
          invitationCount={invitationCount}
          invitationPreviewRows={invitationPreviewRows}
          invitationsError={invitations.error}
          invitationsLoading={invitations.isLoading}
          localization={localization}
          managementPageContent={managementPageContent}
          memberCount={memberCount}
          memberPreviewRows={memberPreviewRows}
          membersError={members.error}
          membersLoading={members.isLoading}
          onApprovePublishRequest={handleApprovePublishRequest}
          onCancelPublishRequest={handleCancelPublishRequest}
          onCreateGroup={() => setIsCreateGroupDialogOpen(true)}
          onInviteMember={() => setIsInviteDialogOpen(true)}
          onManageInvitation={(invitation) =>
            openInvitationAction(invitation, "update")
          }
          onOpenGroupBrowser={() => setIsGroupBrowserOpen(true)}
          onRejectPublishRequest={handleRejectPublishRequest}
          onReviewPublishRequest={setPublishReviewRequest}
          onUpdateMemberRole={openMemberAction}
          canCancelPublishRequest={canCancelPublishRequest}
          publishRequestCount={publishRequestCount}
          publishRequestPreviewRows={publishRequestPreviewRows}
          publishRequestsError={publishRequests.error}
          publishRequestStatusLabel={publishRequestStatusLabel}
          publishRequestSourceLabel={publishRequestSourceLabel}
          publishRequestTargetLabel={publishRequestTargetLabel}
          approvePending={approvePublishRequest.isPending}
          cancelPending={cancelPublishRequest.isPending}
          rejectPending={rejectPublishRequest.isPending}
          sourceSpacePreviewRows={sourceSpacePreviewRows}
          knowledgeBasesError={knowledgeBases.error}
          knowledgeBasesLoading={knowledgeBases.isLoading}
        />
      </GroupsChrome>

      <GroupsDialogs
        activeGroupId={activeGroupId}
        approvePublishRequest={approvePublishRequest}
        canManageMembers={canManageMembers}
        cancelInvitation={cancelInvitation}
        createGroup={createGroup}
        createInvitation={createInvitation}
        handleCancelInvitation={handleCancelInvitation}
        handleCreateGroup={handleSubmit}
        handleCreateInvitation={handleCreateInvitation}
        handleInvitationActionOpenChange={handleInvitationActionOpenChange}
        handleMemberActionOpenChange={handleMemberActionOpenChange}
        handleResendInvitation={handleResendInvitation}
        handleUpdateInvitation={handleUpdateInvitation}
        handleUpdateMember={handleUpdateMember}
        invitationAction={invitationAction}
        invitationActionRole={invitationActionRole}
        invitationEmail={invitationEmail}
        invitationRole={invitationRole}
        isCreateGroupDialogOpen={isCreateGroupDialogOpen}
        isInviteDialogOpen={isInviteDialogOpen}
        localization={localization}
        memberAction={memberAction}
        name={name}
        publishReviewRequest={publishReviewRequest}
        publishReviewSource={publishReviewSource}
        publishRequestSourceLabel={publishRequestSourceLabel}
        publishRequestTargetLabel={publishRequestTargetLabel}
        rejectPublishRequest={rejectPublishRequest}
        resendInvitation={resendInvitation}
        setInvitationActionRole={setInvitationActionRole}
        setInvitationEmail={setInvitationEmail}
        setInvitationRole={setInvitationRole}
        setIsCreateGroupDialogOpen={setIsCreateGroupDialogOpen}
        setIsInviteDialogOpen={setIsInviteDialogOpen}
        setName={setName}
        setPublishReviewRequest={setPublishReviewRequest}
        setUpdateRole={setUpdateRole}
        updateInvitation={updateInvitation}
        updateMember={updateMember}
        updateRole={updateRole}
        updateUserId={updateUserId}
        onApprovePublishRequest={handleApprovePublishRequest}
        onRejectPublishRequest={handleRejectPublishRequest}
      />
    </>
  );
}

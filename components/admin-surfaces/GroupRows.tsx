"use client";

import { FolderIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState, ErrorState, Pill } from "@/components/Status";
import { Button } from "@/components/ui/button";
import type {
  GroupInvitation,
  GroupInvitationStatus,
  GroupMember,
  KnowledgeBase,
  KnowledgePublishRequest,
  KnowledgePublishRequestStatus,
} from "@/model/my-agents";
import {
  type GroupRole,
  InlineLoadingIndicator,
  invitationStatusTone,
  knowledgeSourceHref,
} from "./shared";

type GroupRowsLocalization = {
  groups: {
    advancedGroupDetails: string;
    invitationExpiryLabel: string;
    invitationIdLabel: string;
    invitationStatuses: Record<GroupInvitationStatus, string>;
    invitationsLoading: string;
    manageInvitationAction: string;
    memberJoinedLabel: string;
    memberUserIdLabel: string;
    membersLoading: string;
    noFilteredResultsDescription: string;
    noFilteredResultsTitle: string;
    noInvitationsDescription: string;
    noInvitationsTitle: string;
    noMembersDescription: string;
    noMembersTitle: string;
    noPublishRequestsDescription: string;
    noPublishRequestsTitle: string;
    noSourceSpacesDescription: string;
    noSourceSpacesTitle: string;
    publishApproveNowButton: string;
    publishRejectNowButton: string;
    publishRequestStatuses: Record<KnowledgePublishRequestStatus, string>;
    publishReviewTargetLabel: string;
    publishSourceDocumentOption: string;
    publishSourceKnowledgeBaseOption: string;
    reviewRequestAction: string;
    roles: Record<GroupRole, string>;
    sourceSpacesLoading: string;
    updateMemberRoleAction: string;
  };
};

function emptyRowsState({
  emptyFiltered,
  filteredTitle,
  filteredDescription,
  emptyTitle,
  emptyDescription,
}: {
  emptyFiltered: boolean;
  filteredTitle: string;
  filteredDescription: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <EmptyState
      title={emptyFiltered ? filteredTitle : emptyTitle}
      description={emptyFiltered ? filteredDescription : emptyDescription}
    />
  );
}

export function InvitationRows({
  rows = [],
  isLoading,
  error,
  mode = "management",
  emptyFiltered = false,
  canManageMembers,
  localization,
  onManageInvitation,
}: {
  rows?: GroupInvitation[];
  isLoading: boolean;
  error: unknown;
  mode?: "preview" | "management";
  emptyFiltered?: boolean;
  canManageMembers: boolean;
  localization: GroupRowsLocalization;
  onManageInvitation: (invitation: GroupInvitation) => void;
}) {
  if (isLoading) {
    return (
      <InlineLoadingIndicator label={localization.groups.invitationsLoading} />
    );
  }
  if (error) return <ErrorState error={error} />;
  if (rows.length === 0) {
    return emptyRowsState({
      emptyFiltered,
      filteredTitle: localization.groups.noFilteredResultsTitle,
      filteredDescription: localization.groups.noFilteredResultsDescription,
      emptyTitle: localization.groups.noInvitationsTitle,
      emptyDescription: localization.groups.noInvitationsDescription,
    });
  }
  return (
    <div className="grid gap-2">
      {rows.map((invitation) => (
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
              {mode === "management" ? (
                <details className="mt-2 text-xs text-cal-muted">
                  <summary className="cursor-pointer font-medium text-cal-ink">
                    {localization.groups.advancedGroupDetails}
                  </summary>
                  <p className="mt-1 break-all font-mono">
                    {localization.groups.invitationIdLabel}: {invitation.id}
                  </p>
                </details>
              ) : null}
            </div>
            {canManageMembers ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onManageInvitation(invitation)}
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

export function MemberRows({
  rows = [],
  isLoading,
  error,
  emptyFiltered = false,
  canManageMembers,
  localization,
  onUpdateMemberRole,
}: {
  rows?: GroupMember[];
  isLoading: boolean;
  error: unknown;
  emptyFiltered?: boolean;
  canManageMembers: boolean;
  localization: GroupRowsLocalization;
  onUpdateMemberRole: (member: GroupMember) => void;
}) {
  if (isLoading) {
    return (
      <InlineLoadingIndicator label={localization.groups.membersLoading} />
    );
  }
  if (error) return <ErrorState error={error} />;
  if (rows.length === 0) {
    return emptyRowsState({
      emptyFiltered,
      filteredTitle: localization.groups.noFilteredResultsTitle,
      filteredDescription: localization.groups.noFilteredResultsDescription,
      emptyTitle: localization.groups.noMembersTitle,
      emptyDescription: localization.groups.noMembersDescription,
    });
  }
  return (
    <div className="grid gap-2">
      {rows.map((member) => (
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
                onClick={() => onUpdateMemberRole(member)}
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

export function PublishRequestRows({
  rows = [],
  error,
  emptyFiltered = false,
  canReviewPublishRequests,
  approvePending,
  rejectPending,
  localization,
  publishRequestStatusLabel,
  publishRequestSourceLabel,
  publishRequestTargetLabel,
  onReviewRequest,
  onApproveRequest,
  onRejectRequest,
}: {
  rows?: KnowledgePublishRequest[];
  error: unknown;
  emptyFiltered?: boolean;
  canReviewPublishRequests: boolean;
  approvePending: boolean;
  rejectPending: boolean;
  localization: GroupRowsLocalization;
  publishRequestStatusLabel: (status: KnowledgePublishRequestStatus) => string;
  publishRequestSourceLabel: (request: KnowledgePublishRequest) => string;
  publishRequestTargetLabel: (request: KnowledgePublishRequest) => string;
  onReviewRequest: (request: KnowledgePublishRequest) => void;
  onApproveRequest: (requestId: string) => void;
  onRejectRequest: (requestId: string) => void;
}) {
  if (error) return <ErrorState error={error} />;
  if (rows.length === 0) {
    return emptyRowsState({
      emptyFiltered,
      filteredTitle: localization.groups.noFilteredResultsTitle,
      filteredDescription: localization.groups.noFilteredResultsDescription,
      emptyTitle: localization.groups.noPublishRequestsTitle,
      emptyDescription: localization.groups.noPublishRequestsDescription,
    });
  }
  return (
    <div className="grid gap-2">
      {rows.map((request) => (
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
                  {publishRequestStatusLabel(request.status)}
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
                  onClick={() => onReviewRequest(request)}
                >
                  {localization.groups.reviewRequestAction}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={approvePending || rejectPending}
                  onClick={() => onApproveRequest(request.id)}
                >
                  {localization.groups.publishApproveNowButton}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={approvePending || rejectPending}
                  onClick={() => onRejectRequest(request.id)}
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

export function GroupSourceSpaceRows({
  rows = [],
  isLoading,
  error,
  emptyFiltered = false,
  localization,
}: {
  rows?: KnowledgeBase[];
  isLoading: boolean;
  error: unknown;
  emptyFiltered?: boolean;
  localization: GroupRowsLocalization;
}) {
  if (isLoading) {
    return (
      <InlineLoadingIndicator label={localization.groups.sourceSpacesLoading} />
    );
  }
  if (error) return <ErrorState error={error} />;
  if (rows.length === 0) {
    return emptyRowsState({
      emptyFiltered,
      filteredTitle: localization.groups.noFilteredResultsTitle,
      filteredDescription: localization.groups.noFilteredResultsDescription,
      emptyTitle: localization.groups.noSourceSpacesTitle,
      emptyDescription: localization.groups.noSourceSpacesDescription,
    });
  }
  return (
    <div className="grid gap-2">
      {rows.map((knowledgeBase) => (
        <Link
          key={knowledgeBase.id}
          href={knowledgeSourceHref(knowledgeBase.id)}
          className="flex min-w-0 items-center gap-2 rounded-xl border border-cal-hairline bg-cal-surface-soft p-3 text-sm text-cal-ink transition-colors hover:bg-cal-canvas"
        >
          <FolderIcon className="size-4 shrink-0" />
          <span className="truncate font-medium">{knowledgeBase.name}</span>
        </Link>
      ))}
    </div>
  );
}

"use client";

import Link from "next/link";
import { Field, inputClassName } from "@/components/Field";
import { Button } from "@/components/ui/button";
import type {
  GroupInvitation,
  GroupMember,
  KnowledgeBase,
  KnowledgePublishRequest,
  KnowledgePublishRequestStatus,
} from "@/model/my-agents";
import { renderStatusFilterButton } from "../GroupChrome";
import {
  GroupSourceSpaceRows,
  InvitationRows,
  MemberRows,
  PublishRequestRows,
} from "../GroupRows";
import type { GroupManagementSection } from "../shared";
import type { ManagementPageContent } from "./GroupsWorkspace";
import type {
  InvitationStatusFilter,
  PublishRequestStatusFilter,
} from "./helpers";
import type { GroupsLocalization } from "./types";

export function buildGroupManagementContent({
  activeGroupKnowledgeBases,
  activeGroupName,
  canManageMembers,
  canReviewPublishRequests,
  invitationSearch,
  invitationStatusFilter,
  invitations,
  knowledgeBasesError,
  knowledgeBasesLoading,
  localization,
  memberCount,
  members,
  publishRequestSearch,
  publishRequestStatusFilter,
  publishRequests,
  section,
  sortedPublishRequests,
  approvePending,
  rejectPending,
  setInvitationSearch,
  setInvitationStatusFilter,
  setPublishRequestSearch,
  setPublishRequestStatusFilter,
  onApprovePublishRequest,
  onInviteMember,
  onManageInvitation,
  onRejectPublishRequest,
  onRequestShare,
  onReviewRequest,
  onUpdateMemberRole,
  filterInvitations,
  filterPublishRequests,
  publishRequestStatusLabel,
  publishRequestSourceLabel,
  publishRequestTargetLabel,
}: {
  activeGroupKnowledgeBases: KnowledgeBase[];
  activeGroupName: string;
  canManageMembers: boolean;
  canReviewPublishRequests: boolean;
  invitationSearch: string;
  invitationStatusFilter: InvitationStatusFilter;
  invitations: { data?: GroupInvitation[]; isLoading: boolean; error: unknown };
  knowledgeBasesError: unknown;
  knowledgeBasesLoading: boolean;
  localization: GroupsLocalization;
  memberCount: number;
  members: { data?: GroupMember[]; isLoading: boolean; error: unknown };
  publishRequestSearch: string;
  publishRequestStatusFilter: PublishRequestStatusFilter;
  publishRequests: { error: unknown };
  section?: GroupManagementSection;
  sortedPublishRequests: KnowledgePublishRequest[];
  approvePending: boolean;
  rejectPending: boolean;
  setInvitationSearch: (search: string) => void;
  setInvitationStatusFilter: (status: InvitationStatusFilter) => void;
  setPublishRequestSearch: (search: string) => void;
  setPublishRequestStatusFilter: (status: PublishRequestStatusFilter) => void;
  onApprovePublishRequest: (requestId: string) => void;
  onInviteMember: () => void;
  onManageInvitation: (invitation: GroupInvitation) => void;
  onRejectPublishRequest: (requestId: string) => void;
  onRequestShare: () => void;
  onReviewRequest: (request: KnowledgePublishRequest) => void;
  onUpdateMemberRole: (member: GroupMember) => void;
  filterInvitations: (
    rows: GroupInvitation[],
    status: InvitationStatusFilter,
    search: string,
  ) => GroupInvitation[];
  filterPublishRequests: (
    requests: KnowledgePublishRequest[],
    status: PublishRequestStatusFilter,
    search: string,
  ) => KnowledgePublishRequest[];
  publishRequestStatusLabel: (status: KnowledgePublishRequestStatus) => string;
  publishRequestSourceLabel: (request: KnowledgePublishRequest) => string;
  publishRequestTargetLabel: (request: KnowledgePublishRequest) => string;
}): ManagementPageContent {
  if (!section) return null;
  if (section === "members") {
    return {
      title: localization.groups.manageMembersAction,
      description: localization.groups.membersDrawerDescription.replace(
        "{groupName}",
        activeGroupName,
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
            onUpdateMemberRole={onUpdateMemberRole}
          />
        </div>
      ),
      footer: canManageMembers ? (
        <Button type="button" onClick={onInviteMember}>
          {localization.groups.inviteMemberAction}
        </Button>
      ) : null,
    };
  }
  if (section === "invitations") {
    const filteredRows = filterInvitations(
      invitations.data ?? [],
      invitationStatusFilter,
      invitationSearch,
    );
    return {
      title: localization.groups.viewInvitationsAction,
      description: localization.groups.invitationsDrawerDescription.replace(
        "{groupName}",
        activeGroupName,
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
            onManageInvitation={onManageInvitation}
          />
        </div>
      ),
      footer: canManageMembers ? (
        <Button type="button" onClick={onInviteMember}>
          {localization.groups.inviteMemberAction}
        </Button>
      ) : null,
    };
  }
  if (section === "source-spaces") {
    return {
      title: localization.groups.manageSourceSpacesAction,
      description: localization.groups.sourceSpacesDrawerDescription.replace(
        "{groupName}",
        activeGroupName,
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
            isLoading={knowledgeBasesLoading}
            error={knowledgeBasesError}
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
      activeGroupName,
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
              placeholder={localization.groups.publishRequestSearchPlaceholder}
              value={publishRequestSearch}
              onChange={(event) => setPublishRequestSearch(event.target.value)}
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
          approvePending={approvePending}
          rejectPending={rejectPending}
          localization={localization}
          publishRequestStatusLabel={publishRequestStatusLabel}
          publishRequestSourceLabel={publishRequestSourceLabel}
          publishRequestTargetLabel={publishRequestTargetLabel}
          onReviewRequest={onReviewRequest}
          onApproveRequest={onApprovePublishRequest}
          onRejectRequest={onRejectPublishRequest}
        />
      </div>
    ),
    footer: (
      <Button type="button" onClick={onRequestShare}>
        {localization.groups.requestShareAction}
      </Button>
    ),
  };
}

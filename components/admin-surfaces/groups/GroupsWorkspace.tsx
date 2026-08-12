"use client";

import { ListTreeIcon, NetworkIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState, Pill } from "@/components/Status";
import { Button } from "@/components/ui/button";
import type {
  Group,
  GroupInvitation,
  GroupMember,
  KnowledgeBase,
  KnowledgePublishRequest,
  KnowledgePublishRequestStatus,
} from "@/model/my-agents";
import { GroupSummaryCard } from "../GroupChrome";
import {
  GroupSourceSpaceRows,
  InvitationRows,
  MemberRows,
  PublishRequestRows,
} from "../GroupRows";
import { groupHref, groupManagementHref } from "../shared";
import type { GroupsLocalization } from "./types";

export type ManagementPageContent = {
  title: string;
  description: string;
  body: ReactNode;
  footer: ReactNode;
} | null;

type GroupsWorkspaceProps = {
  activeGroupId?: string;
  activeGroup?: Group;
  activeGroupKnowledgeBases: KnowledgeBase[];
  canManageMembers: boolean;
  canReviewPublishRequests: boolean;
  invitationCount: number;
  invitationPreviewRows: GroupInvitation[];
  invitationsError: unknown;
  invitationsLoading: boolean;
  localization: GroupsLocalization;
  managementPageContent: ManagementPageContent;
  memberCount: number;
  memberPreviewRows: GroupMember[];
  membersError: unknown;
  membersLoading: boolean;
  onApprovePublishRequest: (requestId: string) => void;
  onCancelPublishRequest: (requestId: string) => void;
  onCreateGroup: () => void;
  onInviteMember: () => void;
  onOpenGroupBrowser: () => void;
  onManageInvitation: (invitation: GroupInvitation) => void;
  onRejectPublishRequest: (requestId: string) => void;
  onReviewPublishRequest: (request: KnowledgePublishRequest) => void;
  onUpdateMemberRole: (member: GroupMember) => void;
  canCancelPublishRequest: (request: KnowledgePublishRequest) => boolean;
  publishRequestCount: number;
  publishRequestPreviewRows: KnowledgePublishRequest[];
  publishRequestsError: unknown;
  publishRequestStatusLabel: (status: KnowledgePublishRequestStatus) => string;
  publishRequestSourceLabel: (request: KnowledgePublishRequest) => string;
  publishRequestTargetLabel: (request: KnowledgePublishRequest) => string;
  approvePending: boolean;
  cancelPending: boolean;
  rejectPending: boolean;
  sourceSpacePreviewRows: KnowledgeBase[];
  knowledgeBasesError: unknown;
  knowledgeBasesLoading: boolean;
};

/**
 * "N more" was static text telling the user to go somewhere, while the link
 * that actually goes there was a separate button in the card header. The hint
 * is the link now — it names a destination, so it should be one.
 */
function HiddenRowsHint({
  hiddenCount,
  localization,
  href,
}: {
  hiddenCount: number;
  localization: GroupsLocalization;
  href: string;
}) {
  if (hiddenCount <= 0) return null;
  return (
    <Link
      href={href}
      className="mt-3 block rounded-lg border border-cal-hairline bg-cal-surface-soft p-3 text-xs text-cal-muted transition-colors hover:border-cal-primary/40 hover:bg-cal-surface-soft hover:text-cal-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-km-accent"
    >
      {localization.groups.hiddenRowsHint.replace(
        "{count}",
        String(hiddenCount),
      )}
    </Link>
  );
}

export function GroupsWorkspace({
  activeGroupId,
  activeGroup,
  activeGroupKnowledgeBases,
  canManageMembers,
  canReviewPublishRequests,
  invitationCount,
  invitationPreviewRows,
  invitationsError,
  invitationsLoading,
  localization,
  managementPageContent,
  memberCount,
  memberPreviewRows,
  membersError,
  membersLoading,
  onApprovePublishRequest,
  onCancelPublishRequest,
  onCreateGroup,
  onInviteMember,
  onOpenGroupBrowser,
  onManageInvitation,
  onRejectPublishRequest,
  onReviewPublishRequest,
  onUpdateMemberRole,
  canCancelPublishRequest,
  publishRequestCount,
  publishRequestPreviewRows,
  publishRequestsError,
  publishRequestStatusLabel,
  publishRequestSourceLabel,
  publishRequestTargetLabel,
  approvePending,
  cancelPending,
  rejectPending,
  sourceSpacePreviewRows,
  knowledgeBasesError,
  knowledgeBasesLoading,
}: GroupsWorkspaceProps) {
  if (!activeGroupId) {
    return (
      <div className="grid min-h-[28rem] place-items-center bg-cal-canvas/40 p-6">
        <EmptyState
          title={localization.groups.noSelectedTitle}
          description={localization.groups.emptyDescription}
        />
        <Button type="button" onClick={onCreateGroup}>
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
            <h2 className="mt-2 truncate text-2xl font-semibold text-cal-ink">
              {activeGroup?.name ?? localization.groups.noSelectedDescription}
            </h2>
            <p className="mt-2 text-sm leading-6 text-cal-muted">
              {localization.groups.publishBoundaryDescription}
            </p>
            <details className="mt-3 max-w-xl rounded-lg border border-cal-hairline bg-km-surface p-3 text-xs text-cal-muted">
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
              onClick={onOpenGroupBrowser}
            >
              <ListTreeIcon />
              {localization.groups.browseGroupsAction}
            </Button>
            {/* No create button here: the group browser in the left pane
                already carries a `+` wired to the same `onCreateGroup`. */}
            <Button
              type="button"
              onClick={onInviteMember}
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
          <section className="mx-auto grid max-w-5xl gap-4 rounded-2xl border border-cal-hairline bg-km-surface p-4 shadow-card sm:p-6">
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
                <h3 className="mt-4 text-xl font-semibold text-cal-ink">
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
            <section className="rounded-2xl border border-cal-hairline bg-km-surface p-4 shadow-card">
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
                isLoading={membersLoading}
                error={membersError}
                canManageMembers={canManageMembers}
                localization={localization}
                onUpdateMemberRole={onUpdateMemberRole}
              />
              <HiddenRowsHint
                href={groupManagementHref(activeGroupId ?? "", "members")}
                hiddenCount={memberCount - memberPreviewRows.length}
                localization={localization}
              />
            </section>

            <section className="rounded-2xl border border-cal-hairline bg-km-surface p-4 shadow-card">
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
                        onClick={onInviteMember}
                      >
                        {localization.groups.inviteMemberAction}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
              <InvitationRows
                rows={invitationPreviewRows}
                isLoading={invitationsLoading}
                error={invitationsError}
                mode="preview"
                canManageMembers={canManageMembers}
                localization={localization}
                onManageInvitation={onManageInvitation}
              />
              <HiddenRowsHint
                href={groupManagementHref(activeGroupId ?? "", "invitations")}
                hiddenCount={invitationCount - invitationPreviewRows.length}
                localization={localization}
              />
            </section>

            <section className="rounded-2xl border border-cal-hairline bg-km-surface p-4 shadow-card">
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
                isLoading={knowledgeBasesLoading}
                error={knowledgeBasesError}
                localization={localization}
              />
              <HiddenRowsHint
                href={groupManagementHref(activeGroupId ?? "", "source-spaces")}
                hiddenCount={
                  activeGroupKnowledgeBases.length -
                  sourceSpacePreviewRows.length
                }
                localization={localization}
              />
            </section>

            <section className="rounded-2xl border border-cal-hairline bg-km-surface p-4 shadow-card">
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
                </div>
              </div>
              <PublishRequestRows
                rows={publishRequestPreviewRows}
                error={publishRequestsError}
                canReviewPublishRequests={canReviewPublishRequests}
                canCancelPublishRequest={canCancelPublishRequest}
                approvePending={approvePending}
                cancelPending={cancelPending}
                rejectPending={rejectPending}
                localization={localization}
                publishRequestStatusLabel={publishRequestStatusLabel}
                publishRequestSourceLabel={publishRequestSourceLabel}
                publishRequestTargetLabel={publishRequestTargetLabel}
                onReviewRequest={onReviewPublishRequest}
                onApproveRequest={onApprovePublishRequest}
                onCancelRequest={onCancelPublishRequest}
                onRejectRequest={onRejectPublishRequest}
              />
              <HiddenRowsHint
                href={groupManagementHref(
                  activeGroupId ?? "",
                  "publish-requests",
                )}
                hiddenCount={
                  publishRequestCount - publishRequestPreviewRows.length
                }
                localization={localization}
              />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

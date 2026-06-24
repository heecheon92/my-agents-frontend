"use client";

import type { FormEvent, ReactNode } from "react";
import { Field, inputClassName } from "@/components/Field";
import { ErrorState } from "@/components/Status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  GroupInvitation,
  GroupMember,
  KnowledgePublishRequest,
} from "@/model/my-agents";
import { type GroupRole, RoleSelect } from "../shared";
import type { MutationState, PublishSourceState } from "./dialogTypes";
import { GroupsPublishDialogs } from "./GroupsPublishDialogs";
import type { GroupsLocalization } from "./types";

type GroupsDialogsProps = {
  activeGroupId?: string;
  approvePublishRequest: MutationState;
  canManageMembers: boolean;
  cancelInvitation: MutationState;
  createGroup: MutationState;
  createInvitation: MutationState;
  handleCancelInvitation: () => void;
  handleCreateGroup: (event: FormEvent<HTMLFormElement>) => void;
  handleCreateInvitation: (event: FormEvent<HTMLFormElement>) => void;
  handleInvitationActionOpenChange: (open: boolean) => void;
  handleMemberActionOpenChange: (open: boolean) => void;
  handleResendInvitation: () => void;
  handleUpdateInvitation: (event: FormEvent<HTMLFormElement>) => void;
  handleUpdateMember: (event: FormEvent<HTMLFormElement>) => void;
  invitationAction?: {
    invitation: GroupInvitation;
    type: "update" | "resend" | "cancel";
  };
  invitationActionRole: GroupRole;
  invitationEmail: string;
  invitationRole: GroupRole;
  isCreateGroupDialogOpen: boolean;
  isInviteDialogOpen: boolean;
  localization: GroupsLocalization;
  memberAction?: GroupMember;
  name: string;
  publishReviewRequest?: KnowledgePublishRequest;
  publishReviewSource: PublishSourceState;
  publishRequestSourceLabel: (request: KnowledgePublishRequest) => string;
  publishRequestTargetLabel: (request: KnowledgePublishRequest) => string;
  rejectPublishRequest: MutationState;
  resendInvitation: MutationState;
  setInvitationActionRole: (role: GroupRole) => void;
  setInvitationEmail: (email: string) => void;
  setInvitationRole: (role: GroupRole) => void;
  setIsCreateGroupDialogOpen: (open: boolean) => void;
  setIsInviteDialogOpen: (open: boolean) => void;
  setName: (name: string) => void;
  setPublishReviewRequest: (
    request: KnowledgePublishRequest | undefined,
  ) => void;
  setUpdateRole: (role: GroupRole) => void;
  updateInvitation: MutationState;
  updateMember: MutationState;
  updateRole: GroupRole;
  updateUserId: string;
  onApprovePublishRequest: (requestId: string) => void;
  onRejectPublishRequest: (requestId: string) => void;
};

function DialogActions({ children }: { children: ReactNode }) {
  return <DialogFooter>{children}</DialogFooter>;
}

export function GroupsDialogs({
  activeGroupId,
  approvePublishRequest,
  canManageMembers,
  cancelInvitation,
  createGroup,
  createInvitation,
  handleCancelInvitation,
  handleCreateGroup,
  handleCreateInvitation,
  handleInvitationActionOpenChange,
  handleMemberActionOpenChange,
  handleResendInvitation,
  handleUpdateInvitation,
  handleUpdateMember,
  invitationAction,
  invitationActionRole,
  invitationEmail,
  invitationRole,
  isCreateGroupDialogOpen,
  isInviteDialogOpen,
  localization,
  memberAction,
  name,
  publishReviewRequest,
  publishReviewSource,
  publishRequestSourceLabel,
  publishRequestTargetLabel,
  rejectPublishRequest,
  resendInvitation,
  setInvitationActionRole,
  setInvitationEmail,
  setInvitationRole,
  setIsCreateGroupDialogOpen,
  setIsInviteDialogOpen,
  setName,
  setPublishReviewRequest,
  setUpdateRole,
  updateInvitation,
  updateMember,
  updateRole,
  updateUserId,
  onApprovePublishRequest,
  onRejectPublishRequest,
}: GroupsDialogsProps) {
  return (
    <>
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
            onSubmit={handleCreateGroup}
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
            <DialogActions>
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
            </DialogActions>
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
            <DialogActions>
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
            </DialogActions>
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
              <DialogActions>
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
              </DialogActions>
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
              <DialogActions>
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
              </DialogActions>
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
            <DialogActions>
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
            </DialogActions>
          </form>
        </DialogContent>
      </Dialog>

      <GroupsPublishDialogs
        activeGroupId={activeGroupId}
        approvePublishRequest={approvePublishRequest}
        localization={localization}
        publishReviewRequest={publishReviewRequest}
        publishReviewSource={publishReviewSource}
        publishRequestSourceLabel={publishRequestSourceLabel}
        publishRequestTargetLabel={publishRequestTargetLabel}
        rejectPublishRequest={rejectPublishRequest}
        setPublishReviewRequest={setPublishReviewRequest}
        onApprovePublishRequest={onApprovePublishRequest}
        onRejectPublishRequest={onRejectPublishRequest}
      />
    </>
  );
}

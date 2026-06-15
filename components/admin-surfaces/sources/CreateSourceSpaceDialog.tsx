"use client";

import type { FormEvent } from "react";
import type { KnowledgeBaseCreationScope } from "@/components/knowledge-base-create";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Group } from "@/model/my-agents";
import type { Localization } from "@/utils/localization";
import { SourceSpaceCreateForm } from "../SourceSpaceCreateForm";

type CreateSourceSpaceDialogProps = {
  canManageSystemKnowledge: boolean;
  createKnowledgeBaseError: unknown;
  groupsIsLoading: boolean;
  isCreateSourceSpaceDisabled: boolean;
  isCreatingSystemSourceSpace: boolean;
  isCreatingTeamSourceSpace: boolean;
  isKnowledgeBaseSelectionLocked: boolean;
  localization: Localization["admin"];
  onGroupChange: (groupId: string) => void;
  onNameChange: (name: string) => void;
  onOpenChange: (open: boolean) => void;
  onScopeChange: (scope: KnowledgeBaseCreationScope) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  open: boolean;
  shouldShowFirstSourceSpaceForm: boolean;
  sourceSpaceGroupId: string;
  sourceSpaceGroupOptions: Group[];
  sourceSpaceName: string;
  sourceSpaceScope: KnowledgeBaseCreationScope;
};

export function CreateSourceSpaceDialog({
  canManageSystemKnowledge,
  createKnowledgeBaseError,
  groupsIsLoading,
  isCreateSourceSpaceDisabled,
  isCreatingSystemSourceSpace,
  isCreatingTeamSourceSpace,
  isKnowledgeBaseSelectionLocked,
  localization,
  onGroupChange,
  onNameChange,
  onOpenChange,
  onScopeChange,
  onSubmit,
  open,
  shouldShowFirstSourceSpaceForm,
  sourceSpaceGroupId,
  sourceSpaceGroupOptions,
  sourceSpaceName,
  sourceSpaceScope,
}: CreateSourceSpaceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          groupsIsLoading={groupsIsLoading}
          isCreatingTeamSourceSpace={isCreatingTeamSourceSpace}
          isCreatingSystemSourceSpace={isCreatingSystemSourceSpace}
          isKnowledgeBaseSelectionLocked={isKnowledgeBaseSelectionLocked}
          isCreateSourceSpaceDisabled={isCreateSourceSpaceDisabled}
          createKnowledgeBaseError={createKnowledgeBaseError}
          onSubmit={onSubmit}
          onNameChange={onNameChange}
          onScopeChange={onScopeChange}
          onGroupChange={onGroupChange}
        />
      </DialogContent>
    </Dialog>
  );
}

"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Group, KnowledgeBase } from "@/model/my-agents";
import type { Localization } from "@/utils/localization";
import { SourceSpaceTree } from "../SourceSpaceTree";
import type { DocumentDestination } from "../shared";

type SourceSpaceBrowserSheetProps = {
  activeKnowledgeBaseId?: string;
  activeSystemKnowledgeBaseId?: string;
  activeTeamGroupId?: string;
  activeTeamKnowledgeBaseId?: string;
  allKnowledgeBases: KnowledgeBase[];
  canManageSystemKnowledge: boolean;
  documentKnowledgeBases: KnowledgeBase[];
  effectiveDocumentDestination: DocumentDestination;
  getSourceSpaceActions: (knowledgeBase: KnowledgeBase) => {
    canManage: boolean;
    canShare: boolean;
  };
  groupsError: unknown;
  isKnowledgeBaseSelectionLocked: boolean;
  knowledgeBasesError: unknown;
  knowledgeBasesIsLoading: boolean;
  localization: Localization["admin"];
  onCreateSourceSpace: () => void;
  onDeleteSourceSpace: (knowledgeBase: KnowledgeBase) => void;
  onOpenChange: (open: boolean) => void;
  onRenameSourceSpace: (knowledgeBase: KnowledgeBase) => void;
  onSelectPersonalSourceSpace: (knowledgeBaseId: string) => void;
  onSelectSystemSourceSpace: (knowledgeBaseId: string) => void;
  onSelectTeamGroup: (groupId: string) => void;
  onSelectTeamSourceSpace: (groupId: string, knowledgeBaseId: string) => void;
  onShareSourceSpace: (knowledgeBase: KnowledgeBase) => void;
  open: boolean;
  sourceSpaceCount: number;
  systemKnowledgeBases: KnowledgeBase[];
  teamGroups: Group[];
};

export function SourceSpaceBrowserSheet({
  activeKnowledgeBaseId,
  activeSystemKnowledgeBaseId,
  activeTeamGroupId,
  activeTeamKnowledgeBaseId,
  allKnowledgeBases,
  canManageSystemKnowledge,
  documentKnowledgeBases,
  effectiveDocumentDestination,
  getSourceSpaceActions,
  groupsError,
  isKnowledgeBaseSelectionLocked,
  knowledgeBasesError,
  knowledgeBasesIsLoading,
  localization,
  onCreateSourceSpace,
  onDeleteSourceSpace,
  onOpenChange,
  onRenameSourceSpace,
  onSelectPersonalSourceSpace,
  onSelectSystemSourceSpace,
  onSelectTeamGroup,
  onSelectTeamSourceSpace,
  onShareSourceSpace,
  open,
  sourceSpaceCount,
  systemKnowledgeBases,
  teamGroups,
}: SourceSpaceBrowserSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
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
        <SourceSpaceTree
          localization={localization}
          sourceSpaceCount={sourceSpaceCount}
          knowledgeBasesIsLoading={knowledgeBasesIsLoading}
          knowledgeBasesError={knowledgeBasesError}
          groupsError={groupsError}
          documentKnowledgeBases={documentKnowledgeBases}
          systemKnowledgeBases={systemKnowledgeBases}
          allKnowledgeBases={allKnowledgeBases}
          teamGroups={teamGroups}
          canManageSystemKnowledge={canManageSystemKnowledge}
          isKnowledgeBaseSelectionLocked={isKnowledgeBaseSelectionLocked}
          effectiveDocumentDestination={effectiveDocumentDestination}
          activeKnowledgeBaseId={activeKnowledgeBaseId}
          activeSystemKnowledgeBaseId={activeSystemKnowledgeBaseId}
          activeTeamGroupId={activeTeamGroupId}
          activeTeamKnowledgeBaseId={activeTeamKnowledgeBaseId}
          getSourceSpaceActions={getSourceSpaceActions}
          onCreateSourceSpace={onCreateSourceSpace}
          onDeleteSourceSpace={onDeleteSourceSpace}
          onRenameSourceSpace={onRenameSourceSpace}
          onSelectPersonalSourceSpace={onSelectPersonalSourceSpace}
          onSelectSystemSourceSpace={onSelectSystemSourceSpace}
          onSelectTeamGroup={onSelectTeamGroup}
          onSelectTeamSourceSpace={onSelectTeamSourceSpace}
          onShareSourceSpace={onShareSourceSpace}
        />
      </SheetContent>
    </Sheet>
  );
}

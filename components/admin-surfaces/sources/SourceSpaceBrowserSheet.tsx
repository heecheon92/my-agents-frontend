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
  groupsError: unknown;
  isKnowledgeBaseSelectionLocked: boolean;
  knowledgeBasesError: unknown;
  knowledgeBasesIsLoading: boolean;
  localization: Localization["admin"];
  onCreateSourceSpace: () => void;
  onOpenChange: (open: boolean) => void;
  onSelectPersonalSourceSpace: (knowledgeBaseId: string) => void;
  onSelectSystemSourceSpace: (knowledgeBaseId: string) => void;
  onSelectTeamGroup: (groupId: string) => void;
  onSelectTeamSourceSpace: (groupId: string, knowledgeBaseId: string) => void;
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
  groupsError,
  isKnowledgeBaseSelectionLocked,
  knowledgeBasesError,
  knowledgeBasesIsLoading,
  localization,
  onCreateSourceSpace,
  onOpenChange,
  onSelectPersonalSourceSpace,
  onSelectSystemSourceSpace,
  onSelectTeamGroup,
  onSelectTeamSourceSpace,
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
          onCreateSourceSpace={onCreateSourceSpace}
          onSelectPersonalSourceSpace={onSelectPersonalSourceSpace}
          onSelectSystemSourceSpace={onSelectSystemSourceSpace}
          onSelectTeamGroup={onSelectTeamGroup}
          onSelectTeamSourceSpace={onSelectTeamSourceSpace}
        />
      </SheetContent>
    </Sheet>
  );
}

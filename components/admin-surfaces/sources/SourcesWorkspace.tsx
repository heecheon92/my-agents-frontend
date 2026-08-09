"use client";

import {
  DatabaseIcon,
  FileTextIcon,
  ListTreeIcon,
  PlusIcon,
  SearchIcon,
  UploadIcon,
} from "lucide-react";
import Link from "next/link";
import { OnboardingTarget } from "@/components/onboarding/OnboardingTarget";
import { Button } from "@/components/ui/button";
import type { Document, Group, KnowledgeBase } from "@/model/my-agents";
import type { Localization } from "@/utils/localization";
import { DocumentsTable } from "../DocumentsTable";
import { SourceSpaceTree } from "../SourceSpaceTree";
import type { DocumentDestination } from "../shared";
import type { SourceActionDialogType } from "../source-actions/types";

type SourcesWorkspaceProps = {
  activeDocumentId?: string;
  activeIngestionDocumentIds: Set<string>;
  activeKnowledgeBaseId?: string;
  activeSourceSpace?: KnowledgeBase;
  activeSystemKnowledgeBaseId?: string;
  activeTeamGroupId?: string;
  activeTeamKnowledgeBaseId?: string;
  allKnowledgeBases: KnowledgeBase[];
  canManageSystemKnowledge: boolean;
  canShareActiveDocument: boolean;
  documentKnowledgeBases: KnowledgeBase[];
  documents: { data?: Document[]; isLoading: boolean; error: unknown };
  documentSearch: string;
  onDocumentSearchChange: (value: string) => void;
  effectiveDocumentDestination: DocumentDestination;
  getSourceSpaceActions: (knowledgeBase: KnowledgeBase) => {
    canManage: boolean;
    canShare: boolean;
  };
  groupsError: unknown;
  hasActiveKnowledgeBase: boolean;
  isKnowledgeBaseSelectionLocked: boolean;
  knowledgeBasesError: unknown;
  knowledgeBasesIsLoading: boolean;
  localization: Localization["admin"];
  onCreateSourceSpace: () => void;
  onDeleteSourceSpace: (knowledgeBase: KnowledgeBase) => void;
  onOpenFileUploadDialog: () => void;
  onOpenSourceActions: (
    documentId: string,
    action: SourceActionDialogType,
  ) => void;
  onOpenSourceSpaceBrowser: () => void;
  onOpenTextSourceDialog: () => void;
  onRenameSourceSpace: (knowledgeBase: KnowledgeBase) => void;
  onSelectPersonalSourceSpace: (knowledgeBaseId: string) => void;
  onSelectSystemSourceSpace: (knowledgeBaseId: string) => void;
  onSelectTeamGroup: (groupId: string) => void;
  onSelectTeamSourceSpace: (groupId: string, knowledgeBaseId: string) => void;
  onShareSourceSpace: (knowledgeBase: KnowledgeBase) => void;
  readyDocumentCount: number;
  sourceSpaceCount: number;
  systemKnowledgeBases: KnowledgeBase[];
  teamGroups: Group[];
};

export function SourcesWorkspace({
  activeDocumentId,
  activeIngestionDocumentIds,
  documentSearch,
  onDocumentSearchChange,
  activeKnowledgeBaseId,
  activeSourceSpace,
  activeSystemKnowledgeBaseId,
  activeTeamGroupId,
  activeTeamKnowledgeBaseId,
  allKnowledgeBases,
  canManageSystemKnowledge,
  canShareActiveDocument,
  documentKnowledgeBases,
  documents,
  effectiveDocumentDestination,
  getSourceSpaceActions,
  groupsError,
  hasActiveKnowledgeBase,
  isKnowledgeBaseSelectionLocked,
  knowledgeBasesError,
  knowledgeBasesIsLoading,
  localization,
  onCreateSourceSpace,
  onDeleteSourceSpace,
  onOpenFileUploadDialog,
  onOpenSourceActions,
  onOpenSourceSpaceBrowser,
  onOpenTextSourceDialog,
  onRenameSourceSpace,
  onSelectPersonalSourceSpace,
  onSelectSystemSourceSpace,
  onSelectTeamGroup,
  onSelectTeamSourceSpace,
  onShareSourceSpace,
  readyDocumentCount,
  sourceSpaceCount,
  systemKnowledgeBases,
  teamGroups,
}: SourcesWorkspaceProps) {
  return (
    <div className="flex min-h-[calc(100dvh-11rem)] flex-col overflow-hidden rounded-3xl border border-cal-hairline bg-km-surface shadow-overlay lg:grid lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="hidden min-h-0 border-r border-cal-hairline lg:flex">
        <OnboardingTarget
          id="documents.knowledge-destination"
          className="flex min-h-0 flex-1"
        >
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
        </OnboardingTarget>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-cal-hairline bg-cal-canvas/60 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 text-left">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
                <DatabaseIcon className="size-3.5" />
                <span>
                  {effectiveDocumentDestination === "team"
                    ? localization.common.scopeGroup
                    : effectiveDocumentDestination === "system"
                      ? localization.common.scopeSystem
                      : localization.common.scopePersonal}
                </span>
              </div>
              <h2 className="mt-2 truncate text-2xl font-semibold text-cal-ink">
                {activeSourceSpace?.name ??
                  localization.documents.noSelectedSourceSpaceTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-cal-muted">
                {localization.documents.sourceCountLabel
                  .replace("{count}", String(documents.data?.length ?? 0))
                  .replace("{ready}", String(readyDocumentCount))}
              </p>
              {effectiveDocumentDestination === "system" ? (
                <p className="mt-2 max-w-3xl rounded-xl border border-cal-warning/25 bg-cal-warning/10 px-3 py-2 text-sm leading-6 text-cal-warning">
                  {localization.documents.systemSourcePublicWarning}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="lg:hidden"
                onClick={onOpenSourceSpaceBrowser}
              >
                <ListTreeIcon />
                {localization.documents.browseSourceSpacesAction}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onCreateSourceSpace}
              >
                <PlusIcon />
                {localization.documents.addSourceSpaceAction}
              </Button>
              <OnboardingTarget id="documents.upload-action">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onOpenFileUploadDialog}
                  disabled={!hasActiveKnowledgeBase}
                >
                  <UploadIcon />
                  {localization.documents.uploadFilesAction}
                </Button>
              </OnboardingTarget>
              <Button
                type="button"
                onClick={onOpenTextSourceDialog}
                disabled={!hasActiveKnowledgeBase}
              >
                <FileTextIcon />
                {localization.documents.addTextSourceAction}
              </Button>
            </div>
          </div>
          {(documents.data?.length ?? 0) > 0 ? (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-cal-hairline bg-km-surface p-4 text-sm text-cal-muted sm:flex-row sm:items-center sm:justify-between">
              <p className="leading-6">
                {localization.documents.askSourcesHint}
              </p>
              <Button
                nativeButton={false}
                render={<Link href="/chat" />}
                size="sm"
              >
                {localization.documents.askSourcesAction}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-auto bg-cal-canvas/40 p-4 xl:p-6">
          <section className="flex min-h-[28rem] min-w-0 flex-col rounded-2xl border border-cal-hairline bg-km-surface shadow-card">
            <div className="flex shrink-0 flex-col gap-3 border-b border-cal-hairline p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-cal-ink">
                  {localization.documents.sourceTableTitle}
                </h2>
                <p className="mt-1 text-sm leading-6 text-cal-muted">
                  {localization.documents.sourceTableDescription}
                </p>
              </div>
              {/* This was a decorative chip: a search icon and static text
                  that looked like a control but was not an input. It filters
                  for real now — client-side, which is right at the list sizes
                  a single knowledge base holds. */}
              <label className="flex items-center gap-2 rounded-control border border-cal-hairline bg-cal-canvas px-3 py-2 text-sm text-cal-muted focus-within:border-km-accent focus-within:ring-3 focus-within:ring-km-accent/20">
                <SearchIcon className="size-4 shrink-0" aria-hidden="true" />
                <span className="sr-only">
                  {localization.documents.sourceSearchLabel}
                </span>
                <input
                  type="search"
                  value={documentSearch}
                  onChange={(event) =>
                    onDocumentSearchChange(event.target.value)
                  }
                  placeholder={localization.documents.sourceSearchPlaceholder}
                  className="w-full min-w-0 bg-transparent text-cal-ink outline-none placeholder:text-cal-muted-soft sm:w-44"
                />
              </label>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <DocumentsTable
                documents={documents}
                activeDocumentId={activeDocumentId}
                activeIngestionDocumentIds={activeIngestionDocumentIds}
                canReingestDocuments={hasActiveKnowledgeBase}
                canShareDocuments={canShareActiveDocument}
                localization={localization}
                onOpenSourceActions={onOpenSourceActions}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

"use client";

import {
  FolderIcon,
  MenuIcon,
  NetworkIcon,
  PencilIcon,
  PlusIcon,
  Share2Icon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { groupKnowledgeBasesForGroup } from "@/components/document-knowledge-base";
import { EmptyState, ErrorState } from "@/components/Status";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Group, KnowledgeBase } from "@/model/my-agents";
import { type DocumentDestination, knowledgeSourceHref } from "./shared";

type SourceSpaceActionAvailability = {
  canManage: boolean;
  canShare: boolean;
};

type SourceSpaceTreeLocalization = {
  common: { loading: string };
  documents: {
    sourceSpacesTitle: string;
    sourceSpacesDescription: string;
    addSourceSpaceAction: string;
    deleteSourceSpaceAction: string;
    knowledgeBaseLockedHint: string;
    noKnowledgeBaseTitle: string;
    noKnowledgeBaseDescription: string;
    personalSourceSpacesTitle: string;
    systemSourceSpacesTitle: string;
    noSystemKnowledgeBaseDescription: string;
    teamSourceSpacesTitle: string;
    noTeamKnowledgeBaseDescription: string;
    renameSourceSpaceAction: string;
    shareSourceSpaceAction: string;
    sourceSpaceRowActions: string;
    sourceSpaceRowActionsLabel: string;
  };
  groups: { roles: Record<string, string> };
};

type SourceSpaceTreeProps = {
  localization: SourceSpaceTreeLocalization;
  sourceSpaceCount: number;
  knowledgeBasesIsLoading: boolean;
  knowledgeBasesError: unknown;
  groupsError: unknown;
  documentKnowledgeBases: KnowledgeBase[];
  systemKnowledgeBases: KnowledgeBase[];
  allKnowledgeBases: KnowledgeBase[];
  teamGroups: Group[];
  canManageSystemKnowledge: boolean;
  isKnowledgeBaseSelectionLocked: boolean;
  effectiveDocumentDestination: DocumentDestination;
  activeKnowledgeBaseId?: string;
  activeSystemKnowledgeBaseId?: string;
  activeTeamGroupId?: string;
  activeTeamKnowledgeBaseId?: string;
  getSourceSpaceActions: (
    knowledgeBase: KnowledgeBase,
  ) => SourceSpaceActionAvailability;
  onCreateSourceSpace: () => void;
  onDeleteSourceSpace: (knowledgeBase: KnowledgeBase) => void;
  onRenameSourceSpace: (knowledgeBase: KnowledgeBase) => void;
  onSelectPersonalSourceSpace: (knowledgeBaseId: string) => void;
  onSelectSystemSourceSpace: (knowledgeBaseId: string) => void;
  onSelectTeamGroup: (groupId: string) => void;
  onSelectTeamSourceSpace: (groupId: string, knowledgeBaseId: string) => void;
  onShareSourceSpace: (knowledgeBase: KnowledgeBase) => void;
};

export function SourceSpaceTree({
  localization,
  sourceSpaceCount,
  knowledgeBasesIsLoading,
  knowledgeBasesError,
  groupsError,
  documentKnowledgeBases,
  systemKnowledgeBases,
  allKnowledgeBases,
  teamGroups,
  canManageSystemKnowledge,
  isKnowledgeBaseSelectionLocked,
  effectiveDocumentDestination,
  activeKnowledgeBaseId,
  activeSystemKnowledgeBaseId,
  activeTeamGroupId,
  activeTeamKnowledgeBaseId,
  getSourceSpaceActions,
  onCreateSourceSpace,
  onDeleteSourceSpace,
  onRenameSourceSpace,
  onSelectPersonalSourceSpace,
  onSelectSystemSourceSpace,
  onSelectTeamGroup,
  onSelectTeamSourceSpace,
  onShareSourceSpace,
}: SourceSpaceTreeProps) {
  function renderSourceSpaceActions(
    knowledgeBase: KnowledgeBase,
    active: boolean,
  ) {
    const actions = getSourceSpaceActions(knowledgeBase);

    if (!actions.canManage && !actions.canShare) return null;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className={cn(
                "mr-1 text-current",
                active
                  ? "hover:bg-white/15 focus-visible:ring-white/30 data-[popup-open]:bg-white/15"
                  : "hover:bg-cal-surface-strong/80 focus-visible:ring-cal-primary/20 data-[popup-open]:bg-cal-surface-strong/80",
              )}
              aria-label={localization.documents.sourceSpaceRowActionsLabel.replace(
                "{name}",
                knowledgeBase.name,
              )}
            />
          }
        >
          <MenuIcon />
          <span className="sr-only">
            {localization.documents.sourceSpaceRowActions}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {actions.canManage ? (
            <DropdownMenuItem
              onClick={() => onRenameSourceSpace(knowledgeBase)}
            >
              <PencilIcon />
              {localization.documents.renameSourceSpaceAction}
            </DropdownMenuItem>
          ) : null}
          {actions.canShare ? (
            <DropdownMenuItem onClick={() => onShareSourceSpace(knowledgeBase)}>
              <Share2Icon />
              {localization.documents.shareSourceSpaceAction}
            </DropdownMenuItem>
          ) : null}
          {actions.canManage && actions.canShare ? (
            <DropdownMenuSeparator />
          ) : null}
          {actions.canManage ? (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDeleteSourceSpace(knowledgeBase)}
            >
              <Trash2Icon />
              {localization.documents.deleteSourceSpaceAction}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function renderSourceSpaceButton({
    knowledgeBase,
    active,
    onSelect,
  }: {
    knowledgeBase: KnowledgeBase;
    active: boolean;
    onSelect: () => void;
  }) {
    return (
      <div
        key={knowledgeBase.id}
        className={cn(
          "group/source-space-row flex w-full min-w-0 items-center gap-1 rounded-xl text-sm transition-colors",
          active
            ? "bg-cal-primary text-white shadow-[0_10px_24px_rgb(20_33_61/0.16)]"
            : "text-cal-ink hover:bg-cal-surface-soft",
        )}
      >
        <Link
          href={knowledgeSourceHref(knowledgeBase.id)}
          scroll={false}
          aria-current={active ? "page" : undefined}
          aria-disabled={isKnowledgeBaseSelectionLocked ? true : undefined}
          onClick={(event) => {
            if (isKnowledgeBaseSelectionLocked) {
              event.preventDefault();
              return;
            }
            onSelect();
          }}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-xl py-2.5 pr-1 pl-3 text-left aria-disabled:pointer-events-none aria-disabled:opacity-60"
        >
          <FolderIcon className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate font-medium">
            {knowledgeBase.name}
          </span>
        </Link>
        {renderSourceSpaceActions(knowledgeBase, active)}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="shrink-0 border-b border-cal-hairline px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-cal-ink">
              {localization.documents.sourceSpacesTitle}
            </h2>
            <p className="mt-1 text-xs leading-5 text-cal-muted">
              {localization.documents.sourceSpacesDescription.replace(
                "{count}",
                String(sourceSpaceCount),
              )}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={localization.documents.addSourceSpaceAction}
            onClick={onCreateSourceSpace}
          >
            <PlusIcon />
          </Button>
        </div>
        {isKnowledgeBaseSelectionLocked ? (
          <p className="mt-3 rounded-lg bg-cal-surface-soft px-3 py-2 text-xs leading-5 text-cal-muted">
            {localization.documents.knowledgeBaseLockedHint}
          </p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {knowledgeBasesIsLoading ? (
          <p className="px-3 text-sm text-cal-muted">
            {localization.common.loading}
          </p>
        ) : null}
        {knowledgeBasesError ? (
          <ErrorState error={knowledgeBasesError} />
        ) : null}
        {!knowledgeBasesIsLoading && sourceSpaceCount === 0 ? (
          <div className="px-1">
            <EmptyState
              title={localization.documents.noKnowledgeBaseTitle}
              description={localization.documents.noKnowledgeBaseDescription}
            />
            <Button
              type="button"
              className="mt-3 w-full"
              onClick={onCreateSourceSpace}
            >
              {localization.documents.addSourceSpaceAction}
            </Button>
          </div>
        ) : null}
        {documentKnowledgeBases.length > 0 ? (
          <section className="grid gap-1">
            <h3 className="px-3 pb-1 text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
              {localization.documents.personalSourceSpacesTitle}
            </h3>
            {documentKnowledgeBases.map((knowledgeBase) =>
              renderSourceSpaceButton({
                knowledgeBase,
                active:
                  effectiveDocumentDestination === "personal" &&
                  knowledgeBase.id === activeKnowledgeBaseId,
                onSelect: () => onSelectPersonalSourceSpace(knowledgeBase.id),
              }),
            )}
          </section>
        ) : null}
        {canManageSystemKnowledge ? (
          <section className="mt-5 grid gap-1">
            <h3 className="px-3 pb-1 text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
              {localization.documents.systemSourceSpacesTitle}
            </h3>
            {systemKnowledgeBases.length > 0 ? (
              systemKnowledgeBases.map((knowledgeBase) =>
                renderSourceSpaceButton({
                  knowledgeBase,
                  active:
                    effectiveDocumentDestination === "system" &&
                    knowledgeBase.id === activeSystemKnowledgeBaseId,
                  onSelect: () => onSelectSystemSourceSpace(knowledgeBase.id),
                }),
              )
            ) : (
              <p className="px-3 py-2 text-xs leading-5 text-cal-muted">
                {localization.documents.noSystemKnowledgeBaseDescription}
              </p>
            )}
          </section>
        ) : null}
        {teamGroups.length > 0 ? (
          <section className="mt-5 grid gap-3">
            <h3 className="px-3 text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
              {localization.documents.teamSourceSpacesTitle}
            </h3>
            {teamGroups.map((group) => {
              const groupSourceSpaces = groupKnowledgeBasesForGroup(
                allKnowledgeBases,
                group.id,
              );

              return (
                <div key={group.id} className="grid gap-1">
                  <Link
                    href={knowledgeSourceHref(group.id)}
                    scroll={false}
                    aria-current={
                      effectiveDocumentDestination === "team" &&
                      activeTeamGroupId === group.id
                        ? "page"
                        : undefined
                    }
                    aria-disabled={
                      isKnowledgeBaseSelectionLocked ? true : undefined
                    }
                    onClick={(event) => {
                      if (isKnowledgeBaseSelectionLocked) {
                        event.preventDefault();
                        return;
                      }
                      onSelectTeamGroup(group.id);
                    }}
                    className={cn(
                      "flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors aria-disabled:pointer-events-none aria-disabled:opacity-60",
                      effectiveDocumentDestination === "team" &&
                        activeTeamGroupId === group.id
                        ? "bg-cal-surface-soft text-cal-ink"
                        : "text-cal-muted hover:bg-cal-surface-soft/80 hover:text-cal-ink",
                    )}
                  >
                    <NetworkIcon className="size-3.5 shrink-0" />
                    <span className="truncate">{group.name}</span>
                    <span className="shrink-0">
                      · {localization.groups.roles[group.role]}
                    </span>
                  </Link>
                  {groupSourceSpaces.length > 0 ? (
                    groupSourceSpaces.map((knowledgeBase) =>
                      renderSourceSpaceButton({
                        knowledgeBase,
                        active:
                          effectiveDocumentDestination === "team" &&
                          knowledgeBase.id === activeTeamKnowledgeBaseId,
                        onSelect: () =>
                          onSelectTeamSourceSpace(group.id, knowledgeBase.id),
                      }),
                    )
                  ) : (
                    <p className="px-3 py-2 text-xs leading-5 text-cal-muted">
                      {localization.documents.noTeamKnowledgeBaseDescription}
                    </p>
                  )}
                </div>
              );
            })}
          </section>
        ) : null}
        {groupsError ? <ErrorState error={groupsError} /> : null}
      </div>
    </div>
  );
}

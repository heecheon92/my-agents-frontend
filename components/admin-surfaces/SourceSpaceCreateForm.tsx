"use client";

import { Field, inputClassName, selectClassName } from "@/components/Field";
import type { KnowledgeBaseCreationScope } from "@/components/knowledge-base-create";
import { EmptyState, ErrorState } from "@/components/Status";
import { Button } from "@/components/ui/button";
import type { Group } from "@/model/my-agents";

type SourceSpaceCreateFormLocalization = {
  knowledge: {
    nameLabel: string;
    scopeLabel: string;
    scopeHint: string;
    scopePersonalOption: string;
    scopeGroupOption: string;
    scopeSystemOption: string;
    groupLabel: string;
    groupHint: string;
    groupSystemDisabledHint: string;
    groupDisabledHint: string;
    loadingGroupsOption: string;
    groupPlaceholder: string;
    scopeBoundaryNote: string;
    noGroupsTitle: string;
    noGroupsDescription: string;
    createGroupButton: string;
    createSystemButton: string;
    createPersonalButton: string;
  };
  groups: {
    roles: Record<string, string>;
  };
};

type SourceSpaceCreateFormProps = {
  title: string;
  description: string;
  localization: SourceSpaceCreateFormLocalization;
  sourceSpaceName: string;
  sourceSpaceScope: KnowledgeBaseCreationScope;
  sourceSpaceGroupId: string;
  sourceSpaceGroupOptions: Group[];
  canManageSystemKnowledge: boolean;
  groupsIsLoading: boolean;
  isCreatingTeamSourceSpace: boolean;
  isCreatingSystemSourceSpace: boolean;
  isKnowledgeBaseSelectionLocked: boolean;
  isCreateSourceSpaceDisabled: boolean;
  createKnowledgeBaseError: unknown;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onNameChange: (value: string) => void;
  onScopeChange: (value: KnowledgeBaseCreationScope) => void;
  onGroupChange: (value: string) => void;
};

export function SourceSpaceCreateForm({
  title,
  description,
  localization,
  sourceSpaceName,
  sourceSpaceScope,
  sourceSpaceGroupId,
  sourceSpaceGroupOptions,
  canManageSystemKnowledge,
  groupsIsLoading,
  isCreatingTeamSourceSpace,
  isCreatingSystemSourceSpace,
  isKnowledgeBaseSelectionLocked,
  isCreateSourceSpaceDisabled,
  createKnowledgeBaseError,
  onSubmit,
  onNameChange,
  onScopeChange,
  onGroupChange,
}: SourceSpaceCreateFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 rounded-xl border border-cal-hairline bg-cal-canvas p-3"
    >
      <div>
        <h3 className="font-semibold text-cal-ink">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-cal-muted">{description}</p>
      </div>
      <Field label={localization.knowledge.nameLabel}>
        <input
          className={inputClassName}
          value={sourceSpaceName}
          onChange={(event) => onNameChange(event.target.value)}
          required
        />
      </Field>
      <div className="grid gap-3 md:grid-cols-2 md:items-start">
        <Field
          className="min-w-0"
          label={localization.knowledge.scopeLabel}
          hint={localization.knowledge.scopeHint}
        >
          <select
            className={selectClassName}
            value={sourceSpaceScope}
            onChange={(event) =>
              onScopeChange(event.target.value as KnowledgeBaseCreationScope)
            }
            disabled={isKnowledgeBaseSelectionLocked}
          >
            <option value="personal">
              {localization.knowledge.scopePersonalOption}
            </option>
            <option value="group">
              {localization.knowledge.scopeGroupOption}
            </option>
            {canManageSystemKnowledge ? (
              <option value="system">
                {localization.knowledge.scopeSystemOption}
              </option>
            ) : null}
          </select>
        </Field>
        <Field
          className="min-w-0"
          label={localization.knowledge.groupLabel}
          hint={
            isCreatingTeamSourceSpace
              ? localization.knowledge.groupHint
              : isCreatingSystemSourceSpace
                ? localization.knowledge.groupSystemDisabledHint
                : localization.knowledge.groupDisabledHint
          }
        >
          <select
            aria-invalid={
              isCreatingTeamSourceSpace && !sourceSpaceGroupId
                ? true
                : undefined
            }
            className={selectClassName}
            disabled={
              !isCreatingTeamSourceSpace ||
              groupsIsLoading ||
              isKnowledgeBaseSelectionLocked
            }
            required={isCreatingTeamSourceSpace}
            value={sourceSpaceGroupId}
            onChange={(event) => onGroupChange(event.target.value)}
          >
            <option value="">
              {groupsIsLoading
                ? localization.knowledge.loadingGroupsOption
                : localization.knowledge.groupPlaceholder}
            </option>
            {sourceSpaceGroupOptions.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} · {localization.groups.roles[group.role]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="rounded-lg border border-cal-hairline bg-cal-surface-soft p-3 text-xs leading-5 text-cal-muted">
        {localization.knowledge.scopeBoundaryNote}
      </p>
      {isCreatingTeamSourceSpace &&
      !groupsIsLoading &&
      sourceSpaceGroupOptions.length === 0 ? (
        <EmptyState
          title={localization.knowledge.noGroupsTitle}
          description={localization.knowledge.noGroupsDescription}
        />
      ) : null}
      {createKnowledgeBaseError ? (
        <ErrorState error={createKnowledgeBaseError} />
      ) : null}
      <Button type="submit" disabled={isCreateSourceSpaceDisabled}>
        {isCreatingTeamSourceSpace
          ? localization.knowledge.createGroupButton
          : isCreatingSystemSourceSpace
            ? localization.knowledge.createSystemButton
            : localization.knowledge.createPersonalButton}
      </Button>
    </form>
  );
}

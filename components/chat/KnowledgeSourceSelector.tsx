import { EmptyState, ErrorState, Pill } from "@/components/Status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  Group,
  KnowledgeBase,
  KnowledgeBaseSelectionMode,
} from "@/model/my-agents";
import type { ChatLocalization, ChatMode } from "./types";

export function KnowledgeSourceSelector({
  localization,
  chatMode,
  onChatModeChange,
  knowledgeBaseMode,
  onKnowledgeBaseModeChange,
  personalKnowledgeBases,
  groupKnowledgeBases,
  optionalPrivateKnowledgeBases,
  selectedKnowledgeBaseIds,
  selectedPrivateKnowledgeBaseIds,
  selectedGroupIds,
  selectedGroups,
  groups,
  groupsLoading,
  groupsError,
  knowledgeBasesLoading,
  knowledgeBasesError,
  requiresKnowledgeBaseSelection,
  onToggleKnowledgeBase,
  onTogglePrivateKnowledgeBase,
  onToggleGroup,
}: {
  localization: ChatLocalization;
  chatMode: ChatMode;
  onChatModeChange: (mode: ChatMode) => void;
  knowledgeBaseMode: KnowledgeBaseSelectionMode;
  onKnowledgeBaseModeChange: (mode: KnowledgeBaseSelectionMode) => void;
  personalKnowledgeBases: KnowledgeBase[];
  groupKnowledgeBases: KnowledgeBase[];
  optionalPrivateKnowledgeBases: KnowledgeBase[];
  selectedKnowledgeBaseIds: string[];
  selectedPrivateKnowledgeBaseIds: string[];
  selectedGroupIds: string[];
  selectedGroups: Group[];
  groups?: Group[];
  groupsLoading: boolean;
  groupsError: unknown;
  knowledgeBasesLoading: boolean;
  knowledgeBasesError: unknown;
  requiresKnowledgeBaseSelection: boolean;
  onToggleKnowledgeBase: (knowledgeBaseId: string) => void;
  onTogglePrivateKnowledgeBase: (knowledgeBaseId: string) => void;
  onToggleGroup: (groupId: string) => void;
}) {
  const isGroupMode = chatMode === "group";
  const selectedPersonalCount =
    knowledgeBaseMode === "all"
      ? personalKnowledgeBases.length
      : selectedKnowledgeBaseIds.length;
  const sourceSummary = isGroupMode
    ? localization.groupSourceSummary.replace(
        "{count}",
        String(selectedGroups.length),
      )
    : knowledgeBaseMode === "all"
      ? localization.personalSourceAllSummary.replace(
          "{count}",
          String(selectedPersonalCount),
        )
      : localization.personalSourceSelectedSummary.replace(
          "{count}",
          String(selectedPersonalCount),
        );

  return (
    <details className="rounded-xl border border-cal-hairline bg-cal-surface-soft p-3 text-sm">
      <summary className="flex min-h-10 cursor-pointer list-none flex-wrap items-center justify-between gap-3 marker:hidden">
        <span className="min-w-0">
          <span className="block font-semibold text-cal-ink">
            {localization.knowledgeSourceTitle}
          </span>
          <span className="mt-1 block text-xs leading-5 text-cal-muted">
            {sourceSummary}
          </span>
        </span>
        <span className="rounded-full border border-cal-hairline bg-cal-canvas px-3 py-1 text-xs font-semibold text-cal-ink">
          {localization.changeSourcesAction}
        </span>
      </summary>
      <div className="mt-3 grid gap-3 border-t border-cal-hairline pt-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <p className="text-xs leading-5 text-cal-muted">
            {localization.knowledgeSourceDescription}
          </p>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-cal-hairline bg-cal-canvas px-3 py-2 text-xs font-semibold text-cal-ink">
            <input
              type="checkbox"
              checked={isGroupMode}
              onChange={(event) =>
                onChatModeChange(event.target.checked ? "group" : "personal")
              }
            />
            {localization.includeGroupKnowledgeLabel}
          </label>
        </div>
        <div className="grid gap-2 rounded-xl border border-cal-hairline bg-cal-canvas p-3">
          <div className="flex flex-wrap gap-2">
            <Pill tone="green">{localization.personalTranscriptPill}</Pill>
            <Pill tone={isGroupMode ? "blue" : "slate"}>
              {isGroupMode
                ? localization.groupChatMode
                : localization.personalSourcesPill}
            </Pill>
          </div>
          <p className="text-xs leading-5 text-cal-muted">
            {isGroupMode
              ? localization.groupChatBoundaryCopy
              : localization.personalChatBoundaryCopy}
          </p>
        </div>
        {!isGroupMode ? (
          <div className="grid gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={knowledgeBaseMode === "all" ? "secondary" : "ghost"}
                onClick={() => onKnowledgeBaseModeChange("all")}
              >
                {localization.knowledgeSourceAll}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={
                  knowledgeBaseMode === "selected" ? "secondary" : "ghost"
                }
                onClick={() => onKnowledgeBaseModeChange("selected")}
              >
                {localization.knowledgeSourceSelected}
              </Button>
            </div>
          </div>
        ) : null}
        {!isGroupMode && knowledgeBaseMode === "selected" ? (
          <div className="grid gap-2">
            {knowledgeBasesLoading ? (
              <p className="text-xs text-cal-muted">
                {localization.loadingKnowledgeBases}
              </p>
            ) : null}
            {knowledgeBasesError ? (
              <ErrorState error={knowledgeBasesError} />
            ) : null}
            {personalKnowledgeBases.length === 0 ? (
              <EmptyState
                title={localization.noKnowledgeBasesTitle}
                description={localization.noKnowledgeBasesDescription}
              />
            ) : null}
            <div className="flex flex-wrap gap-2">
              {personalKnowledgeBases.map((knowledgeBase) => {
                const checked = selectedKnowledgeBaseIds.includes(
                  knowledgeBase.id,
                );
                return (
                  <label
                    key={knowledgeBase.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium",
                      checked
                        ? "border-cal-primary bg-cal-primary text-white"
                        : "border-cal-hairline bg-cal-canvas text-cal-ink",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => onToggleKnowledgeBase(knowledgeBase.id)}
                    />
                    {knowledgeBase.name}
                  </label>
                );
              })}
            </div>
            {requiresKnowledgeBaseSelection ? (
              <p className="text-xs text-cal-error">
                {localization.knowledgeSourceRequired}
              </p>
            ) : null}
          </div>
        ) : null}
        {isGroupMode ? (
          <div className="grid gap-2 rounded-xl border border-cal-primary/20 bg-cal-primary/10 p-3">
            <fieldset className="grid gap-2">
              <legend className="text-xs font-medium text-cal-muted">
                {localization.groupContextLabel}
              </legend>
              <div className="flex flex-wrap gap-2">
                {groups?.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    aria-pressed={selectedGroupIds.includes(group.id)}
                    onClick={() => onToggleGroup(group.id)}
                    className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cal-primary"
                  >
                    <Badge
                      variant={
                        selectedGroupIds.includes(group.id)
                          ? "default"
                          : "outline"
                      }
                      className="min-h-8 cursor-pointer px-3"
                    >
                      {group.name}
                    </Badge>
                  </button>
                ))}
              </div>
            </fieldset>
            <p className="text-xs leading-5 text-cal-muted">
              {selectedGroups.length > 0
                ? localization.mandatoryGroupKnowledgeDescription.replace(
                    "{groups}",
                    selectedGroups.map((group) => group.name).join(", "),
                  )
                : localization.groupContextRequired}
            </p>
            {groupsLoading ? (
              <p className="text-xs text-cal-muted">
                {localization.loadingGroups}
              </p>
            ) : null}
            {groupsError ? <ErrorState error={groupsError} /> : null}
            <details className="rounded-lg border border-cal-primary/20 bg-cal-canvas p-2">
              <summary className="cursor-pointer text-xs font-semibold text-cal-ink">
                {localization.groupKnowledgeSourceDescription}
              </summary>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-cal-ink">
                  {localization.mandatoryGroupKnowledgeTitle}
                </span>
                <Pill tone="blue">{localization.fixedSourcePill}</Pill>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {groupKnowledgeBases.length === 0 ? (
                  <span className="rounded-full border border-cal-hairline bg-cal-surface-soft px-3 py-2 text-xs text-cal-muted">
                    {localization.noGroupKnowledgeBases}
                  </span>
                ) : null}
                {groupKnowledgeBases.map((knowledgeBase) => (
                  <Badge key={knowledgeBase.id} variant="secondary">
                    {knowledgeBase.name}
                  </Badge>
                ))}
              </div>
              <p className="mt-3 text-xs font-semibold text-cal-ink">
                {localization.optionalPrivateKnowledgeTitle}
              </p>
              <p className="mt-1 text-xs leading-5 text-cal-muted">
                {localization.optionalPrivateKnowledgeDescription}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {optionalPrivateKnowledgeBases.length === 0 ? (
                  <span className="rounded-full border border-cal-hairline bg-cal-surface-soft px-3 py-2 text-xs text-cal-muted">
                    {localization.noPersonalKnowledgeBases}
                  </span>
                ) : null}
                {optionalPrivateKnowledgeBases.map((knowledgeBase) => {
                  const checked = selectedPrivateKnowledgeBaseIds.includes(
                    knowledgeBase.id,
                  );
                  return (
                    <label
                      key={knowledgeBase.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium",
                        checked
                          ? "border-cal-brand-accent bg-cal-brand-accent/10 text-cal-ink"
                          : "border-cal-hairline bg-cal-surface-soft text-cal-muted",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() =>
                          onTogglePrivateKnowledgeBase(knowledgeBase.id)
                        }
                      />
                      {knowledgeBase.name}
                    </label>
                  );
                })}
              </div>
            </details>
            <p className="text-xs leading-5 text-cal-body">
              {localization.groupChatOpenApiPending}
            </p>
          </div>
        ) : null}
      </div>
    </details>
  );
}

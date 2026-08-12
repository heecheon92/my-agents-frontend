import { EmptyState, ErrorState } from "@/components/Status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  KnowledgeBase,
  KnowledgeBaseSelectionMode,
} from "@/model/my-agents";
import {
  ambientSystemKnowledgeBaseCount,
  chatSelectableKnowledgeBases,
} from "../document-knowledge-base";
import type { ChatLocalization } from "./types";

export type KnowledgeScopeFieldsProps = {
  localization: ChatLocalization;
  knowledgeBaseMode: KnowledgeBaseSelectionMode;
  onKnowledgeBaseModeChange: (mode: KnowledgeBaseSelectionMode) => void;
  knowledgeBases: KnowledgeBase[];
  selectedKnowledgeBaseIds: string[];
  knowledgeBasesLoading: boolean;
  knowledgeBasesError: unknown;
  requiresKnowledgeBaseSelection: boolean;
  onToggleKnowledgeBase: (knowledgeBaseId: string) => void;
};

/**
 * How many sources this answer will draw on, phrased for the picker trigger as
 * well as the overlay heading so both always agree.
 */
export function knowledgeSourceSummary({
  localization,
  knowledgeBaseMode,
  knowledgeBases,
  selectedKnowledgeBaseIds,
}: Pick<
  KnowledgeScopeFieldsProps,
  | "localization"
  | "knowledgeBaseMode"
  | "knowledgeBases"
  | "selectedKnowledgeBaseIds"
>) {
  const selectable = chatSelectableKnowledgeBases(knowledgeBases);
  const selectableIds = new Set(selectable.map((item) => item.id));
  const selectedCount =
    knowledgeBaseMode === "all"
      ? selectable.length
      : selectedKnowledgeBaseIds.filter((id) => selectableIds.has(id)).length;

  return (
    knowledgeBaseMode === "all"
      ? localization.knowledgeSourceAllSummary
      : localization.knowledgeSourceSelectedSummary
  ).replace("{count}", String(selectedCount));
}

/**
 * The source-scope controls, with no chrome of their own. `KnowledgeScopePicker`
 * supplies that — a Dialog on desktop, a Drawer on mobile — so this stays a
 * plain form body that either can host.
 */
export function KnowledgeScopeFields({
  localization,
  knowledgeBaseMode,
  onKnowledgeBaseModeChange,
  knowledgeBases,
  selectedKnowledgeBaseIds,
  knowledgeBasesLoading,
  knowledgeBasesError,
  requiresKnowledgeBaseSelection,
  onToggleKnowledgeBase,
}: KnowledgeScopeFieldsProps) {
  const selectableKnowledgeBases = chatSelectableKnowledgeBases(knowledgeBases);
  const ambientSystemSourceCount =
    ambientSystemKnowledgeBaseCount(knowledgeBases);

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 rounded-xl border border-cal-hairline bg-cal-surface-soft p-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{localization.privateChatPill}</Badge>
          <Badge variant="outline">{localization.unifiedSourcesPill}</Badge>
          <Badge variant="outline">
            {localization.systemProjectKnowledgePill}
          </Badge>
        </div>
        <p className="text-xs leading-5 text-cal-muted">
          {localization.knowledgeSourceBoundaryCopy}
        </p>
        <p className="text-xs leading-5 text-cal-muted">
          {localization.systemAmbientBoundaryCopy}
        </p>
        {ambientSystemSourceCount > 0 ? (
          <p className="text-xs leading-5 text-cal-muted">
            {localization.systemAmbientAvailableCopy.replace(
              "{count}",
              String(ambientSystemSourceCount),
            )}
          </p>
        ) : null}
      </div>
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
          variant={knowledgeBaseMode === "selected" ? "secondary" : "ghost"}
          onClick={() => onKnowledgeBaseModeChange("selected")}
        >
          {localization.knowledgeSourceSelected}
        </Button>
      </div>
      {knowledgeBaseMode === "selected" ? (
        <div className="grid gap-2">
          {knowledgeBasesLoading ? (
            <p className="text-xs text-cal-muted">
              {localization.loadingKnowledgeBases}
            </p>
          ) : null}
          {knowledgeBasesError ? (
            <ErrorState error={knowledgeBasesError} />
          ) : null}
          {selectableKnowledgeBases.length === 0 ? (
            <EmptyState
              title={localization.noKnowledgeBasesTitle}
              description={localization.noKnowledgeBasesDescription}
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            {selectableKnowledgeBases.map((knowledgeBase) => {
              const checked = selectedKnowledgeBaseIds.includes(
                knowledgeBase.id,
              );
              const scopeLabel =
                knowledgeBase.scope === "group"
                  ? localization.sourceScopeTeam
                  : knowledgeBase.published_group_ids.length > 0
                    ? localization.sourceScopeShared
                    : localization.sourceScopePersonal;
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
                  <span>{knowledgeBase.name}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold",
                      checked
                        ? "bg-white/20 text-white"
                        : "bg-cal-surface-soft text-cal-muted",
                    )}
                  >
                    {scopeLabel}
                  </span>
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
    </div>
  );
}

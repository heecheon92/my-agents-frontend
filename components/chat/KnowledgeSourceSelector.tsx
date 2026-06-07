import { EmptyState, ErrorState } from "@/components/Status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  KnowledgeBase,
  KnowledgeBaseSelectionMode,
} from "@/model/my-agents";
import type { ChatLocalization } from "./types";

export function KnowledgeSourceSelector({
  localization,
  knowledgeBaseMode,
  onKnowledgeBaseModeChange,
  knowledgeBases,
  selectedKnowledgeBaseIds,
  knowledgeBasesLoading,
  knowledgeBasesError,
  requiresKnowledgeBaseSelection,
  onToggleKnowledgeBase,
}: {
  localization: ChatLocalization;
  knowledgeBaseMode: KnowledgeBaseSelectionMode;
  onKnowledgeBaseModeChange: (mode: KnowledgeBaseSelectionMode) => void;
  knowledgeBases: KnowledgeBase[];
  selectedKnowledgeBaseIds: string[];
  knowledgeBasesLoading: boolean;
  knowledgeBasesError: unknown;
  requiresKnowledgeBaseSelection: boolean;
  onToggleKnowledgeBase: (knowledgeBaseId: string) => void;
}) {
  const selectedCount =
    knowledgeBaseMode === "all"
      ? knowledgeBases.length
      : selectedKnowledgeBaseIds.length;
  const sourceSummary =
    knowledgeBaseMode === "all"
      ? localization.knowledgeSourceAllSummary.replace(
          "{count}",
          String(selectedCount),
        )
      : localization.knowledgeSourceSelectedSummary.replace(
          "{count}",
          String(selectedCount),
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
        <p className="text-xs leading-5 text-cal-muted">
          {localization.knowledgeSourceDescription}
        </p>
        <div className="grid gap-2 rounded-xl border border-cal-hairline bg-cal-canvas p-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{localization.privateChatPill}</Badge>
            <Badge variant="outline">{localization.unifiedSourcesPill}</Badge>
          </div>
          <p className="text-xs leading-5 text-cal-muted">
            {localization.knowledgeSourceBoundaryCopy}
          </p>
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
            {knowledgeBases.length === 0 ? (
              <EmptyState
                title={localization.noKnowledgeBasesTitle}
                description={localization.noKnowledgeBasesDescription}
              />
            ) : null}
            <div className="flex flex-wrap gap-2">
              {knowledgeBases.map((knowledgeBase) => {
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
    </details>
  );
}

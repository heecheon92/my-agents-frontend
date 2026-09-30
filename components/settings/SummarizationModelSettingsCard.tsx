"use client";

import {
  useSummarizationModelCapabilities,
  useSummarizationPreferences,
  useUpdateSummarizationModel,
} from "@/hooks/use-assistant-model";
import { useLocalization } from "@/hooks/useLocalization";
import { ModelPreferenceCard } from "./ModelPreferenceCard";

/**
 * The model that summarizes earlier turns when a long conversation is
 * compacted.
 *
 * The recommendation is served (`recommended_model`) and marked beside that
 * model; the copy names no model, so a changed recommendation needs no
 * release. The off-recommendation note appears only when the model actually
 * in use differs from it — a saved choice or the deployment default alike.
 */
export function SummarizationModelSettingsCard({
  isGuest,
}: {
  isGuest: boolean;
}) {
  const capabilities = useSummarizationModelCapabilities();
  const preferences = useSummarizationPreferences();
  const update = useUpdateSummarizationModel();
  const { localization } = useLocalization((state) => ({
    settings: state.localization.settings,
    auth: state.localization.auth,
  }));
  const copy = localization.settings.account;
  const recommendedId = capabilities.data?.recommended_model;
  const effectiveId = preferences.data?.effective_model;
  const offRecommendation = Boolean(
    recommendedId && effectiveId && effectiveId !== recommendedId,
  );

  return (
    <ModelPreferenceCard
      slot="summarization-model-settings"
      copy={{
        title: copy.summarizationTitle,
        description: copy.summarizationDescription,
        legend: copy.summarizationLegend,
        defaultOption: copy.modelDefaultOption,
        unlistedSelection: copy.modelUnlistedSelection,
        effective: copy.summarizationEffective,
        loadErrorTitle: copy.summarizationLoadErrorTitle,
        updateErrorTitle: copy.summarizationUpdateErrorTitle,
        unavailable: copy.summarizationUnavailable,
        saved: copy.summarizationSaved,
        lockedGuest: copy.summarizationLockedGuest,
        working: localization.auth.working,
      }}
      catalog={capabilities}
      preferences={preferences}
      isGuest={isGuest}
      saving={update.isPending}
      updateError={update.error}
      save={(next) => update.mutateAsync({ summarization_model: next })}
      recommended={
        recommendedId
          ? { id: recommendedId, label: copy.summarizationRecommendedBadge }
          : undefined
      }
    >
      {recommendedId ? (
        <p
          data-slot="summarization-recommendation"
          className={
            offRecommendation
              ? "rounded-lg border border-cal-warning/25 bg-cal-warning/10 p-3 text-sm leading-6 text-cal-warning"
              : "text-sm leading-6 text-cal-muted"
          }
        >
          {offRecommendation
            ? copy.summarizationOffRecommendation
            : copy.summarizationRecommendation}
        </p>
      ) : null}
    </ModelPreferenceCard>
  );
}

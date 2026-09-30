"use client";

import {
  useAssistantModelCapabilities,
  useAssistantPreferences,
  useUpdateAssistantModel,
} from "@/hooks/use-assistant-model";
import { useLocalization } from "@/hooks/useLocalization";
import { ModelPreferenceCard } from "./ModelPreferenceCard";

/**
 * The account's answer model, the same server-owned value the composer edits.
 * The composer picks a change up through the shared query cache.
 */
export function AssistantModelSettingsCard({ isGuest }: { isGuest: boolean }) {
  const capabilities = useAssistantModelCapabilities();
  const preferences = useAssistantPreferences();
  const update = useUpdateAssistantModel();
  const { localization } = useLocalization((state) => ({
    settings: state.localization.settings,
    auth: state.localization.auth,
  }));
  const copy = localization.settings.account;

  return (
    <ModelPreferenceCard
      slot="assistant-model-settings"
      copy={{
        title: copy.modelTitle,
        description: copy.modelDescription,
        legend: copy.modelLegend,
        defaultOption: copy.modelDefaultOption,
        unlistedSelection: copy.modelUnlistedSelection,
        effective: copy.modelEffective,
        loadErrorTitle: copy.modelLoadErrorTitle,
        updateErrorTitle: copy.modelUpdateErrorTitle,
        unavailable: copy.modelUnavailable,
        saved: copy.modelSaved,
        lockedGuest: copy.modelLockedGuest,
        working: localization.auth.working,
      }}
      catalog={capabilities}
      preferences={preferences}
      isGuest={isGuest}
      saving={update.isPending}
      updateError={update.error}
      save={(next) => update.mutateAsync({ assistant_model: next })}
    />
  );
}

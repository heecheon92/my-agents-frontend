"use client";

import { useState } from "react";
import { AssistantModelOptions } from "@/components/chat/AssistantModelOptions";
import { resolveAssistantModel } from "@/components/chat/assistant-model-selection";
import { ErrorState } from "@/components/Status";
import {
  useAssistantModelCapabilities,
  useAssistantPreferences,
  useUpdateAssistantModel,
} from "@/hooks/use-assistant-model";
import { useLocalization } from "@/hooks/useLocalization";
import { isMyAgentsAPIError } from "@/services/my-agents/MyAgentsAPIError";

/**
 * The account's answer model, the same server-owned value the composer edits.
 *
 * Saves on selection, like the memory toggle, rather than behind a submit
 * button: there is no password to confirm and nothing to batch. The composer
 * picks the change up through the shared query cache.
 */
export function AssistantModelSettingsCard({ isGuest }: { isGuest: boolean }) {
  const capabilities = useAssistantModelCapabilities();
  const preferences = useAssistantPreferences();
  const update = useUpdateAssistantModel();
  const [saved, setSaved] = useState(false);
  const { localization } = useLocalization((state) => ({
    settings: state.localization.settings,
    auth: state.localization.auth,
  }));
  const copy = localization.settings.account;
  const resolved = resolveAssistantModel(
    capabilities.data,
    preferences.data,
    isGuest,
  );
  const isLoading = capabilities.isLoading || preferences.isLoading;
  // A 404 is a backend without model selection — a supported state with its
  // own copy, not a failure to report.
  const rawError = capabilities.error ?? preferences.error;
  const loadError =
    isMyAgentsAPIError(rawError) && rawError.status === 404 ? null : rawError;

  return (
    <section
      aria-labelledby="assistant-model-title"
      className="cal-card rounded-xl p-5"
      data-slot="assistant-model-settings"
    >
      <h2
        id="assistant-model-title"
        className="font-heading text-xl font-semibold text-cal-ink"
      >
        {copy.modelTitle}
      </h2>
      <p className="mt-2 text-sm leading-6 text-cal-muted">
        {copy.modelDescription}
      </p>

      <div className="mt-5 grid gap-3">
        {isLoading ? (
          <p className="text-sm text-cal-muted">{localization.auth.working}</p>
        ) : loadError && !resolved.available ? (
          <ErrorState title={copy.modelLoadErrorTitle} error={loadError} />
        ) : !resolved.available ? (
          <p className="text-sm leading-6 text-cal-muted">
            {copy.modelUnavailable}
          </p>
        ) : (
          <>
            <AssistantModelOptions
              resolved={resolved}
              legend={copy.modelLegend}
              defaultOptionLabel={(name) =>
                localization.settings.account.modelDefaultOption.replace(
                  "{name}",
                  name,
                )
              }
              unlistedSelectionLabel={(name) =>
                copy.modelUnlistedSelection.replace("{name}", name)
              }
              disabled={resolved.locked}
              saving={update.isPending}
              onChange={async (next) => {
                // The confirmation stays up through a follow-up save rather
                // than blinking out and back; only a failure clears it.
                try {
                  await update.mutateAsync({ assistant_model: next });
                  setSaved(true);
                } catch {
                  // React Query stores the API error on the mutation; render it below.
                  setSaved(false);
                }
              }}
            />
            {resolved.effectiveModel ? (
              <p className="text-sm text-cal-body">
                {copy.modelEffective.replace(
                  "{name}",
                  resolved.effectiveModel.name,
                )}
              </p>
            ) : null}
            {resolved.locked ? (
              <p className="text-sm leading-6 text-cal-muted">
                {copy.modelLockedGuest}
              </p>
            ) : null}
            {update.error ? (
              <ErrorState
                title={copy.modelUpdateErrorTitle}
                error={update.error}
              />
            ) : null}
            {saved ? (
              <output
                aria-live="polite"
                className="rounded-lg border border-cal-success/20 bg-cal-success/5 p-4 text-sm text-cal-success"
              >
                {copy.modelSaved}
              </output>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

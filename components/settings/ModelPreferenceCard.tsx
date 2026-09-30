"use client";

import { type ReactNode, useId, useState } from "react";
import { AssistantModelOptions } from "@/components/chat/AssistantModelOptions";
import {
  type ModelCatalogLike,
  type ModelOptionLike,
  type ModelPreferencesLike,
  resolveModelPreference,
} from "@/components/chat/assistant-model-selection";
import { ErrorState } from "@/components/Status";
import { isMyAgentsAPIError } from "@/services/my-agents/MyAgentsAPIError";

export type ModelPreferenceCardCopy = {
  title: string;
  description: string;
  legend: string;
  /** Receives the default model's display name via `{name}`. */
  defaultOption: string;
  /** Receives the unlisted saved model's ID via `{name}`. */
  unlistedSelection: string;
  /** Receives the effective model's name via `{name}`. */
  effective: string;
  loadErrorTitle: string;
  updateErrorTitle: string;
  unavailable: string;
  saved: string;
  lockedGuest: string;
  working: string;
};

type QueryLike<T> = { data?: T; isLoading: boolean; error: unknown };

/**
 * One account-level model preference in settings: a served catalog, the saved
 * choice, and save-on-select.
 *
 * Shared by the answer model and the summarization model, which differ only in
 * copy, endpoints, and whether a model is recommended. Saves on selection,
 * like the memory toggle, rather than behind a submit button: there is no
 * password to confirm and nothing to batch.
 */
export function ModelPreferenceCard<T extends ModelOptionLike>({
  slot,
  copy,
  catalog,
  preferences,
  isGuest,
  saving,
  updateError,
  save,
  recommended,
  children,
}: {
  /** `data-slot` for the section, so tests can scope to one card. */
  slot: string;
  copy: ModelPreferenceCardCopy;
  catalog: QueryLike<ModelCatalogLike<T>>;
  preferences: QueryLike<ModelPreferencesLike>;
  isGuest: boolean;
  saving: boolean;
  updateError: unknown;
  save: (next: string | null) => Promise<unknown>;
  recommended?: { id: string; label: string };
  /** Extra guidance under the options, e.g. an off-recommendation note. */
  children?: ReactNode;
}) {
  const titleId = useId();
  const [saved, setSaved] = useState(false);
  const resolved = resolveModelPreference(
    catalog.data,
    preferences.data,
    isGuest,
  );
  const isLoading = catalog.isLoading || preferences.isLoading;
  // A 404 is a backend without this preference — a supported state with its
  // own copy, not a failure to report.
  const rawError = catalog.error ?? preferences.error;
  const loadError =
    isMyAgentsAPIError(rawError) && rawError.status === 404 ? null : rawError;

  return (
    <section
      aria-labelledby={titleId}
      className="cal-card rounded-xl p-5"
      data-slot={slot}
    >
      <h2
        id={titleId}
        className="font-heading text-xl font-semibold text-cal-ink"
      >
        {copy.title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-cal-muted">
        {copy.description}
      </p>

      <div className="mt-5 grid gap-3">
        {isLoading ? (
          <p className="text-sm text-cal-muted">{copy.working}</p>
        ) : loadError && !resolved.available ? (
          <ErrorState title={copy.loadErrorTitle} error={loadError} />
        ) : !resolved.available ? (
          <p className="text-sm leading-6 text-cal-muted">{copy.unavailable}</p>
        ) : (
          <>
            <AssistantModelOptions
              resolved={resolved}
              legend={copy.legend}
              defaultOptionLabel={(name) =>
                copy.defaultOption.replace("{name}", name)
              }
              unlistedSelectionLabel={(name) =>
                copy.unlistedSelection.replace("{name}", name)
              }
              disabled={resolved.locked}
              saving={saving}
              recommended={recommended}
              onChange={async (next) => {
                // The confirmation stays up through a follow-up save rather
                // than blinking out and back; only a failure clears it.
                try {
                  await save(next);
                  setSaved(true);
                } catch {
                  // React Query stores the API error on the mutation; render it below.
                  setSaved(false);
                }
              }}
            />
            {resolved.effectiveModel ? (
              <p className="text-sm text-cal-body">
                {copy.effective.replace("{name}", resolved.effectiveModel.name)}
              </p>
            ) : null}
            {children}
            {resolved.locked ? (
              <p className="text-sm leading-6 text-cal-muted">
                {copy.lockedGuest}
              </p>
            ) : null}
            {updateError ? (
              <ErrorState title={copy.updateErrorTitle} error={updateError} />
            ) : null}
            {saved ? (
              <output
                aria-live="polite"
                className="rounded-lg border border-cal-success/20 bg-cal-success/5 p-4 text-sm text-cal-success"
              >
                {copy.saved}
              </output>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

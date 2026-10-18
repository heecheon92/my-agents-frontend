"use client";

import { useId, useState } from "react";
import { ErrorState } from "@/components/Status";
import { ChoiceGroup } from "@/components/ui/choice-group";
import {
  useAssistantPreferences,
  useUpdateDocumentPreferences,
} from "@/hooks/use-assistant-model";
import { useDocumentUploadPolicy } from "@/hooks/use-capabilities";
import { useLocalization } from "@/hooks/useLocalization";
import type {
  DocumentIngestionMode,
  DocumentRetrievalPriority,
} from "@/model/my-agents";
import { isMyAgentsAPIError } from "@/services/my-agents/MyAgentsAPIError";

/**
 * When answers search the user's documents, and how new documents are
 * prepared. Both are account preferences served by `/assistant/preferences`
 * and saved on selection, like the model cards beside it.
 *
 * Rendered for guests too, read-only: the backend fixes them to `automatic`
 * and `standard`, and hiding the card would suggest the product has no such
 * choice rather than that this session cannot make it.
 */
export function DocumentPreferencesCard({ isGuest }: { isGuest: boolean }) {
  const titleId = useId();
  const preferences = useAssistantPreferences();
  const update = useUpdateDocumentPreferences();
  const policy = useDocumentUploadPolicy();
  const [saved, setSaved] = useState(false);
  /**
   * The clicked choice, shown checked at once. The radios are controlled by
   * server state, so without this a click looks ignored until the save
   * returns. Cleared when the save settles, which also reverts a failed one.
   */
  const [optimistic, setOptimistic] = useState<
    Parameters<typeof update.mutateAsync>[0]
  >({});
  const { localization } = useLocalization(
    (state) => state.localization.settings.account,
  );
  const copy = localization;
  const loadError =
    isMyAgentsAPIError(preferences.error) && preferences.error.status === 404
      ? null
      : preferences.error;
  const retrieval: DocumentRetrievalPriority = isGuest
    ? "automatic"
    : (optimistic.document_retrieval_priority ??
      preferences.data?.document_retrieval_priority ??
      "automatic");
  const ingestion: DocumentIngestionMode = isGuest
    ? "standard"
    : (optimistic.document_ingestion_mode ??
      preferences.data?.document_ingestion_mode ??
      "standard");
  const aiAvailable = policy.aiAssistedIngestion && !isGuest;

  async function save(
    patch: Parameters<typeof update.mutateAsync>[0],
  ): Promise<void> {
    setOptimistic(patch);
    try {
      await update.mutateAsync(patch);
      setSaved(true);
    } catch {
      // React Query stores the API error on the mutation; render it below.
      setSaved(false);
    } finally {
      setOptimistic({});
    }
  }

  return (
    <section
      aria-labelledby={titleId}
      className="cal-card rounded-xl p-5"
      data-slot="document-preferences"
    >
      <h2
        id={titleId}
        className="font-heading text-xl font-semibold text-cal-ink"
      >
        {copy.documentsTitle}
      </h2>
      <p className="mt-2 text-sm leading-6 text-cal-muted">
        {copy.documentsDescription}
      </p>
      <div className="mt-5 grid gap-5">
        {preferences.isLoading ? (
          <p className="text-sm text-cal-muted">{copy.documentsLoading}</p>
        ) : loadError ? (
          <ErrorState title={copy.documentsLoadErrorTitle} error={loadError} />
        ) : (
          <>
            <ChoiceGroup<DocumentRetrievalPriority>
              slot="document-retrieval-priority"
              legend={copy.retrievalLegend}
              value={retrieval}
              disabled={isGuest}
              busy={update.isPending}
              onChange={(next) => save({ document_retrieval_priority: next })}
              options={[
                {
                  value: "always",
                  label: copy.retrievalAlways,
                  description: copy.retrievalAlwaysDescription,
                },
                {
                  value: "automatic",
                  label: copy.retrievalAutomatic,
                  description: copy.retrievalAutomaticDescription,
                  badge: copy.retrievalRecommendedBadge,
                },
                {
                  value: "on_request",
                  label: copy.retrievalOnRequest,
                  description: copy.retrievalOnRequestDescription,
                },
              ]}
            />
            <ChoiceGroup<DocumentIngestionMode>
              slot="document-ingestion-mode"
              legend={copy.ingestionLegend}
              value={ingestion}
              disabled={isGuest}
              busy={update.isPending}
              onChange={(next) => save({ document_ingestion_mode: next })}
              options={[
                {
                  value: "standard",
                  label: copy.ingestionStandard,
                  description: copy.ingestionStandardDescription,
                },
                {
                  value: "ai_assisted",
                  label: copy.ingestionAiAssisted,
                  description: `${copy.ingestionAiAssistedDescription} ${copy.ingestionAiAssistedCost}`,
                  disabled: !aiAvailable,
                },
              ]}
            >
              {!isGuest && !policy.aiAssistedIngestion ? (
                <p className="px-2 text-xs leading-5 text-cal-muted">
                  {copy.ingestionAiUnavailable}
                </p>
              ) : null}
            </ChoiceGroup>
            {isGuest ? (
              <p className="text-sm leading-6 text-cal-muted">
                {copy.documentsLockedGuest}
              </p>
            ) : null}
            {update.error ? (
              <ErrorState
                title={copy.documentsUpdateErrorTitle}
                error={update.error}
              />
            ) : null}
            {saved ? (
              <output
                aria-live="polite"
                className="rounded-lg border border-cal-success/20 bg-cal-success/5 p-4 text-sm text-cal-success"
              >
                {copy.documentsSaved}
              </output>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

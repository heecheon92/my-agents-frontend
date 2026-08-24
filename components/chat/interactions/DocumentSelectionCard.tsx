"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  DocumentSelectionInteraction,
  DocumentSelectionOption,
} from "@/model/my-agents";
import type { ChatLocalization } from "../types";

/**
 * The document-source choice, rendered above the composer.
 *
 * Lives in the composer's pending slot rather than in the transcript: the
 * question is composer state — it blocks sending and disappears once answered —
 * and putting it in the transcript would imply it is part of the permanent
 * record and let it scroll out of reach on a phone.
 */
export function DocumentSelectionCard({
  interaction,
  options,
  localization,
  isResuming,
  isLoadingMore,
  optionsError,
  hasMore,
  onChoose,
  onLoadMore,
  onCancel,
}: {
  interaction: DocumentSelectionInteraction;
  options: DocumentSelectionOption[];
  localization: ChatLocalization;
  isResuming: boolean;
  isLoadingMore: boolean;
  optionsError: boolean;
  hasMore: boolean;
  onChoose: (documentId: string) => void;
  onLoadMore: () => void;
  onCancel: () => void;
}) {
  const isExpired = useIsExpired(interaction.expires_at);
  // Once the deadline passes the server will refuse the answer with
  // `run_interaction_expired`, so offering Choose would be offering a request
  // known to fail. Cancel stays enabled — it is what releases the waiting run.
  const canAnswer = !isResuming && !isExpired;
  return (
    <div
      data-slot="interaction-card"
      className="mb-3 rounded-xl border border-cal-hairline bg-cal-surface-soft p-3 text-sm text-cal-body"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-cal-ink">
          {localization.interactionTitle}
        </p>
        {isExpired ? null : (
          <ExpiryNotice
            expiresAt={interaction.expires_at}
            localization={localization}
          />
        )}
      </div>
      <p className="mt-1 text-cal-body">
        {localization.interactionDescription}
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {options.map((option) => (
          <li
            key={option.document_id}
            className="flex flex-col gap-2 rounded-control border border-cal-hairline bg-cal-surface-card p-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-cal-ink">
                {option.title}
              </p>
              <p className="truncate text-xs text-cal-muted">
                {/* Filename disambiguates two documents sharing a title; the
                    knowledge base says which space it came from. Either can be
                    absent — a pasted note has no file. */}
                {[
                  option.source_filename,
                  option.knowledge_base_name ??
                    localization.interactionNoKnowledgeBase,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="shrink-0"
              disabled={!canAnswer}
              onClick={() => onChoose(option.document_id)}
            >
              {localization.interactionChoose}
            </Button>
          </li>
        ))}
      </ul>

      {optionsError ? (
        <p className="mt-2 text-xs text-cal-muted">
          {localization.interactionOptionsFailed}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {hasMore ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isLoadingMore || !canAnswer}
            onClick={onLoadMore}
          >
            {localization.interactionLoadMore}
          </Button>
        ) : null}
        {/* Cancel is always reachable, including while resuming. A suspended
            run blocks the whole conversation, so the dismissal must never be
            the thing that is disabled. */}
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {localization.interactionCancel}
        </Button>
        <span className="text-xs text-cal-muted">
          {localization.interactionCountLabel.replace(
            "{count}",
            String(interaction.option_count),
          )}
        </span>
      </div>

      {isExpired ? (
        <p
          data-slot="interaction-expired"
          className="mt-2 text-xs text-cal-muted"
        >
          {localization.interactionExpired}
        </p>
      ) : null}
      {isResuming ? (
        <p className="mt-2 text-xs text-cal-muted">
          {localization.interactionResuming}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Tracks the deadline locally, re-rendering as it passes.
 *
 * The server default is a 24-hour window and nothing pushes an expiry event, so
 * without a local clock the card would keep offering an answer the server has
 * already stopped accepting. The card disables its actions from this; it is not
 * cosmetic.
 */
export function useIsExpired(expiresAt: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);
  const deadline = new Date(expiresAt).getTime();
  if (Number.isNaN(deadline)) return false;
  return deadline <= now;
}

/**
 * The remaining-time hint only. Expiry itself is announced by the card, which
 * also disables the actions — keeping both here would state it twice.
 */
function ExpiryNotice({
  expiresAt,
  localization,
}: {
  expiresAt: string;
  localization: ChatLocalization;
}) {
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(remainingMs) || remainingMs <= 0) return null;
  return (
    <span className="text-xs text-cal-muted">
      {localization.interactionExpiresIn.replace(
        "{time}",
        formatRemaining(remainingMs, localization),
      )}
    </span>
  );
}

/**
 * Coarse on purpose: a ticking second counter on a 24-hour deadline is noise.
 *
 * The unit words come from localization rather than being interpolated here —
 * hardcoding `분`/`시간` would render Korean units inside the English UI.
 */
export function formatRemaining(
  remainingMs: number,
  localization: Pick<
    ChatLocalization,
    "interactionUnitMinutes" | "interactionUnitHours" | "interactionUnitDays"
  >,
) {
  const minutes = Math.ceil(remainingMs / 60_000);
  if (minutes < 60) {
    return localization.interactionUnitMinutes.replace("{n}", String(minutes));
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return localization.interactionUnitHours.replace("{n}", String(hours));
  }
  return localization.interactionUnitDays.replace(
    "{n}",
    String(Math.floor(hours / 24)),
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type DocumentSelectionInteraction,
  type DocumentSelectionOption,
  isDocumentSelectionV2,
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
  hasLoadedBroadPage,
  displayOptionCount,
  displayLibraryCount,
  hasMore,
  onChoose,
  onRefine,
  onLoadMore,
  onCancel,
}: {
  interaction: DocumentSelectionInteraction;
  options: DocumentSelectionOption[];
  localization: ChatLocalization;
  isResuming: boolean;
  isLoadingMore: boolean;
  optionsError: boolean;
  hasLoadedBroadPage: boolean;
  displayOptionCount: number;
  displayLibraryCount: number;
  hasMore: boolean;
  onChoose: (documentId: string) => void;
  onRefine: (text: string) => void;
  onLoadMore: () => void;
  onCancel: () => void;
}) {
  const isExpired = useIsExpired(interaction.expires_at);
  const isV2 = isDocumentSelectionV2(interaction);
  const canAnswer = !isResuming && !isExpired;
  const [refinement, setRefinement] = useState("");
  const firstOptionRef = useRef<HTMLButtonElement>(null);
  const refinementInputRef = useRef<HTMLInputElement>(null);
  const browseActionRef = useRef<HTMLButtonElement>(null);
  const cancelActionRef = useRef<HTMLButtonElement>(null);
  const focusPendingRef = useRef(false);
  const previousInteractionIdRef = useRef(interaction.interaction_id);
  const previousBroadLoadedRef = useRef(hasLoadedBroadPage);
  useEffect(() => {
    const interactionChanged =
      previousInteractionIdRef.current !== interaction.interaction_id;
    const broadPageJustLoaded =
      !previousBroadLoadedRef.current && hasLoadedBroadPage;
    previousInteractionIdRef.current = interaction.interaction_id;
    previousBroadLoadedRef.current = hasLoadedBroadPage;
    if (interactionChanged || broadPageJustLoaded) {
      focusPendingRef.current = true;
    }
    if (interactionChanged) setRefinement("");
    if (!focusPendingRef.current || !canAnswer) return;
    const frameId = window.requestAnimationFrame(() => {
      const target = [
        firstOptionRef.current,
        refinementInputRef.current,
        browseActionRef.current,
        cancelActionRef.current,
      ].find((candidate) => candidate && !candidate.disabled);
      target?.focus();
      focusPendingRef.current = false;
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [canAnswer, hasLoadedBroadPage, interaction.interaction_id]);
  // Once the deadline passes the server will refuse the answer with
  // `run_interaction_expired`, so offering Choose would be offering a request
  // known to fail. Cancel stays enabled — it is what releases the waiting run.
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
        {!isV2
          ? localization.interactionV1Description
          : !interaction.refinement.allowed
            ? localization.interactionExhaustedDescription
            : interaction.reason_code === "unresolved_document_reference"
              ? localization.interactionUnresolvedDescription
              : localization.interactionDescription}
      </p>

      <p className="sr-only" aria-live="polite">
        {(isV2 && !hasLoadedBroadPage
          ? localization.interactionCandidatesAnnouncement
          : localization.interactionDocumentsAnnouncement
        ).replace("{count}", String(options.length))}
      </p>

      {/*
        The list is the scroller, and it is bounded.
        Uncapped, this grew the composer — which is absolutely positioned
        against the panel at `bottom-0` — upward past the panel's top edge,
        where `overflow-hidden` clipped the title and the first options away
        with no way to reach them. A full backend page can be 50 options, so this
        was reachable with one ordinary ambiguous reference, not an edge case.
        Bounding the list rather than the card keeps the title, the expiry
        notice and Cancel pinned: a suspended run blocks the conversation, so
        Cancel must never be the thing that scrolls out of reach.
      */}
      <ul
        data-slot="interaction-options"
        className={`mt-3 flex flex-col gap-2 overflow-y-auto overscroll-contain pr-1 ${
          isV2 ? "max-h-[min(10rem,18dvh)]" : "max-h-[min(16rem,28dvh)]"
        }`}
      >
        {options.map((option, index) => (
          <li
            key={option.document_id}
            className="flex flex-col gap-2 rounded-control border border-cal-hairline bg-cal-surface-card p-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="break-words font-medium text-cal-ink [overflow-wrap:anywhere]">
                {option.title}
              </p>
              <p className="break-words text-xs text-cal-muted [overflow-wrap:anywhere]">
                {/* Filename disambiguates two documents sharing a title; the
                    knowledge base says which space it came from. Either can be
                    absent — a pasted note has no file. */}
                {[
                  option.source_filename,
                  option.knowledge_base_name ??
                    localization.interactionNoKnowledgeBase,
                  "match_confidence" in option && option.match_confidence
                    ? localization[
                        option.match_confidence === "high"
                          ? "interactionMatchHigh"
                          : option.match_confidence === "medium"
                            ? "interactionMatchMedium"
                            : "interactionMatchLow"
                      ]
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <Button
              ref={index === 0 ? firstOptionRef : undefined}
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

      {isV2 && interaction.refinement.allowed ? (
        <div className="mt-3 rounded-control border border-cal-hairline bg-cal-surface-card p-3">
          <label
            htmlFor={`document-refinement-${interaction.interaction_id}`}
            className="font-medium text-cal-ink"
          >
            {localization.interactionRefineLabel}
          </label>
          <p
            id={`document-refinement-help-${interaction.interaction_id}`}
            className="mt-1 text-xs text-cal-muted"
          >
            {localization.interactionRefineDescription}
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              ref={refinementInputRef}
              id={`document-refinement-${interaction.interaction_id}`}
              value={refinement}
              maxLength={interaction.refinement.max_length}
              enterKeyHint="search"
              disabled={!canAnswer}
              aria-describedby={`document-refinement-help-${interaction.interaction_id}`}
              className="min-w-0 flex-1 rounded-control border border-cal-hairline bg-cal-surface-card px-3 py-2 text-cal-ink outline-none focus-visible:outline-2 focus-visible:outline-cal-primary focus-visible:outline-offset-2"
              placeholder={localization.interactionRefinePlaceholder}
              onChange={(event) => setRefinement(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                event.stopPropagation();
                if (
                  event.nativeEvent.isComposing ||
                  !refinement.trim() ||
                  !canAnswer
                )
                  return;
                onRefine(refinement.trim());
              }}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={!canAnswer || !refinement.trim()}
              onClick={() => onRefine(refinement.trim())}
            >
              {localization.interactionRefineAction}
            </Button>
          </div>
          <p className="mt-1 text-right text-xs text-cal-muted">
            {localization.interactionRefineAttemptsRemaining.replace(
              "{remaining}",
              String(
                interaction.refinement.attempts_max -
                  interaction.refinement.attempts_used,
              ),
            )}
          </p>
        </div>
      ) : null}

      {isV2 && interaction.browse.allowed ? (
        <p className="mt-3 text-xs text-cal-muted">
          {hasLoadedBroadPage
            ? localization.interactionBrowseLoadedDescription
            : localization.interactionBrowseAvailableDescription}
        </p>
      ) : null}

      {optionsError ? (
        <p className="mt-2 text-xs text-cal-muted">
          {localization.interactionOptionsFailed}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {hasMore ? (
          <Button
            ref={
              isV2 && interaction.browse.allowed && !hasLoadedBroadPage
                ? browseActionRef
                : undefined
            }
            type="button"
            variant="secondary"
            size="sm"
            disabled={isLoadingMore || !canAnswer}
            onClick={onLoadMore}
          >
            {isV2 && interaction.browse.allowed && !hasLoadedBroadPage
              ? localization.interactionBrowseAction
              : localization.interactionLoadMore}
          </Button>
        ) : null}
        {/* Cancel is always reachable, including while resuming. A suspended
            run blocks the whole conversation, so the dismissal must never be
            the thing that is disabled. */}
        <Button
          ref={cancelActionRef}
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          {localization.interactionCancel}
        </Button>
        <span className="text-xs text-cal-muted">
          {isV2
            ? localization.interactionV2CountLabel
                .replace("{count}", String(displayOptionCount))
                .replace("{total}", String(displayLibraryCount))
            : localization.interactionCountLabel.replace(
                "{count}",
                String(displayOptionCount),
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

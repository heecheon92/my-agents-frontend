"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type DocumentSelectionInteraction,
  type DocumentSelectionOption,
  isDocumentSelectionV2,
} from "@/model/my-agents";
import { myAgentsAPI } from "@/services/my-agents";

/**
 * Accumulates pages of document options for one pending interaction.
 *
 * Not TanStack Query, deliberately. Every route that delivers an interaction —
 * the HTTP 202, run detail, and SSE — embeds V1 options or the V2 shortlist.
 * Exhausted V2 interactions deliberately wait for the user to request broad
 * browsing before fetching its first page.
 *
 * What this owns is the *rest*: `option_count` can exceed one page, so later
 * pages are pulled through `next_cursor` and accumulated here. The fetch on an
 * empty list is a fallback for a server that legitimately sent none inline.
 */
export function useInteractionOptions({
  conversationId,
  runId,
  interaction,
}: {
  conversationId: string | undefined;
  runId: string | null;
  interaction: DocumentSelectionInteraction | null;
}) {
  const [options, setOptions] = useState<DocumentSelectionOption[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [hasLoadedBroadPage, setHasLoadedBroadPage] = useState(false);
  const [displayOptionCount, setDisplayOptionCount] = useState(0);
  const [displayLibraryCount, setDisplayLibraryCount] = useState(0);
  // Guards the seed effect from refiring on every render while still resetting
  // when the user is asked a *different* question.
  const seededInteractionIdRef = useRef<string | null>(null);
  const seededSnapshotRef = useRef<string | null>(null);
  const requestSequenceRef = useRef(0);

  const interactionId = interaction?.interaction_id ?? null;
  const interactionVersion = interaction?.schema_version ?? null;
  const interactionKey = interaction
    ? `${interaction.schema_version}:${interaction.interaction_id}:${
        isDocumentSelectionV2(interaction)
          ? interaction.refinement.attempts_used
          : 0
      }`
    : null;
  const interactionSnapshot = interaction
    ? JSON.stringify({
        optionCount: interaction.option_count,
        libraryCount: isDocumentSelectionV2(interaction)
          ? interaction.library_count
          : interaction.option_count,
        options: interaction.options,
        cursor: isDocumentSelectionV2(interaction)
          ? interaction.browse.cursor
          : interaction.next_cursor,
        refinement: isDocumentSelectionV2(interaction)
          ? interaction.refinement
          : null,
        browse: isDocumentSelectionV2(interaction) ? interaction.browse : null,
      })
    : null;

  useEffect(() => {
    if (!interaction || !interactionKey) {
      seededInteractionIdRef.current = null;
      seededSnapshotRef.current = null;
      requestSequenceRef.current += 1;
      setOptions([]);
      setCursor(null);
      setIsLoadingMore(false);
      setHasError(false);
      setHasLoadedBroadPage(false);
      setDisplayOptionCount(0);
      setDisplayLibraryCount(0);
      return;
    }
    if (
      seededInteractionIdRef.current === interactionKey &&
      seededSnapshotRef.current === interactionSnapshot
    )
      return;
    seededInteractionIdRef.current = interactionKey;
    seededSnapshotRef.current = interactionSnapshot;
    requestSequenceRef.current += 1;
    setOptions(interaction.options);
    setCursor(
      isDocumentSelectionV2(interaction)
        ? interaction.browse.allowed && !interaction.refinement.allowed
          ? (interaction.browse.cursor ?? null)
          : null
        : (interaction.next_cursor ?? null),
    );
    setHasError(false);
    setIsLoadingMore(false);
    setHasLoadedBroadPage(false);
    setDisplayOptionCount(interaction.option_count);
    setDisplayLibraryCount(
      isDocumentSelectionV2(interaction)
        ? interaction.library_count
        : interaction.option_count,
    );
  }, [interaction, interactionKey, interactionSnapshot]);

  const fetchPage = useCallback(
    async (nextCursor: string | null) => {
      if (!conversationId || !runId || !interactionId) return;
      const requestId = ++requestSequenceRef.current;
      const requestedInteractionKey = interactionKey;
      setIsLoadingMore(true);
      try {
        const page = await myAgentsAPI.conversations.interactionOptions(
          conversationId,
          runId,
          interactionId,
          nextCursor,
        );
        // Ignore a page that arrived after the user was asked something else.
        if (
          requestSequenceRef.current !== requestId ||
          seededInteractionIdRef.current !== requestedInteractionKey
        )
          return;
        if (
          page.interaction_id !== interactionId ||
          page.schema_version !== interactionVersion
        )
          return;
        setOptions((current) => {
          const seen = new Set(current.map((option) => option.document_id));
          return [
            ...current,
            ...page.options.filter((option) => !seen.has(option.document_id)),
          ];
        });
        setCursor(page.next_cursor ?? null);
        if (page.schema_version === 2 && page.mode === "broad") {
          setHasLoadedBroadPage(true);
          setDisplayLibraryCount(page.library_count);
        } else if (page.schema_version === 1) {
          setDisplayOptionCount(page.option_count);
          setDisplayLibraryCount(page.option_count);
        }
        setHasError(false);
      } catch {
        // Copy is chosen by the card; the raw error is never rendered.
        if (
          requestSequenceRef.current === requestId &&
          seededInteractionIdRef.current === requestedInteractionKey
        ) {
          setHasError(true);
        }
      } finally {
        if (requestSequenceRef.current === requestId) {
          setIsLoadingMore(false);
        }
      }
    },
    [conversationId, interactionId, interactionKey, interactionVersion, runId],
  );

  // V1 compatibility only: a legacy page can be omitted despite a non-zero
  // count. V2 broad browsing is always an explicit user action.
  useEffect(() => {
    if (!interaction || options.length > 0) return;
    if (isDocumentSelectionV2(interaction)) {
      return;
    }
    if (interaction.option_count > 0) void fetchPage(null);
  }, [fetchPage, interaction, options.length]);

  const canLoadInitialBroadPage = Boolean(
    interaction &&
      isDocumentSelectionV2(interaction) &&
      interaction.browse.allowed &&
      !interaction.refinement.allowed &&
      !hasLoadedBroadPage,
  );
  const loadMore = useCallback(() => {
    if (isLoadingMore || (!cursor && !canLoadInitialBroadPage)) return;
    void fetchPage(cursor);
  }, [canLoadInitialBroadPage, cursor, fetchPage, isLoadingMore]);

  return {
    options,
    hasMore: canLoadInitialBroadPage || Boolean(cursor),
    isLoadingMore,
    hasError,
    hasLoadedBroadPage,
    displayOptionCount,
    displayLibraryCount,
    loadMore,
  };
}

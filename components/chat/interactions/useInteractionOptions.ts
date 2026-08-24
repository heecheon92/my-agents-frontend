"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DocumentSelectionInteraction,
  DocumentSelectionOption,
} from "@/model/my-agents";
import { myAgentsAPI } from "@/services/my-agents";

/**
 * Accumulates pages of document options for one pending interaction.
 *
 * Not TanStack Query, deliberately. Every route that delivers an interaction —
 * the HTTP 202, `GET .../runs/{run_id}` on refresh, and the SSE
 * `run_interrupted` event — embeds the first page of `options` already, so a
 * query keyed on the interaction would refetch what the server just handed us
 * and make the card wait on a round-trip it does not need.
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
  // Guards the seed effect from refiring on every render while still resetting
  // when the user is asked a *different* question.
  const seededInteractionIdRef = useRef<string | null>(null);

  const interactionId = interaction?.interaction_id ?? null;

  useEffect(() => {
    if (!interaction || !interactionId) {
      seededInteractionIdRef.current = null;
      setOptions([]);
      setCursor(null);
      setHasError(false);
      return;
    }
    if (seededInteractionIdRef.current === interactionId) return;
    seededInteractionIdRef.current = interactionId;
    setOptions(interaction.options);
    setCursor(interaction.next_cursor ?? null);
    setHasError(false);
  }, [interaction, interactionId]);

  const fetchPage = useCallback(
    async (nextCursor: string | null) => {
      if (!conversationId || !runId || !interactionId) return;
      setIsLoadingMore(true);
      try {
        const page = await myAgentsAPI.conversations.interactionOptions(
          conversationId,
          runId,
          interactionId,
          nextCursor,
        );
        // Ignore a page that arrived after the user was asked something else.
        if (seededInteractionIdRef.current !== interactionId) return;
        setOptions((current) => {
          const seen = new Set(current.map((option) => option.document_id));
          return [
            ...current,
            ...page.options.filter((option) => !seen.has(option.document_id)),
          ];
        });
        setCursor(page.next_cursor ?? null);
        setHasError(false);
      } catch {
        // Copy is chosen by the card; the raw error is never rendered.
        setHasError(true);
      } finally {
        setIsLoadingMore(false);
      }
    },
    [conversationId, interactionId, runId],
  );

  // Defensive only: every delivery route embeds the first page, including the
  // live `run_interrupted` event, so this normally never fires. It covers a
  // server that reports a non-zero count while sending an empty inline list.
  useEffect(() => {
    if (!interaction || options.length > 0) return;
    if (interaction.option_count === 0) return;
    void fetchPage(null);
  }, [fetchPage, interaction, options.length]);

  const loadMore = useCallback(() => {
    if (!cursor || isLoadingMore) return;
    void fetchPage(cursor);
  }, [cursor, fetchPage, isLoadingMore]);

  return {
    options,
    hasMore: Boolean(cursor),
    isLoadingMore,
    hasError,
    loadMore,
  };
}

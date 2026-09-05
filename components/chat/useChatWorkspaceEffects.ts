"use client";

import { useEffect } from "react";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import type { KnowledgeBase } from "@/model/my-agents";
import type { QueuedMessage } from "./types";

type QueryInvalidator = {
  invalidateQueries: (options: {
    queryKey: readonly unknown[];
  }) => Promise<unknown>;
};

type UseChatWorkspaceEffectsOptions = {
  activeId?: string;
  autoReplayAttemptedRunIdsRef: React.MutableRefObject<Set<string>>;
  autoScrollTrigger: string;
  chatScrollRef: React.RefObject<HTMLDivElement | null>;
  /**
   * The transcript's content, whose height is observed directly.
   *
   * `autoScrollTrigger` only names content the workspace already knows about —
   * messages, streamed text, activity events. Anything that grows the
   * transcript on its own schedule is invisible to it: a rendered diagram, an
   * artifact list arriving after a run, an image finishing layout. Observing
   * the box covers all of them, including the ones nobody has thought of yet.
   */
  chatContentRef: React.RefObject<HTMLDivElement | null>;
  isCancelling: boolean;
  isStreaming: boolean;
  localization: { queuedSentAnnouncement: string };
  previousServerActiveRunIdRef: React.MutableRefObject<string | null>;
  queryClient: QueryInvalidator;
  queuedMessageRef: React.MutableRefObject<QueuedMessage | null>;
  requestAnimationFrameFn?: typeof requestAnimationFrame;
  runMessageAndContinue: (
    conversationId: string,
    message: string,
    knowledgeBaseSelection: QueuedMessage["knowledgeBaseSelection"],
    attachmentIds: QueuedMessage["attachmentIds"],
  ) => Promise<void>;
  selectableKnowledgeBases: KnowledgeBase[];
  serverActiveRunId: string | null;
  /**
   * A run suspended on an unanswered question. It produces no output, so it is
   * not "active", but it does hold the conversation.
   */
  serverWaitingRunId: string | null;
  /** `canDrainQueue(runPhase)` from `run-state.ts`, so the rule lives in one place. */
  canDrainQueue: boolean;
  setActiveRunClock: (value: number) => void;
  setObservedServerActiveRun: React.Dispatch<
    React.SetStateAction<{ runId: string; observedAt: number } | null>
  >;
  setQueuedMessageState: React.Dispatch<
    React.SetStateAction<QueuedMessage | null>
  >;
  setSelectedKnowledgeBaseIds: React.Dispatch<React.SetStateAction<string[]>>;
  setStatusAnnouncement: (message: string) => void;
  shouldAutoScrollRef: React.MutableRefObject<boolean>;
};

export function useChatWorkspaceEffects({
  activeId,
  autoReplayAttemptedRunIdsRef,
  autoScrollTrigger,
  chatContentRef,
  chatScrollRef,
  isCancelling,
  isStreaming,
  localization,
  previousServerActiveRunIdRef,
  queryClient,
  queuedMessageRef,
  requestAnimationFrameFn = requestAnimationFrame,
  runMessageAndContinue,
  selectableKnowledgeBases,
  serverActiveRunId,
  serverWaitingRunId,
  canDrainQueue,
  setActiveRunClock,
  setObservedServerActiveRun,
  setQueuedMessageState,
  setSelectedKnowledgeBaseIds,
  setStatusAnnouncement,
  shouldAutoScrollRef,
}: UseChatWorkspaceEffectsOptions) {
  useEffect(() => {
    if (!activeId) return;
    // Waiting runs are polled too, at a slower cadence. Nothing is streaming,
    // so there is no output to chase — but the run can be resumed, cancelled,
    // or expired somewhere else, and none of those reach this tab as an event.
    // Without a poll the card would sit there after it stopped being real.
    const pollingRunId = serverActiveRunId ?? serverWaitingRunId;
    if (!pollingRunId) return;
    if (serverActiveRunId) {
      previousServerActiveRunIdRef.current = serverActiveRunId;
    }
    const intervalId = window.setInterval(
      () => {
        void queryClient.invalidateQueries({
          queryKey: MyAgentsQueryKeys.conversations.runs(activeId),
        });
      },
      serverActiveRunId ? 2000 : 15000,
    );
    return () => window.clearInterval(intervalId);
  }, [
    activeId,
    queryClient,
    previousServerActiveRunIdRef,
    serverActiveRunId,
    serverWaitingRunId,
  ]);

  useEffect(() => {
    if (!serverActiveRunId) {
      setObservedServerActiveRun(null);
      return;
    }
    setActiveRunClock(Date.now());
    setObservedServerActiveRun((current) =>
      current?.runId === serverActiveRunId
        ? current
        : { runId: serverActiveRunId, observedAt: Date.now() },
    );
  }, [serverActiveRunId, setActiveRunClock, setObservedServerActiveRun]);

  useEffect(() => {
    if (!serverActiveRunId) return;
    const intervalId = window.setInterval(
      () => setActiveRunClock(Date.now()),
      2000,
    );
    return () => window.clearInterval(intervalId);
  }, [serverActiveRunId, setActiveRunClock]);

  useEffect(() => {
    if (!activeId || serverActiveRunId || isStreaming || isCancelling) return;
    // The queue *pauses* while a question is open; it does not drain. A run
    // moving from `running` to `waiting_for_input` looks exactly like
    // completion to the active-run predicate, so without this guard the queued
    // message would be sent into a conversation the backend will refuse with
    // the same 409 it uses for a busy one — and the guard below would then
    // never let it retry.
    if (!canDrainQueue) return;
    const previousServerActiveRunId = previousServerActiveRunIdRef.current;
    if (!previousServerActiveRunId) return;
    previousServerActiveRunIdRef.current = null;
    void queryClient.invalidateQueries({
      queryKey: MyAgentsQueryKeys.conversations.messages(activeId),
    });
    const nextQueuedMessage = queuedMessageRef.current;
    if (nextQueuedMessage?.conversationId !== activeId) return;
    if (autoReplayAttemptedRunIdsRef.current.has(previousServerActiveRunId))
      return;
    autoReplayAttemptedRunIdsRef.current.add(previousServerActiveRunId);
    queuedMessageRef.current = null;
    setQueuedMessageState(null);
    setStatusAnnouncement(localization.queuedSentAnnouncement);
    void runMessageAndContinue(
      nextQueuedMessage.conversationId,
      nextQueuedMessage.content,
      nextQueuedMessage.knowledgeBaseSelection,
      nextQueuedMessage.attachmentIds,
    );
  }, [
    activeId,
    autoReplayAttemptedRunIdsRef,
    isCancelling,
    isStreaming,
    localization,
    previousServerActiveRunIdRef,
    queryClient,
    queuedMessageRef,
    runMessageAndContinue,
    serverActiveRunId,
    canDrainQueue,
    setQueuedMessageState,
    setStatusAnnouncement,
  ]);

  useEffect(() => {
    const availableIds = new Set(selectableKnowledgeBases.map((kb) => kb.id));
    setSelectedKnowledgeBaseIds((current) =>
      current.filter((id) => availableIds.has(id)),
    );
  }, [selectableKnowledgeBases, setSelectedKnowledgeBaseIds]);

  useEffect(() => {
    if (!activeId) return;
    shouldAutoScrollRef.current = true;
    requestAnimationFrameFn(() => {
      const scrollElement = chatScrollRef.current;
      if (!scrollElement) return;
      scrollElement.scrollTop = scrollElement.scrollHeight;
    });
  }, [activeId, chatScrollRef, requestAnimationFrameFn, shouldAutoScrollRef]);

  useEffect(() => {
    if (!autoScrollTrigger || !shouldAutoScrollRef.current) return;
    requestAnimationFrameFn(() => {
      const scrollElement = chatScrollRef.current;
      if (!scrollElement || !shouldAutoScrollRef.current) return;
      scrollElement.scrollTop = scrollElement.scrollHeight;
    });
  }, [
    autoScrollTrigger,
    chatScrollRef,
    requestAnimationFrameFn,
    shouldAutoScrollRef,
  ]);

  /**
   * Follows the transcript while the reader is at the bottom, whatever grew it.
   *
   * The effect above fires on state the workspace tracks. This one fires on the
   * content box actually changing height, which is what a reader experiences.
   * A diagram that finishes rendering a second after the answer settles added
   * over a thousand pixels below the fold and left the view stranded, because
   * no tracked value changed when it appeared.
   *
   * `shouldAutoScrollRef` is still the only authority on whether to move: a
   * reader who scrolled up stays where they put themselves, and growth below
   * them fires no scroll event, so their position is never silently reclaimed.
   */
  useEffect(() => {
    const scrollElement = chatScrollRef.current;
    const contentElement = chatContentRef.current;
    if (!scrollElement || !contentElement) return;
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      if (!shouldAutoScrollRef.current) return;
      // Deferred out of the observer callback. Writing `scrollTop` during
      // layout can re-enter the observer, and the browser warns about a
      // resize loop; a frame later the layout is settled.
      requestAnimationFrameFn(() => {
        const element = chatScrollRef.current;
        if (!element || !shouldAutoScrollRef.current) return;
        const distance =
          element.scrollHeight - element.scrollTop - element.clientHeight;
        // Already there. Skipping the write keeps this from cancelling a
        // reader's in-flight smooth scroll or momentum on a touch device.
        if (distance <= 0) return;
        element.scrollTop = element.scrollHeight;
      });
    });
    observer.observe(contentElement);
    return () => observer.disconnect();
  }, [
    chatContentRef,
    chatScrollRef,
    requestAnimationFrameFn,
    shouldAutoScrollRef,
  ]);
}

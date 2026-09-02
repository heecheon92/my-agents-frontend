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
}

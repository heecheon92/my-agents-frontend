"use client";

import { MyAgentsQueryKeys } from "@/constants/query-keys";
import type {
  AnswerDeltaEventData,
  Citation,
  ConversationRunResponse,
  KnowledgeBaseSelection,
  Message,
} from "@/model/my-agents";
import { myAgentsAPI } from "@/services/my-agents";
import type { LiveActivityEvent, QueuedMessage } from "./types";
import {
  isConversationRunAlreadyActiveError,
  type RunOutcome,
  safeBackendDetail,
  shouldRecordLiveActivityEvent,
} from "./workspace-helpers";

type QueryInvalidator = {
  invalidateQueries: (options: {
    queryKey: readonly unknown[];
  }) => Promise<unknown>;
};

type UseChatRunLoopOptions = {
  isStreamingRef: React.MutableRefObject<boolean>;
  activeRunIdRef: React.MutableRefObject<string | null>;
  queuedMessageRef: React.MutableRefObject<QueuedMessage | null>;
  pendingImmediateMessageRef: React.MutableRefObject<QueuedMessage | null>;
  cancelAcceptedRef: React.MutableRefObject<boolean>;
  localization: {
    runFailed: string;
    queueAlreadyExistsAnnouncement: string;
    queuedAnnouncement: string;
    immediateFailedAnnouncement: string;
    immediateStartedAnnouncement: string;
    currentAnswerStoppedAnnouncement: string;
    queuedSentAnnouncement: string;
  };
  queryClient: QueryInvalidator;
  setActiveRunId: (runId: string | null) => void;
  setDraft: (draft: string) => void;
  setIsCancelling: (isCancelling: boolean) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  setLatestCitations: React.Dispatch<React.SetStateAction<Citation[]>>;
  setLiveActivityEvents: React.Dispatch<
    React.SetStateAction<LiveActivityEvent[]>
  >;
  setOptimisticMessage: React.Dispatch<React.SetStateAction<Message | null>>;
  setQueuedMessageState: React.Dispatch<
    React.SetStateAction<QueuedMessage | null>
  >;
  setStatusAnnouncement: (message: string) => void;
  setStreamedReply: (reply: string | ((current: string) => string)) => void;
  setStreamError: (error: unknown) => void;
};

export function useChatRunLoop({
  activeRunIdRef,
  cancelAcceptedRef,
  isStreamingRef,
  localization,
  pendingImmediateMessageRef,
  queryClient,
  queuedMessageRef,
  setActiveRunId,
  setDraft,
  setIsCancelling,
  setIsStreaming,
  setLatestCitations,
  setLiveActivityEvents,
  setOptimisticMessage,
  setQueuedMessageState,
  setStatusAnnouncement,
  setStreamError,
  setStreamedReply,
}: UseChatRunLoopOptions) {
  function setQueuedMessage(nextQueuedMessage: QueuedMessage | null) {
    queuedMessageRef.current = nextQueuedMessage;
    setQueuedMessageState(nextQueuedMessage);
  }

  function setCurrentRunId(runId: string | null) {
    activeRunIdRef.current = runId;
    setActiveRunId(runId);
  }

  function resetImmediateState() {
    pendingImmediateMessageRef.current = null;
    cancelAcceptedRef.current = false;
    setIsCancelling(false);
  }

  async function runMessage(
    conversationId: string,
    message: string,
    knowledgeBaseSelection: KnowledgeBaseSelection,
  ): Promise<RunOutcome> {
    if (isStreamingRef.current) return "failed";
    isStreamingRef.current = true;
    setIsStreaming(true);
    setStreamError(null);
    setStreamedReply("");
    setCurrentRunId(null);
    setLiveActivityEvents([]);
    setLatestCitations([]);
    setOptimisticMessage({
      id: `optimistic-${Date.now()}`,
      conversation_id: conversationId,
      role: "user",
      content: message,
    });
    let completed = false;
    let cancelled = false;
    let liveSequence = 0;
    try {
      for await (const streamEvent of myAgentsAPI.conversations.streamRunEvents(
        conversationId,
        { message, knowledge_base_selection: knowledgeBaseSelection },
      )) {
        if (streamEvent.event === "answer_delta") {
          const data = streamEvent.data as AnswerDeltaEventData;
          setStreamedReply((current) => current + data.delta);
          continue;
        }
        if (shouldRecordLiveActivityEvent(streamEvent.event)) {
          liveSequence += 1;
          setLiveActivityEvents((current) => [
            ...current,
            {
              id: `live-${liveSequence}`,
              sequence: liveSequence,
              event_type: streamEvent.event,
              payload: streamEvent.data,
            },
          ]);
        }
        if (streamEvent.event === "run_started") {
          const data = streamEvent.data as { run_id: string };
          setCurrentRunId(data.run_id);
        }
        if (streamEvent.event === "run_cancelled") cancelled = true;
        if (streamEvent.event === "run_completed") {
          const data = streamEvent.data as ConversationRunResponse;
          completed = true;
          setStreamedReply(data.reply);
          setLatestCitations(data.citations ?? []);
        }
        if (streamEvent.event === "run_failed") {
          throw new Error(
            safeBackendDetail(streamEvent.data) ?? localization.runFailed,
          );
        }
      }
      if (!completed && !cancelled) {
        if (cancelAcceptedRef.current && pendingImmediateMessageRef.current) {
          cancelled = true;
        } else throw new Error(localization.runFailed);
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: MyAgentsQueryKeys.conversations.messages(conversationId),
        }),
        queryClient.invalidateQueries({
          queryKey: MyAgentsQueryKeys.conversations.runs(conversationId),
        }),
      ]);
      setOptimisticMessage(null);
      setStreamedReply("");
      return cancelled ? "cancelled" : "completed";
    } catch (error) {
      if (isConversationRunAlreadyActiveError(error)) {
        setOptimisticMessage(null);
        setStreamError(null);
        return "active_conflict";
      }
      setStreamError(error);
      return "failed";
    } finally {
      isStreamingRef.current = false;
      setIsStreaming(false);
      setCurrentRunId(null);
    }
  }

  async function runMessageAndContinue(
    conversationId: string,
    message: string,
    knowledgeBaseSelection: KnowledgeBaseSelection,
  ): Promise<void> {
    const outcome = await runMessage(
      conversationId,
      message,
      knowledgeBaseSelection,
    );
    if (outcome === "active_conflict") {
      if (queuedMessageRef.current?.conversationId === conversationId) {
        setDraft(message);
        setStatusAnnouncement(localization.queueAlreadyExistsAnnouncement);
      } else {
        setQueuedMessage({
          conversationId,
          content: message,
          knowledgeBaseSelection,
        });
        setStatusAnnouncement(localization.queuedAnnouncement);
      }
      await queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.conversations.runs(conversationId),
      });
      resetImmediateState();
      return;
    }
    if (outcome === "failed") {
      const pendingImmediateMessage = pendingImmediateMessageRef.current;
      if (pendingImmediateMessage?.conversationId === conversationId) {
        setDraft(pendingImmediateMessage.content);
        setStatusAnnouncement(localization.immediateFailedAnnouncement);
        resetImmediateState();
      }
      return;
    }
    const pendingImmediateMessage = pendingImmediateMessageRef.current;
    if (pendingImmediateMessage?.conversationId === conversationId) {
      resetImmediateState();
      setStatusAnnouncement(localization.immediateStartedAnnouncement);
      await runMessageAndContinue(
        pendingImmediateMessage.conversationId,
        pendingImmediateMessage.content,
        pendingImmediateMessage.knowledgeBaseSelection,
      );
      return;
    }
    if (outcome !== "completed") {
      resetImmediateState();
      setStatusAnnouncement(localization.currentAnswerStoppedAnnouncement);
      return;
    }
    const nextQueuedMessage = queuedMessageRef.current;
    if (nextQueuedMessage?.conversationId === conversationId) {
      setQueuedMessage(null);
      setStatusAnnouncement(localization.queuedSentAnnouncement);
      await runMessageAndContinue(
        nextQueuedMessage.conversationId,
        nextQueuedMessage.content,
        nextQueuedMessage.knowledgeBaseSelection,
      );
    }
  }

  return { resetImmediateState, runMessageAndContinue, setQueuedMessage };
}

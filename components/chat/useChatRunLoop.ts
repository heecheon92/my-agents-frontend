"use client";

import { MyAgentsQueryKeys } from "@/constants/query-keys";
import type {
  AnswerDeltaEventData,
  Citation,
  ConversationRunInterruptedResponse,
  ConversationRunResponse,
  ConversationRunResumeRequest,
  KnowledgeBaseSelection,
  Message,
  PendingInteraction,
  ReasoningEffort,
  ReasoningMode,
  RunCancelledEventData,
} from "@/model/my-agents";
import { myAgentsAPI } from "@/services/my-agents";
import type { LiveActivityEvent, QueuedMessage } from "./types";
import {
  appendLiveActivityEvent,
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
  /**
   * Read at send time rather than captured, so a level changed while a run is
   * in flight applies to the next message instead of the one already sent.
   * Returns `null` when the backend has not confirmed it accepts the fields,
   * and the payload then omits them entirely.
   */
  getReasoning: () => {
    reasoning_mode: ReasoningMode;
    reasoning_effort: ReasoningEffort;
  } | null;
  localization: {
    runFailed: string;
    interactionWaitingAnnouncement: string;
    interactionResumedAnnouncement: string;
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
  /**
   * Records the question the run stopped to ask. Called with the id and count
   * only — the SSE payload carries no options, so the card fetches them.
   */
  setPendingInteraction: (interaction: PendingInteraction | null) => void;
  pendingInteractionRef: React.MutableRefObject<PendingInteraction | null>;
};

export function useChatRunLoop({
  activeRunIdRef,
  cancelAcceptedRef,
  getReasoning,
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
  setPendingInteraction,
  pendingInteractionRef,
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
    // The backend reports whether it stored the partial answer. If it did, the
    // refetch below brings it back and the live buffer should clear; if it did
    // not, clearing would silently discard text the user already read.
    let partialReplyPersisted = false;
    let interrupted = false;
    let interruptedRunId: string | null = null;
    try {
      for await (const streamEvent of myAgentsAPI.conversations.streamRunEvents(
        conversationId,
        {
          message,
          knowledge_base_selection: knowledgeBaseSelection,
          ...(getReasoning() ?? {}),
        },
      )) {
        if (streamEvent.event === "answer_delta") {
          const data = streamEvent.data as AnswerDeltaEventData;
          setStreamedReply((current) => current + data.delta);
          continue;
        }
        if (shouldRecordLiveActivityEvent(streamEvent.event)) {
          setLiveActivityEvents((current) =>
            appendLiveActivityEvent(current, {
              eventType: streamEvent.event,
              payload: streamEvent.data,
            }),
          );
        }
        if (streamEvent.event === "run_started") {
          const data = streamEvent.data as { run_id: string };
          setCurrentRunId(data.run_id);
        }
        if (streamEvent.event === "run_cancelled") {
          cancelled = true;
          partialReplyPersisted = Boolean(
            (streamEvent.data as RunCancelledEventData)
              ?.partial_reply_persisted,
          );
        }
        if (streamEvent.event === "run_completed") {
          const data = streamEvent.data as ConversationRunResponse;
          completed = true;
          setStreamedReply(data.reply);
          setLatestCitations(data.citations ?? []);
        }
        // The run stopped to ask something. This is a *terminal* event for this
        // stream but not for the run: the run stays open server-side and holds
        // the conversation until it is answered, cancelled, or expires.
        if (streamEvent.event === "run_interrupted") {
          const data = streamEvent.data as ConversationRunInterruptedResponse;
          interrupted = true;
          interruptedRunId = data.run_id;
          // The stream hands over the whole interaction, including its first
          // page of options, so the card can render without a round-trip.
          setPendingInteraction(data.interaction);
          setStatusAnnouncement(localization.interactionWaitingAnnouncement);
        }
        if (streamEvent.event === "run_resumed") {
          setStatusAnnouncement(localization.interactionResumedAnnouncement);
        }
        if (streamEvent.event === "run_failed") {
          throw new Error(
            safeBackendDetail(streamEvent.data) ?? localization.runFailed,
          );
        }
      }
      if (!completed && !cancelled && !interrupted) {
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
      // Keep the partial answer on screen when the run suspended: the user has
      // already read it, and it is the context for the question being asked.
      if (interrupted) return "interrupted";
      if (!cancelled || partialReplyPersisted) setStreamedReply("");
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
      // A suspended run must keep its id: it is the address the resume request
      // is sent to. Clearing it here would leave the card unable to answer.
      if (!interrupted) setCurrentRunId(null);
      else if (interruptedRunId) setCurrentRunId(interruptedRunId);
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
    // The run suspended to ask a question. Stop here: the queue must *hold*
    // rather than drain, because the suspended run still occupies the
    // conversation and the backend would reject the next message with the same
    // 409 it uses for a busy one. The announcement was already made when the
    // interrupt arrived, and falling through would claim the answer was
    // stopped, which is not what happened.
    if (outcome === "interrupted") {
      resetImmediateState();
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

  /**
   * Answers a pending interaction and streams the continuation.
   *
   * Resume is control input, not a new turn: it creates no transcript message
   * and does not consume a guest prompt. It is also not retried — a retried
   * resume against an already-resumed run returns
   * `run_not_waiting_for_input`, which would show the user a failure for
   * something that actually succeeded.
   */
  async function resumeInteraction(
    conversationId: string,
    runId: string,
    payload: ConversationRunResumeRequest,
  ): Promise<RunOutcome> {
    if (isStreamingRef.current) return "failed";
    isStreamingRef.current = true;
    setIsStreaming(true);
    setStreamError(null);
    let completed = false;
    let cancelled = false;
    let interrupted = false;
    try {
      for await (const streamEvent of myAgentsAPI.conversations.streamResumeRunEvents(
        conversationId,
        runId,
        payload,
      )) {
        if (streamEvent.event === "answer_delta") {
          const data = streamEvent.data as AnswerDeltaEventData;
          setStreamedReply((current) => current + data.delta);
          continue;
        }
        // Appends to the list the interrupted stream already filled: this is
        // a continuation of the same run, not a new timeline.
        if (shouldRecordLiveActivityEvent(streamEvent.event)) {
          setLiveActivityEvents((current) =>
            appendLiveActivityEvent(current, {
              eventType: streamEvent.event,
              payload: streamEvent.data,
            }),
          );
        }
        if (streamEvent.event === "run_resumed") {
          // The question is answered; the card comes down and the partial
          // answer keeps growing from where it stopped.
          setPendingInteraction(null);
          setStatusAnnouncement(localization.interactionResumedAnnouncement);
        }
        if (streamEvent.event === "run_cancelled") cancelled = true;
        if (streamEvent.event === "run_completed") {
          const data = streamEvent.data as ConversationRunResponse;
          completed = true;
          setStreamedReply(data.reply);
          setLatestCitations(data.citations ?? []);
          setPendingInteraction(null);
        }
        // A resumed run can suspend again — a second ambiguous reference in
        // the same answer. Replace the card rather than assuming one question
        // per run.
        if (streamEvent.event === "run_interrupted") {
          const data = streamEvent.data as ConversationRunInterruptedResponse;
          interrupted = true;
          setPendingInteraction(data.interaction);
          setStatusAnnouncement(localization.interactionWaitingAnnouncement);
        }
        if (streamEvent.event === "run_failed") {
          throw new Error(
            safeBackendDetail(streamEvent.data) ?? localization.runFailed,
          );
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: MyAgentsQueryKeys.conversations.messages(conversationId),
        }),
        queryClient.invalidateQueries({
          queryKey: MyAgentsQueryKeys.conversations.runs(conversationId),
        }),
      ]);
      if (interrupted) return "interrupted";
      setOptimisticMessage(null);
      if (completed) setStreamedReply("");
      return cancelled ? "cancelled" : "completed";
    } catch (error) {
      // The interaction is still open server-side, so the card stays up and
      // the user can choose again. Dropping it here would strand the run.
      setStreamError(error);
      return "failed";
    } finally {
      isStreamingRef.current = false;
      setIsStreaming(false);
      if (!interrupted && pendingInteractionRef.current === null) {
        setCurrentRunId(null);
      }
    }
  }

  return {
    resetImmediateState,
    resumeInteraction,
    runMessageAndContinue,
    setQueuedMessage,
  };
}

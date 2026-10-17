"use client";

import { MyAgentsQueryKeys } from "@/constants/query-keys";
import {
  type AnswerDeltaEventData,
  type Citation,
  type ConversationAttachment,
  type ConversationRunInterruptedResponse,
  type ConversationRunResponse,
  type ConversationRunResumeRequest,
  type DocumentCoverage,
  isAttachmentSelection,
  isDocumentSelection,
  isDocumentSelectionV2,
  type KnowledgeBaseSelection,
  type Message,
  type PendingInteraction,
  REASONING_SUMMARY_MAX_LENGTH,
  type ReasoningEffort,
  type ReasoningMode,
  type ReasoningSummaryDeltaEventData,
  type ReasoningSummaryDisplay,
  type RunAdmissionReceipt,
  type RunCancelledEventData,
  type RunOutputSnapshot,
} from "@/model/my-agents";
import { myAgentsAPI } from "@/services/my-agents";
import {
  isMyAgentsAPIError,
  MyAgentsAPIError,
} from "@/services/my-agents/MyAgentsAPIError";
import type { ConversationRunStreamEvent } from "@/services/my-agents/MyAgentsConversationAPI";
import {
  admitWithRetry,
  durableRunFailedError,
  followDurableRun,
  isAbortError,
} from "./durable-run";
import type { LiveActivityEvent, QueuedMessage } from "./types";
import {
  type AdmissionVerdict,
  appendLiveActivityEvent,
  createLiveActivityEvent,
  decideAdmission,
  isAmbiguousPreAdmissionFailure,
  isConversationRunAlreadyActiveError,
  newClientRequestId,
  type RunOutcome,
  safeBackendDetail,
  shouldRecordLiveActivityEvent,
} from "./workspace-helpers";

/** Gap before reconciliation looks again for a run recorded late. */
const ADMISSION_RECHECK_DELAY_MS = 1500;

/*
 * Synthetic events a durable answer adds to the shared stream. Prefixed so no
 * backend event name can collide with them, and handled before the activity
 * timeline sees anything.
 */
const DURABLE_ADMITTED_EVENT = "durable:admitted";
const DURABLE_SNAPSHOT_EVENT = "durable:snapshot";
const DURABLE_RECONNECTING_EVENT = "durable:reconnecting";
/** A durable `run_failed`: recorded on the timeline, then raised by code. */
const DURABLE_FAILED_EVENT = "durable:failed";

type DurableFailure = { code: string; detail: string } | null;

type QueryInvalidator = {
  invalidateQueries: (options: {
    queryKey: readonly unknown[];
  }) => Promise<unknown>;
  getQueryData: (queryKey: readonly unknown[]) => unknown;
  setQueryData: (queryKey: readonly unknown[], value: unknown) => unknown;
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
  /**
   * Called once when the backend admits a run (`run_started`), with exactly the
   * attachment IDs that run submitted — never the composer's current selection,
   * which may already hold a newer turn's files. Anything that fails before
   * admission never calls it, so the selection survives for a retry.
   */
  onRunAdmitted?: (attachmentIds: string[]) => void;
  /**
   * The attachment records behind a send's IDs, for the optimistic message,
   * so a question and its files appear together the moment it is sent rather
   * than the files arriving once the stored message is refetched. Unknown IDs
   * are skipped; the stored copy is still the source of truth.
   */
  resolveAttachments?: (attachmentIds: string[]) => ConversationAttachment[];
  localization: {
    runFailed: string;
    interactionWaitingAnnouncement: string;
    interactionRefinementWaitingAnnouncement: string;
    interactionBrowseWaitingAnnouncement: string;
    attachmentInteractionWaitingAnnouncement: string;
    interactionResumedAnnouncement: string;
    interactionRefiningAnnouncement: string;
    queueAlreadyExistsAnnouncement: string;
    queuedAnnouncement: string;
    immediateFailedAnnouncement: string;
    immediateStartedAnnouncement: string;
    currentAnswerStoppedAnnouncement: string;
    queuedSentAnnouncement: string;
    admittedAfterDisconnectAnnouncement: string;
    durableReconnectingAnnouncement: string;
    durableAttachedAnnouncement: string;
  };
  queryClient: QueryInvalidator;
  setActiveRunId: (runId: string | null) => void;
  setDraft: (draft: string) => void;
  setIsCancelling: (isCancelling: boolean) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  setLatestCitations: React.Dispatch<React.SetStateAction<Citation[]>>;
  setLatestConsultedSources: React.Dispatch<
    React.SetStateAction<Citation[] | null>
  >;
  setLatestDocumentCoverage: React.Dispatch<
    React.SetStateAction<DocumentCoverage | null | undefined>
  >;
  setLatestReasoningSummaries: React.Dispatch<
    React.SetStateAction<ReasoningSummaryDisplay[] | undefined>
  >;
  setLatestRunResultId: (runId: string | null) => void;
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
  /** Records the complete refresh-safe interaction carried by HTTP or SSE. */
  setPendingInteraction: (interaction: PendingInteraction | null) => void;
  pendingInteractionRef: React.MutableRefObject<PendingInteraction | null>;
  /**
   * Server-owned answers, opt-in. `isEnabled` selects the route for new work;
   * an existing run is joined and resumed by its own `execution_mode`,
   * whatever the flag says now.
   */
  durable: {
    /** Read per send: whether NEW work is admitted as a durable run. */
    isEnabled: () => boolean;
    /** How a known run executes; `undefined` when this page cannot tell. */
    runMode: (runId: string) => "durable" | "legacy" | undefined;
    /** Last delivery cursor per run, so a resume continues the same view. */
    cursorsRef: React.MutableRefObject<Map<string, number>>;
    /** Runs this page is following or has followed to their end. */
    followedRunIdsRef: React.MutableRefObject<Set<string>>;
    /** The live subscription. Aborting detaches; it never cancels the run. */
    abortRef: React.MutableRefObject<AbortController | null>;
  };
};

export function useChatRunLoop({
  activeRunIdRef,
  cancelAcceptedRef,
  getReasoning,
  onRunAdmitted,
  resolveAttachments,
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
  setLatestConsultedSources,
  setLatestDocumentCoverage,
  setLatestReasoningSummaries,
  setLatestRunResultId,
  setLiveActivityEvents,
  setOptimisticMessage,
  setQueuedMessageState,
  setStatusAnnouncement,
  setStreamError,
  setStreamedReply,
  setPendingInteraction,
  pendingInteractionRef,
  durable,
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

  /**
   * The conversation's run IDs before a send: the baseline reconciliation
   * compares against. The cached list when there is one; otherwise a fetch.
   * `null` when neither is available, which makes a later drop `unknown`
   * rather than a guess.
   */
  async function snapshotRunIds(
    conversationId: string,
  ): Promise<Set<string> | null> {
    const cached = queryClient.getQueryData(
      MyAgentsQueryKeys.conversations.runs(conversationId),
    ) as { run_id: string }[] | undefined;
    if (cached) return new Set(cached.map((run) => run.run_id));
    try {
      const runs = await myAgentsAPI.conversations.runs(conversationId);
      return new Set(runs.map((run) => run.run_id));
    } catch {
      return null;
    }
  }

  /**
   * Asks the server whether a send that lost its connection before
   * `run_started` was admitted. Checked twice: the backend may record the run
   * a moment after the connection drops, and "not admitted" is the verdict
   * that invites a resend, so it has to survive a second look.
   */
  async function reconcileAdmission(
    conversationId: string,
    clientRequestId: string,
    knownRunIds: Set<string> | null,
  ): Promise<AdmissionVerdict> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, ADMISSION_RECHECK_DELAY_MS),
        );
      }
      try {
        const runs = await myAgentsAPI.conversations.runs(conversationId);
        const verdict = decideAdmission({
          knownRunIds,
          runs,
          clientRequestId,
        });
        if (verdict !== "not_admitted") return verdict;
      } catch {
        return "unknown";
      }
    }
    return "not_admitted";
  }

  type AnswerStreamState = {
    completed: boolean;
    cancelled: boolean;
    // The backend reports whether it stored the partial answer. If it did, the
    // refetch below brings it back and the live buffer should clear; if it did
    // not, clearing would silently discard text the user already read.
    partialReplyPersisted: boolean;
    interrupted: boolean;
    interruptedRunId: string | null;
    admitted: boolean;
  };

  function newAnswerStreamState(): AnswerStreamState {
    return {
      completed: false,
      cancelled: false,
      partialReplyPersisted: false,
      interrupted: false,
      interruptedRunId: null,
      admitted: false,
    };
  }

  /** Starts the one durable subscription this workspace may hold. */
  function beginDurableSubscription() {
    durable.abortRef.current?.abort();
    const controller = new AbortController();
    durable.abortRef.current = controller;
    return controller;
  }

  function endDurableSubscription(controller: AbortController | null) {
    if (controller && durable.abortRef.current === controller) {
      durable.abortRef.current = null;
    }
  }

  /**
   * A durable run as the same event stream the legacy routes produce.
   *
   * Admits first when given `admit`, then follows the run until its current
   * phase ends. Three synthetic events carry what the legacy stream has no
   * word for: the admission receipt, a snapshot that *replaces* the view, and
   * a reconnect notice. A durable `run_failed` is thrown as a coded error, so
   * the shared copy table names it.
   */
  async function* durableAnswerEvents({
    conversationId,
    admit,
    runId,
    snapshotFirst,
    signal,
  }: {
    conversationId: string;
    admit?: () => Promise<RunAdmissionReceipt>;
    runId?: string;
    /** Replace the view from `/output` before listening. */
    snapshotFirst: "always" | "when_cursor_unknown" | "never";
    signal: AbortSignal;
  }): AsyncGenerator<ConversationRunStreamEvent> {
    let targetRunId = runId;
    if (admit) {
      const receipt = await admitWithRetry(admit, { signal });
      targetRunId = receipt.run_id;
      yield { event: DURABLE_ADMITTED_EVENT, data: receipt };
    }
    if (!targetRunId) return;
    const followedRunId = targetRunId;
    const knownCursor = durable.cursorsRef.current.get(followedRunId);
    durable.followedRunIdsRef.current.add(followedRunId);
    try {
      for await (const frame of followDurableRun({
        api: myAgentsAPI.conversations,
        conversationId,
        runId: followedRunId,
        startCursor: knownCursor ?? 0,
        snapshotFirst:
          snapshotFirst === "always" ||
          (snapshotFirst === "when_cursor_unknown" &&
            knownCursor === undefined),
        signal,
        onCursor: (cursor) =>
          durable.cursorsRef.current.set(followedRunId, cursor),
      })) {
        if (frame.kind === "snapshot") {
          yield { event: DURABLE_SNAPSHOT_EVENT, data: frame.snapshot };
          continue;
        }
        if (frame.kind === "reconnecting") {
          yield { event: DURABLE_RECONNECTING_EVENT, data: null };
          continue;
        }
        const { deliveryId: _deliveryId, ...event } = frame.event;
        if (event.event === "run_failed") {
          yield { event: DURABLE_FAILED_EVENT, data: event.data };
          // A consumer that records the step throws before pulling again; this
          // is the backstop for one that does not.
          throw durableRunFailedError(event.data as DurableFailure);
        }
        yield event as ConversationRunStreamEvent;
      }
    } catch (error) {
      // Detached, not finished: a return to this conversation re-attaches.
      if (isAbortError(error)) {
        durable.followedRunIdsRef.current.delete(followedRunId);
      }
      throw error;
    }
  }

  /**
   * Puts a durable failure on the activity timeline, as the legacy stream's
   * `run_failed` is, then raises it by its stable code for the shared copy.
   */
  function recordDurableFailure(data: unknown): never {
    setLiveActivityEvents((current) =>
      appendLiveActivityEvent(current, {
        eventType: "run_failed",
        payload: data,
      }),
    );
    throw durableRunFailedError(data as DurableFailure);
  }

  /** The completed-run evidence, from `run_completed` or a snapshot. */
  function applyCompletedRun(data: ConversationRunResponse) {
    setStreamedReply(data.reply);
    setLatestCitations(data.citations ?? []);
    // `?? null`, never `?? []`: a backend without attribution omits the
    // field, and that is "unverified", not "nothing consulted".
    setLatestConsultedSources(data.consulted_sources ?? null);
    setLatestDocumentCoverage(data.document_coverage ?? null);
    setLatestReasoningSummaries(data.reasoning_summaries ?? []);
    setLatestRunResultId(data.run_id);
  }

  /**
   * Replaces the view with a durable snapshot and reports what it settled.
   *
   * A snapshot is the server's whole account of the run so far, so it
   * replaces rather than merges: text, summaries, and the activity timeline
   * all come from it, and the stream that follows appends only newer frames.
   * A pending question is set here but never cleared: during a refinement the
   * card stays mounted until an answer or a new question arrives.
   */
  function applyDurableSnapshot(
    snapshot: RunOutputSnapshot,
    state: AnswerStreamState,
  ) {
    setLiveActivityEvents(
      snapshot.activity_events
        .filter((activity) => shouldRecordLiveActivityEvent(activity.event))
        .map((activity, index) =>
          createLiveActivityEvent({
            eventType: activity.event,
            payload: activity.data,
            sequence: index + 1,
          }),
        ),
    );
    if (snapshot.result) {
      applyCompletedRun(snapshot.result);
    } else {
      setStreamedReply(snapshot.partial_reply);
      setLatestReasoningSummaries(snapshot.reasoning_summaries);
    }
    if (snapshot.status === "completed") state.completed = true;
    if (snapshot.status === "cancelled") state.cancelled = true;
    if (snapshot.status === "failed")
      throw durableRunFailedError(snapshot.error);
    if (snapshot.status === "waiting_for_input" && snapshot.interaction) {
      state.interrupted = true;
      state.interruptedRunId = snapshot.run_id;
      if (
        pendingInteractionRef.current?.interaction_id !==
        snapshot.interaction.interaction_id
      ) {
        setPendingInteraction(snapshot.interaction);
        setStatusAnnouncement(
          waitingInteractionAnnouncement(snapshot.interaction, localization),
        );
      }
    }
  }

  /**
   * Applies one answer stream to the workspace, legacy or durable alike.
   *
   * The durable synthetic events are handled first and never reach the
   * activity timeline; everything else is the legacy event handling,
   * unchanged.
   */
  async function consumeAnswerEvents(
    conversationId: string,
    source: AsyncIterable<ConversationRunStreamEvent>,
    state: AnswerStreamState,
    attachmentIds: string[],
  ) {
    for await (const streamEvent of source) {
      if (streamEvent.event === DURABLE_ADMITTED_EVENT) {
        const receipt = streamEvent.data as RunAdmissionReceipt;
        setCurrentRunId(receipt.run_id);
        if (!state.admitted) {
          state.admitted = true;
          onRunAdmitted?.(attachmentIds);
        }
        continue;
      }
      if (streamEvent.event === DURABLE_RECONNECTING_EVENT) {
        setStatusAnnouncement(localization.durableReconnectingAnnouncement);
        continue;
      }
      if (streamEvent.event === DURABLE_FAILED_EVENT) {
        recordDurableFailure(streamEvent.data);
      }
      if (streamEvent.event === DURABLE_SNAPSHOT_EVENT) {
        applyDurableSnapshot(streamEvent.data as RunOutputSnapshot, state);
        continue;
      }
      if (streamEvent.event === "answer_delta") {
        const data = streamEvent.data as AnswerDeltaEventData;
        setStreamedReply((current) => current + data.delta);
        continue;
      }
      if (streamEvent.event === "reasoning_summary_delta") {
        // `null` is an unparseable delta the API layer chose to drop rather
        // than throw on. Display metadata must not abort an answer stream.
        const data = streamEvent.data as ReasoningSummaryDeltaEventData | null;
        if (data) {
          setLatestReasoningSummaries((current) =>
            mergeReasoningSummaryDelta(current, data),
          );
        }
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
        if (!state.admitted) {
          state.admitted = true;
          onRunAdmitted?.(attachmentIds);
        }
      }
      if (streamEvent.event === "run_cancelled") {
        state.cancelled = true;
        state.partialReplyPersisted = Boolean(
          (streamEvent.data as RunCancelledEventData | null)
            ?.partial_reply_persisted,
        );
      }
      if (streamEvent.event === "run_completed") {
        state.completed = true;
        applyCompletedRun(streamEvent.data as ConversationRunResponse);
      }
      // The run stopped to ask something. This is a *terminal* event for this
      // stream but not for the run: the run stays open server-side and holds
      // the conversation until it is answered, cancelled, or expires.
      if (streamEvent.event === "run_interrupted") {
        const data = streamEvent.data as ConversationRunInterruptedResponse;
        state.interrupted = true;
        state.interruptedRunId = data.run_id;
        // The stream hands over the whole interaction, including its first
        // page of options, so the card can render without a round-trip.
        setPendingInteraction(data.interaction);
        queryClient.setQueryData(
          MyAgentsQueryKeys.conversations.run(conversationId, data.run_id),
          data,
        );
        setStatusAnnouncement(
          waitingInteractionAnnouncement(data.interaction, localization),
        );
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
  }

  /** Refreshes what a finished stream changed and names how it ended. */
  async function finishAnswerStream(
    conversationId: string,
    state: AnswerStreamState,
  ): Promise<RunOutcome> {
    if (!state.completed && !state.cancelled && !state.interrupted) {
      if (cancelAcceptedRef.current && pendingImmediateMessageRef.current) {
        state.cancelled = true;
      } else throw new Error(localization.runFailed);
    }
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.conversations.messages(conversationId),
      }),
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.conversations.runs(conversationId),
      }),
      // A run is what creates artifacts and what expires attachments, so
      // both lists are stale the moment it ends. `staleTime: 0` only marks
      // them stale — without an invalidation nothing refetches, and a file
      // the run just generated stays invisible until the next full page
      // load.
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.conversations.artifacts(conversationId),
      }),
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.conversations.attachments(conversationId),
      }),
    ]);
    setOptimisticMessage(null);
    // Keep the partial answer on screen when the run suspended: the user has
    // already read it, and it is the context for the question being asked.
    if (state.interrupted) return "interrupted";
    if (!state.cancelled || state.partialReplyPersisted) setStreamedReply("");
    return state.cancelled ? "cancelled" : "completed";
  }

  async function runMessage(
    conversationId: string,
    message: string,
    knowledgeBaseSelection: KnowledgeBaseSelection,
    attachmentIds: string[],
    clientRequestId: string,
  ): Promise<RunOutcome> {
    if (isStreamingRef.current) return "failed";
    isStreamingRef.current = true;
    setIsStreaming(true);
    setStreamError(null);
    setStreamedReply("");
    setCurrentRunId(null);
    setLiveActivityEvents([]);
    setLatestCitations([]);
    setLatestConsultedSources(null);
    // Until completion, busy-state ownership suppresses stale run-detail
    // evidence. Keep this `undefined` so a failed run can reveal the previous
    // completed answer's evidence again once the busy state ends.
    setLatestDocumentCoverage(undefined);
    setLatestReasoningSummaries(undefined);
    setLatestRunResultId(null);
    setOptimisticMessage({
      id: `optimistic-${Date.now()}`,
      conversation_id: conversationId,
      role: "user",
      content: message,
      attachments: resolveAttachments?.(attachmentIds) ?? [],
    });
    const state = newAnswerStreamState();
    const knownRunIds = await snapshotRunIds(conversationId);
    const payload = {
      message,
      knowledge_base_selection: knowledgeBaseSelection,
      // Omitted entirely when nothing is attached, so a run from a
      // deployment without the document workspace sends the same body it
      // always did rather than an empty array the backend must interpret.
      ...(attachmentIds.length > 0 ? { attachment_ids: attachmentIds } : {}),
      client_request_id: clientRequestId,
      ...(getReasoning() ?? {}),
    };
    // Read once per send, like the reasoning level. With the flag on there is
    // no fallback: with no worker ready, admission fails with
    // `durable_runs_unavailable` and nothing is sent the legacy way.
    const controller = durable.isEnabled() ? beginDurableSubscription() : null;
    try {
      await consumeAnswerEvents(
        conversationId,
        controller
          ? durableAnswerEvents({
              conversationId,
              admit: () =>
                myAgentsAPI.conversations.admitRun(conversationId, payload),
              snapshotFirst: "never",
              signal: controller.signal,
            })
          : myAgentsAPI.conversations.streamRunEvents(conversationId, payload),
        state,
        attachmentIds,
      );
      return await finishAnswerStream(conversationId, state);
    } catch (error) {
      // This viewer detached (the conversation changed). The run carries on
      // server-side and is re-attached from the run list on return.
      if (isAbortError(error)) return "detached";
      if (isConversationRunAlreadyActiveError(error)) {
        setOptimisticMessage(null);
        setStreamError(null);
        return "active_conflict";
      }
      if (!state.admitted && isAmbiguousPreAdmissionFailure(error)) {
        const verdict = await reconcileAdmission(
          conversationId,
          clientRequestId,
          knownRunIds,
        );
        // Refresh either way: if the run did land, the transcript and the run
        // list are what show it, and run polling carries the answer from here.
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: MyAgentsQueryKeys.conversations.messages(conversationId),
          }),
          queryClient.invalidateQueries({
            queryKey: MyAgentsQueryKeys.conversations.runs(conversationId),
          }),
        ]).catch(() => undefined);
        if (verdict === "admitted") {
          state.admitted = true;
          onRunAdmitted?.(attachmentIds);
          setOptimisticMessage(null);
          setStreamError(null);
          setStatusAnnouncement(
            localization.admittedAfterDisconnectAnnouncement,
          );
          return "admitted_after_disconnect";
        }
        if (verdict === "unknown") {
          // Localized through the shared error copy by `code`; nothing is
          // resent, and the selection stays until the user has looked.
          setStreamError(
            new MyAgentsAPIError({
              message: "run admission unknown",
              status: 0,
              body: { code: "run_admission_unknown" },
            }),
          );
          return "admission_unknown";
        }
      }
      if (state.admitted) {
        // Admitted, then lost: the server stored the question (and its files)
        // before the stream ended. Show that stored copy instead of the local
        // optimistic one, and let the run list report what became of the run.
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: MyAgentsQueryKeys.conversations.messages(conversationId),
          }),
          queryClient.invalidateQueries({
            queryKey: MyAgentsQueryKeys.conversations.runs(conversationId),
          }),
        ]).catch(() => undefined);
        setOptimisticMessage(null);
      }
      setStreamError(error);
      return "failed";
    } finally {
      endDurableSubscription(controller);
      isStreamingRef.current = false;
      setIsStreaming(false);
      // A suspended run must keep its id: it is the address the resume request
      // is sent to. Clearing it here would leave the card unable to answer.
      if (!state.interrupted) setCurrentRunId(null);
      else if (state.interruptedRunId) setCurrentRunId(state.interruptedRunId);
    }
  }

  /**
   * Joins a durable run this page did not start: after a reload, from a second
   * tab, or on returning to a conversation.
   *
   * The snapshot replaces the view first, so the answer appears as far as the
   * server has committed it, then the listener appends the rest. Nothing is
   * admitted and nothing is re-executed: this only reads.
   */
  async function attachToRun(
    conversationId: string,
    runId: string,
  ): Promise<RunOutcome> {
    if (isStreamingRef.current) return "failed";
    isStreamingRef.current = true;
    setIsStreaming(true);
    setStreamError(null);
    setCurrentRunId(runId);
    setLatestDocumentCoverage(undefined);
    setLatestRunResultId(null);
    setStatusAnnouncement(localization.durableAttachedAnnouncement);
    const state = newAnswerStreamState();
    state.admitted = true;
    const controller = beginDurableSubscription();
    try {
      await consumeAnswerEvents(
        conversationId,
        durableAnswerEvents({
          conversationId,
          runId,
          snapshotFirst: "always",
          signal: controller.signal,
        }),
        state,
        [],
      );
      return await finishAnswerStream(conversationId, state);
    } catch (error) {
      if (isAbortError(error)) return "detached";
      // No durable projection: a legacy run, or one too old to have one. It is
      // left to the legacy run polling, quietly, and nothing is started.
      if (isMyAgentsAPIError(error) && error.status === 404) return "detached";
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: MyAgentsQueryKeys.conversations.messages(conversationId),
        }),
        queryClient.invalidateQueries({
          queryKey: MyAgentsQueryKeys.conversations.runs(conversationId),
        }),
      ]).catch(() => undefined);
      setStreamError(error);
      return "failed";
    } finally {
      endDurableSubscription(controller);
      isStreamingRef.current = false;
      setIsStreaming(false);
      if (!state.interrupted) setCurrentRunId(null);
      else if (state.interruptedRunId) setCurrentRunId(state.interruptedRunId);
    }
  }

  async function runMessageAndContinue(
    conversationId: string,
    message: string,
    knowledgeBaseSelection: KnowledgeBaseSelection,
    attachmentIds: string[],
    clientRequestId: string,
  ): Promise<void> {
    const outcome = await runMessage(
      conversationId,
      message,
      knowledgeBaseSelection,
      attachmentIds,
      clientRequestId,
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
          // The files were already uploaded and are still available; the held
          // message keeps them so a retry does not re-transfer the bytes.
          attachmentIds,
          // The same logical send: the backend refused it, so reusing the ID
          // cannot collide with a run it created.
          clientRequestId,
        });
        setStatusAnnouncement(localization.queuedAnnouncement);
      }
      await queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.conversations.runs(conversationId),
      });
      resetImmediateState();
      return;
    }
    // A disconnect the server survived, or one that could not be verified:
    // either way the message may already be stored, so the draft is not
    // restored for a resend and the queue does not drain behind it.
    if (
      outcome === "admitted_after_disconnect" ||
      outcome === "admission_unknown" ||
      outcome === "detached"
    ) {
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
        pendingImmediateMessage.attachmentIds,
        pendingImmediateMessage.clientRequestId,
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
        nextQueuedMessage.attachmentIds,
        nextQueuedMessage.clientRequestId,
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
    // One key per answer, minted before the first attempt: a durable resume
    // retried after a dropped connection must be recognised as the same one.
    const resumeRequestId = newClientRequestId();
    // The run's own mode decides, never the flag: a durable run resumes
    // durably even after the flag is turned off, and a legacy run never does.
    // The backend rejects the other pairing with `run_execution_mode_mismatch`.
    // An unreported mode means an older backend, which only has legacy runs.
    const controller =
      durable.runMode(runId) === "durable" ? beginDurableSubscription() : null;
    // Continues the same run, so the cursor carries on from the question. With
    // no cursor known (a reload), the snapshot supplies one first.
    const source = controller
      ? durableAnswerEvents({
          conversationId,
          admit: () =>
            myAgentsAPI.conversations.resumeRunAsync(conversationId, runId, {
              client_request_id: resumeRequestId,
              answer: payload,
            }),
          snapshotFirst: "when_cursor_unknown",
          signal: controller.signal,
        })
      : myAgentsAPI.conversations.streamResumeRunEvents(
          conversationId,
          runId,
          payload,
        );
    const snapshotState = newAnswerStreamState();
    try {
      for await (const streamEvent of source) {
        if (
          streamEvent.event === DURABLE_ADMITTED_EVENT ||
          streamEvent.event === DURABLE_RECONNECTING_EVENT
        ) {
          if (streamEvent.event === DURABLE_RECONNECTING_EVENT) {
            setStatusAnnouncement(localization.durableReconnectingAnnouncement);
          }
          continue;
        }
        if (streamEvent.event === DURABLE_FAILED_EVENT) {
          recordDurableFailure(streamEvent.data);
        }
        if (streamEvent.event === DURABLE_SNAPSHOT_EVENT) {
          applyDurableSnapshot(
            streamEvent.data as RunOutputSnapshot,
            snapshotState,
          );
          if (snapshotState.completed) {
            completed = true;
            setPendingInteraction(null);
          }
          if (snapshotState.cancelled) cancelled = true;
          if (snapshotState.interrupted) interrupted = true;
          continue;
        }
        if (streamEvent.event === "answer_delta") {
          const data = streamEvent.data as AnswerDeltaEventData;
          if ("kind" in payload && payload.kind === "refine") {
            setPendingInteraction(null);
          }
          setStreamedReply((current) => current + data.delta);
          continue;
        }
        if (streamEvent.event === "reasoning_summary_delta") {
          // `null` is an unparseable delta the API layer chose to drop rather
          // than throw on. Display metadata must not abort an answer stream.
          const data =
            streamEvent.data as ReasoningSummaryDeltaEventData | null;
          if (data) {
            setLatestReasoningSummaries((current) =>
              mergeReasoningSummaryDelta(current, data),
            );
          }
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
          // Selection ends suspension immediately. Refinement keeps the card
          // mounted and disabled until a new interaction or answer arrives.
          if (!("kind" in payload && payload.kind === "refine")) {
            setPendingInteraction(null);
          }
          setStatusAnnouncement(
            "kind" in payload && payload.kind === "refine"
              ? localization.interactionRefiningAnnouncement
              : localization.interactionResumedAnnouncement,
          );
        }
        if (streamEvent.event === "run_cancelled") cancelled = true;
        if (streamEvent.event === "run_completed") {
          const data = streamEvent.data as ConversationRunResponse;
          completed = true;
          setStreamedReply(data.reply);
          setLatestCitations(data.citations ?? []);
          // `?? null`, never `?? []`: a backend without attribution omits the
          // field, and that is "unverified", not "nothing consulted".
          setLatestConsultedSources(data.consulted_sources ?? null);
          setLatestDocumentCoverage(data.document_coverage ?? null);
          setLatestReasoningSummaries(data.reasoning_summaries ?? []);
          setLatestRunResultId(data.run_id);
          setPendingInteraction(null);
        }
        // A resumed run can suspend again — a second ambiguous reference in
        // the same answer. Replace the card rather than assuming one question
        // per run.
        if (streamEvent.event === "run_interrupted") {
          const data = streamEvent.data as ConversationRunInterruptedResponse;
          interrupted = true;
          setPendingInteraction(data.interaction);
          queryClient.setQueryData(
            MyAgentsQueryKeys.conversations.run(conversationId, data.run_id),
            data,
          );
          setStatusAnnouncement(
            waitingInteractionAnnouncement(data.interaction, localization),
          );
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
        // A replay re-runs the turn and can write its own artifacts.
        queryClient.invalidateQueries({
          queryKey: MyAgentsQueryKeys.conversations.artifacts(conversationId),
        }),
      ]);
      if (interrupted) return "interrupted";
      setOptimisticMessage(null);
      if (completed) setStreamedReply("");
      return cancelled ? "cancelled" : "completed";
    } catch (error) {
      if (isAbortError(error)) return "detached";
      // The interaction is still open server-side, so the card stays up and
      // Product DB may already hold a fresh attempt even if its SSE event was
      // lost. Refresh both keys so recovery cannot keep a stale UUID forever.
      await Promise.allSettled([
        queryClient.invalidateQueries({
          queryKey: MyAgentsQueryKeys.conversations.run(conversationId, runId),
        }),
        queryClient.invalidateQueries({
          queryKey: MyAgentsQueryKeys.conversations.runs(conversationId),
        }),
      ]);
      setStreamError(error);
      return "failed";
    } finally {
      endDurableSubscription(controller);
      isStreamingRef.current = false;
      setIsStreaming(false);
      if (!interrupted && pendingInteractionRef.current === null) {
        setCurrentRunId(null);
      }
    }
  }

  return {
    attachToRun,
    resetImmediateState,
    resumeInteraction,
    runMessageAndContinue,
    setQueuedMessage,
  };
}

/**
 * Appends one streamed delta to the item for its stage.
 *
 * Produces `ReasoningSummaryDisplay`, which has no `source`. A half-streamed
 * summary genuinely has no provenance to report — the delta event does not
 * carry one — and deriving it from `stage` would state, in a closed contract
 * field, something the backend never said. The completed run replaces this
 * whole list with the served items anyway, so the value would be short-lived
 * and wrong rather than short-lived and absent.
 *
 * Text is bounded here as well as at render: an unbounded accumulator would
 * grow with a misbehaving stream even before anything is displayed.
 */
export function mergeReasoningSummaryDelta(
  current: ReasoningSummaryDisplay[] | undefined,
  data: ReasoningSummaryDeltaEventData,
): ReasoningSummaryDisplay[] {
  const summaries = current ?? [];
  const existing = summaries.find((item) => item.stage === data.stage);
  const text = `${existing?.text ?? ""}${data.delta}`.slice(
    0,
    REASONING_SUMMARY_MAX_LENGTH,
  );
  const next: ReasoningSummaryDisplay = { stage: data.stage, text };
  return existing
    ? summaries.map((item) => (item.stage === data.stage ? next : item))
    : [...summaries, next];
}

export function waitingInteractionAnnouncement(
  interaction: PendingInteraction,
  localization: Pick<
    UseChatRunLoopOptions["localization"],
    | "interactionWaitingAnnouncement"
    | "interactionRefinementWaitingAnnouncement"
    | "interactionBrowseWaitingAnnouncement"
    | "attachmentInteractionWaitingAnnouncement"
  >,
) {
  if (isAttachmentSelection(interaction)) {
    return localization.attachmentInteractionWaitingAnnouncement;
  }
  if (
    !isDocumentSelection(interaction) ||
    !isDocumentSelectionV2(interaction)
  ) {
    return localization.interactionWaitingAnnouncement;
  }
  if (interaction.option_count > 0) {
    return localization.interactionWaitingAnnouncement;
  }
  if (interaction.refinement.allowed) {
    return localization.interactionRefinementWaitingAnnouncement;
  }
  return localization.interactionBrowseWaitingAnnouncement;
}

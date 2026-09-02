"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import { useCurrentUser } from "@/hooks/use-auth";
import { useReasoningCapabilities } from "@/hooks/use-capabilities";
import {
  useConversation,
  useCreateConversation,
  useMessages,
  useRunDetail,
  useRunEvents,
  useRuns,
} from "@/hooks/use-conversations";
import { useKnowledgeBases } from "@/hooks/use-knowledge";
import { useLocalization } from "@/hooks/useLocalization";
import { decodeRouteSegment } from "@/lib/route-segments";
import {
  type Citation,
  type ConversationRunResumeRequest,
  type DocumentCoverage,
  INTERACTION_SCHEMA_VERSION,
  isDocumentSelection,
  isDocumentSelectionV2,
  isRunInterrupted,
  type KnowledgeBaseSelectionMode,
  LEGACY_INTERACTION_SCHEMA_VERSION,
  type Message,
  type PendingInteraction,
  type ReasoningSummaryDisplay,
} from "@/model/my-agents";
import { myAgentsAPI } from "@/services/my-agents";
import { resolveErrorMessage } from "@/utils/error-message";
import {
  CHAT_SCROLL_REGION_CLASS_NAME,
  REPLAY_ICON_PENDING_CLASS_NAME,
} from "./chat/ChatTranscript";
import { ChatWorkspaceLayout } from "./chat/ChatWorkspaceLayout";
import { useChatActivityStore } from "./chat/chat-activity-store";
import {
  conversationHref,
  conversationIdFromPathname,
  isChatPathname,
} from "./chat/chat-routes";
import { getConversationCardClassName } from "./chat/conversation-card";
import { getAgentTraceStageKeys } from "./chat/EvidencePanel";
import { PendingInteractionSlot } from "./chat/interactions/PendingInteractionSlot";
import {
  REASONING_STORAGE_KEY,
  type ReasoningSelection,
  readStoredReasoning,
  resolveReasoning,
} from "./chat/reasoning-selection";
import {
  blocksNewRun,
  canDrainQueue,
  deriveRunPhase,
  showsStopControl,
} from "./chat/run-state";
import type { LiveActivityEvent, QueuedMessage } from "./chat/types";
import {
  useChatRunLoop,
  waitingInteractionAnnouncement,
} from "./chat/useChatRunLoop";
import { useChatWorkspaceEffects } from "./chat/useChatWorkspaceEffects";
import { useReplayAssistantMessageHandler } from "./chat/useReplayAssistantMessageHandler";
import {
  buildActiveKnowledgeBaseSelection,
  deriveConversationTitle,
  getLatestAssistantMessageId,
  isActiveAgentRunStatus,
  isNearScrollBottom,
  isObservedActiveRunStale,
  isReasoningSummaryEventType,
  isWaitingForInputRunStatus,
  seedLiveActivityEvents,
} from "./chat/workspace-helpers";

export { CHAT_SCROLL_REGION_CLASS_NAME };
export { REPLAY_ICON_PENDING_CLASS_NAME };
export { CHAT_WORKSPACE_PANEL_CLASS_NAME } from "./chat/ChatWorkspaceLayout";
export {
  ACTIVE_RUN_STALE_NOTICE_AFTER_MS,
  appendLiveActivityEvent,
  buildActiveKnowledgeBaseSelection,
  createLiveActivityEvent,
  deriveConversationTitle,
  getLatestAssistantMessageId,
  getNextConversationIdAfterDelete,
  isActiveAgentRunStatus,
  isBlockingAgentRunStatus,
  isConversationRunAlreadyActiveError,
  isObservedActiveRunStale,
  isReasoningSummaryEventType,
  isWaitingForInputRunStatus,
  seedLiveActivityEvents,
  shouldRecordLiveActivityEvent,
} from "./chat/workspace-helpers";
export { getAgentTraceStageKeys, getConversationCardClassName };

export function ChatWorkspace({
  initialConversationId,
}: {
  initialConversationId?: string;
} = {}) {
  const queryClient = useQueryClient();
  const knowledgeBases = useKnowledgeBases();
  const createConversation = useCreateConversation();
  /**
   * The route is the source of truth for which conversation is open. Bare
   * `/chat` is the new-conversation state — it deliberately does *not* fall
   * back to the most recent conversation, which is what makes
   * auto-create-on-first-send reachable for everyone rather than only for users
   * with an empty history.
   */
  /*
   * Derived from the pathname, not from the route params this component is
   * handed.
   *
   * `ensureConversationId` moves the URL with `history.replaceState`, which
   * performs no route transition — so `initialConversationId` still reports the
   * value the page was loaded with, forever. That made the clearing effect
   * below unreachable: `routeConversationId` could never become the optimistic
   * id, so the optimistic id was never dropped, and it outranked the empty
   * route when the user then started a new chat. The workspace kept showing the
   * conversation they had just left.
   *
   * `usePathname` tracks `replaceState`, which is why the sidebar already read
   * it. Both now go through one helper so they cannot disagree again.
   */
  const pathname = usePathname();
  const routeConversationId = isChatPathname(pathname)
    ? decodeRouteSegment(conversationIdFromPathname(pathname))
    : decodeRouteSegment(initialConversationId);
  const [optimisticConversationId, setOptimisticConversationId] =
    useState<string>();
  const activeId = optimisticConversationId ?? routeConversationId;
  const conversation = useConversation(activeId);
  const messages = useMessages(activeId);
  const runs = useRuns(activeId);
  const sortedRuns = useMemo(() => {
    return [...(runs.data ?? [])].sort(
      (left, right) =>
        new Date(right.created_at).getTime() -
        new Date(left.created_at).getTime(),
    );
  }, [runs.data]);
  const serverActiveRun = sortedRuns.find((run) =>
    isActiveAgentRunStatus(run.status),
  );
  const serverActiveRunId = serverActiveRun?.run_id ?? null;
  // A run suspended on an unanswered question. It is not "active" — it writes
  // nothing — but it does hold the conversation, and it is how a pending
  // question survives a reload: the run list is server state, so it is still
  // here after a refresh when no stream is.
  const serverWaitingRun = sortedRuns.find((run) =>
    isWaitingForInputRunStatus(run.status),
  );
  const serverWaitingRunId = serverWaitingRun?.run_id ?? null;
  const latestTerminalRun =
    serverActiveRun || serverWaitingRun ? undefined : sortedRuns[0];
  const latestCompletedRunId =
    latestTerminalRun?.status === "completed"
      ? latestTerminalRun.run_id
      : undefined;
  /**
   * Which run's stored events the activity panel falls back to.
   *
   * An *active* run is excluded because its stream is already filling the live
   * list; querying would duplicate it. A *waiting* run is the opposite case and
   * must not be excluded with it: it is the one state that outlives its stream,
   * so after a reload nothing else can supply the activity it already produced
   * and the panel would sit empty behind the question card.
   */
  const latestRunEventId = serverActiveRun
    ? undefined
    : (serverWaitingRunId ?? latestTerminalRun?.run_id);
  const runDetail = useRunDetail(activeId, latestCompletedRunId);
  // Fetched only when a waiting run exists, and only to recover the pending
  // interaction after a cold load. The live path gets it from the stream.
  const waitingRunDetail = useRunDetail(
    activeId,
    serverWaitingRunId ?? undefined,
  );
  const events = useRunEvents(activeId, latestRunEventId);
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [streamError, setStreamError] = useState<unknown>(null);
  const [streamedReply, setStreamedReply] = useState("");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [queuedMessage, setQueuedMessageState] = useState<QueuedMessage | null>(
    null,
  );
  const [statusAnnouncement, setStatusAnnouncement] = useState("");
  const [pendingInteraction, setPendingInteractionState] =
    useState<PendingInteraction | null>(null);
  const pendingInteractionRef = useRef<PendingInteraction | null>(null);
  const [isCancellingInteraction, setIsCancellingInteraction] = useState(false);
  function setPendingInteraction(next: PendingInteraction | null) {
    pendingInteractionRef.current = next;
    setPendingInteractionState(next);
  }
  const [activeRunClock, setActiveRunClock] = useState(() => Date.now());
  const [observedServerActiveRun, setObservedServerActiveRun] = useState<{
    runId: string;
    observedAt: number;
  } | null>(null);
  const [liveActivityEvents, setLiveActivityEvents] = useState<
    LiveActivityEvent[]
  >([]);
  const [optimisticMessage, setOptimisticMessage] = useState<Message | null>(
    null,
  );
  const [latestCitations, setLatestCitations] = useState<Citation[]>([]);
  /**
   * `null` means the run did not report attribution, which is not the same as
   * reporting an empty list. Kept separate from `latestCitations` for that
   * reason — a single array could not express "unverified".
   */
  const [latestConsultedSources, setLatestConsultedSources] = useState<
    Citation[] | null
  >(null);
  /**
   * Tri-state by design: `undefined` means no local run owns this surface yet,
   * so refresh-safe run detail may supply coverage. `null` means the current
   * run explicitly reported no coverage. An object is the bounded range read.
   */
  const [latestDocumentCoverage, setLatestDocumentCoverage] = useState<
    DocumentCoverage | null | undefined
  >(undefined);
  const [latestReasoningSummaries, setLatestReasoningSummaries] = useState<
    ReasoningSummaryDisplay[] | undefined
  >(undefined);
  const [latestRunResultId, setLatestRunResultId] = useState<string | null>(
    null,
  );
  // Derived from the session, not from `?guest=1`. The query param survives
  // only until the first navigation, so the old derivation dropped the notice
  // while the session was still a guest session.
  const currentUser = useCurrentUser();
  const isGuest = Boolean(currentUser.data?.is_guest);
  const showGuestNotice = isGuest;

  // Seeded from storage on first render so a reload does not flash the served
  // default before the stored preference applies.
  const reasoningCapabilities = useReasoningCapabilities();
  const [storedReasoning, setStoredReasoning] =
    useState<Partial<ReasoningSelection> | null>(() =>
      typeof window === "undefined"
        ? null
        : readStoredReasoning(window.localStorage),
    );
  const reasoning = useMemo(
    () =>
      resolveReasoning(reasoningCapabilities.data, storedReasoning, isGuest),
    [reasoningCapabilities.data, storedReasoning, isGuest],
  );

  function persistReasoning(next: Partial<ReasoningSelection>) {
    const merged = { ...reasoning.selection, ...next };
    setStoredReasoning(merged);
    try {
      window.localStorage.setItem(
        REASONING_STORAGE_KEY,
        JSON.stringify(merged),
      );
    } catch {
      // Private-mode or quota failure. The selection still applies for this
      // session; losing the persistence is not worth surfacing an error.
    }
  }
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [knowledgeBaseMode, setKnowledgeBaseMode] =
    useState<KnowledgeBaseSelectionMode>("all");
  const [selectedKnowledgeBaseIds, setSelectedKnowledgeBaseIds] = useState<
    string[]
  >([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const isStreamingRef = useRef(false);
  const activeRunIdRef = useRef<string | null>(null);
  const queuedMessageRef = useRef<QueuedMessage | null>(null);
  const pendingImmediateMessageRef = useRef<QueuedMessage | null>(null);
  const cancelAcceptedRef = useRef(false);
  const replayPreviousReasoningSummariesRef = useRef<
    ReasoningSummaryDisplay[] | undefined
  >(undefined);
  const creatingConversationRef = useRef<Promise<string> | null>(null);
  const previousActiveIdRef = useRef<string | undefined>(activeId);
  const previousServerActiveRunIdRef = useRef<string | null>(null);
  const autoReplayAttemptedRunIdsRef = useRef<Set<string>>(new Set());
  const { lang, localization } = useLocalization(
    (state) => state.localization.chat,
  );
  const { localization: fullLocalization } = useLocalization(
    (state) => state.localization,
  );
  const visibleQueuedMessage =
    queuedMessage?.conversationId === activeId ? queuedMessage : null;
  const draftMessage = draft.trim();
  const hasActiveDraft = draftMessage.length > 0;
  const selectableKnowledgeBases = useMemo(
    () => (knowledgeBases.data ?? []).filter((kb) => kb.purpose === "standard"),
    [knowledgeBases.data],
  );
  const activeKnowledgeBaseSelection = buildActiveKnowledgeBaseSelection({
    knowledgeBaseMode,
    selectedKnowledgeBaseIds,
  });
  const requiresKnowledgeBaseSelection =
    knowledgeBaseMode === "selected" && selectedKnowledgeBaseIds.length === 0;
  // One derived phase, three decisions. A pending question holds the
  // conversation without producing output, so "busy" and "showing a stop
  // button" stop being the same question — see `run-state.ts`.
  const hasPendingInteraction = Boolean(pendingInteraction);
  const runPhase = deriveRunPhase({
    isStreaming,
    hasPendingInteraction,
    hasServerActiveRun: Boolean(serverActiveRun),
    hasServerWaitingRun: Boolean(serverWaitingRun),
  });
  const conversationIsBusy = blocksNewRun(runPhase);
  const showsStopButton = showsStopControl(runPhase);
  const serverActiveRunIsStale = isObservedActiveRunStale({
    activeRunId: serverActiveRunId,
    observedRunId: observedServerActiveRun?.runId ?? null,
    observedAt: observedServerActiveRun?.observedAt ?? null,
    now: activeRunClock,
  });
  const {
    resetImmediateState,
    resumeInteraction,
    runMessageAndContinue,
    setQueuedMessage,
  } = useChatRunLoop({
    activeRunIdRef,
    cancelAcceptedRef,
    getReasoning: () =>
      reasoning.selection
        ? {
            reasoning_mode: reasoning.selection.mode,
            reasoning_effort: reasoning.selection.effort,
          }
        : null,
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
  });
  const {
    handleReplayAssistantMessage,
    replayAssistantMessage,
    replayNotice,
    replayingMessageId,
    setReplayNotice,
  } = useReplayAssistantMessageHandler({
    activeId,
    conversationIsBusy,
    isCancelling,
    localization,
    setStatusAnnouncement,
    onReplayStart: () =>
      setLatestReasoningSummaries((current) => {
        replayPreviousReasoningSummariesRef.current = current;
        return [];
      }),
    onReplayResult: (result) => {
      setLatestCitations(result.citations ?? []);
      setLatestConsultedSources(result.consulted_sources ?? null);
      setLatestDocumentCoverage(result.document_coverage ?? null);
      setLatestReasoningSummaries(result.reasoning_summaries ?? []);
      replayPreviousReasoningSummariesRef.current = undefined;
      setLatestRunResultId(result.run_id);
    },
    onReplayError: () => {
      setLatestReasoningSummaries(replayPreviousReasoningSummariesRef.current);
      replayPreviousReasoningSummariesRef.current = undefined;
    },
  });

  function toggleSelectedKnowledgeBase(knowledgeBaseId: string) {
    setSelectedKnowledgeBaseIds((current) =>
      current.includes(knowledgeBaseId)
        ? current.filter((id) => id !== knowledgeBaseId)
        : [...current, knowledgeBaseId],
    );
  }

  /**
   * Resolves the conversation to send into, creating one on the first message
   * of a new chat. Returns `undefined` only when the create failed — callers
   * must treat that as "do not send" and give the draft back.
   */
  async function ensureConversationId(seedTitle: string) {
    if (activeId) return activeId;
    // A ref, not `createConversation.isPending`: mutation state updates
    // asynchronously, so two submits in the same tick would both start a POST.
    if (creatingConversationRef.current) return creatingConversationRef.current;

    const pending = (async () => {
      const created = await createConversation.mutateAsync({
        title: seedTitle,
      });
      setOptimisticConversationId(created.id);
      /**
       * `history.replaceState`, deliberately not `router.push`.
       *
       * A router navigation crosses into a different dynamic segment value,
       * and Next remounts the page component when that changes — verified by
       * tagging the composer node and watching it get recreated. That tore down
       * `ChatWorkspace` mid-run and took the optimistic bubble, `isStreaming`,
       * and the streamed reply with it, while the run loop kept writing to an
       * unmounted tree. Nothing appeared until the answer landed.
       *
       * The native History API updates the URL without a route transition, so
       * the component stays mounted and the run stays visible. `usePathname`
       * still tracks it, which is what the sidebar reads to mark the active
       * row. `replace` rather than `push` because the empty `/chat` this came
       * from is not a state worth going Back to.
       */
      window.history.replaceState(null, "", conversationHref(created.id));
      return created.id;
    })();

    creatingConversationRef.current = pending;
    setIsCreatingConversation(true);
    try {
      return await pending;
    } catch {
      return undefined;
    } finally {
      creatingConversationRef.current = null;
      setIsCreatingConversation(false);
    }
  }

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The knowledge-base requirement is checked before the create, so a blocked
    // send never leaves an empty orphan conversation behind.
    if (!draftMessage || isCancelling || requiresKnowledgeBaseSelection) return;
    if (creatingConversationRef.current) return;
    if (activeId && conversationIsBusy) {
      if (visibleQueuedMessage) {
        setStatusAnnouncement(localization.queueAlreadyExistsAnnouncement);
        return;
      }
      setQueuedMessage({
        conversationId: activeId,
        content: draftMessage,
        knowledgeBaseSelection: activeKnowledgeBaseSelection,
      });
      setDraft("");
      setStatusAnnouncement(localization.queuedAnnouncement);
      return;
    }

    const pendingDraft = draftMessage;
    const pendingSelection = activeKnowledgeBaseSelection;
    setDraft("");
    const conversationId = await ensureConversationId(
      deriveConversationTitle(
        pendingDraft,
        `${localization.newConversationTitle} ${new Date().toLocaleString(lang)}`,
      ),
    );
    if (!conversationId) {
      // Nothing was sent, so the draft is still the user's work.
      setDraft(pendingDraft);
      setStatusAnnouncement(localization.createConversationFailedAnnouncement);
      toast.error(localization.createConversationFailedAnnouncement);
      return;
    }
    await runMessageAndContinue(conversationId, pendingDraft, pendingSelection);
  }

  /**
   * Rebuilds the pending question after a cold load.
   *
   * The stream is gone after a refresh, so without this a reload during a
   * pending question would leave the composer looking idle while the backend
   * refused every message — for up to 24 hours, the server-side expiry default.
   * The run list survives a reload, so a waiting run there is the recovery
   * signal, and its detail response carries the full interaction.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: `setPendingInteraction` and `setActiveRunId` are recreated on every render; including them would re-run this on every commit. The recovery is keyed on the waiting run and its detail, which is what should trigger it.
  useEffect(() => {
    // The runs cache can still say `waiting_for_input` while a resume request
    // is already in flight. Rebuilding from that stale row would put the frozen
    // card back over an answer that is producing output again.
    if (!serverWaitingRunId || isStreaming) return;
    const detail = waitingRunDetail.data;
    if (!detail || !isRunInterrupted(detail)) return;
    if (
      pendingInteractionRef.current?.interaction_id ===
      detail.interaction.interaction_id
    )
      return;
    setPendingInteraction(detail.interaction);
    setActiveRunId(detail.run_id);
    activeRunIdRef.current = detail.run_id;
    setStatusAnnouncement(
      waitingInteractionAnnouncement(detail.interaction, localization),
    );
  }, [serverWaitingRunId, waitingRunDetail.data, isStreaming]);

  /**
   * Clears the card once the server stops reporting a waiting run.
   *
   * Covers cancellation from another tab and server-side expiry, neither of
   * which produces an event in this client.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: same reason as the recovery effect above — the trigger is server truth, not the setters.
  useEffect(() => {
    if (serverWaitingRunId || isStreaming) return;
    if (!pendingInteractionRef.current) return;
    if (runs.isFetching) return;
    setPendingInteraction(null);
  }, [serverWaitingRunId, isStreaming, runs.isFetching]);

  async function answerPendingInteraction(
    payload: ConversationRunResumeRequest,
  ) {
    const interaction = pendingInteraction;
    const runId = activeRunId ?? serverWaitingRunId;
    if (!activeId || !interaction || !runId) return;
    if (!isDocumentSelection(interaction)) return;
    // Carry the run's stored activity into the live list before the resume
    // appends to it. After a cold load the live list is empty and this run's
    // earlier events exist only on the server; `events` is keyed to the
    // waiting run precisely so they are here to hand over. A no-op in a
    // session that never reloaded.
    setLiveActivityEvents((current) =>
      seedLiveActivityEvents(current, events.data ?? []),
    );
    // A final selection leaves the suspended presentation immediately. A
    // refinement keeps the card mounted and disabled while the backend tries
    // the clue, then replaces it with the next attempt if needed.
    if (!("kind" in payload && payload.kind === "refine")) {
      setPendingInteraction(null);
    }
    await resumeInteraction(activeId, runId, payload);
  }

  async function handleChooseInteractionOption(documentId: string) {
    const interaction = pendingInteraction;
    if (!interaction || !isDocumentSelection(interaction)) return;
    await answerPendingInteraction(
      isDocumentSelectionV2(interaction)
        ? {
            schema_version: INTERACTION_SCHEMA_VERSION,
            interaction_id: interaction.interaction_id,
            type: "document_selection",
            kind: "select",
            document_id: documentId,
          }
        : {
            schema_version: LEGACY_INTERACTION_SCHEMA_VERSION,
            interaction_id: interaction.interaction_id,
            type: "document_selection",
            document_id: documentId,
          },
    );
  }

  async function handleRefineInteraction(text: string) {
    const interaction = pendingInteraction;
    if (
      !interaction ||
      !isDocumentSelection(interaction) ||
      !isDocumentSelectionV2(interaction) ||
      !interaction.refinement.allowed
    )
      return;
    await answerPendingInteraction({
      schema_version: INTERACTION_SCHEMA_VERSION,
      interaction_id: interaction.interaction_id,
      type: "document_selection",
      kind: "refine",
      text,
    });
  }

  async function handleCancelInteraction() {
    const runId = activeRunId ?? serverWaitingRunId;
    if (!activeId || !runId) {
      // No run to cancel server-side: this card is local-only, so dropping it
      // strands nothing.
      setPendingInteraction(null);
      setStatusAnnouncement(localization.interactionCancelledAnnouncement);
      return;
    }
    // The card is the *only* way out of a suspended run, so it must survive a
    // failed cancel. Clearing optimistically would leave the backend run
    // blocked with nothing on screen to retry from: the cold-load effect keys
    // on `serverWaitingRunId` and the run detail, neither of which changes when
    // the cancel request fails, so it would never restore the card.
    setIsCancellingInteraction(true);
    try {
      await myAgentsAPI.conversations.cancelRun(activeId, runId);
      setPendingInteraction(null);
      setStatusAnnouncement(localization.interactionCancelledAnnouncement);
    } catch (error) {
      // Localized from the backend's `code`; the raw detail is never rendered.
      toast.error(resolveErrorMessage(error, fullLocalization));
    } finally {
      setIsCancellingInteraction(false);
      await queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.conversations.runs(activeId),
      });
    }
  }

  async function handleSendNow() {
    // Steering acts on whatever is pending: the queued message if one is held,
    // otherwise the draft. Previously this was draft-only and was disabled
    // whenever a queue existed, so a queued message could never be pushed
    // through — you could queue or steer, never steer what you queued.
    const pending = visibleQueuedMessage
      ? {
          conversationId: visibleQueuedMessage.conversationId,
          content: visibleQueuedMessage.content,
          knowledgeBaseSelection: visibleQueuedMessage.knowledgeBaseSelection,
        }
      : activeId && draftMessage
        ? {
            conversationId: activeId,
            content: draftMessage,
            knowledgeBaseSelection: activeKnowledgeBaseSelection,
          }
        : null;
    if (
      !activeId ||
      !pending ||
      !isStreaming ||
      isCancelling ||
      !activeRunId ||
      (!visibleQueuedMessage && requiresKnowledgeBaseSelection)
    )
      return;
    const immediateMessage = pending;
    if (visibleQueuedMessage) setQueuedMessage(null);
    pendingImmediateMessageRef.current = immediateMessage;
    cancelAcceptedRef.current = false;
    if (!visibleQueuedMessage) setDraft("");
    setIsCancelling(true);
    setStatusAnnouncement(localization.stoppingCurrentAnswerAnnouncement);
    try {
      await myAgentsAPI.conversations.cancelRun(activeId, activeRunId);
      if (pendingImmediateMessageRef.current === immediateMessage) {
        cancelAcceptedRef.current = true;
        setStatusAnnouncement(localization.currentAnswerStoppingAnnouncement);
      }
    } catch (error) {
      if (pendingImmediateMessageRef.current === immediateMessage) {
        setStreamError(error);
        setDraft(immediateMessage.content);
        setStatusAnnouncement(localization.immediateFailedAnnouncement);
        resetImmediateState();
      }
    }
  }

  function handleEditQueuedMessage() {
    if (!visibleQueuedMessage) return;
    setDraft(visibleQueuedMessage.content);
    setKnowledgeBaseMode(visibleQueuedMessage.knowledgeBaseSelection.mode);
    setSelectedKnowledgeBaseIds(
      visibleQueuedMessage.knowledgeBaseSelection.knowledge_base_ids,
    );
    setQueuedMessage(null);
    setStatusAnnouncement(localization.queueEditAnnouncement);
  }

  function handleCancelQueuedMessage() {
    if (!visibleQueuedMessage) return;
    setQueuedMessage(null);
    setStatusAnnouncement(localization.queueCancelledAnnouncement);
  }

  async function handleSendQueuedMessage() {
    if (!visibleQueuedMessage || conversationIsBusy) return;
    const nextQueuedMessage = visibleQueuedMessage;
    setQueuedMessage(null);
    setStatusAnnouncement(localization.queuedSentAnnouncement);
    await runMessageAndContinue(
      nextQueuedMessage.conversationId,
      nextQueuedMessage.content,
      nextQueuedMessage.knowledgeBaseSelection,
    );
  }

  const sortedMessages = useMemo(() => {
    const persistedMessages = messages.data ?? [];
    if (!optimisticMessage || optimisticMessage.conversation_id !== activeId)
      return persistedMessages;
    return [...persistedMessages, optimisticMessage];
  }, [activeId, messages.data, optimisticMessage]);
  /*
   * The live list is already filtered as it is built; the stored list is not,
   * and after a reload it is the only source the panel has. Reasoning-summary
   * events are a different trust channel and would otherwise reach the
   * verified-stage heuristic here — see `isReasoningSummaryEventType`.
   */
  const visibleActivityEvents =
    liveActivityEvents.length > 0
      ? liveActivityEvents
      : (events.data ?? []).filter(
          (event) => !isReasoningSummaryEventType(event.event_type),
        );
  const completedRunDetail =
    runDetail.data && !isRunInterrupted(runDetail.data) ? runDetail.data : null;
  /*
   * Read as a pair, from one source.
   *
   * The old test was `latestCitations.length > 0`. Under attribution that
   * breaks: a completed run can legitimately have zero citations and several
   * consulted sources, so the emptiness of one array no longer means "no live
   * evidence". Keying on it alone would pair the live consulted list with the
   * server's citation list and badge whichever rows happened to match.
   *
   * Busy state owns the surface before a result exists; afterward the coverage
   * tri-state owns it. This suppresses stale evidence while a run is active,
   * preserves explicit empty legacy completions, and lets a failed run reveal
   * the previous completed answer's evidence again.
   */
  const localRunOwnsEvidence =
    conversationIsBusy || latestDocumentCoverage !== undefined;
  const hasLiveEvidence =
    localRunOwnsEvidence ||
    latestCitations.length > 0 ||
    latestConsultedSources !== null;
  const visibleCitations = hasLiveEvidence
    ? latestCitations
    : (completedRunDetail?.citations ?? []);
  const visibleConsultedSources = hasLiveEvidence
    ? latestConsultedSources
    : (completedRunDetail?.consulted_sources ?? null);
  const visibleDocumentCoverage = localRunOwnsEvidence
    ? (latestDocumentCoverage ?? null)
    : (completedRunDetail?.document_coverage ?? null);
  const visibleReasoningSummaries = localRunOwnsEvidence
    ? (latestReasoningSummaries ?? [])
    : (completedRunDetail?.reasoning_summaries ?? []);
  // Live events without a completed local result belong to a newer attempt than
  // the cached run list. Do not pair them with the previous completed run ID.
  const latestRunId =
    latestRunResultId ??
    (liveActivityEvents.length === 0 ? (latestCompletedRunId ?? null) : null);
  const latestAssistantMessageId = getLatestAssistantMessageId(sortedMessages);
  const latestActivityEvent = visibleActivityEvents.at(-1);
  // The transcript grows from process events before the first answer token,
  // not only from messages and reply text. Event identity/sequence changes for
  // every appended phase, including one event that reveals several trace steps
  // in a burst. The scroll effect still checks `shouldAutoScrollRef`, so this
  // never pulls a reader back down after they intentionally scroll upward.
  const autoScrollTrigger = `${sortedMessages.length}:${streamedReply.length}:${visibleActivityEvents.length}:${latestActivityEvent?.id ?? ""}:${latestActivityEvent?.sequence ?? ""}`;
  const composerPlaceholder = conversationIsBusy
    ? visibleQueuedMessage
      ? localization.queuedComposerPlaceholder
      : localization.streamingComposerPlaceholder
    : localization.composerPlaceholder;
  const primaryActionLabel = conversationIsBusy
    ? localization.queueNext
    : localization.send;
  // No `!activeId`: with no conversation open the composer is still live, and
  // sending creates one. Only an in-flight create blocks it, so a double submit
  // cannot start two conversations.
  const isPrimaryActionDisabled =
    !hasActiveDraft ||
    isCancelling ||
    isCreatingConversation ||
    requiresKnowledgeBaseSelection ||
    (conversationIsBusy && Boolean(visibleQueuedMessage));
  const isSendNowDisabled =
    !activeId ||
    (!hasActiveDraft && !visibleQueuedMessage) ||
    !isStreaming ||
    isCancelling ||
    !activeRunId ||
    (!visibleQueuedMessage && requiresKnowledgeBaseSelection);
  const sendNowHelper = isCancelling
    ? localization.stoppingCurrentAnswer
    : visibleQueuedMessage
      ? localization.sendNowQueuedBlocked
      : runPhase === "waiting"
        ? localization.interactionSendHelper
        : serverActiveRunIsStale
          ? localization.activeRunStaleHelper
          : !activeRunId && isStreaming
            ? localization.sendNowWaitingForRun
            : localization.sendNowHelper;
  const queuedHelper =
    // A queued message under an open question is not "waiting for the current
    // answer" — nothing is being answered. Saying so avoids the impression that
    // it will send itself shortly.
    hasPendingInteraction || serverWaitingRun
      ? localization.interactionQueuePaused
      : streamError && !isStreaming
        ? localization.queuedAfterFailureHelper
        : localization.queuedHelper;

  function handleChatScroll() {
    const scrollElement = chatScrollRef.current;
    if (!scrollElement) return;
    shouldAutoScrollRef.current = isNearScrollBottom(scrollElement);
  }

  /**
   * Clear the optimistic id only once the route has caught up to it.
   *
   * `SourcesSurface` also clears when the route segment goes empty; copying
   * that here would break the send path, because for at least one render after
   * `router.push` the route id is still undefined — clearing then would pull
   * `activeId` out from under a run that is already streaming.
   */
  useEffect(() => {
    if (!optimisticConversationId) return;
    if (routeConversationId === optimisticConversationId) {
      setOptimisticConversationId(undefined);
    }
  }, [optimisticConversationId, routeConversationId]);

  /**
   * Evidence is per-conversation, so it must not survive a conversation change.
   *
   * This used to live inside the delete handler, which meant switching between
   * conversations left the previous answer's citations and activity trail on
   * screen. Keyed on `activeId`, it now covers delete, switch, and starting a
   * new chat with one rule.
   *
   * Deliberately not clearing `queuedMessage`: it is already scoped by
   * `conversationId` and is meant to survive a detour to another conversation.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: `activeId` is the trigger; the setters are stable and listing the cleared state would re-run this on every change to it.
  useEffect(() => {
    const previous = previousActiveIdRef.current;
    previousActiveIdRef.current = activeId;
    /**
     * Only a *switch* between conversations clears evidence.
     *
     * `undefined -> id` is a new chat becoming real, which happens in the same
     * tick as the first send: the run loop has already set the optimistic
     * bubble and started streaming by the time this runs. Treating that as a
     * switch wiped both, so the user saw an empty transcript until the answer
     * arrived. There is nothing stale to clear in that direction anyway —
     * a brand-new conversation has no prior evidence.
     */
    if (previous === undefined) return;

    setStreamError(null);
    setReplayNotice(null);
    setLiveActivityEvents([]);
    setLatestCitations([]);
    setLatestConsultedSources(null);
    setLatestDocumentCoverage(undefined);
    setLatestReasoningSummaries(undefined);
    setLatestRunResultId(null);
    setOptimisticMessage(null);
  }, [activeId]);

  /**
   * Publishes which conversation is mid-run so the history list in the shell
   * sidebar can disable its delete button. It is a sibling of this route, so
   * props cannot reach it. Flips at most twice per run — never per token.
   */
  const setBusyConversationId = useChatActivityStore(
    (state) => state.setBusyConversationId,
  );
  useEffect(() => {
    setBusyConversationId(
      activeId && (conversationIsBusy || isCancelling) ? activeId : null,
    );
  }, [activeId, conversationIsBusy, isCancelling, setBusyConversationId]);
  useEffect(() => {
    return () => setBusyConversationId(null);
  }, [setBusyConversationId]);

  useChatWorkspaceEffects({
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
    runMessageAndContinue,
    selectableKnowledgeBases,
    serverActiveRunId,
    serverWaitingRunId,
    canDrainQueue: canDrainQueue(runPhase),
    setActiveRunClock,
    setObservedServerActiveRun,
    setQueuedMessageState,
    setSelectedKnowledgeBaseIds,
    setStatusAnnouncement,
    shouldAutoScrollRef,
  });

  return (
    <ChatWorkspaceLayout
      activeId={activeId}
      activeRunId={activeRunId}
      chatScrollRef={chatScrollRef}
      composerPlaceholder={composerPlaceholder}
      conversation={conversation}
      conversationIsBusy={conversationIsBusy}
      draft={draft}
      events={visibleActivityEvents}
      hasActiveDraft={hasActiveDraft}
      isCancelling={isCancelling}
      isPrimaryActionDisabled={isPrimaryActionDisabled}
      isSendNowDisabled={isSendNowDisabled}
      // The stop button follows the derived phase, not the raw streaming flag:
      // a suspended run must not offer to stop an answer nobody is writing.
      isStreaming={showsStopButton}
      knowledgeBaseMode={knowledgeBaseMode}
      knowledgeBases={knowledgeBases}
      lang={lang}
      latestAssistantMessageId={latestAssistantMessageId}
      latestRunId={latestRunId}
      localization={localization}
      messages={sortedMessages}
      messagesError={messages.error}
      onCancelQueuedMessage={handleCancelQueuedMessage}
      onChatScroll={handleChatScroll}
      onDraftChange={setDraft}
      onEditQueuedMessage={handleEditQueuedMessage}
      onKnowledgeBaseModeChange={setKnowledgeBaseMode}
      onReplayAssistantMessage={handleReplayAssistantMessage}
      onSendNow={handleSendNow}
      onSendQueuedMessage={handleSendQueuedMessage}
      onSubmit={handleSend}
      onToggleKnowledgeBase={toggleSelectedKnowledgeBase}
      primaryActionLabel={primaryActionLabel}
      queuedHelper={queuedHelper}
      pendingInteractionSlot={
        pendingInteraction ? (
          <PendingInteractionSlot
            interaction={pendingInteraction}
            conversationId={activeId}
            runId={activeRunId ?? serverWaitingRunId}
            localization={localization}
            isResuming={isStreaming || isCancellingInteraction}
            onChoose={handleChooseInteractionOption}
            onRefine={handleRefineInteraction}
            onCancel={handleCancelInteraction}
          />
        ) : null
      }
      replayAssistantMessage={replayAssistantMessage}
      replayNotice={replayNotice}
      replayingMessageId={replayingMessageId}
      requiresKnowledgeBaseSelection={requiresKnowledgeBaseSelection}
      selectedKnowledgeBaseIds={selectedKnowledgeBaseIds}
      sendNowHelper={sendNowHelper}
      serverActiveRunIsStale={serverActiveRunIsStale}
      reasoning={reasoning}
      onReasoningModeChange={(mode) => persistReasoning({ mode })}
      onReasoningEffortChange={(effort) => persistReasoning({ effort })}
      showGuestNotice={showGuestNotice}
      statusAnnouncement={statusAnnouncement}
      streamError={streamError}
      streamedReply={streamedReply}
      visibleCitations={visibleCitations}
      visibleConsultedSources={visibleConsultedSources}
      visibleDocumentCoverage={visibleDocumentCoverage}
      visibleReasoningSummaries={visibleReasoningSummaries}
      visibleQueuedMessage={visibleQueuedMessage}
    />
  );
}

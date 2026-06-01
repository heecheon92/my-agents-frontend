"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import { useCurrentUser } from "@/hooks/use-auth";
import {
  useConversation,
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useMessages,
  useReplayAssistantMessage,
  useRunDetail,
  useRunEvents,
  useRuns,
} from "@/hooks/use-conversations";
import { useGroups } from "@/hooks/use-groups";
import { useKnowledgeBases } from "@/hooks/use-knowledge";
import { useLocalization } from "@/hooks/useLocalization";
import type {
  AnswerDeltaEventData,
  Citation,
  Conversation,
  ConversationRunResponse,
  KnowledgeBase,
  KnowledgeBaseSelection,
  KnowledgeBaseSelectionMode,
  Message,
} from "@/model/my-agents";
import { myAgentsAPI } from "@/services/my-agents";
import { isMyAgentsAPIError } from "@/services/my-agents/MyAgentsAPIError";
import {
  CHAT_SCROLL_REGION_CLASS_NAME,
  ChatTranscript,
  REPLAY_ICON_PENDING_CLASS_NAME,
} from "./chat/ChatTranscript";
import { ComposerBar } from "./chat/ComposerBar";
import {
  ConversationSidebar,
  getConversationCardClassName,
} from "./chat/ConversationSidebar";
import { sanitizeActivityEventPayload } from "./chat/EvidencePanel";
import { KnowledgeSourceSelector } from "./chat/KnowledgeSourceSelector";
import type { ChatMode, LiveActivityEvent, QueuedMessage } from "./chat/types";

type RunOutcome = "completed" | "cancelled" | "failed" | "active_conflict";

const CHAT_BOTTOM_THRESHOLD_PX = 96;
export const ACTIVE_RUN_STALE_NOTICE_AFTER_MS = 30_000;

export { CHAT_SCROLL_REGION_CLASS_NAME };
export { REPLAY_ICON_PENDING_CLASS_NAME };
export { getConversationCardClassName, sanitizeActivityEventPayload };

export const CHAT_WORKSPACE_PANEL_CLASS_NAME =
  "cal-card flex h-[calc(100dvh-8rem)] min-h-0 min-w-0 flex-col overflow-hidden rounded-xl xl:h-full";

export function getLatestAssistantMessageId(messages: Message[]) {
  return [...messages].reverse().find((message) => message.role === "assistant")
    ?.id;
}

export function getNextConversationIdAfterDelete(
  conversations: Array<Pick<Conversation, "id">>,
  deletedConversationId: string,
  activeConversationId?: string,
) {
  if (activeConversationId !== deletedConversationId)
    return activeConversationId;

  const deletedIndex = conversations.findIndex(
    (item) => item.id === deletedConversationId,
  );
  const remainingConversations = conversations.filter(
    (item) => item.id !== deletedConversationId,
  );
  if (remainingConversations.length === 0) return undefined;
  if (deletedIndex < 0) return remainingConversations[0]?.id;
  return (
    remainingConversations[deletedIndex]?.id ??
    remainingConversations[deletedIndex - 1]?.id
  );
}

export function isActiveAgentRunStatus(status: string) {
  return status === "running" || status === "cancelling";
}

export function isObservedActiveRunStale({
  activeRunId,
  observedRunId,
  observedAt,
  now,
  thresholdMs = ACTIVE_RUN_STALE_NOTICE_AFTER_MS,
}: {
  activeRunId: string | null;
  observedRunId: string | null;
  observedAt: number | null;
  now: number;
  thresholdMs?: number;
}) {
  return Boolean(
    activeRunId &&
      activeRunId === observedRunId &&
      observedAt !== null &&
      now - observedAt >= thresholdMs,
  );
}

export function isConversationRunAlreadyActiveError(error: unknown) {
  if (!isMyAgentsAPIError(error) || error.status !== 409) return false;
  const details = [error.detail, error.message];
  if (typeof error.body === "string") {
    details.push(error.body);
  }
  if (error.body && typeof error.body === "object") {
    const body = error.body as { detail?: unknown; message?: unknown };
    if (typeof body.detail === "string") details.push(body.detail);
    if (typeof body.message === "string") details.push(body.message);
  }
  return details.some((detail) =>
    detail?.toLowerCase().includes("conversation run already active"),
  );
}

function safeBackendDetail(value: unknown) {
  if (value && typeof value === "object" && "detail" in value) {
    const detail = (value as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return undefined;
}

function isNearScrollBottom(element: HTMLElement) {
  return (
    element.scrollHeight - element.scrollTop - element.clientHeight <=
    CHAT_BOTTOM_THRESHOLD_PX
  );
}

function getSelectedGroupKnowledgeBaseIds(
  isGroupMode: boolean,
  groupKnowledgeBases: KnowledgeBase[],
) {
  return isGroupMode
    ? groupKnowledgeBases.map((knowledgeBase) => knowledgeBase.id)
    : [];
}

export function buildActiveKnowledgeBaseSelection({
  isGroupMode,
  knowledgeBaseMode,
  selectedKnowledgeBaseIds,
  groupKnowledgeBaseIds = [],
}: {
  isGroupMode: boolean;
  knowledgeBaseMode: KnowledgeBaseSelectionMode;
  selectedKnowledgeBaseIds: string[];
  groupKnowledgeBaseIds?: string[];
}): KnowledgeBaseSelection {
  if (isGroupMode) {
    return { mode: "selected", knowledge_base_ids: groupKnowledgeBaseIds };
  }
  return {
    mode: knowledgeBaseMode,
    knowledge_base_ids:
      knowledgeBaseMode === "selected" ? selectedKnowledgeBaseIds : [],
  };
}

export function ChatWorkspace() {
  const queryClient = useQueryClient();
  const conversations = useConversations();
  const groups = useGroups();
  const knowledgeBases = useKnowledgeBases();
  const currentUser = useCurrentUser();
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();
  const [selectedId, setSelectedId] = useState<string>();
  const activeId = selectedId ?? conversations.data?.[0]?.id;
  const conversation = useConversation(activeId);
  const messages = useMessages(activeId);
  const replayAssistantMessage = useReplayAssistantMessage(activeId);
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
  const latestRunId = serverActiveRun ? undefined : sortedRuns[0]?.run_id;
  const runDetail = useRunDetail(activeId, latestRunId);
  const events = useRunEvents(activeId, latestRunId);
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
  const [activeRunClock, setActiveRunClock] = useState(() => Date.now());
  const [observedServerActiveRun, setObservedServerActiveRun] = useState<{
    runId: string;
    observedAt: number;
  } | null>(null);
  const [replayingMessageId, setReplayingMessageId] = useState<string | null>(
    null,
  );
  const [replayNotice, setReplayNotice] = useState<{
    messageId: string;
    message: string;
    tone: "error" | "success" | "warning";
  } | null>(null);
  const [liveActivityEvents, setLiveActivityEvents] = useState<
    LiveActivityEvent[]
  >([]);
  const [optimisticMessage, setOptimisticMessage] = useState<Message | null>(
    null,
  );
  const [latestCitations, setLatestCitations] = useState<Citation[]>([]);
  const [showGuestNotice, setShowGuestNotice] = useState(false);
  const [knowledgeBaseMode, setKnowledgeBaseMode] =
    useState<KnowledgeBaseSelectionMode>("all");
  const [chatMode, setChatMode] = useState<ChatMode>("personal");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedKnowledgeBaseIds, setSelectedKnowledgeBaseIds] = useState<
    string[]
  >([]);
  const [selectedPrivateKnowledgeBaseIds, setSelectedPrivateKnowledgeBaseIds] =
    useState<string[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const isStreamingRef = useRef(false);
  const activeRunIdRef = useRef<string | null>(null);
  const queuedMessageRef = useRef<QueuedMessage | null>(null);
  const pendingImmediateMessageRef = useRef<QueuedMessage | null>(null);
  const cancelAcceptedRef = useRef(false);
  const previousServerActiveRunIdRef = useRef<string | null>(null);
  const autoReplayAttemptedRunIdsRef = useRef<Set<string>>(new Set());
  const runMessageAndContinueRef = useRef<
    (
      conversationId: string,
      message: string,
      knowledgeBaseSelection: KnowledgeBaseSelection,
      optionalPersonalKnowledgeBaseIds: string[],
    ) => Promise<void>
  >(async () => undefined);
  const { lang, localization } = useLocalization(
    (state) => state.localization.chat,
  );

  const visibleQueuedMessage =
    queuedMessage?.conversationId === activeId ? queuedMessage : null;
  const draftMessage = draft.trim();
  const hasActiveDraft = draftMessage.length > 0;
  const personalKnowledgeBases = useMemo(
    () =>
      (knowledgeBases.data ?? []).filter(
        (kb) =>
          kb.scope === "personal" &&
          (!currentUser.data?.id || kb.owner_user_id === currentUser.data.id),
      ),
    [knowledgeBases.data, currentUser.data?.id],
  );
  const groupKnowledgeBases = useMemo(
    () =>
      (knowledgeBases.data ?? []).filter(
        (kb) =>
          selectedGroupIds.length > 0 &&
          ((kb.scope === "group" &&
            kb.group_id !== null &&
            selectedGroupIds.includes(kb.group_id)) ||
            (kb.scope === "personal" &&
              kb.published_group_ids.some((groupId) =>
                selectedGroupIds.includes(groupId),
              ))),
      ),
    [knowledgeBases.data, selectedGroupIds],
  );
  const optionalPrivateKnowledgeBases = useMemo(
    () =>
      personalKnowledgeBases.filter(
        (kb) =>
          !kb.published_group_ids.some((groupId) =>
            selectedGroupIds.includes(groupId),
          ),
      ),
    [personalKnowledgeBases, selectedGroupIds],
  );
  const selectedGroups = (groups.data ?? []).filter((group) =>
    selectedGroupIds.includes(group.id),
  );
  const isGroupMode = chatMode === "group";
  const groupContextRequired = isGroupMode && selectedGroupIds.length === 0;
  const selectedGroupKnowledgeBaseIds = getSelectedGroupKnowledgeBaseIds(
    isGroupMode,
    groupKnowledgeBases,
  );
  const activeOptionalPersonalKnowledgeBaseIds = isGroupMode
    ? selectedPrivateKnowledgeBaseIds
    : [];
  const activeKnowledgeBaseSelection = buildActiveKnowledgeBaseSelection({
    isGroupMode,
    knowledgeBaseMode,
    selectedKnowledgeBaseIds,
    groupKnowledgeBaseIds: selectedGroupKnowledgeBaseIds,
  });
  const requiresKnowledgeBaseSelection =
    !isGroupMode &&
    knowledgeBaseMode === "selected" &&
    selectedKnowledgeBaseIds.length === 0;
  const conversationIsBusy = isStreaming || Boolean(serverActiveRun);
  const serverActiveRunIsStale = isObservedActiveRunStale({
    activeRunId: serverActiveRunId,
    observedRunId: observedServerActiveRun?.runId ?? null,
    observedAt: observedServerActiveRun?.observedAt ?? null,
    now: activeRunClock,
  });

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

  function toggleSelectedKnowledgeBase(knowledgeBaseId: string) {
    setSelectedKnowledgeBaseIds((current) =>
      current.includes(knowledgeBaseId)
        ? current.filter((id) => id !== knowledgeBaseId)
        : [...current, knowledgeBaseId],
    );
  }

  function togglePrivateKnowledgeBase(knowledgeBaseId: string) {
    setSelectedPrivateKnowledgeBaseIds((current) =>
      current.includes(knowledgeBaseId)
        ? current.filter((id) => id !== knowledgeBaseId)
        : [...current, knowledgeBaseId],
    );
  }

  function toggleSelectedGroup(groupId: string) {
    setSelectedGroupIds((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId],
    );
  }

  async function handleCreate() {
    try {
      const created = await createConversation.mutateAsync({
        title: `${localization.newConversationTitle} ${new Date().toLocaleString(lang)}`,
        group_id: null,
      });
      setSelectedId(created.id);
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  async function handleDeleteConversation(item: Conversation) {
    const nextSelectedId = getNextConversationIdAfterDelete(
      conversations.data ?? [],
      item.id,
      activeId,
    );
    const confirmed = window.confirm(
      localization.deleteConversationConfirm.replace("{title}", item.title),
    );
    if (!confirmed) return;

    try {
      await deleteConversation.mutateAsync(item.id);
      if (activeId === item.id) {
        setSelectedId(nextSelectedId);
        setQueuedMessage(null);
        setStreamError(null);
        setReplayNotice(null);
        setLiveActivityEvents([]);
        setLatestCitations([]);
        setOptimisticMessage(null);
      }
      setStatusAnnouncement(localization.deleteConversationSuccessAnnouncement);
    } catch {
      setStatusAnnouncement(localization.deleteConversationFailedAnnouncement);
    }
  }

  async function runMessage(
    conversationId: string,
    message: string,
    knowledgeBaseSelection: KnowledgeBaseSelection,
    optionalPersonalKnowledgeBaseIds: string[],
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
        {
          message,
          knowledge_base_selection: knowledgeBaseSelection,
          optional_personal_knowledge_base_ids:
            optionalPersonalKnowledgeBaseIds,
        },
      )) {
        liveSequence += 1;
        const sequence = liveSequence;
        setLiveActivityEvents((current) => [
          ...current,
          {
            id: `live-${sequence}`,
            sequence,
            event_type: streamEvent.event,
            payload: streamEvent.data,
          },
        ]);

        if (streamEvent.event === "run_started") {
          const data = streamEvent.data as { run_id: string };
          setCurrentRunId(data.run_id);
        }
        if (streamEvent.event === "answer_delta") {
          const data = streamEvent.data as AnswerDeltaEventData;
          setStreamedReply((current) => current + data.delta);
        }
        if (streamEvent.event === "run_cancelled") {
          cancelled = true;
        }
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
        } else {
          throw new Error(localization.runFailed);
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
    optionalPersonalKnowledgeBaseIds: string[],
  ): Promise<void> {
    const outcome = await runMessage(
      conversationId,
      message,
      knowledgeBaseSelection,
      optionalPersonalKnowledgeBaseIds,
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
          optionalPersonalKnowledgeBaseIds,
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
        pendingImmediateMessage.optionalPersonalKnowledgeBaseIds,
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
        nextQueuedMessage.optionalPersonalKnowledgeBaseIds,
      );
    }
  }

  runMessageAndContinueRef.current = runMessageAndContinue;

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !draftMessage ||
      !activeId ||
      isCancelling ||
      requiresKnowledgeBaseSelection ||
      groupContextRequired
    ) {
      return;
    }

    if (conversationIsBusy) {
      if (visibleQueuedMessage) {
        setStatusAnnouncement(localization.queueAlreadyExistsAnnouncement);
        return;
      }
      const nextQueuedMessage = {
        conversationId: activeId,
        content: draftMessage,
        knowledgeBaseSelection: activeKnowledgeBaseSelection,
        optionalPersonalKnowledgeBaseIds:
          activeOptionalPersonalKnowledgeBaseIds,
      };
      setQueuedMessage(nextQueuedMessage);
      setDraft("");
      setStatusAnnouncement(localization.queuedAnnouncement);
      return;
    }

    setDraft("");
    await runMessageAndContinue(
      activeId,
      draftMessage,
      activeKnowledgeBaseSelection,
      activeOptionalPersonalKnowledgeBaseIds,
    );
  }

  async function handleSendNow() {
    if (
      !activeId ||
      !draftMessage ||
      !isStreaming ||
      isCancelling ||
      !activeRunId ||
      visibleQueuedMessage ||
      requiresKnowledgeBaseSelection ||
      groupContextRequired
    ) {
      return;
    }

    const immediateMessage = {
      conversationId: activeId,
      content: draftMessage,
      knowledgeBaseSelection: activeKnowledgeBaseSelection,
      optionalPersonalKnowledgeBaseIds: activeOptionalPersonalKnowledgeBaseIds,
    };
    pendingImmediateMessageRef.current = immediateMessage;
    cancelAcceptedRef.current = false;
    setDraft("");
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
    setSelectedPrivateKnowledgeBaseIds(
      visibleQueuedMessage.optionalPersonalKnowledgeBaseIds,
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
      nextQueuedMessage.optionalPersonalKnowledgeBaseIds,
    );
  }

  async function handleReplayAssistantMessage(messageId: string) {
    if (
      !activeId ||
      conversationIsBusy ||
      isCancelling ||
      replayAssistantMessage.isPending
    ) {
      return;
    }

    setReplayingMessageId(messageId);
    setReplayNotice(null);
    setStatusAnnouncement(localization.replayStartedAnnouncement);

    try {
      const replayResult = await replayAssistantMessage.mutateAsync(messageId);
      const hasUnavailableSources = replayResult.warnings.some(
        (warning) => warning.code === "regeneration_sources_unavailable",
      );
      setReplayNotice({
        messageId,
        message: hasUnavailableSources
          ? localization.replaySourcesUnavailable
          : localization.replaySuccess,
        tone: hasUnavailableSources ? "warning" : "success",
      });
      setStatusAnnouncement(
        hasUnavailableSources
          ? localization.replaySourcesUnavailableAnnouncement
          : localization.replaySuccessAnnouncement,
      );
    } catch (error) {
      const isConflict = isMyAgentsAPIError(error) && error.status === 409;
      const message =
        error instanceof Error
          ? error.message
          : isConflict
            ? localization.replayConflict
            : localization.replayFailed;
      setReplayNotice({
        messageId,
        message: isConflict ? message || localization.replayConflict : message,
        tone: "error",
      });
      setStatusAnnouncement(
        isConflict
          ? localization.replayConflictAnnouncement
          : localization.replayFailedAnnouncement,
      );
    } finally {
      setReplayingMessageId(null);
    }
  }

  const sortedMessages = useMemo(() => {
    const persistedMessages = messages.data ?? [];
    if (!optimisticMessage || optimisticMessage.conversation_id !== activeId) {
      return persistedMessages;
    }
    return [...persistedMessages, optimisticMessage];
  }, [activeId, messages.data, optimisticMessage]);
  const visibleActivityEvents =
    liveActivityEvents.length > 0 ? liveActivityEvents : (events.data ?? []);
  const visibleCitations =
    latestCitations.length > 0
      ? latestCitations
      : (runDetail.data?.citations ?? []);
  const latestAssistantMessageId = getLatestAssistantMessageId(sortedMessages);
  const autoScrollTrigger = `${sortedMessages.length}:${streamedReply.length}`;
  const composerPlaceholder = conversationIsBusy
    ? visibleQueuedMessage
      ? localization.queuedComposerPlaceholder
      : localization.streamingComposerPlaceholder
    : isGroupMode
      ? localization.groupComposerPlaceholder
      : localization.composerPlaceholder;
  const primaryActionLabel = conversationIsBusy
    ? localization.queueNext
    : localization.send;
  const isPrimaryActionDisabled =
    !activeId ||
    !hasActiveDraft ||
    isCancelling ||
    requiresKnowledgeBaseSelection ||
    groupContextRequired ||
    (conversationIsBusy && Boolean(visibleQueuedMessage));
  const isSendNowDisabled =
    !activeId ||
    !hasActiveDraft ||
    !isStreaming ||
    isCancelling ||
    !activeRunId ||
    Boolean(visibleQueuedMessage) ||
    requiresKnowledgeBaseSelection ||
    groupContextRequired;
  const sendNowHelper = isCancelling
    ? localization.stoppingCurrentAnswer
    : visibleQueuedMessage
      ? localization.sendNowQueuedBlocked
      : serverActiveRunIsStale
        ? localization.activeRunStaleHelper
        : !activeRunId && isStreaming
          ? localization.sendNowWaitingForRun
          : localization.sendNowHelper;
  const queuedHelper =
    streamError && !isStreaming
      ? localization.queuedAfterFailureHelper
      : localization.queuedHelper;

  function handleChatScroll() {
    const scrollElement = chatScrollRef.current;
    if (!scrollElement) return;
    shouldAutoScrollRef.current = isNearScrollBottom(scrollElement);
  }

  useEffect(() => {
    if (!activeId || !serverActiveRunId) return;
    previousServerActiveRunIdRef.current = serverActiveRunId;
    const intervalId = window.setInterval(() => {
      void queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.conversations.runs(activeId),
      });
    }, 2000);
    return () => window.clearInterval(intervalId);
  }, [activeId, queryClient, serverActiveRunId]);

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
  }, [serverActiveRunId]);

  useEffect(() => {
    if (!serverActiveRunId) return;
    const intervalId = window.setInterval(() => {
      setActiveRunClock(Date.now());
    }, 2000);
    return () => window.clearInterval(intervalId);
  }, [serverActiveRunId]);

  useEffect(() => {
    if (!activeId || serverActiveRunId || isStreaming || isCancelling) return;
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
    void runMessageAndContinueRef.current(
      nextQueuedMessage.conversationId,
      nextQueuedMessage.content,
      nextQueuedMessage.knowledgeBaseSelection,
      nextQueuedMessage.optionalPersonalKnowledgeBaseIds,
    );
  }, [
    activeId,
    isCancelling,
    isStreaming,
    localization,
    queryClient,
    serverActiveRunId,
  ]);

  useEffect(() => {
    setShowGuestNotice(
      new URLSearchParams(window.location.search).get("guest") === "1",
    );
  }, []);

  useEffect(() => {
    const availableIds = new Set(knowledgeBases.data?.map((kb) => kb.id) ?? []);
    setSelectedKnowledgeBaseIds((current) =>
      current.filter((id) => availableIds.has(id)),
    );
    setSelectedPrivateKnowledgeBaseIds((current) =>
      current.filter((id) => availableIds.has(id)),
    );
  }, [knowledgeBases.data]);

  useEffect(() => {
    if (!groups.data) return;
    const availableGroupIds = new Set(groups.data.map((group) => group.id));
    setSelectedGroupIds((current) =>
      current.filter((id) => availableGroupIds.has(id)),
    );
  }, [groups.data]);

  useEffect(() => {
    if (conversation.data?.group_id) {
      setSelectedGroupIds((current) =>
        current.includes(conversation.data?.group_id ?? "")
          ? current
          : [...current, conversation.data?.group_id ?? ""].filter(Boolean),
      );
      return;
    }
  }, [conversation.data?.group_id]);

  useEffect(() => {
    if (!activeId) return;
    shouldAutoScrollRef.current = true;
    requestAnimationFrame(() => {
      const scrollElement = chatScrollRef.current;
      if (!scrollElement) return;
      scrollElement.scrollTop = scrollElement.scrollHeight;
    });
  }, [activeId]);

  useEffect(() => {
    if (!autoScrollTrigger || !shouldAutoScrollRef.current) return;

    requestAnimationFrame(() => {
      const scrollElement = chatScrollRef.current;
      if (!scrollElement || !shouldAutoScrollRef.current) return;
      scrollElement.scrollTop = scrollElement.scrollHeight;
    });
  }, [autoScrollTrigger]);

  return (
    <div className="grid gap-4 xl:h-[calc(100dvh-8rem)] xl:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
      {showGuestNotice ? (
        <div className="rounded-xl border border-cal-warning/25 bg-cal-warning/10 p-4 text-sm text-cal-body xl:col-span-2">
          <p className="font-semibold text-cal-ink">
            {localization.guestNoticeTitle}
          </p>
          <p className="mt-1 leading-6">
            {localization.guestNoticeDescription}
          </p>
        </div>
      ) : null}
      <ConversationSidebar
        localization={localization}
        conversations={conversations.data}
        activeId={activeId}
        isLoading={conversations.isLoading}
        error={conversations.error}
        createError={createConversation.error}
        deleteError={deleteConversation.error}
        isCreatePending={createConversation.isPending}
        isDeletePending={deleteConversation.isPending}
        conversationIsBusy={conversationIsBusy}
        isCancelling={isCancelling}
        onCreate={handleCreate}
        onSelect={setSelectedId}
        onDelete={handleDeleteConversation}
      />

      <div className="min-h-0 min-w-0 xl:h-full">
        <section
          data-testid="chat-workspace-panel"
          className={CHAT_WORKSPACE_PANEL_CLASS_NAME}
        >
          <header className="grid gap-3 border-b border-cal-hairline p-4 sm:p-5">
            <div>
              <p className="cal-label">
                {localization.activeConversationLabel}
              </p>
              <h2 className="mt-2 break-words text-lg font-medium text-cal-ink">
                {conversation.data?.title ??
                  localization.selectOrCreateConversation}
              </h2>
            </div>
            <KnowledgeSourceSelector
              localization={localization}
              chatMode={chatMode}
              onChatModeChange={setChatMode}
              knowledgeBaseMode={knowledgeBaseMode}
              onKnowledgeBaseModeChange={setKnowledgeBaseMode}
              personalKnowledgeBases={personalKnowledgeBases}
              groupKnowledgeBases={groupKnowledgeBases}
              optionalPrivateKnowledgeBases={optionalPrivateKnowledgeBases}
              selectedKnowledgeBaseIds={selectedKnowledgeBaseIds}
              selectedPrivateKnowledgeBaseIds={selectedPrivateKnowledgeBaseIds}
              selectedGroupIds={selectedGroupIds}
              selectedGroups={selectedGroups}
              groups={groups.data}
              groupsLoading={groups.isLoading}
              groupsError={groups.error}
              knowledgeBasesLoading={knowledgeBases.isLoading}
              knowledgeBasesError={knowledgeBases.error}
              requiresKnowledgeBaseSelection={requiresKnowledgeBaseSelection}
              onToggleKnowledgeBase={toggleSelectedKnowledgeBase}
              onTogglePrivateKnowledgeBase={togglePrivateKnowledgeBase}
              onToggleGroup={toggleSelectedGroup}
            />
          </header>
          <ChatTranscript
            localization={localization}
            lang={lang}
            activeId={activeId}
            messagesError={messages.error}
            messages={sortedMessages}
            conversationIsBusy={conversationIsBusy}
            streamedReply={streamedReply}
            serverActiveRunIsStale={serverActiveRunIsStale}
            sortedRuns={sortedRuns}
            visibleActivityEvents={visibleActivityEvents}
            visibleCitations={visibleCitations}
            latestAssistantMessageId={latestAssistantMessageId}
            replayingMessageId={replayingMessageId}
            replayDisabled={
              conversationIsBusy ||
              isCancelling ||
              replayAssistantMessage.isPending
            }
            replayNotice={replayNotice}
            chatScrollRef={chatScrollRef}
            onChatScroll={handleChatScroll}
            onReplayAssistantMessage={handleReplayAssistantMessage}
          />
          <ComposerBar
            localization={localization}
            draft={draft}
            onDraftChange={setDraft}
            onSubmit={handleSend}
            visibleQueuedMessage={visibleQueuedMessage}
            queuedHelper={queuedHelper}
            knowledgeBases={knowledgeBases.data ?? []}
            conversationIsBusy={conversationIsBusy}
            activeId={activeId}
            isCancelling={isCancelling}
            isPrimaryActionDisabled={isPrimaryActionDisabled}
            primaryActionLabel={primaryActionLabel}
            isStreaming={isStreaming}
            isSendNowDisabled={isSendNowDisabled}
            onSendNow={handleSendNow}
            sendNowHelper={sendNowHelper}
            groupContextRequired={groupContextRequired}
            showGuestNotice={showGuestNotice}
            streamError={streamError}
            statusAnnouncement={statusAnnouncement}
            onSendQueuedMessage={handleSendQueuedMessage}
            onEditQueuedMessage={handleEditQueuedMessage}
            onCancelQueuedMessage={handleCancelQueuedMessage}
            composerPlaceholder={composerPlaceholder}
          />
        </section>
      </div>
    </div>
  );
}

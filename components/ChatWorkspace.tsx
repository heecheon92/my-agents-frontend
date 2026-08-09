"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useConversation,
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useMessages,
  useRunDetail,
  useRunEvents,
  useRuns,
} from "@/hooks/use-conversations";
import { useKnowledgeBases } from "@/hooks/use-knowledge";
import { useLocalization } from "@/hooks/useLocalization";
import type {
  Citation,
  Conversation,
  KnowledgeBaseSelectionMode,
  Message,
} from "@/model/my-agents";
import { myAgentsAPI } from "@/services/my-agents";
import {
  CHAT_SCROLL_REGION_CLASS_NAME,
  REPLAY_ICON_PENDING_CLASS_NAME,
} from "./chat/ChatTranscript";
import { ChatWorkspaceLayout } from "./chat/ChatWorkspaceLayout";
import { getConversationCardClassName } from "./chat/ConversationSidebar";
import { DeleteConversationAlertDialog } from "./chat/DeleteConversationAlertDialog";
import {
  getAgentTraceStageKeys,
  sanitizeActivityEventPayload,
} from "./chat/EvidencePanel";
import type { LiveActivityEvent, QueuedMessage } from "./chat/types";
import { useChatRunLoop } from "./chat/useChatRunLoop";
import { useChatWorkspaceEffects } from "./chat/useChatWorkspaceEffects";
import { useReplayAssistantMessageHandler } from "./chat/useReplayAssistantMessageHandler";
import {
  buildActiveKnowledgeBaseSelection,
  getLatestAssistantMessageId,
  getNextConversationIdAfterDelete,
  isActiveAgentRunStatus,
  isNearScrollBottom,
  isObservedActiveRunStale,
} from "./chat/workspace-helpers";

export { CHAT_SCROLL_REGION_CLASS_NAME };
export { REPLAY_ICON_PENDING_CLASS_NAME };
export { CHAT_WORKSPACE_PANEL_CLASS_NAME } from "./chat/ChatWorkspaceLayout";
export {
  ACTIVE_RUN_STALE_NOTICE_AFTER_MS,
  buildActiveKnowledgeBaseSelection,
  createLiveActivityEvent,
  getLatestAssistantMessageId,
  getNextConversationIdAfterDelete,
  isActiveAgentRunStatus,
  isConversationRunAlreadyActiveError,
  isObservedActiveRunStale,
  shouldRecordLiveActivityEvent,
} from "./chat/workspace-helpers";
export {
  getAgentTraceStageKeys,
  getConversationCardClassName,
  sanitizeActivityEventPayload,
};

export function ChatWorkspace() {
  const queryClient = useQueryClient();
  const conversations = useConversations();
  const knowledgeBases = useKnowledgeBases();
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();
  const [selectedId, setSelectedId] = useState<string>();
  const activeId = selectedId ?? conversations.data?.[0]?.id;
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
  const latestTerminalRun = serverActiveRun ? undefined : sortedRuns[0];
  const latestCompletedRunId =
    latestTerminalRun?.status === "completed"
      ? latestTerminalRun.run_id
      : undefined;
  const latestRunEventId = latestTerminalRun?.run_id;
  const runDetail = useRunDetail(activeId, latestCompletedRunId);
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
  const [showGuestNotice, setShowGuestNotice] = useState(false);
  // Compact-screen conversation browser. Lives here, not in the sheet, so
  // selecting a conversation can close it in the same handler.
  const [isConversationBrowserOpen, setIsConversationBrowserOpen] =
    useState(false);
  const [conversationPendingDelete, setConversationPendingDelete] =
    useState<Conversation>();
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
  const previousServerActiveRunIdRef = useRef<string | null>(null);
  const autoReplayAttemptedRunIdsRef = useRef<Set<string>>(new Set());
  const { lang, localization } = useLocalization(
    (state) => state.localization.chat,
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
  const conversationIsBusy = isStreaming || Boolean(serverActiveRun);
  const serverActiveRunIsStale = isObservedActiveRunStale({
    activeRunId: serverActiveRunId,
    observedRunId: observedServerActiveRun?.runId ?? null,
    observedAt: observedServerActiveRun?.observedAt ?? null,
    now: activeRunClock,
  });
  const { resetImmediateState, runMessageAndContinue, setQueuedMessage } =
    useChatRunLoop({
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
  });

  function toggleSelectedKnowledgeBase(knowledgeBaseId: string) {
    setSelectedKnowledgeBaseIds((current) =>
      current.includes(knowledgeBaseId)
        ? current.filter((id) => id !== knowledgeBaseId)
        : [...current, knowledgeBaseId],
    );
  }

  async function handleCreate() {
    try {
      const created = await createConversation.mutateAsync({
        title: `${localization.newConversationTitle} ${new Date().toLocaleString(lang)}`,
      });
      setSelectedId(created.id);
      toast.success(localization.createConversationSuccessAnnouncement);
    } catch {
      toast.error(localization.createConversationFailedAnnouncement);
    }
  }

  function requestDeleteConversation(item: Conversation) {
    deleteConversation.reset();
    setConversationPendingDelete(item);
  }

  function handleDeleteConversationDialogOpenChange(open: boolean) {
    if (open || deleteConversation.isPending) return;
    setConversationPendingDelete(undefined);
    deleteConversation.reset();
  }

  async function handleDeleteConversation(item: Conversation) {
    const nextSelectedId = getNextConversationIdAfterDelete(
      conversations.data ?? [],
      item.id,
      activeId,
    );
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
      setConversationPendingDelete(undefined);
      toast.success(localization.deleteConversationSuccessAnnouncement);
    } catch {
      setStatusAnnouncement(localization.deleteConversationFailedAnnouncement);
      toast.error(localization.deleteConversationFailedAnnouncement);
    }
  }

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !draftMessage ||
      !activeId ||
      isCancelling ||
      requiresKnowledgeBaseSelection
    )
      return;
    if (conversationIsBusy) {
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
    setDraft("");
    await runMessageAndContinue(
      activeId,
      draftMessage,
      activeKnowledgeBaseSelection,
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
      requiresKnowledgeBaseSelection
    )
      return;
    const immediateMessage = {
      conversationId: activeId,
      content: draftMessage,
      knowledgeBaseSelection: activeKnowledgeBaseSelection,
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
    : localization.composerPlaceholder;
  const primaryActionLabel = conversationIsBusy
    ? localization.queueNext
    : localization.send;
  const isPrimaryActionDisabled =
    !activeId ||
    !hasActiveDraft ||
    isCancelling ||
    requiresKnowledgeBaseSelection ||
    (conversationIsBusy && Boolean(visibleQueuedMessage));
  const isSendNowDisabled =
    !activeId ||
    !hasActiveDraft ||
    !isStreaming ||
    isCancelling ||
    !activeRunId ||
    Boolean(visibleQueuedMessage) ||
    requiresKnowledgeBaseSelection;
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
    setActiveRunClock,
    setObservedServerActiveRun,
    setQueuedMessageState,
    setSelectedKnowledgeBaseIds,
    setShowGuestNotice,
    setStatusAnnouncement,
    shouldAutoScrollRef,
  });

  return (
    <>
      <ChatWorkspaceLayout
        activeId={activeId}
        activeRunId={activeRunId}
        chatScrollRef={chatScrollRef}
        composerPlaceholder={composerPlaceholder}
        conversation={conversation}
        conversationIsBusy={conversationIsBusy}
        conversations={conversations}
        createConversation={createConversation}
        deleteConversation={deleteConversation}
        draft={draft}
        events={visibleActivityEvents}
        hasActiveDraft={hasActiveDraft}
        isCancelling={isCancelling}
        isConversationBrowserOpen={isConversationBrowserOpen}
        isPrimaryActionDisabled={isPrimaryActionDisabled}
        isSendNowDisabled={isSendNowDisabled}
        isStreaming={isStreaming}
        knowledgeBaseMode={knowledgeBaseMode}
        knowledgeBases={knowledgeBases}
        lang={lang}
        latestAssistantMessageId={latestAssistantMessageId}
        localization={localization}
        messages={sortedMessages}
        messagesError={messages.error}
        onCancelQueuedMessage={handleCancelQueuedMessage}
        onChatScroll={handleChatScroll}
        onConversationBrowserOpenChange={setIsConversationBrowserOpen}
        onCreate={handleCreate}
        onDeleteConversation={requestDeleteConversation}
        onDraftChange={setDraft}
        onEditQueuedMessage={handleEditQueuedMessage}
        onKnowledgeBaseModeChange={setKnowledgeBaseMode}
        onReplayAssistantMessage={handleReplayAssistantMessage}
        onSelectConversation={setSelectedId}
        onSendNow={handleSendNow}
        onSendQueuedMessage={handleSendQueuedMessage}
        onSubmit={handleSend}
        onToggleKnowledgeBase={toggleSelectedKnowledgeBase}
        primaryActionLabel={primaryActionLabel}
        queuedHelper={queuedHelper}
        replayAssistantMessage={replayAssistantMessage}
        replayNotice={replayNotice}
        replayingMessageId={replayingMessageId}
        requiresKnowledgeBaseSelection={requiresKnowledgeBaseSelection}
        selectableKnowledgeBases={selectableKnowledgeBases}
        selectedKnowledgeBaseIds={selectedKnowledgeBaseIds}
        sendNowHelper={sendNowHelper}
        serverActiveRunIsStale={serverActiveRunIsStale}
        showGuestNotice={showGuestNotice}
        sortedRuns={sortedRuns}
        statusAnnouncement={statusAnnouncement}
        streamError={streamError}
        streamedReply={streamedReply}
        visibleCitations={visibleCitations}
        visibleQueuedMessage={visibleQueuedMessage}
      />
      <DeleteConversationAlertDialog
        conversation={conversationPendingDelete}
        error={deleteConversation.error}
        isPending={deleteConversation.isPending}
        localization={localization}
        onConfirm={(item) => void handleDeleteConversation(item)}
        onOpenChange={handleDeleteConversationDialogOpenChange}
        open={Boolean(conversationPendingDelete)}
      />
    </>
  );
}

"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import type {
  AgentEvent,
  AgentRunSummary,
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
import { AgentMessageRenderer } from "./AgentMessageRenderer";
import { inputClassName } from "./Field";
import { EmptyState, ErrorState, Pill } from "./Status";

type LiveActivityEvent = Pick<AgentEvent, "id" | "sequence" | "event_type"> & {
  payload: unknown;
};

type QueuedMessage = {
  conversationId: string;
  content: string;
  knowledgeBaseSelection: KnowledgeBaseSelection;
  optionalPersonalKnowledgeBaseIds: string[];
};

type RunOutcome = "completed" | "cancelled" | "failed";
type ChatMode = "personal" | "group";

const CHAT_BOTTOM_THRESHOLD_PX = 96;

export const CHAT_WORKSPACE_PANEL_CLASS_NAME =
  "cal-card flex h-[calc(100dvh-8rem)] min-h-0 min-w-0 flex-col overflow-hidden rounded-xl xl:h-full";
export const CHAT_SCROLL_REGION_CLASS_NAME = "min-h-0 flex-1 overflow-auto p-4";

type ChatLocalization = typeof import("@/localization/en.json")["chat"];

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

function MessageFooterDisclosure({
  title,
  ariaLabel,
  count,
  children,
}: {
  title: string;
  ariaLabel: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <details className="group/footer min-w-0 rounded-lg border border-cal-hairline bg-white/70 text-cal-ink open:bg-white">
      <summary
        aria-label={`${ariaLabel} (${count})`}
        className="flex min-h-8 cursor-pointer list-none items-center gap-1.5 px-2 text-[11px] font-semibold marker:hidden hover:text-cal-primary"
      >
        <span>{title}</span>
        <span className="rounded-full bg-cal-surface-soft px-1.5 py-0.5 text-[10px] text-cal-muted">
          {count}
        </span>
      </summary>
      <div className="border-t border-cal-hairline p-2">{children}</div>
    </details>
  );
}

function AssistantEvidenceFooter({
  localization,
  lang,
  isLatestAssistantMessage,
  isStreaming,
  replayButton,
  runs,
  events,
  citations,
}: {
  localization: ChatLocalization;
  lang: string;
  isLatestAssistantMessage: boolean;
  isStreaming: boolean;
  replayButton?: ReactNode;
  runs: AgentRunSummary[];
  events: Array<AgentEvent | LiveActivityEvent>;
  citations: Citation[];
}) {
  return (
    <fieldset
      aria-label={localization.messageFooterLabel}
      data-testid="assistant-message-footer"
      className="mt-3 border-t border-cal-hairline/70 pt-2"
    >
      <div className="flex flex-wrap items-start gap-2">
        {replayButton}
        {isLatestAssistantMessage || isStreaming ? (
          <>
            <MessageFooterDisclosure
              title={localization.runHistory}
              ariaLabel={localization.viewRunHistory}
              count={runs.length}
            >
              <div className="grid max-h-56 gap-2 overflow-auto pr-1">
                {runs.length === 0 ? (
                  <EmptyState
                    title={localization.noRunsTitle}
                    description={localization.noRunsDescription}
                  />
                ) : null}
                {runs.map((run) => (
                  <div
                    key={run.run_id}
                    className="rounded-lg border border-cal-hairline p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Pill
                        tone={run.status === "completed" ? "green" : "rose"}
                      >
                        {localization.runStatuses[
                          run.status as keyof typeof localization.runStatuses
                        ] ?? run.status}
                      </Pill>
                      <span className="text-xs text-cal-muted">
                        {new Date(run.created_at).toLocaleString(lang)}
                      </span>
                    </div>
                    <p className="mt-2 text-cal-muted">
                      {run.route_label ?? localization.unrouted}
                    </p>
                  </div>
                ))}
              </div>
            </MessageFooterDisclosure>
            <MessageFooterDisclosure
              title={localization.activityEvents}
              ariaLabel={localization.viewActivityEvents}
              count={events.length}
            >
              <div className="grid max-h-56 gap-2 overflow-auto pr-1">
                {events.length === 0 ? (
                  <EmptyState
                    title={localization.noEventsTitle}
                    description={localization.noEventsDescription}
                  />
                ) : null}
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-lg bg-cal-surface-soft p-3 text-sm"
                  >
                    <p className="break-words font-medium text-cal-ink">
                      {event.sequence}. {event.event_type}
                    </p>
                    <pre className="mt-2 max-h-40 overflow-auto rounded-xl border border-cal-hairline bg-white p-3 text-xs text-cal-muted">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </MessageFooterDisclosure>
            <MessageFooterDisclosure
              title={localization.latestCitations}
              ariaLabel={localization.viewLatestCitations}
              count={citations.length}
            >
              <div className="grid max-h-56 gap-2 overflow-auto pr-1">
                {citations.length === 0 ? (
                  <EmptyState
                    title={localization.noCitationsTitle}
                    description={localization.noCitationsDescription}
                  />
                ) : null}
                {citations.map((citation) => (
                  <div
                    key={citation.id}
                    className="rounded-lg bg-cal-surface-strong p-3 text-sm text-cal-ink"
                  >
                    <p className="font-medium">
                      {citation.source_filename ?? localization.documentLabel}{" "}
                      {citation.source_filename
                        ? citation.source_page
                          ? `p. ${citation.source_page}`
                          : ""
                        : citation.document_id.slice(0, 8)}
                    </p>
                    {citation.source_filename ? (
                      <p className="mt-1 text-xs text-cal-muted">
                        {localization.documentLabel}{" "}
                        {citation.document_id.slice(0, 8)}
                      </p>
                    ) : null}
                    {citation.knowledge_base_id ? (
                      <p className="mt-1 text-xs text-cal-muted">
                        {localization.knowledgeBaseLabel}{" "}
                        {citation.knowledge_base_id.slice(0, 8)}
                      </p>
                    ) : null}
                    <p className="mt-1 break-words text-cal-body">
                      {citation.snippet}
                    </p>
                  </div>
                ))}
              </div>
            </MessageFooterDisclosure>
          </>
        ) : (
          <p className="self-center text-xs leading-5 text-cal-muted">
            {localization.messageEvidenceUnavailable}
          </p>
        )}
      </div>
    </fieldset>
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

function describeKnowledgeBaseSelection(
  selection: KnowledgeBaseSelection,
  knowledgeBases: KnowledgeBase[],
  localization: {
    knowledgeSourceAll: string;
    knowledgeSourceQueuedSelected: string;
    knowledgeSourceQueuedFallback: string;
  },
) {
  if (selection.mode === "all") return localization.knowledgeSourceAll;
  const names = selection.knowledge_base_ids
    .map(
      (id) => knowledgeBases.find((kb) => kb.id === id)?.name ?? id.slice(0, 8),
    )
    .join(", ");
  return names
    ? localization.knowledgeSourceQueuedSelected.replace("{names}", names)
    : localization.knowledgeSourceQueuedFallback;
}

export function hasSourceContextMismatch({
  conversationGroupId,
  isGroupMode,
  selectedGroupId,
}: {
  conversationGroupId: string | null | undefined;
  isGroupMode: boolean;
  selectedGroupId?: string;
}) {
  const activeConversationGroupId = conversationGroupId ?? null;
  return isGroupMode
    ? activeConversationGroupId !== (selectedGroupId ?? null)
    : activeConversationGroupId !== null;
}

export function buildActiveKnowledgeBaseSelection({
  isGroupMode,
  knowledgeBaseMode,
  selectedKnowledgeBaseIds,
}: {
  isGroupMode: boolean;
  knowledgeBaseMode: KnowledgeBaseSelectionMode;
  selectedKnowledgeBaseIds: string[];
}): KnowledgeBaseSelection {
  if (isGroupMode) {
    return { mode: "all", knowledge_base_ids: [] };
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
  const latestRunId = sortedRuns[0]?.run_id;
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
  const [selectedGroupId, setSelectedGroupId] = useState<string>();
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
          !selectedGroupId ||
          (kb.scope === "group" && kb.group_id === selectedGroupId) ||
          (kb.scope === "personal" &&
            kb.published_group_ids.includes(selectedGroupId)),
      ),
    [knowledgeBases.data, selectedGroupId],
  );
  const optionalPrivateKnowledgeBases = useMemo(
    () =>
      personalKnowledgeBases.filter(
        (kb) =>
          !selectedGroupId || !kb.published_group_ids.includes(selectedGroupId),
      ),
    [personalKnowledgeBases, selectedGroupId],
  );
  const selectedGroup = groups.data?.find(
    (group) => group.id === selectedGroupId,
  );
  const isGroupMode = chatMode === "group";
  const groupContextRequired = isGroupMode && !selectedGroupId;
  const sourceContextMismatch = conversation.data
    ? hasSourceContextMismatch({
        conversationGroupId: conversation.data?.group_id,
        isGroupMode,
        selectedGroupId,
      })
    : false;
  const activeOptionalPersonalKnowledgeBaseIds = isGroupMode
    ? selectedPrivateKnowledgeBaseIds
    : [];
  const activeKnowledgeBaseSelection = buildActiveKnowledgeBaseSelection({
    isGroupMode,
    knowledgeBaseMode,
    selectedKnowledgeBaseIds,
  });
  const requiresKnowledgeBaseSelection =
    !isGroupMode &&
    knowledgeBaseMode === "selected" &&
    selectedKnowledgeBaseIds.length === 0;

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

  async function handleCreate() {
    if (isGroupMode && !selectedGroupId) {
      setStatusAnnouncement(localization.groupContextRequired);
      return;
    }
    try {
      const created = await createConversation.mutateAsync({
        title: `${localization.newConversationTitle} ${new Date().toLocaleString(lang)}`,
        group_id: isGroupMode ? selectedGroupId : null,
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

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !draftMessage ||
      !activeId ||
      isCancelling ||
      requiresKnowledgeBaseSelection ||
      groupContextRequired ||
      sourceContextMismatch
    ) {
      return;
    }

    if (isStreaming) {
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
      groupContextRequired ||
      sourceContextMismatch
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
    if (!visibleQueuedMessage || isStreaming) return;
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
      isStreaming ||
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
  const composerPlaceholder = isStreaming
    ? visibleQueuedMessage
      ? localization.queuedComposerPlaceholder
      : localization.streamingComposerPlaceholder
    : isGroupMode
      ? localization.groupComposerPlaceholder
      : localization.composerPlaceholder;
  const primaryActionLabel = isStreaming
    ? localization.queueNext
    : localization.send;
  const isPrimaryActionDisabled =
    !activeId ||
    !hasActiveDraft ||
    isCancelling ||
    requiresKnowledgeBaseSelection ||
    groupContextRequired ||
    sourceContextMismatch ||
    (isStreaming && Boolean(visibleQueuedMessage));
  const isSendNowDisabled =
    !activeId ||
    !hasActiveDraft ||
    !isStreaming ||
    isCancelling ||
    !activeRunId ||
    Boolean(visibleQueuedMessage) ||
    requiresKnowledgeBaseSelection ||
    groupContextRequired ||
    sourceContextMismatch;
  const sendNowHelper = isCancelling
    ? localization.stoppingCurrentAnswer
    : visibleQueuedMessage
      ? localization.sendNowQueuedBlocked
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
    if (conversation.data?.group_id) {
      setChatMode("group");
      setSelectedGroupId(conversation.data.group_id);
      return;
    }
    if (!selectedGroupId && groups.data?.[0]) {
      setSelectedGroupId(groups.data[0].id);
    }
  }, [
    conversation.data,
    conversation.data?.group_id,
    groups.data,
    selectedGroupId,
  ]);

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
      <aside className="cal-card min-w-0 rounded-xl p-4 xl:overflow-auto">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="cal-heading cal-fluid-title">
              {localization.title}
            </h1>
            <p className="mt-1 text-sm text-cal-muted">
              {localization.description}
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={createConversation.isPending || groupContextRequired}
            title={
              groupContextRequired
                ? localization.groupContextRequired
                : undefined
            }
          >
            {localization.newButton}
          </Button>
        </div>
        <div className="mt-5 grid gap-2">
          {conversations.error ? (
            <ErrorState error={conversations.error} />
          ) : null}
          {createConversation.error ? (
            <ErrorState error={createConversation.error} />
          ) : null}
          {deleteConversation.error ? (
            <ErrorState error={deleteConversation.error} />
          ) : null}
          {conversations.isLoading ? (
            <p className="text-sm text-cal-muted">
              {localization.loadingConversations}
            </p>
          ) : null}
          {conversations.data?.length === 0 ? (
            <EmptyState
              title={localization.noConversationsTitle}
              description={localization.noConversationsDescription}
            />
          ) : null}
          {conversations.data?.map((item) => {
            const isActiveConversation = activeId === item.id;
            const deleteDisabled =
              deleteConversation.isPending ||
              (isActiveConversation && (isStreaming || isCancelling));
            return (
              <div
                key={item.id}
                className={cn(
                  "group/conversation rounded-lg border p-2 transition hover:border-cal-hairline hover:bg-cal-surface-soft",
                  isActiveConversation
                    ? "border-cal-primary bg-cal-primary text-white"
                    : "border-cal-hairline bg-cal-canvas",
                )}
              >
                <div className="flex min-w-0 items-start gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className="min-w-0 flex-1 rounded-md p-1 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cal-primary"
                    aria-current={isActiveConversation ? "true" : undefined}
                  >
                    <span className="block break-words font-medium">
                      {item.title}
                    </span>
                    <span
                      className={cn(
                        "mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]",
                        isActiveConversation
                          ? "bg-white/15 text-white"
                          : "bg-cal-surface-soft text-cal-muted",
                      )}
                    >
                      {item.group_id
                        ? localization.groupConversationBadge
                        : localization.personalConversationBadge}
                    </span>
                    <span
                      className={cn(
                        "mt-1 block text-xs",
                        isActiveConversation
                          ? "text-white/70"
                          : "text-cal-muted",
                      )}
                    >
                      {item.id.slice(0, 8)}
                    </span>
                  </button>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    className={cn(
                      "mt-0.5",
                      isActiveConversation
                        ? "text-white hover:bg-white/15"
                        : "text-cal-muted hover:text-cal-error",
                    )}
                    onClick={() => handleDeleteConversation(item)}
                    disabled={deleteDisabled}
                    aria-label={localization.deleteConversationLabel.replace(
                      "{title}",
                      item.title,
                    )}
                    title={
                      deleteDisabled && isActiveConversation
                        ? localization.deleteConversationActiveRunDisabled
                        : localization.deleteConversationAction
                    }
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <div className="min-h-0 min-w-0 xl:h-full">
        <section
          data-testid="chat-workspace-panel"
          className={CHAT_WORKSPACE_PANEL_CLASS_NAME}
        >
          <header className="border-b border-cal-hairline p-4 sm:p-5">
            <p className="cal-label">{localization.activeConversationLabel}</p>
            <h2 className="mt-2 break-words text-lg font-medium text-cal-ink">
              {conversation.data?.title ??
                localization.selectOrCreateConversation}
            </h2>
          </header>
          <div
            ref={chatScrollRef}
            onScroll={handleChatScroll}
            data-testid="chat-scroll-region"
            className={CHAT_SCROLL_REGION_CLASS_NAME}
          >
            {!activeId ? (
              <EmptyState
                title={localization.noActiveConversationTitle}
                description={localization.noActiveConversationDescription}
              />
            ) : null}
            {messages.error ? <ErrorState error={messages.error} /> : null}
            <div className="grid gap-3">
              {sortedMessages.map((message) => {
                const isAssistant = message.role === "assistant";
                const isReplaying = replayingMessageId === message.id;
                const replayDisabled =
                  isStreaming ||
                  isCancelling ||
                  replayAssistantMessage.isPending;
                return (
                  <div
                    key={message.id}
                    className={cn(
                      "max-w-[88%] overflow-hidden rounded-xl border px-4 py-3 text-sm leading-6 sm:max-w-[78%]",
                      message.role === "user"
                        ? "ml-auto border-cal-primary bg-cal-primary text-white"
                        : "border-cal-hairline bg-cal-surface-soft text-cal-ink",
                    )}
                  >
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] opacity-60">
                      {localization.roles[
                        message.role as keyof typeof localization.roles
                      ] ?? message.role}
                    </p>
                    {isAssistant ? (
                      <AgentMessageRenderer content={message.content} />
                    ) : (
                      <p className="whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                    )}
                    {isAssistant ? (
                      <AssistantEvidenceFooter
                        localization={localization}
                        lang={lang}
                        isLatestAssistantMessage={
                          message.id === latestAssistantMessageId
                        }
                        isStreaming={false}
                        runs={sortedRuns}
                        events={visibleActivityEvents}
                        citations={visibleCitations}
                        replayButton={
                          <Button
                            type="button"
                            size="icon-lg"
                            variant="ghost"
                            className="min-h-11 min-w-11"
                            onClick={() =>
                              handleReplayAssistantMessage(message.id)
                            }
                            disabled={replayDisabled}
                            aria-busy={isReplaying}
                            aria-label={
                              isReplaying
                                ? localization.replayLoading
                                : localization.replayAction
                            }
                            title={
                              isReplaying
                                ? localization.replayLoading
                                : localization.replayAction
                            }
                          >
                            <RotateCcw
                              aria-hidden="true"
                              className={cn(isReplaying ? "animate-spin" : "")}
                            />
                          </Button>
                        }
                      />
                    ) : null}
                    {replayNotice?.messageId === message.id ? (
                      <p
                        className={cn(
                          "mt-3 rounded-lg border px-3 py-2 text-xs leading-5",
                          replayNotice.tone === "success"
                            ? "border-cal-success/20 bg-cal-success/10 text-cal-success"
                            : replayNotice.tone === "warning"
                              ? "border-cal-warning/25 bg-cal-warning/10 text-cal-ink"
                              : "border-cal-error/20 bg-cal-error/10 text-cal-error",
                        )}
                      >
                        {replayNotice.message}
                      </p>
                    ) : null}
                  </div>
                );
              })}
              {isStreaming || streamedReply ? (
                <div className="max-w-[88%] overflow-hidden rounded-xl border border-cal-hairline bg-cal-surface-soft px-4 py-3 text-sm leading-6 text-cal-ink sm:max-w-[78%]">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
                    {localization.roles.assistant}
                  </p>
                  {streamedReply ? (
                    <AgentMessageRenderer content={streamedReply} />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">
                      {localization.agentComposing}
                    </p>
                  )}
                  <AssistantEvidenceFooter
                    localization={localization}
                    lang={lang}
                    isLatestAssistantMessage={true}
                    isStreaming={isStreaming}
                    runs={sortedRuns}
                    events={visibleActivityEvents}
                    citations={visibleCitations}
                  />
                </div>
              ) : null}
            </div>
          </div>
          <form
            onSubmit={handleSend}
            className="border-t border-cal-hairline p-4"
          >
            <p className="sr-only" aria-live="polite">
              {statusAnnouncement}
            </p>
            {visibleQueuedMessage ? (
              <div className="mb-3 rounded-xl border border-cal-hairline bg-cal-surface-soft p-3 text-sm text-cal-body">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-cal-ink">
                      {localization.queuedTitle}
                    </p>
                    <p className="mt-1 max-h-20 overflow-hidden break-words text-cal-ink">
                      {visibleQueuedMessage.content}
                    </p>
                    <p className="mt-1 text-xs text-cal-muted">
                      {queuedHelper}
                    </p>
                    <p className="mt-1 text-xs text-cal-muted">
                      {describeKnowledgeBaseSelection(
                        visibleQueuedMessage.knowledgeBaseSelection,
                        knowledgeBases.data ?? [],
                        localization,
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {!isStreaming ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleSendQueuedMessage}
                      >
                        {localization.sendQueued}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleEditQueuedMessage}
                    >
                      {localization.editQueued}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelQueuedMessage}
                    >
                      {localization.cancelQueued}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
            <section className="mb-3 rounded-xl border border-cal-hairline bg-cal-surface-soft p-3 text-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-cal-ink">
                    {localization.knowledgeSourceTitle}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-cal-muted">
                    {isGroupMode
                      ? localization.groupKnowledgeSourceDescription
                      : localization.knowledgeSourceDescription}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={chatMode === "personal" ? "secondary" : "ghost"}
                    onClick={() => setChatMode("personal")}
                  >
                    {localization.personalChatMode}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={chatMode === "group" ? "secondary" : "ghost"}
                    onClick={() => setChatMode("group")}
                  >
                    {localization.groupChatMode}
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 rounded-xl border border-cal-hairline bg-cal-canvas p-3">
                <div className="flex flex-wrap gap-2">
                  <Pill tone={isGroupMode ? "blue" : "green"}>
                    {isGroupMode
                      ? localization.privateGroupTranscriptPill
                      : localization.personalTranscriptPill}
                  </Pill>
                  <Pill tone="slate">
                    {isGroupMode
                      ? localization.noSharedTranscriptPill
                      : localization.personalSourcesPill}
                  </Pill>
                </div>
                <p className="text-xs leading-5 text-cal-muted">
                  {isGroupMode
                    ? localization.groupChatBoundaryCopy
                    : localization.personalChatBoundaryCopy}
                </p>
              </div>
              {!isGroupMode ? (
                <div className="mt-3 grid gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        knowledgeBaseMode === "all" ? "secondary" : "ghost"
                      }
                      onClick={() => setKnowledgeBaseMode("all")}
                    >
                      {localization.knowledgeSourceAll}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        knowledgeBaseMode === "selected" ? "secondary" : "ghost"
                      }
                      onClick={() => setKnowledgeBaseMode("selected")}
                    >
                      {localization.knowledgeSourceSelected}
                    </Button>
                  </div>
                </div>
              ) : null}
              {!isGroupMode && knowledgeBaseMode === "selected" ? (
                <div className="mt-3 grid gap-2">
                  {knowledgeBases.isLoading ? (
                    <p className="text-xs text-cal-muted">
                      {localization.loadingKnowledgeBases}
                    </p>
                  ) : null}
                  {knowledgeBases.error ? (
                    <ErrorState error={knowledgeBases.error} />
                  ) : null}
                  {personalKnowledgeBases.length === 0 ? (
                    <EmptyState
                      title={localization.noKnowledgeBasesTitle}
                      description={localization.noKnowledgeBasesDescription}
                    />
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {personalKnowledgeBases.map((knowledgeBase) => {
                      const checked = selectedKnowledgeBaseIds.includes(
                        knowledgeBase.id,
                      );
                      return (
                        <label
                          key={knowledgeBase.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium",
                            checked
                              ? "border-cal-primary bg-cal-primary text-white"
                              : "border-cal-hairline bg-cal-canvas text-cal-ink",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            onChange={() =>
                              toggleSelectedKnowledgeBase(knowledgeBase.id)
                            }
                          />
                          {knowledgeBase.name}
                        </label>
                      );
                    })}
                  </div>
                  {requiresKnowledgeBaseSelection ? (
                    <p className="text-xs text-cal-error">
                      {localization.knowledgeSourceRequired}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {isGroupMode ? (
                <div className="mt-3 grid gap-3">
                  <label className="grid gap-1 text-xs font-medium text-cal-muted">
                    {localization.groupContextLabel}
                    <select
                      className={inputClassName}
                      value={selectedGroupId ?? ""}
                      onChange={(event) =>
                        setSelectedGroupId(event.target.value)
                      }
                    >
                      <option value="">
                        {localization.groupContextPlaceholder}
                      </option>
                      {groups.data?.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {groups.isLoading ? (
                    <p className="text-xs text-cal-muted">
                      {localization.loadingGroups}
                    </p>
                  ) : null}
                  {groups.error ? <ErrorState error={groups.error} /> : null}
                  <div className="rounded-xl border border-cal-hairline bg-cal-canvas p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-cal-ink">
                        {localization.mandatoryGroupKnowledgeTitle}
                      </p>
                      <Pill tone="blue">{localization.fixedSourcePill}</Pill>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-cal-muted">
                      {selectedGroup
                        ? localization.mandatoryGroupKnowledgeDescription.replace(
                            "{group}",
                            selectedGroup.name,
                          )
                        : localization.groupContextRequired}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {groupKnowledgeBases.length === 0 ? (
                        <span className="rounded-full border border-cal-hairline bg-cal-surface-soft px-3 py-2 text-xs text-cal-muted">
                          {localization.noGroupKnowledgeBases}
                        </span>
                      ) : null}
                      {groupKnowledgeBases.map((knowledgeBase) => (
                        <span
                          key={knowledgeBase.id}
                          className="rounded-full border border-cal-primary/20 bg-cal-primary/10 px-3 py-2 text-xs font-medium text-cal-ink"
                        >
                          {knowledgeBase.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-cal-hairline bg-cal-canvas p-3">
                    <p className="font-semibold text-cal-ink">
                      {localization.optionalPrivateKnowledgeTitle}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-cal-muted">
                      {localization.optionalPrivateKnowledgeDescription}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {optionalPrivateKnowledgeBases.length === 0 ? (
                        <span className="rounded-full border border-cal-hairline bg-cal-surface-soft px-3 py-2 text-xs text-cal-muted">
                          {localization.noPersonalKnowledgeBases}
                        </span>
                      ) : null}
                      {optionalPrivateKnowledgeBases.map((knowledgeBase) => {
                        const checked =
                          selectedPrivateKnowledgeBaseIds.includes(
                            knowledgeBase.id,
                          );
                        return (
                          <label
                            key={knowledgeBase.id}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium",
                              checked
                                ? "border-cal-brand-accent bg-cal-brand-accent/10 text-cal-ink"
                                : "border-cal-hairline bg-cal-surface-soft text-cal-muted",
                            )}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={checked}
                              onChange={() =>
                                togglePrivateKnowledgeBase(knowledgeBase.id)
                              }
                            />
                            {knowledgeBase.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <p className="rounded-lg border border-cal-primary/20 bg-cal-primary/10 p-3 text-xs leading-5 text-cal-body">
                    {localization.groupChatOpenApiPending}
                  </p>
                </div>
              ) : null}
            </section>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                className={cn(inputClassName, "min-h-12 w-full")}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={composerPlaceholder}
                disabled={!activeId || isCancelling}
                aria-describedby={
                  isStreaming ? "chat-steering-helper" : undefined
                }
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  className="w-full sm:w-auto"
                  type="submit"
                  size="lg"
                  disabled={isPrimaryActionDisabled}
                >
                  {primaryActionLabel}
                </Button>
                {isStreaming ? (
                  <Button
                    className="w-full sm:w-auto"
                    type="button"
                    size="lg"
                    variant="secondary"
                    onClick={handleSendNow}
                    disabled={isSendNowDisabled}
                    aria-describedby="chat-steering-helper"
                  >
                    {localization.sendNow}
                  </Button>
                ) : null}
              </div>
            </div>
            {isStreaming ? (
              <p
                id="chat-steering-helper"
                className="mt-2 text-xs leading-5 text-cal-muted"
              >
                {sendNowHelper}
              </p>
            ) : null}
            {groupContextRequired ? (
              <p className="mt-2 text-xs leading-5 text-cal-muted">
                {localization.groupContextRequired}
              </p>
            ) : null}
            {showGuestNotice && isStreaming ? (
              <p className="mt-1 text-xs leading-5 text-cal-muted">
                {localization.guestPromptLimitHelper}
              </p>
            ) : null}
            {streamError ? (
              <div className="mt-3">
                <ErrorState
                  title={localization.runFailed}
                  error={streamError}
                />
              </div>
            ) : null}
          </form>
        </section>
      </div>
    </div>
  );
}

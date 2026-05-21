"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import {
  useConversation,
  useConversations,
  useCreateConversation,
  useMessages,
  useRunDetail,
  useRunEvents,
  useRuns,
} from "@/hooks/use-conversations";
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from "@/lib/utils";
import type {
  AgentEvent,
  AnswerDeltaEventData,
  Citation,
  ConversationRunResponse,
  Message,
} from "@/model/my-agents";
import { myAgentsAPI } from "@/services/my-agents";
import { AgentMessageRenderer } from "./AgentMessageRenderer";
import { inputClassName } from "./Field";
import { EmptyState, ErrorState, Pill } from "./Status";

type LiveActivityEvent = Pick<AgentEvent, "id" | "sequence" | "event_type"> & {
  payload: unknown;
};

type QueuedMessage = {
  conversationId: string;
  content: string;
};

type RunOutcome = "completed" | "cancelled" | "failed";

const CHAT_BOTTOM_THRESHOLD_PX = 96;

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

export function ChatWorkspace() {
  const queryClient = useQueryClient();
  const conversations = useConversations();
  const createConversation = useCreateConversation();
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
  const [liveActivityEvents, setLiveActivityEvents] = useState<
    LiveActivityEvent[]
  >([]);
  const [optimisticMessage, setOptimisticMessage] = useState<Message | null>(
    null,
  );
  const [latestCitations, setLatestCitations] = useState<Citation[]>([]);
  const [showGuestNotice, setShowGuestNotice] = useState(false);
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

  async function handleCreate() {
    try {
      const created = await createConversation.mutateAsync({
        title: `${localization.newConversationTitle} ${new Date().toLocaleString(lang)}`,
      });
      setSelectedId(created.id);
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  async function runMessage(
    conversationId: string,
    message: string,
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
        { message },
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
  ): Promise<void> {
    const outcome = await runMessage(conversationId, message);

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
      );
    }
  }

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draftMessage || !activeId || isCancelling) return;

    if (isStreaming) {
      if (visibleQueuedMessage) {
        setStatusAnnouncement(localization.queueAlreadyExistsAnnouncement);
        return;
      }
      const nextQueuedMessage = {
        conversationId: activeId,
        content: draftMessage,
      };
      setQueuedMessage(nextQueuedMessage);
      setDraft("");
      setStatusAnnouncement(localization.queuedAnnouncement);
      return;
    }

    setDraft("");
    await runMessageAndContinue(activeId, draftMessage);
  }

  async function handleSendNow() {
    if (
      !activeId ||
      !draftMessage ||
      !isStreaming ||
      isCancelling ||
      !activeRunId ||
      visibleQueuedMessage
    ) {
      return;
    }

    const immediateMessage = {
      conversationId: activeId,
      content: draftMessage,
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
    );
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
  const autoScrollTrigger = `${sortedMessages.length}:${streamedReply.length}`;
  const composerPlaceholder = isStreaming
    ? visibleQueuedMessage
      ? localization.queuedComposerPlaceholder
      : localization.streamingComposerPlaceholder
    : localization.composerPlaceholder;
  const primaryActionLabel = isStreaming
    ? localization.queueNext
    : localization.send;
  const isPrimaryActionDisabled =
    !activeId ||
    !hasActiveDraft ||
    isCancelling ||
    (isStreaming && Boolean(visibleQueuedMessage));
  const isSendNowDisabled =
    !activeId ||
    !hasActiveDraft ||
    !isStreaming ||
    isCancelling ||
    !activeRunId ||
    Boolean(visibleQueuedMessage);
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
            disabled={createConversation.isPending}
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
          {conversations.data?.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition hover:border-cal-hairline hover:bg-cal-surface-soft",
                activeId === item.id
                  ? "border-cal-primary bg-cal-primary text-white"
                  : "border-cal-hairline bg-cal-canvas",
              )}
            >
              <span className="block break-words font-medium">
                {item.title}
              </span>
              <span
                className={cn(
                  "mt-1 block text-xs",
                  activeId === item.id ? "text-white/70" : "text-cal-muted",
                )}
              >
                {item.id.slice(0, 8)}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <div className="grid min-h-0 min-w-0 gap-4 xl:grid-rows-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
        <section className="cal-card flex min-h-[32rem] min-w-0 flex-col rounded-xl xl:min-h-0">
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
            className="min-h-0 flex-1 overflow-auto p-4"
          >
            {!activeId ? (
              <EmptyState
                title={localization.noActiveConversationTitle}
                description={localization.noActiveConversationDescription}
              />
            ) : null}
            {messages.error ? <ErrorState error={messages.error} /> : null}
            <div className="grid gap-3">
              {sortedMessages.map((message) => (
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
                  {message.role === "assistant" ? (
                    <AgentMessageRenderer content={message.content} />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  )}
                </div>
              ))}
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

        <aside className="grid min-h-0 min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-[minmax(17rem,0.9fr)_minmax(24rem,1.45fr)_minmax(17rem,0.9fr)]">
          <section className="cal-card min-h-0 rounded-xl p-4 xl:overflow-auto">
            <h2 className="font-medium text-cal-ink">
              {localization.runHistory}
            </h2>
            <div className="mt-3 grid gap-2">
              {sortedRuns.length === 0 ? (
                <EmptyState
                  title={localization.noRunsTitle}
                  description={localization.noRunsDescription}
                />
              ) : null}
              {sortedRuns.map((run) => (
                <div
                  key={run.run_id}
                  className="rounded-lg border border-cal-hairline p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Pill tone={run.status === "completed" ? "green" : "rose"}>
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
          </section>
          <section className="cal-card min-h-0 rounded-xl p-4 md:col-span-2 xl:overflow-auto 2xl:col-span-1">
            <h2 className="font-medium text-cal-ink">
              {localization.activityEvents}
            </h2>
            <div className="mt-3 grid gap-2">
              {visibleActivityEvents.length === 0 ||
              (!latestRunId && !isStreaming) ? (
                <EmptyState
                  title={localization.noEventsTitle}
                  description={localization.noEventsDescription}
                />
              ) : null}
              {visibleActivityEvents.map((event) => (
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
          </section>
          <section className="cal-card min-h-0 rounded-xl p-4 xl:overflow-auto">
            <h2 className="font-medium text-cal-ink">
              {localization.latestCitations}
            </h2>
            <div className="mt-3 grid gap-2">
              {visibleCitations.length === 0 ? (
                <EmptyState
                  title={localization.noCitationsTitle}
                  description={localization.noCitationsDescription}
                />
              ) : null}
              {visibleCitations.map((citation) => (
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
                  <p className="mt-1 break-words text-cal-body">
                    {citation.snippet}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

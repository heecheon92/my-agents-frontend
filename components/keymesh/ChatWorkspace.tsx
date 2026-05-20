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
import { inputClassName } from "./Field";
import { EmptyState, ErrorState, Pill } from "./Status";

type LiveActivityEvent = Pick<AgentEvent, "id" | "sequence" | "event_type"> & {
  payload: unknown;
};

const CHAT_BOTTOM_THRESHOLD_PX = 96;

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
  const [streamError, setStreamError] = useState<unknown>(null);
  const [streamedReply, setStreamedReply] = useState("");
  const [liveActivityEvents, setLiveActivityEvents] = useState<
    LiveActivityEvent[]
  >([]);
  const [optimisticMessage, setOptimisticMessage] = useState<Message | null>(
    null,
  );
  const [latestCitations, setLatestCitations] = useState<Citation[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const { lang, localization } = useLocalization(
    (state) => state.localization.chat,
  );

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

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || !activeId) return;
    setDraft("");
    setIsStreaming(true);
    setStreamError(null);
    setStreamedReply("");
    setLiveActivityEvents([]);
    setLatestCitations([]);
    setOptimisticMessage({
      id: `optimistic-${Date.now()}`,
      conversation_id: activeId,
      role: "user",
      content: message,
    });

    let completed = false;
    let liveSequence = 0;
    try {
      for await (const streamEvent of myAgentsAPI.conversations.streamRunEvents(
        activeId,
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

        if (streamEvent.event === "answer_delta") {
          const data = streamEvent.data as AnswerDeltaEventData;
          setStreamedReply((current) => current + data.delta);
        }
        if (streamEvent.event === "run_completed") {
          const data = streamEvent.data as ConversationRunResponse;
          completed = true;
          setStreamedReply(data.reply);
          setLatestCitations(data.citations ?? []);
        }
        if (streamEvent.event === "run_failed") {
          throw new Error(localization.runFailed);
        }
      }

      if (!completed) throw new Error(localization.runFailed);

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: MyAgentsQueryKeys.conversations.messages(activeId),
        }),
        queryClient.invalidateQueries({
          queryKey: MyAgentsQueryKeys.conversations.runs(activeId),
        }),
      ]);
      setOptimisticMessage(null);
      setStreamedReply("");
    } catch (error) {
      setStreamError(error);
    } finally {
      setIsStreaming(false);
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
  const autoScrollTrigger = `${sortedMessages.length}:${streamedReply.length}`;

  function handleChatScroll() {
    const scrollElement = chatScrollRef.current;
    if (!scrollElement) return;
    shouldAutoScrollRef.current = isNearScrollBottom(scrollElement);
  }

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
                  <p className="whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                </div>
              ))}
              {isStreaming || streamedReply ? (
                <div className="max-w-[88%] overflow-hidden rounded-xl border border-cal-hairline bg-cal-surface-soft px-4 py-3 text-sm leading-6 text-cal-ink sm:max-w-[78%]">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
                    {localization.roles.assistant}
                  </p>
                  <p className="whitespace-pre-wrap break-words">
                    {streamedReply || localization.agentComposing}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
          <form
            onSubmit={handleSend}
            className="border-t border-cal-hairline p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                className={cn(inputClassName, "min-h-12 flex-1")}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={localization.composerPlaceholder}
                disabled={!activeId || isStreaming}
              />
              <Button
                className="w-full sm:w-auto"
                type="submit"
                size="lg"
                disabled={!activeId || !draft.trim() || isStreaming}
              >
                {localization.send}
              </Button>
            </div>
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
                    {localization.documentLabel}{" "}
                    {citation.document_id.slice(0, 8)}
                  </p>
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

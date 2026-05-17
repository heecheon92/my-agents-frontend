"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  useConversation,
  useConversations,
  useCreateConversation,
  useMessages,
  useRunConversation,
  useRunEvents,
  useRuns,
} from "@/hooks/use-conversations";
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from "@/lib/utils";
import { inputClassName } from "./Field";
import { EmptyState, ErrorState, Pill } from "./Status";

export function ChatWorkspace() {
  const conversations = useConversations();
  const createConversation = useCreateConversation();
  const [selectedId, setSelectedId] = useState<string>();
  const activeId = selectedId ?? conversations.data?.[0]?.id;
  const conversation = useConversation(activeId);
  const messages = useMessages(activeId);
  const runs = useRuns(activeId);
  const latestRunId = runs.data?.[0]?.run_id;
  const events = useRunEvents(activeId, latestRunId);
  const runConversation = useRunConversation(activeId);
  const [draft, setDraft] = useState("");
  const latestCitations = runConversation.data?.citations ?? [];
  const { lang, localization } = useLocalization(
    (state) => state.localization.chat,
  );

  async function handleCreate() {
    const created = await createConversation.mutateAsync({
      title: `${localization.newConversationTitle} ${new Date().toLocaleString(lang)}`,
    });
    setSelectedId(created.id);
  }

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || !activeId) return;
    setDraft("");
    await runConversation.mutateAsync({ message });
  }

  const sortedMessages = useMemo(() => messages.data ?? [], [messages.data]);

  return (
    <div className="grid gap-4 xl:h-[calc(100dvh-8rem)] xl:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)_minmax(18rem,21.25rem)]">
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

      <section className="cal-card flex min-h-[32rem] min-w-0 flex-col rounded-xl xl:min-h-0">
        <header className="border-b border-cal-hairline p-4 sm:p-5">
          <p className="cal-label">{localization.activeConversationLabel}</p>
          <h2 className="mt-2 break-words text-lg font-medium text-cal-ink">
            {conversation.data?.title ??
              localization.selectOrCreateConversation}
          </h2>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-4">
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
            {runConversation.isPending ? (
              <div className="max-w-[88%] rounded-xl border border-cal-hairline bg-cal-surface-soft px-4 py-3 text-sm text-cal-muted sm:max-w-[78%]">
                {localization.agentComposing}
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
              disabled={!activeId || runConversation.isPending}
            />
            <Button
              className="w-full sm:w-auto"
              type="submit"
              size="lg"
              disabled={!activeId || !draft.trim() || runConversation.isPending}
            >
              {localization.send}
            </Button>
          </div>
          {runConversation.error ? (
            <div className="mt-3">
              <ErrorState
                title={localization.runFailed}
                error={runConversation.error}
              />
            </div>
          ) : null}
        </form>
      </section>

      <aside className="grid min-h-0 min-w-0 gap-4 xl:overflow-auto">
        <section className="cal-card rounded-xl p-4">
          <h2 className="font-medium text-cal-ink">
            {localization.runHistory}
          </h2>
          <div className="mt-3 grid gap-2">
            {runs.data?.length === 0 ? (
              <EmptyState
                title={localization.noRunsTitle}
                description={localization.noRunsDescription}
              />
            ) : null}
            {runs.data?.map((run) => (
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
        <section className="cal-card rounded-xl p-4">
          <h2 className="font-medium text-cal-ink">
            {localization.activityEvents}
          </h2>
          <div className="mt-3 grid gap-2">
            {events.data?.length === 0 || !latestRunId ? (
              <EmptyState
                title={localization.noEventsTitle}
                description={localization.noEventsDescription}
              />
            ) : null}
            {events.data?.map((event) => (
              <div
                key={event.id}
                className="rounded-lg bg-cal-surface-soft p-3 text-sm"
              >
                <p className="font-medium text-cal-ink">
                  {event.sequence}. {event.event_type}
                </p>
                <pre className="mt-2 max-h-28 overflow-auto rounded-xl border border-cal-hairline bg-white p-2 text-xs text-cal-muted">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </section>
        <section className="cal-card rounded-xl p-4">
          <h2 className="font-medium text-cal-ink">
            {localization.latestCitations}
          </h2>
          <div className="mt-3 grid gap-2">
            {latestCitations.length === 0 ? (
              <EmptyState
                title={localization.noCitationsTitle}
                description={localization.noCitationsDescription}
              />
            ) : null}
            {latestCitations.map((citation) => (
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
  );
}

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

  async function handleCreate() {
    const created = await createConversation.mutateAsync({
      title: `Conversation ${new Date().toLocaleString()}`,
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
    <div className="grid h-[calc(100dvh-4rem)] gap-4 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
      <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Chat</h1>
            <p className="text-sm text-slate-500">
              Conversation-run product surface.
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={createConversation.isPending}
          >
            New
          </Button>
        </div>
        <div className="mt-4 grid gap-2">
          {conversations.error ? (
            <ErrorState error={conversations.error} />
          ) : null}
          {conversations.isLoading ? (
            <p className="text-sm text-slate-500">Loading conversations...</p>
          ) : null}
          {conversations.data?.length === 0 ? (
            <EmptyState
              title="No conversations"
              description="Create a conversation to begin."
            />
          ) : null}
          {conversations.data?.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className={cn(
                "rounded-2xl border p-3 text-left text-sm transition hover:border-slate-300 hover:bg-slate-50",
                activeId === item.id
                  ? "border-slate-900 bg-slate-950 text-white"
                  : "border-slate-200 bg-white",
              )}
            >
              <span className="block font-medium">{item.title}</span>
              <span
                className={cn(
                  "mt-1 block text-xs",
                  activeId === item.id ? "text-slate-300" : "text-slate-500",
                )}
              >
                {item.id.slice(0, 8)}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col rounded-3xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 p-4">
          <p className="text-sm text-slate-500">Active conversation</p>
          <h2 className="text-lg font-semibold">
            {conversation.data?.title ?? "Select or create a conversation"}
          </h2>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {!activeId ? (
            <EmptyState
              title="No active conversation"
              description="Create a conversation to unlock the chat composer."
            />
          ) : null}
          {messages.error ? <ErrorState error={messages.error} /> : null}
          <div className="grid gap-3">
            {sortedMessages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[78%] rounded-3xl px-4 py-3 text-sm leading-6",
                  message.role === "user"
                    ? "ml-auto bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-900",
                )}
              >
                <p className="mb-1 text-xs uppercase tracking-wide opacity-60">
                  {message.role}
                </p>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            ))}
            {runConversation.isPending ? (
              <div className="max-w-[78%] rounded-3xl bg-slate-100 px-4 py-3 text-sm text-slate-500">
                Agent is composing...
              </div>
            ) : null}
          </div>
        </div>
        <form onSubmit={handleSend} className="border-t border-slate-200 p-4">
          <div className="flex gap-3">
            <input
              className={cn(inputClassName, "min-h-12 flex-1")}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask the assistant through /conversations/{id}/runs..."
              disabled={!activeId || runConversation.isPending}
            />
            <Button
              type="submit"
              size="lg"
              disabled={!activeId || !draft.trim() || runConversation.isPending}
            >
              Send
            </Button>
          </div>
          {runConversation.error ? (
            <div className="mt-3">
              <ErrorState title="Run failed" error={runConversation.error} />
            </div>
          ) : null}
        </form>
      </section>

      <aside className="grid min-h-0 gap-4 overflow-auto">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Run history</h2>
          <div className="mt-3 grid gap-2">
            {runs.data?.length === 0 ? (
              <EmptyState
                title="No runs"
                description="Send a message to create the first run."
              />
            ) : null}
            {runs.data?.map((run) => (
              <div
                key={run.run_id}
                className="rounded-2xl border border-slate-200 p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <Pill tone={run.status === "completed" ? "green" : "rose"}>
                    {run.status}
                  </Pill>
                  <span className="text-xs text-slate-500">
                    {new Date(run.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 text-slate-600">
                  {run.route_label ?? "unrouted"}
                </p>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Activity events</h2>
          <div className="mt-3 grid gap-2">
            {events.data?.length === 0 || !latestRunId ? (
              <EmptyState
                title="No events"
                description="Latest run events will appear here."
              />
            ) : null}
            {events.data?.map((event) => (
              <div
                key={event.id}
                className="rounded-2xl bg-slate-50 p-3 text-sm"
              >
                <p className="font-medium">
                  {event.sequence}. {event.event_type}
                </p>
                <pre className="mt-2 max-h-28 overflow-auto rounded-xl bg-white p-2 text-xs text-slate-600">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Latest citations</h2>
          <div className="mt-3 grid gap-2">
            {latestCitations.length === 0 ? (
              <EmptyState
                title="No citations"
                description="RAG citations appear when retrieved context is used."
              />
            ) : null}
            {latestCitations.map((citation) => (
              <div
                key={citation.id}
                className="rounded-2xl bg-blue-50 p-3 text-sm text-blue-950"
              >
                <p className="font-medium">
                  Document {citation.document_id.slice(0, 8)}
                </p>
                <p className="mt-1 text-blue-800">{citation.snippet}</p>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

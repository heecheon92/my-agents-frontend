"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { OnboardingTarget } from "@/components/onboarding/OnboardingTarget";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type {
  AgentRunSummary,
  Citation,
  Conversation,
  KnowledgeBase,
  Message,
  ReasoningEffort,
} from "@/model/my-agents";
import type { Localization } from "@/utils/localization";
import { ChatTranscript } from "./ChatTranscript";
import { ComposerBar } from "./ComposerBar";
import { NEW_CHAT_HREF } from "./chat-routes";
import type { ResolvedReasoning } from "./reasoning-selection";
import type { LiveActivityEvent, QueuedMessage } from "./types";

/**
 * No viewport math. `ServiceShell` bounds the content region for this route, so
 * `h-full` is the whole height contract.
 *
 * The old value was `h-[calc(100dvh-8rem)]`, which subtracted a 64px header
 * plus 64px of padding — but the shell's padding is `p-4` (16px) at mobile,
 * `sm:p-6`, `lg:p-8`. The panel was therefore ~32px shorter than the viewport
 * allowed at exactly the narrow widths that were already broken.
 */
export const CHAT_WORKSPACE_PANEL_CLASS_NAME =
  "cal-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-card";

type ChatWorkspaceLayoutProps = {
  activeId?: string;
  activeRunId: string | null;
  chatScrollRef: React.RefObject<HTMLDivElement | null>;
  composerPlaceholder: string;
  conversation: { data?: Conversation };
  conversationIsBusy: boolean;
  draft: string;
  events: LiveActivityEvent[];
  hasActiveDraft: boolean;
  isCancelling: boolean;
  isPrimaryActionDisabled: boolean;
  isSendNowDisabled: boolean;
  isStreaming: boolean;
  knowledgeBaseMode: "all" | "selected";
  knowledgeBases: {
    data?: KnowledgeBase[];
    isLoading: boolean;
    error: unknown;
  };
  lang: string;
  latestAssistantMessageId?: string;
  localization: Localization["chat"];
  messages: Message[];
  messagesError: unknown;
  onCancelQueuedMessage: () => void;
  onChatScroll: () => void;
  onDraftChange: (draft: string) => void;
  onEditQueuedMessage: () => void;
  onKnowledgeBaseModeChange: (mode: "all" | "selected") => void;
  onReplayAssistantMessage: (messageId: string) => void;
  onSendNow: () => void;
  onSendQueuedMessage: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onToggleKnowledgeBase: (knowledgeBaseId: string) => void;
  primaryActionLabel: string;
  queuedHelper: string;
  pendingInteractionSlot?: React.ReactNode;
  replayAssistantMessage: { isPending: boolean };
  replayNotice: {
    messageId: string;
    message: string;
    tone: "error" | "success" | "warning";
  } | null;
  replayingMessageId: string | null;
  requiresKnowledgeBaseSelection: boolean;
  selectedKnowledgeBaseIds: string[];
  sendNowHelper: string;
  serverActiveRunIsStale: boolean;
  showGuestNotice: boolean;
  reasoning: ResolvedReasoning;
  onReasoningModeChange: (next: "standard" | "pro") => void;
  onReasoningEffortChange: (next: ReasoningEffort) => void;
  sortedRuns: AgentRunSummary[];
  statusAnnouncement: string;
  streamError: unknown;
  streamedReply: string;
  visibleCitations: Citation[];
  visibleConsultedSources: Citation[] | null;
  visibleQueuedMessage: QueuedMessage | null;
};

export function ChatWorkspaceLayout({
  activeId,
  chatScrollRef,
  composerPlaceholder,
  conversation,
  conversationIsBusy,
  draft,
  events,
  isCancelling,
  isPrimaryActionDisabled,
  isSendNowDisabled,
  isStreaming,
  knowledgeBaseMode,
  knowledgeBases,
  lang,
  latestAssistantMessageId,
  localization,
  messages,
  messagesError,
  onCancelQueuedMessage,
  onChatScroll,
  onDraftChange,
  onEditQueuedMessage,
  onKnowledgeBaseModeChange,
  onReplayAssistantMessage,
  onSendNow,
  onSendQueuedMessage,
  onSubmit,
  onToggleKnowledgeBase,
  primaryActionLabel,
  queuedHelper,
  pendingInteractionSlot,
  replayAssistantMessage,
  replayNotice,
  replayingMessageId,
  requiresKnowledgeBaseSelection,
  selectedKnowledgeBaseIds,
  sendNowHelper,
  serverActiveRunIsStale,
  showGuestNotice,
  reasoning,
  onReasoningModeChange,
  onReasoningEffortChange,
  sortedRuns,
  statusAnnouncement,
  streamError,
  streamedReply,
  visibleCitations,
  visibleConsultedSources,
  visibleQueuedMessage,
}: ChatWorkspaceLayoutProps) {
  const isMobile = useIsMobile();
  const composerRef = useRef<HTMLDivElement>(null);
  const [composerHeight, setComposerHeight] = useState(0);

  /**
   * The composer overlays the transcript, so the transcript has to reserve its
   * height as padding. Measured, not guessed: the composer grows with the
   * draft, with a queued-message card, and with error copy, and a fixed inset
   * would either hide the last message or leave a permanent gap.
   */
  useEffect(() => {
    const node = composerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      // `offsetHeight`, not `contentRect`: the border box is what actually
      // covers the transcript.
      setComposerHeight(node.offsetHeight);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Outside the grid: inside it, this banner competed for the fixed
          height and pushed the transcript around unpredictably. */}
      {showGuestNotice ? (
        <div className="shrink-0 rounded-control border border-cal-warning/25 bg-cal-warning/10 px-3 py-2.5 text-sm text-cal-body">
          <p className="font-semibold leading-5 text-cal-ink">
            {localization.guestNoticeTitle}
          </p>
          <p className="mt-0.5 leading-5">
            {localization.guestNoticeDescription}
          </p>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1">
        <div className="min-h-0 min-w-0">
          {/* `relative`: the composer is positioned against this panel. */}
          <section
            data-testid="chat-workspace-panel"
            className={cn("relative", CHAT_WORKSPACE_PANEL_CLASS_NAME)}
          >
            <header className="flex shrink-0 items-start gap-3 border-b border-cal-hairline p-4 sm:p-5">
              <div className="min-w-0 flex-1">
                {/* The route's h1 lives here rather than in the conversation
                    history, which is inside a closed sheet on mobile. */}
                <h1 className="cal-label">{localization.title}</h1>
                <p className="mt-1 break-words text-lg font-medium text-cal-ink">
                  {conversation.data?.title ?? localization.newChatTitle}
                </p>
              </div>
              {/*
                Below 768px the whole shell sidebar — and with it the new-chat
                button that normally carries this spotlight target — is inside a
                closed Sheet, so the target would never register. A real
                conditional render, not `md:hidden`: a hidden-but-mounted
                element would register a target the tour cannot point at.

                Same id on purpose. `registerTarget` is last-write-wins and the
                two buttons never coexist, so a resize across the breakpoint
                sequences unregister-then-register in either direction.
              */}
              {isMobile ? (
                <OnboardingTarget id="chat.new-conversation">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="shrink-0"
                    aria-label={localization.newButton}
                    title={localization.newButton}
                    // Base UI needs telling this is not a native <button>, or
                    // it warns that the button semantics were dropped.
                    nativeButton={false}
                    render={<Link href={NEW_CHAT_HREF} />}
                  >
                    <PlusIcon aria-hidden="true" />
                  </Button>
                </OnboardingTarget>
              ) : null}
            </header>
            <ChatTranscript
              localization={localization}
              lang={lang}
              activeId={activeId}
              messagesError={messagesError}
              messages={messages}
              conversationIsBusy={conversationIsBusy}
              streamedReply={streamedReply}
              serverActiveRunIsStale={serverActiveRunIsStale}
              sortedRuns={sortedRuns}
              visibleActivityEvents={events}
              visibleCitations={visibleCitations}
              visibleConsultedSources={visibleConsultedSources}
              latestAssistantMessageId={latestAssistantMessageId}
              replayingMessageId={replayingMessageId}
              replayDisabled={
                conversationIsBusy ||
                isCancelling ||
                replayAssistantMessage.isPending
              }
              replayNotice={replayNotice}
              chatScrollRef={chatScrollRef}
              onChatScroll={onChatScroll}
              onReplayAssistantMessage={onReplayAssistantMessage}
              bottomInset={composerHeight}
            />
            {/*
              Overlaid, not stacked. The transcript now runs the full height of
              the panel and messages scroll *behind* the composer, so the
              composer reads as floating on the conversation rather than as a
              footer bolted under it. The transcript reserves `composerHeight`
              as scrollable padding, so nothing is unreachable — the last
              message still scrolls clear.
            */}
            <div
              ref={composerRef}
              className="pointer-events-none absolute inset-x-0 bottom-0"
            >
              <OnboardingTarget id="chat.composer">
                <ComposerBar
                  localization={localization}
                  draft={draft}
                  onDraftChange={onDraftChange}
                  onSubmit={onSubmit}
                  visibleQueuedMessage={visibleQueuedMessage}
                  queuedHelper={queuedHelper}
                  pendingInteractionSlot={pendingInteractionSlot}
                  knowledgeBases={knowledgeBases.data ?? []}
                  conversationIsBusy={conversationIsBusy}
                  isCancelling={isCancelling}
                  isPrimaryActionDisabled={isPrimaryActionDisabled}
                  primaryActionLabel={primaryActionLabel}
                  isStreaming={isStreaming}
                  isSendNowDisabled={isSendNowDisabled}
                  onSendNow={onSendNow}
                  sendNowHelper={sendNowHelper}
                  showGuestNotice={showGuestNotice}
                  reasoning={reasoning}
                  onReasoningModeChange={onReasoningModeChange}
                  onReasoningEffortChange={onReasoningEffortChange}
                  knowledgeBaseMode={knowledgeBaseMode}
                  onKnowledgeBaseModeChange={onKnowledgeBaseModeChange}
                  selectedKnowledgeBaseIds={selectedKnowledgeBaseIds}
                  knowledgeBasesLoading={knowledgeBases.isLoading}
                  knowledgeBasesError={knowledgeBases.error}
                  requiresKnowledgeBaseSelection={
                    requiresKnowledgeBaseSelection
                  }
                  onToggleKnowledgeBase={onToggleKnowledgeBase}
                  streamError={streamError}
                  statusAnnouncement={statusAnnouncement}
                  onSendQueuedMessage={onSendQueuedMessage}
                  onEditQueuedMessage={onEditQueuedMessage}
                  onCancelQueuedMessage={onCancelQueuedMessage}
                  composerPlaceholder={composerPlaceholder}
                />
              </OnboardingTarget>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

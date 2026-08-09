"use client";

import { PanelLeftIcon } from "lucide-react";
import { OnboardingTarget } from "@/components/onboarding/OnboardingTarget";
import { Button } from "@/components/ui/button";
import type {
  AgentRunSummary,
  Citation,
  Conversation,
  KnowledgeBase,
  Message,
} from "@/model/my-agents";
import type { Localization } from "@/utils/localization";
import { ChatTranscript } from "./ChatTranscript";
import { ComposerBar } from "./ComposerBar";
import { ConversationBrowserSheet } from "./ConversationBrowserSheet";
import { ConversationSidebar } from "./ConversationSidebar";
import { KnowledgeSourceSelector } from "./KnowledgeSourceSelector";
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
  conversations: { data?: Conversation[]; isLoading: boolean; error: unknown };
  createConversation: { error: unknown; isPending: boolean };
  deleteConversation: { error: unknown; isPending: boolean };
  draft: string;
  events: LiveActivityEvent[];
  hasActiveDraft: boolean;
  isCancelling: boolean;
  isPrimaryActionDisabled: boolean;
  isSendNowDisabled: boolean;
  isConversationBrowserOpen: boolean;
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
  onConversationBrowserOpenChange: (open: boolean) => void;
  onCreate: () => void;
  onDeleteConversation: (item: Conversation) => void;
  onDraftChange: (draft: string) => void;
  onEditQueuedMessage: () => void;
  onKnowledgeBaseModeChange: (mode: "all" | "selected") => void;
  onReplayAssistantMessage: (messageId: string) => void;
  onSelectConversation: (id: string) => void;
  onSendNow: () => void;
  onSendQueuedMessage: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onToggleKnowledgeBase: (knowledgeBaseId: string) => void;
  primaryActionLabel: string;
  queuedHelper: string;
  replayAssistantMessage: { isPending: boolean };
  replayNotice: {
    messageId: string;
    message: string;
    tone: "error" | "success" | "warning";
  } | null;
  replayingMessageId: string | null;
  requiresKnowledgeBaseSelection: boolean;
  selectableKnowledgeBases: KnowledgeBase[];
  selectedKnowledgeBaseIds: string[];
  sendNowHelper: string;
  serverActiveRunIsStale: boolean;
  showGuestNotice: boolean;
  sortedRuns: AgentRunSummary[];
  statusAnnouncement: string;
  streamError: unknown;
  streamedReply: string;
  visibleCitations: Citation[];
  visibleQueuedMessage: QueuedMessage | null;
};

export function ChatWorkspaceLayout({
  activeId,
  chatScrollRef,
  composerPlaceholder,
  conversation,
  conversationIsBusy,
  conversations,
  createConversation,
  deleteConversation,
  draft,
  events,
  isCancelling,
  isConversationBrowserOpen,
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
  onConversationBrowserOpenChange,
  onCreate,
  onDeleteConversation,
  onDraftChange,
  onEditQueuedMessage,
  onKnowledgeBaseModeChange,
  onReplayAssistantMessage,
  onSelectConversation,
  onSendNow,
  onSendQueuedMessage,
  onSubmit,
  onToggleKnowledgeBase,
  primaryActionLabel,
  queuedHelper,
  replayAssistantMessage,
  replayNotice,
  replayingMessageId,
  requiresKnowledgeBaseSelection,
  selectableKnowledgeBases,
  selectedKnowledgeBaseIds,
  sendNowHelper,
  serverActiveRunIsStale,
  showGuestNotice,
  sortedRuns,
  statusAnnouncement,
  streamError,
  streamedReply,
  visibleCitations,
  visibleQueuedMessage,
}: ChatWorkspaceLayoutProps) {
  const conversationListProps = {
    localization,
    conversations: conversations.data,
    activeId,
    isLoading: conversations.isLoading,
    error: conversations.error,
    createError: createConversation.error,
    deleteError: deleteConversation.error,
    isDeletePending: deleteConversation.isPending,
    conversationIsBusy,
    isCancelling,
    onSelect: onSelectConversation,
    onDelete: onDeleteConversation,
  };

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

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
        {/* Desktop rail. Below `xl` the same component renders inside the
            sheet, so it is not merely hidden here. */}
        <ConversationSidebar
          {...conversationListProps}
          className="cal-card hidden rounded-card p-4 xl:flex"
        />
        <ConversationBrowserSheet
          {...conversationListProps}
          open={isConversationBrowserOpen}
          onOpenChange={onConversationBrowserOpenChange}
        />

        <div className="min-h-0 min-w-0">
          <section
            data-testid="chat-workspace-panel"
            className={CHAT_WORKSPACE_PANEL_CLASS_NAME}
          >
            <header className="grid shrink-0 gap-3 border-b border-cal-hairline p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="shrink-0 xl:hidden"
                  onClick={() => onConversationBrowserOpenChange(true)}
                  aria-label={localization.browseConversationsAction}
                  title={localization.browseConversationsAction}
                >
                  <PanelLeftIcon aria-hidden="true" />
                </Button>
                <div className="min-w-0 flex-1">
                  {/* The route's h1 lives here rather than in the conversation
                      list, which is inside a closed sheet below `xl`. */}
                  <h1 className="cal-label">{localization.title}</h1>
                  <p className="mt-1 break-words text-lg font-medium text-cal-ink">
                    {conversation.data?.title ??
                      localization.selectOrCreateConversation}
                  </p>
                </div>
                <OnboardingTarget id="chat.new-conversation">
                  <Button
                    size="sm"
                    className="shrink-0"
                    onClick={onCreate}
                    disabled={createConversation.isPending}
                  >
                    {localization.newButton}
                  </Button>
                </OnboardingTarget>
              </div>
              <OnboardingTarget id="chat.source-selector">
                <KnowledgeSourceSelector
                  localization={localization}
                  knowledgeBaseMode={knowledgeBaseMode}
                  onKnowledgeBaseModeChange={onKnowledgeBaseModeChange}
                  knowledgeBases={selectableKnowledgeBases}
                  selectedKnowledgeBaseIds={selectedKnowledgeBaseIds}
                  knowledgeBasesLoading={knowledgeBases.isLoading}
                  knowledgeBasesError={knowledgeBases.error}
                  requiresKnowledgeBaseSelection={
                    requiresKnowledgeBaseSelection
                  }
                  onToggleKnowledgeBase={onToggleKnowledgeBase}
                />
              </OnboardingTarget>
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
            />
            <OnboardingTarget id="chat.composer">
              <ComposerBar
                localization={localization}
                draft={draft}
                onDraftChange={onDraftChange}
                onSubmit={onSubmit}
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
                onSendNow={onSendNow}
                sendNowHelper={sendNowHelper}
                showGuestNotice={showGuestNotice}
                streamError={streamError}
                statusAnnouncement={statusAnnouncement}
                onSendQueuedMessage={onSendQueuedMessage}
                onEditQueuedMessage={onEditQueuedMessage}
                onCancelQueuedMessage={onCancelQueuedMessage}
                composerPlaceholder={composerPlaceholder}
              />
            </OnboardingTarget>
          </section>
        </div>
      </div>
    </div>
  );
}

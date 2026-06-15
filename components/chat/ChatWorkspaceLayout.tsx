"use client";

import { OnboardingTarget } from "@/components/onboarding/OnboardingTarget";
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
import { ConversationSidebar } from "./ConversationSidebar";
import { KnowledgeSourceSelector } from "./KnowledgeSourceSelector";
import type { LiveActivityEvent, QueuedMessage } from "./types";

export const CHAT_WORKSPACE_PANEL_CLASS_NAME =
  "cal-card flex h-[calc(100dvh-8rem)] min-h-0 min-w-0 flex-col overflow-hidden rounded-xl xl:h-full";

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
  return (
    <div className="grid gap-4 xl:h-[calc(100dvh-8rem)] xl:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
      {showGuestNotice ? (
        <div className="rounded-xl border border-cal-warning/25 bg-cal-warning/10 px-3 py-2.5 text-sm text-cal-body xl:col-span-2">
          <p className="font-semibold leading-5 text-cal-ink">
            {localization.guestNoticeTitle}
          </p>
          <p className="mt-0.5 leading-5">
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
        onCreate={onCreate}
        onSelect={onSelectConversation}
        onDelete={onDeleteConversation}
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
            <OnboardingTarget id="chat.source-selector">
              <KnowledgeSourceSelector
                localization={localization}
                knowledgeBaseMode={knowledgeBaseMode}
                onKnowledgeBaseModeChange={onKnowledgeBaseModeChange}
                knowledgeBases={selectableKnowledgeBases}
                selectedKnowledgeBaseIds={selectedKnowledgeBaseIds}
                knowledgeBasesLoading={knowledgeBases.isLoading}
                knowledgeBasesError={knowledgeBases.error}
                requiresKnowledgeBaseSelection={requiresKnowledgeBaseSelection}
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
  );
}

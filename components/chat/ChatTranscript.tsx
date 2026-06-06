import { RotateCcw } from "lucide-react";
import type { RefObject } from "react";
import { EmptyState, ErrorState } from "@/components/Status";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  AgentEvent,
  AgentRunSummary,
  Citation,
  Message,
} from "@/model/my-agents";
import { EvidencePanel } from "./EvidencePanel";
import { MessageBubble } from "./MessageBubble";
import type { ChatLocalization, LiveActivityEvent } from "./types";

export const REPLAY_ICON_PENDING_CLASS_NAME =
  "animate-[spin_1s_linear_infinite_reverse]";

export const CHAT_SCROLL_REGION_CLASS_NAME = "min-h-0 flex-1 overflow-auto p-4";

export type ReplayNotice = {
  messageId: string;
  message: string;
  tone: "error" | "success" | "warning";
};

export function ChatTranscript({
  localization,
  lang,
  activeId,
  messagesError,
  messages,
  conversationIsBusy,
  streamedReply,
  serverActiveRunIsStale,
  sortedRuns,
  visibleActivityEvents,
  visibleCitations,
  latestAssistantMessageId,
  replayingMessageId,
  replayDisabled,
  replayNotice,
  chatScrollRef,
  onChatScroll,
  onReplayAssistantMessage,
}: {
  localization: ChatLocalization;
  lang: string;
  activeId?: string;
  messagesError: unknown;
  messages: Message[];
  conversationIsBusy: boolean;
  streamedReply: string;
  serverActiveRunIsStale: boolean;
  sortedRuns: AgentRunSummary[];
  visibleActivityEvents: Array<AgentEvent | LiveActivityEvent>;
  visibleCitations: Citation[];
  latestAssistantMessageId?: string;
  replayingMessageId: string | null;
  replayDisabled: boolean;
  replayNotice: ReplayNotice | null;
  chatScrollRef: RefObject<HTMLDivElement | null>;
  onChatScroll: () => void;
  onReplayAssistantMessage: (messageId: string) => void;
}) {
  return (
    <div
      ref={chatScrollRef}
      onScroll={onChatScroll}
      data-testid="chat-scroll-region"
      className={CHAT_SCROLL_REGION_CLASS_NAME}
    >
      {!activeId ? (
        <EmptyState
          title={localization.noActiveConversationTitle}
          description={localization.noActiveConversationDescription}
        />
      ) : null}
      {messagesError ? <ErrorState error={messagesError} /> : null}
      <div className="grid gap-3">
        {messages.map((message) => {
          const isAssistant = message.role === "assistant";
          const isReplaying = replayingMessageId === message.id;
          return (
            <MessageBubble
              key={message.id}
              roleLabel={
                localization.roles[
                  message.role as keyof typeof localization.roles
                ] ?? message.role
              }
              content={message.content}
              isAssistant={isAssistant}
              align={message.role === "user" ? "right" : "left"}
            >
              {isAssistant ? (
                <EvidencePanel
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
                      onClick={() => onReplayAssistantMessage(message.id)}
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
                        className={cn(
                          isReplaying ? REPLAY_ICON_PENDING_CLASS_NAME : "",
                        )}
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
            </MessageBubble>
          );
        })}
        {conversationIsBusy || streamedReply ? (
          <MessageBubble
            roleLabel={localization.roles.assistant}
            content={
              streamedReply ||
              (serverActiveRunIsStale
                ? localization.activeRunStale
                : localization.agentComposing)
            }
            isAssistant={Boolean(streamedReply)}
          >
            <EvidencePanel
              localization={localization}
              lang={lang}
              isLatestAssistantMessage={true}
              isStreaming={conversationIsBusy}
              runs={sortedRuns}
              events={visibleActivityEvents}
              citations={visibleCitations}
            />
          </MessageBubble>
        ) : null}
      </div>
    </div>
  );
}

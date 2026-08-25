import { RotateCcw, Sparkles } from "lucide-react";
import type { RefObject } from "react";
import { ErrorState } from "@/components/Status";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  AgentEvent,
  AgentRunSummary,
  Citation,
  Message,
} from "@/model/my-agents";
import { CopyMessageButton } from "./CopyMessageButton";
import { CurrentAgentTraceStepPanel, EvidencePanel } from "./EvidencePanel";
import { MessageBubble } from "./MessageBubble";
import type { ChatLocalization, LiveActivityEvent } from "./types";

export const REPLAY_ICON_PENDING_CLASS_NAME =
  "animate-[spin_1s_linear_infinite_reverse]";

export const ASSISTANT_GENERATING_ICON_CLASS_NAME =
  "motion-safe:animate-[spin_2.4s_linear_infinite]";

export const CHAT_SCROLL_REGION_CLASS_NAME = "min-h-0 flex-1 overflow-auto p-4";

export type ReplayNotice = {
  messageId: string;
  message: string;
  tone: "error" | "success" | "warning";
};

export function getReplayDisplayedMessages(
  messages: Message[],
  replayingMessageId: string | null,
) {
  if (!replayingMessageId) return messages;
  const replayingMessageIndex = messages.findIndex(
    (message) => message.id === replayingMessageId,
  );
  return replayingMessageIndex >= 0
    ? messages.slice(0, replayingMessageIndex + 1)
    : messages;
}

function AssistantGeneratingIndicator({ label }: { label: string }) {
  return (
    <output aria-label={label} className="mt-1 flex min-h-11 items-center">
      <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-km-accent/25 bg-km-surface text-km-accent shadow-sm">
        <span className="absolute h-full w-full rounded-full bg-km-accent/20 opacity-75 motion-safe:animate-ping" />
        <Sparkles
          aria-hidden="true"
          className={cn(
            "relative h-4 w-4",
            ASSISTANT_GENERATING_ICON_CLASS_NAME,
          )}
        />
      </span>
    </output>
  );
}

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
  visibleConsultedSources,
  latestAssistantMessageId,
  replayingMessageId,
  replayDisabled,
  replayNotice,
  chatScrollRef,
  onChatScroll,
  onReplayAssistantMessage,
  bottomInset,
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
  visibleConsultedSources: Citation[] | null;
  latestAssistantMessageId?: string;
  replayingMessageId: string | null;
  replayDisabled: boolean;
  replayNotice: ReplayNotice | null;
  chatScrollRef: RefObject<HTMLDivElement | null>;
  onChatScroll: () => void;
  onReplayAssistantMessage: (messageId: string) => void;
  /**
   * Height of the composer overlaying the bottom of the panel, in pixels.
   * Reserved as scrollable padding so the last message can always be scrolled
   * clear of it — messages pass *behind* the composer, they are not hidden by
   * it. Measured rather than guessed because the composer grows with the draft.
   */
  bottomInset: number;
}) {
  const displayedMessages = getReplayDisplayedMessages(
    messages,
    replayingMessageId,
  );
  const shouldRenderBusyBubble = conversationIsBusy && !replayingMessageId;
  const shouldRenderSeparateStreamingBubble =
    !replayingMessageId && (shouldRenderBusyBubble || Boolean(streamedReply));

  return (
    <div
      ref={chatScrollRef}
      onScroll={onChatScroll}
      data-testid="chat-scroll-region"
      className={CHAT_SCROLL_REGION_CLASS_NAME}
      // Inline, not a class: the value is measured at runtime, and
      // `CHAT_SCROLL_REGION_CLASS_NAME` is asserted verbatim in
      // `tests/chatworkspace-footer.test.ts` — including that it contains no
      // `calc(`.
      style={{ paddingBottom: bottomInset }}
    >
      {/*
        A greeting, not a blocker. The composer below is live in this state —
        sending the first message creates the conversation — so this must not
        tell the user to go find a "new conversation" button first.
      */}
      {!activeId ? (
        <div className="flex min-h-full items-center justify-center py-8">
          <div className="max-w-md text-center">
            <p className="cal-heading text-xl text-cal-ink">
              {localization.newChatGreeting}
            </p>
            <p className="mt-2 text-sm leading-6 text-cal-muted">
              {localization.newChatGreetingDescription}
            </p>
          </div>
        </div>
      ) : null}
      {messagesError ? <ErrorState error={messagesError} /> : null}
      <div className="grid gap-3">
        {displayedMessages.map((message) => {
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
              content={isReplaying ? streamedReply : message.content}
              isAssistant={
                isAssistant && (!isReplaying || Boolean(streamedReply))
              }
              align={message.role === "user" ? "right" : "left"}
            >
              {isReplaying && !streamedReply ? (
                <AssistantGeneratingIndicator
                  label={localization.agentComposing}
                />
              ) : null}
              {isReplaying ? (
                <CurrentAgentTraceStepPanel
                  localization={localization}
                  lang={lang}
                  events={visibleActivityEvents}
                />
              ) : null}
              {isAssistant ? (
                <EvidencePanel
                  localization={localization}
                  lang={lang}
                  isLatestAssistantMessage={
                    message.id === latestAssistantMessageId
                  }
                  isStreaming={isReplaying}
                  runs={sortedRuns}
                  events={visibleActivityEvents}
                  citations={visibleCitations}
                  consultedSources={visibleConsultedSources}
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
                  copyButton={
                    <CopyMessageButton
                      localization={localization}
                      // The text on screen, not the persisted record: mid-replay
                      // the bubble shows `streamedReply`, and copying something
                      // other than what is displayed would be a quiet lie.
                      content={isReplaying ? streamedReply : message.content}
                    />
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
        {shouldRenderSeparateStreamingBubble ? (
          <MessageBubble
            roleLabel={localization.roles.assistant}
            content={
              streamedReply ||
              (serverActiveRunIsStale ? localization.activeRunStale : "")
            }
            isAssistant={Boolean(streamedReply)}
          >
            {shouldRenderBusyBubble &&
            !streamedReply &&
            !serverActiveRunIsStale ? (
              <AssistantGeneratingIndicator
                label={localization.agentComposing}
              />
            ) : null}
            {shouldRenderBusyBubble ? (
              <CurrentAgentTraceStepPanel
                localization={localization}
                lang={lang}
                events={visibleActivityEvents}
              />
            ) : null}
            <EvidencePanel
              localization={localization}
              lang={lang}
              isLatestAssistantMessage={true}
              isStreaming={shouldRenderBusyBubble}
              runs={sortedRuns}
              events={visibleActivityEvents}
              citations={visibleCitations}
              consultedSources={visibleConsultedSources}
            />
          </MessageBubble>
        ) : null}
      </div>
    </div>
  );
}

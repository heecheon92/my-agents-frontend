import { RotateCcw, Sparkles } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { OnboardingTarget } from "@/components/onboarding/OnboardingTarget";
import { ErrorState } from "@/components/Status";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  AgentEvent,
  Citation,
  ConversationArtifact,
  DocumentCoverage,
  Message,
  ReasoningSummaryDisplay,
} from "@/model/my-agents";
import { ArtifactList } from "./attachments/ArtifactList";
import { CopyMessageButton } from "./CopyMessageButton";
import { AgentProcessPanel, EvidencePanel } from "./EvidencePanel";
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

/**
 * The onboarding target travels with the panel. It is still gated on recorded
 * events: `OnboardingTarget` always renders its wrapper, and an empty wrapper
 * would register a zero-size anchor for the coach mark to point at.
 */
function AgentProcessHeader({
  localization,
  lang,
  events,
  citationCount,
  isStreaming,
  reasoningSummaries,
}: {
  localization: ChatLocalization;
  lang: string;
  events: Array<AgentEvent | LiveActivityEvent>;
  citationCount: number;
  isStreaming: boolean;
  reasoningSummaries: ReasoningSummaryDisplay[];
}): ReactNode {
  if (events.length === 0) return null;
  return (
    <OnboardingTarget id="chat.agent-process" className="w-full min-w-0">
      <AgentProcessPanel
        localization={localization}
        lang={lang}
        events={events}
        citationCount={citationCount}
        isStreaming={isStreaming}
        reasoningSummaries={reasoningSummaries}
      />
    </OnboardingTarget>
  );
}

export function ChatTranscript({
  localization,
  lang,
  activeId,
  activeRunId,
  messagesError,
  messages,
  conversationIsBusy,
  isProducingOutput,
  streamedReply,
  serverActiveRunIsStale,
  visibleActivityEvents,
  visibleCitations,
  visibleConsultedSources,
  visibleDocumentCoverage,
  visibleReasoningSummaries,
  latestAssistantMessageId,
  latestRunId,
  replayingMessageId,
  replayDisabled,
  replayNotice,
  chatScrollRef,
  onChatScroll,
  onReplayAssistantMessage,
  artifactsByRun,
  bottomInset,
}: {
  localization: ChatLocalization;
  lang: string;
  activeId?: string;
  activeRunId: string | null;
  messagesError: unknown;
  messages: Message[];
  conversationIsBusy: boolean;
  isProducingOutput: boolean;
  streamedReply: string;
  serverActiveRunIsStale: boolean;
  visibleActivityEvents: Array<AgentEvent | LiveActivityEvent>;
  visibleCitations: Citation[];
  visibleConsultedSources: Citation[] | null;
  visibleDocumentCoverage: DocumentCoverage | null;
  visibleReasoningSummaries: ReasoningSummaryDisplay[];
  latestAssistantMessageId?: string;
  latestRunId: string | null;
  replayingMessageId: string | null;
  replayDisabled: boolean;
  replayNotice: ReplayNotice | null;
  chatScrollRef: RefObject<HTMLDivElement | null>;
  onChatScroll: () => void;
  onReplayAssistantMessage: (messageId: string) => void;
  /**
   * Generated files keyed by the run that produced them.
   *
   * Grouped by `run_id` rather than read off the run list, which does not
   * carry artifacts — this is the only thing that reattaches a file to its
   * answer after a refresh.
   */
  artifactsByRun: Record<string, ConversationArtifact[]>;
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
  const shouldRenderBusyBubble = isProducingOutput && !replayingMessageId;
  const shouldRenderSeparateStreamingBubble =
    !replayingMessageId && (conversationIsBusy || Boolean(streamedReply));

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
          const showsLiveEvidence =
            message.id === latestAssistantMessageId || isReplaying;
          // A busy conversation renders its activity on the streaming bubble
          // below, so the settled message must not draw the same panel twice.
          const messageEvents =
            conversationIsBusy && !isReplaying ? [] : visibleActivityEvents;
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
              header={
                isAssistant && showsLiveEvidence ? (
                  <AgentProcessHeader
                    localization={localization}
                    lang={lang}
                    events={messageEvents}
                    citationCount={visibleCitations.length}
                    isStreaming={isReplaying}
                    reasoningSummaries={
                      showsLiveEvidence ? visibleReasoningSummaries : []
                    }
                  />
                ) : null
              }
            >
              {isReplaying && !streamedReply ? (
                <AssistantGeneratingIndicator
                  label={localization.agentComposing}
                />
              ) : null}
              {/* Between the answer and its evidence footer: a generated
                  file is a result of the answer, not provenance for it. */}
              {isAssistant && activeId && !isReplaying && latestRunId ? (
                <ArtifactList
                  localization={localization}
                  conversationId={activeId}
                  artifacts={
                    message.id === latestAssistantMessageId
                      ? (artifactsByRun[latestRunId] ?? [])
                      : []
                  }
                />
              ) : null}
              {isAssistant ? (
                <EvidencePanel
                  localization={localization}
                  isLatestAssistantMessage={
                    message.id === latestAssistantMessageId
                  }
                  isStreaming={isReplaying}
                  runId={isReplaying ? null : latestRunId}
                  events={messageEvents}
                  citations={visibleCitations}
                  consultedSources={visibleConsultedSources}
                  documentCoverage={visibleDocumentCoverage}
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
            header={
              <AgentProcessHeader
                localization={localization}
                lang={lang}
                events={visibleActivityEvents}
                citationCount={visibleCitations.length}
                isStreaming={isProducingOutput}
                reasoningSummaries={visibleReasoningSummaries}
              />
            }
          >
            {shouldRenderBusyBubble &&
            !streamedReply &&
            !serverActiveRunIsStale ? (
              <AssistantGeneratingIndicator
                label={localization.agentComposing}
              />
            ) : null}
            {activeId && activeRunId ? (
              <ArtifactList
                localization={localization}
                conversationId={activeId}
                artifacts={artifactsByRun[activeRunId] ?? []}
              />
            ) : null}
            <EvidencePanel
              localization={localization}
              isLatestAssistantMessage={true}
              isStreaming={isProducingOutput}
              runId={activeRunId}
              events={visibleActivityEvents}
              citations={visibleCitations}
              consultedSources={visibleConsultedSources}
              documentCoverage={visibleDocumentCoverage}
            />
          </MessageBubble>
        ) : null}
      </div>
    </div>
  );
}

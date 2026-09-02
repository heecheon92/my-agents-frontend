import { ArrowUpIcon, SendHorizontalIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { inputClassName } from "@/components/Field";
import { OnboardingTarget } from "@/components/onboarding/OnboardingTarget";
import { ErrorState } from "@/components/Status";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  KnowledgeBase,
  KnowledgeBaseSelectionMode,
  ReasoningEffort,
} from "@/model/my-agents";
import {
  AttachmentButton,
  AttachmentPanels,
} from "./attachments/AttachmentControls";
import type { AttachmentComposer } from "./attachments/useAttachmentComposer";
import { KnowledgeScopePicker } from "./KnowledgeScopePicker";
import { ReasoningControls } from "./ReasoningControls";
import type { ResolvedReasoning } from "./reasoning-selection";
import type { ChatLocalization, QueuedMessage } from "./types";

/** Roughly eight lines, after which the composer scrolls instead of growing. */
const MAX_COMPOSER_HEIGHT_PX = 200;

export function describeKnowledgeBaseSelection(
  selection: QueuedMessage["knowledgeBaseSelection"],
  knowledgeBases: KnowledgeBase[],
  localization: {
    knowledgeSourceAll: string;
    knowledgeSourceQueuedSelected: string;
    knowledgeSourceQueuedFallback: string;
  },
) {
  if (selection.mode === "all") return localization.knowledgeSourceAll;
  const names = selection.knowledge_base_ids
    .map((id) => knowledgeBases.find((kb) => kb.id === id)?.name)
    .filter((name): name is string => Boolean(name))
    .join(", ");
  return names
    ? localization.knowledgeSourceQueuedSelected.replace("{names}", names)
    : localization.knowledgeSourceQueuedFallback;
}

export function ComposerBar({
  localization,
  draft,
  onDraftChange,
  onSubmit,
  visibleQueuedMessage,
  queuedHelper,
  pendingInteractionSlot,
  knowledgeBases,
  conversationIsBusy,
  isCancelling,
  isPrimaryActionDisabled,
  primaryActionLabel,
  isStreaming,
  isSendNowDisabled,
  onSendNow,
  sendNowHelper,
  showGuestNotice,
  streamError,
  statusAnnouncement,
  onSendQueuedMessage,
  onEditQueuedMessage,
  onCancelQueuedMessage,
  composerPlaceholder,
  reasoning,
  onReasoningModeChange,
  onReasoningEffortChange,
  knowledgeBaseMode,
  onKnowledgeBaseModeChange,
  selectedKnowledgeBaseIds,
  knowledgeBasesLoading,
  knowledgeBasesError,
  requiresKnowledgeBaseSelection,
  onToggleKnowledgeBase,
  attachmentComposer,
}: {
  localization: ChatLocalization;
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  visibleQueuedMessage: QueuedMessage | null;
  queuedHelper: string;
  /**
   * The pending durable interaction, already rendered. Passed as a node rather
   * than as data so the composer stays unaware of interaction types — the
   * registry owns that mapping.
   */
  pendingInteractionSlot?: React.ReactNode;
  knowledgeBases: KnowledgeBase[];
  conversationIsBusy: boolean;
  isCancelling: boolean;
  isPrimaryActionDisabled: boolean;
  primaryActionLabel: string;
  isStreaming: boolean;
  isSendNowDisabled: boolean;
  onSendNow: () => void;
  sendNowHelper: string;
  showGuestNotice: boolean;
  streamError: unknown;
  statusAnnouncement: string;
  onSendQueuedMessage: () => void;
  onEditQueuedMessage: () => void;
  onCancelQueuedMessage: () => void;
  composerPlaceholder: string;
  reasoning: ResolvedReasoning;
  onReasoningModeChange: (next: "standard" | "pro") => void;
  onReasoningEffortChange: (next: ReasoningEffort) => void;
  knowledgeBaseMode: KnowledgeBaseSelectionMode;
  onKnowledgeBaseModeChange: (mode: KnowledgeBaseSelectionMode) => void;
  selectedKnowledgeBaseIds: string[];
  knowledgeBasesLoading: boolean;
  knowledgeBasesError: unknown;
  requiresKnowledgeBaseSelection: boolean;
  onToggleKnowledgeBase: (knowledgeBaseId: string) => void;
  /**
   * Temporary conversation files. The composer renders whatever this reports
   * and nothing when the capability is unavailable — the gating decision is
   * the hook's, not a prop the caller can get wrong.
   */
  attachmentComposer: AttachmentComposer;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Grow with the content instead of scrolling a one-line box. Measured after
  // every draft change, including when the draft is cleared on send or
  // restored from the queue.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `draft` is the trigger, not a read value — the height is measured from the DOM after React commits the new text.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_COMPOSER_HEIGHT_PX)}px`;
  }, [draft]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    // An IME composition commit also fires Enter; submitting there would send
    // a half-typed Korean phrase. `isComposing` is the documented guard, and
    // this is a Korean-first product, so it is not optional.
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    formRef.current?.requestSubmit();
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      /*
       * No border and no background: the composer floats on the panel rather
       * than sitting in a footer band. The old `border-t` drew a full-width
       * rule directly above a box that already has its own border, so the
       * input read as double-framed — a rectangle inside a rectangle inside
       * the panel. `bg-cal-surface-card` went with it because it resolves to
       * the same value as the panel behind it and was painting nothing.
       *
       * Safe-area padding stays: on iOS the composer otherwise sits under the
       * home indicator, which only became visible once the panel was genuinely
       * viewport-bounded.
       */
      className="pointer-events-auto px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <p className="sr-only" aria-live="polite">
        {statusAnnouncement}
      </p>
      {/* Above the queue card: answering this is what unblocks everything
          else, so it should not sit below a message that cannot send yet. */}
      {pendingInteractionSlot}
      {/* Above the input, with the queue card: both describe something that
          has not been sent yet. */}
      <AttachmentPanels
        localization={localization}
        composer={attachmentComposer}
        disabled={isCancelling}
      />
      {visibleQueuedMessage ? (
        <div className="mb-3 rounded-xl border border-cal-hairline bg-cal-surface-soft p-3 text-sm text-cal-body">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold text-cal-ink">
                {localization.queuedTitle}
              </p>
              {/* `max-h-20 overflow-hidden` silently truncated with no
                  affordance — a long queued question just stopped mid-word.
                  `line-clamp` ellipsizes honestly. */}
              <p className="mt-1 line-clamp-3 break-words text-cal-ink">
                {visibleQueuedMessage.content}
              </p>
              <p className="mt-1 text-xs text-cal-muted">{queuedHelper}</p>
              <p className="mt-1 text-xs text-cal-muted">
                {describeKnowledgeBaseSelection(
                  visibleQueuedMessage.knowledgeBaseSelection,
                  knowledgeBases,
                  localization,
                )}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {conversationIsBusy ? (
                // Steer: stop the running answer and send this instead. The
                // queue used to offer nothing here, so a held message could
                // only wait for a run that might take minutes.
                <Button
                  type="button"
                  size="sm"
                  onClick={onSendNow}
                  disabled={isSendNowDisabled}
                  aria-describedby="chat-steering-helper"
                >
                  {localization.sendNow}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onSendQueuedMessage}
                >
                  {localization.sendQueued}
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onEditQueuedMessage}
              >
                {localization.editQueued}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancelQueuedMessage}
              >
                {localization.cancelQueued}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {/*
        A stack, not a grid. The send button used to be a column beside the
        textarea, so a grid stretch made it grow taller as the draft wrapped —
        a full-height slab of a button next to four lines of text. Controls now
        sit on their own row under the text, which is why send can stay a fixed
        circle no matter how tall the input gets.
      */}
      <div className="flex flex-col gap-1 rounded-2xl border border-cal-hairline bg-cal-canvas p-2 shadow-raised sm:p-3">
        <textarea
          ref={textareaRef}
          rows={1}
          className={cn(
            inputClassName,
            "min-h-11 w-full resize-none border-0 bg-transparent px-2 py-2 text-base leading-6 shadow-none focus-visible:ring-0",
          )}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={composerPlaceholder}
          // Usable before a conversation exists: sending the first message
          // creates one. A dead input was the single biggest first-run
          // confusion, because nothing on screen explained what to click.
          disabled={isCancelling}
          aria-describedby={
            conversationIsBusy ? "chat-steering-helper" : undefined
          }
        />
        {/*
          One row: what the answer draws on at the left, how hard it thinks and
          the send action at the right. Everything here is either a compact
          trigger or an icon — the settings themselves live behind them.
        */}
        <div className="flex items-center gap-1">
          {/* No `OnboardingTarget` wrapper: it always renders a div, and the
              button renders nothing when the capability is unavailable, which
              would leave an empty anchor in the control row on every
              deployment without the feature. */}
          <AttachmentButton
            localization={localization}
            composer={attachmentComposer}
            disabled={isCancelling}
          />
          <OnboardingTarget id="chat.source-selector">
            <KnowledgeScopePicker
              localization={localization}
              knowledgeBaseMode={knowledgeBaseMode}
              onKnowledgeBaseModeChange={onKnowledgeBaseModeChange}
              knowledgeBases={knowledgeBases}
              selectedKnowledgeBaseIds={selectedKnowledgeBaseIds}
              knowledgeBasesLoading={knowledgeBasesLoading}
              knowledgeBasesError={knowledgeBasesError}
              requiresKnowledgeBaseSelection={requiresKnowledgeBaseSelection}
              onToggleKnowledgeBase={onToggleKnowledgeBase}
              disabled={isCancelling}
            />
          </OnboardingTarget>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {/* Renders only once the backend confirms it accepts these fields,
                so a deployment without the reasoning migration still gets the
                source picker and send. */}
            {reasoning.available ? (
              <ReasoningControls
                resolved={reasoning}
                localization={localization}
                onModeChange={onReasoningModeChange}
                onEffortChange={onReasoningEffortChange}
                disabled={isCancelling}
              />
            ) : null}
            {isStreaming ? (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="size-9 rounded-full"
                onClick={onSendNow}
                disabled={isSendNowDisabled}
                aria-label={localization.sendNow}
                title={localization.sendNow}
                aria-describedby="chat-steering-helper"
              >
                <SendHorizontalIcon aria-hidden="true" />
              </Button>
            ) : null}
            {/*
              Icon-only, so the label moves to `aria-label`/`title` rather than
              being dropped. It still changes with state — "보내기" becomes
              "대기열에 추가" while a run is in flight.
            */}
            <Button
              type="submit"
              size="icon"
              className="size-9 shrink-0 rounded-full"
              disabled={isPrimaryActionDisabled}
              aria-label={primaryActionLabel}
              title={primaryActionLabel}
            >
              <ArrowUpIcon aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
      {/*
        The blocker, outside the overlay. Send is disabled while a "selected"
        scope has nothing selected, and with the picker collapsed the
        explanation would otherwise be hidden behind a closed dialog — a greyed
        button with no stated reason.
      */}
      {requiresKnowledgeBaseSelection ? (
        <p className="mt-2 text-xs leading-5 text-cal-error">
          {localization.knowledgeSourceRequired}
        </p>
      ) : null}
      {conversationIsBusy ? (
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
          <ErrorState title={localization.runFailed} error={streamError} />
        </div>
      ) : null}
    </form>
  );
}

import { useEffect, useRef } from "react";
import { inputClassName } from "@/components/Field";
import { ErrorState } from "@/components/Status";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { KnowledgeBase } from "@/model/my-agents";
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
  knowledgeBases,
  conversationIsBusy,
  activeId,
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
}: {
  localization: ChatLocalization;
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  visibleQueuedMessage: QueuedMessage | null;
  queuedHelper: string;
  knowledgeBases: KnowledgeBase[];
  conversationIsBusy: boolean;
  activeId?: string;
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
      // Safe-area padding: on iOS the composer otherwise sits under the home
      // indicator, which only became visible once the panel was genuinely
      // viewport-bounded.
      className="border-t border-cal-hairline bg-cal-surface-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <p className="sr-only" aria-live="polite">
        {statusAnnouncement}
      </p>
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
              {!conversationIsBusy ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onSendQueuedMessage}
                >
                  {localization.sendQueued}
                </Button>
              ) : null}
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
      <div className="rounded-2xl border border-cal-hairline bg-cal-canvas p-2 shadow-raised sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-2 sm:p-3">
        <textarea
          ref={textareaRef}
          rows={1}
          className={cn(
            inputClassName,
            "min-h-14 w-full resize-none border-0 bg-transparent px-3 py-3 text-base leading-6 shadow-none focus-visible:ring-0",
          )}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={composerPlaceholder}
          disabled={!activeId || isCancelling}
          aria-describedby={
            conversationIsBusy ? "chat-steering-helper" : undefined
          }
        />
        <div className="mt-2 flex flex-wrap gap-2 sm:mt-0 sm:justify-end">
          <Button
            className="w-full px-4 sm:w-auto"
            type="submit"
            size="lg"
            disabled={isPrimaryActionDisabled}
          >
            {primaryActionLabel}
          </Button>
          {isStreaming ? (
            <Button
              className="w-full px-4 sm:w-auto"
              type="button"
              size="lg"
              variant="secondary"
              onClick={onSendNow}
              disabled={isSendNowDisabled}
              aria-describedby="chat-steering-helper"
            >
              {localization.sendNow}
            </Button>
          ) : null}
        </div>
      </div>
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

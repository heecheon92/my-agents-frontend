import { inputClassName } from "@/components/Field";
import { ErrorState } from "@/components/Status";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { KnowledgeBase } from "@/model/my-agents";
import type { ChatLocalization, QueuedMessage } from "./types";

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
  return (
    <form
      onSubmit={onSubmit}
      className="border-t border-cal-hairline bg-cal-surface-card p-4"
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
              <p className="mt-1 max-h-20 overflow-hidden break-words text-cal-ink">
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
        <input
          className={cn(
            inputClassName,
            "min-h-14 w-full border-0 bg-transparent px-3 text-base shadow-none focus-visible:ring-0",
          )}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
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

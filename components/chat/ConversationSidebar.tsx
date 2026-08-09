import { Trash2 } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/Status";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/model/my-agents";
import type { ChatLocalization } from "./types";

export function getConversationCardClassName(isActiveConversation: boolean) {
  return cn(
    "group/conversation rounded-lg border p-2 transition",
    isActiveConversation
      ? "border-cal-primary bg-cal-primary text-white hover:border-cal-primary hover:bg-cal-primary hover:text-white"
      : "border-cal-hairline bg-cal-canvas hover:border-cal-hairline hover:bg-cal-surface-soft",
  );
}

export function ConversationSidebar({
  localization,
  conversations,
  activeId,
  isLoading,
  error,
  createError,
  deleteError,
  isDeletePending,
  conversationIsBusy,
  isCancelling,
  onSelect,
  onDelete,
  className,
}: {
  localization: ChatLocalization;
  conversations?: Conversation[];
  activeId?: string;
  isLoading: boolean;
  error: unknown;
  createError: unknown;
  deleteError: unknown;
  isDeletePending: boolean;
  conversationIsBusy: boolean;
  isCancelling: boolean;
  onSelect: (conversationId: string) => void;
  onDelete: (conversation: Conversation) => void;
  /**
   * Chrome is supplied by the caller so the same component can be the desktop
   * rail and the body of the compact-screen sheet.
   */
  className?: string;
}) {
  return (
    <aside className={cn("flex min-h-0 min-w-0 flex-col", className)}>
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {/*
            An h2, not an h1: the page heading now lives in the transcript panel
            header, which stays mounted at every width. Below `xl` this list
            moves into a closed sheet, so an h1 here would leave the route with
            no heading at all on mobile.
          */}
          <h2 className="cal-heading text-lg">
            {localization.conversationListTitle}
          </h2>
          <p className="mt-1 text-sm text-cal-muted">
            {localization.description}
          </p>
        </div>
      </div>
      <div className="mt-5 grid min-h-0 flex-1 auto-rows-min gap-2 overflow-y-auto">
        {error ? <ErrorState error={error} /> : null}
        {createError ? <ErrorState error={createError} /> : null}
        {deleteError ? <ErrorState error={deleteError} /> : null}
        {isLoading ? (
          <p className="text-sm text-cal-muted">
            {localization.loadingConversations}
          </p>
        ) : null}
        {conversations?.length === 0 ? (
          <EmptyState
            title={localization.noConversationsTitle}
            description={localization.noConversationsDescription}
          />
        ) : null}
        {conversations?.map((item) => {
          const isActiveConversation = activeId === item.id;
          const deleteDisabled =
            isDeletePending ||
            (isActiveConversation && (conversationIsBusy || isCancelling));
          return (
            <div
              key={item.id}
              className={getConversationCardClassName(isActiveConversation)}
            >
              <div className="flex min-w-0 items-start gap-2">
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className="min-w-0 flex-1 rounded-md p-1 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cal-primary"
                  aria-current={isActiveConversation ? "true" : undefined}
                >
                  <span className="block break-words font-medium">
                    {item.title}
                  </span>
                  <span
                    className={cn(
                      "mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]",
                      isActiveConversation
                        ? "bg-white/15 text-white"
                        : "bg-cal-surface-soft text-cal-muted",
                    )}
                  >
                    {localization.personalConversationBadge}
                  </span>
                </button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className={cn(
                    "mt-0.5",
                    isActiveConversation
                      ? "text-white hover:bg-white/15"
                      : "text-cal-muted hover:text-cal-error",
                  )}
                  onClick={() => onDelete(item)}
                  disabled={deleteDisabled}
                  aria-label={localization.deleteConversationLabel.replace(
                    "{title}",
                    item.title,
                  )}
                  title={
                    deleteDisabled && isActiveConversation
                      ? localization.deleteConversationActiveRunDisabled
                      : localization.deleteConversationAction
                  }
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

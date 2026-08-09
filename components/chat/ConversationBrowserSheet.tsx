"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Conversation } from "@/model/my-agents";
import { ConversationSidebar } from "./ConversationSidebar";
import type { ChatLocalization } from "./types";

/**
 * Compact-screen conversation browser.
 *
 * Below `xl` the conversation list previously stacked above the transcript, so
 * every phone and tablet user scrolled past the whole list to reach the chat.
 * `/knowledge` and `/groups` already solved this with a left `Sheet`; this
 * follows the same pattern rather than inventing a third one, and matches the
 * repo's overlay rule that a Sheet is for compact-screen navigation.
 *
 * Presentational only — open state and mutations stay in `ChatWorkspace`.
 */
export function ConversationBrowserSheet({
  open,
  onOpenChange,
  onSelect,
  ...sidebarProps
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-full max-w-sm gap-0 border-r border-cal-hairline bg-km-surface p-0"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>
            {sidebarProps.localization.conversationListTitle}
          </SheetTitle>
          <SheetDescription>
            {sidebarProps.localization.selectOrCreateConversation}
          </SheetDescription>
        </SheetHeader>
        <ConversationSidebar
          {...sidebarProps}
          className="h-full p-4"
          // Picking a conversation is the reason the sheet was opened, so
          // close it rather than leaving the transcript hidden behind it.
          onSelect={(conversationId) => {
            onSelect(conversationId);
            onOpenChange(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

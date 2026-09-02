"use client";

import { LockIcon, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorState } from "@/components/Status";
import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  useConversations,
  useDeleteConversation,
} from "@/hooks/use-conversations";
import { useLocalization } from "@/hooks/useLocalization";
import { decodeRouteSegment } from "@/lib/route-segments";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/model/my-agents";
import { useChatActivityStore } from "./chat-activity-store";
import {
  conversationHref,
  conversationIdFromPathname,
  NEW_CHAT_HREF,
} from "./chat-routes";
import { getConversationCardClassName } from "./conversation-card";
import { DeleteConversationAlertDialog } from "./DeleteConversationAlertDialog";
import { getNextConversationIdAfterDelete } from "./workspace-helpers";

/**
 * The conversation history, rendered by `ServiceShell` inside the app's one
 * sidebar rather than by the `/chat` route.
 *
 * It takes no props: `ChatWorkspace` is a sibling in the tree, not an ancestor,
 * so nothing can be threaded down. Instead it reads the same
 * `MyAgentsQueryKeys.conversations.list()` entry through `useConversations()` —
 * TanStack Query is the shared store, which is why this needs neither a context
 * provider nor a parallel route slot.
 */
export function ConversationHistorySidebarGroup() {
  const { localization } = useLocalization((state) => state.localization.chat);
  const router = useRouter();
  /**
   * Read from the pathname rather than `useParams`. Auto-creating a
   * conversation updates the URL with `history.replaceState` to avoid
   * remounting the chat mid-run, and `usePathname` tracks that; route params
   * only refresh on a real navigation, so the new row would not light up.
   */
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const conversations = useConversations();
  const deleteConversation = useDeleteConversation();
  const busyConversationId = useChatActivityStore(
    (state) => state.busyConversationId,
  );
  const [conversationPendingDelete, setConversationPendingDelete] =
    useState<Conversation>();

  const activeId = decodeRouteSegment(conversationIdFromPathname(pathname));

  function requestDelete(item: Conversation) {
    deleteConversation.reset();
    setConversationPendingDelete(item);
  }

  function handleDialogOpenChange(open: boolean) {
    if (open || deleteConversation.isPending) return;
    setConversationPendingDelete(undefined);
    deleteConversation.reset();
  }

  async function handleDelete(item: Conversation) {
    const nextId = getNextConversationIdAfterDelete(
      conversations.data ?? [],
      item.id,
      activeId,
    );
    try {
      await deleteConversation.mutateAsync(item.id);
      if (activeId === item.id) {
        // `replace`, not `push`: Back must never return to a deleted
        // conversation, which would render a permanent error state.
        router.replace(nextId ? conversationHref(nextId) : NEW_CHAT_HREF, {
          scroll: false,
        });
      }
      setConversationPendingDelete(undefined);
      toast.success(localization.deleteConversationSuccessAnnouncement);
    } catch {
      toast.error(localization.deleteConversationFailedAnnouncement);
    }
  }

  return (
    <>
      {/*
        `hidden`, deliberately not `opacity-0`. `e2e/sidebar-persistence.spec.ts`
        filters sidebar buttons by `offsetParent !== null`, which only goes null
        under `display: none` — an opacity-based hide would leave these rows in
        the collapsed-rail size assertions. See DESIGN.md.
      */}
      <SidebarGroup className="flex min-h-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>
          {localization.conversationListTitle}
        </SidebarGroupLabel>
        <SidebarGroupContent className="flex min-h-0 flex-1 flex-col">
          {/* The sidebar's only scroller. `SidebarContent` is `overflow-hidden`
              so the nav links above cannot be scrolled out of reach. */}
          {/* `gap-0.5`, not `gap-2`: rows are list items now, and card-era
              spacing left them floating apart. */}
          {/* `overflow-x-hidden` is explicit: `overflow-y: auto` alone forces
              the computed `overflow-x` to `auto` as well, so the list would
              scroll sideways the moment any row exceeded the rail. */}
          <div className="grid min-h-0 flex-1 auto-rows-min gap-0.5 overflow-y-auto overflow-x-hidden">
            {conversations.error ? (
              <ErrorState error={conversations.error} />
            ) : null}
            {deleteConversation.error ? (
              <ErrorState error={deleteConversation.error} />
            ) : null}
            {conversations.isLoading ? (
              <p className="text-sm text-cal-muted">
                {localization.loadingConversations}
              </p>
            ) : null}
            {conversations.data?.length === 0 ? (
              <EmptyState
                title={localization.noConversationsTitle}
                description={localization.noConversationsDescription}
              />
            ) : null}
            {conversations.data?.map((item) => {
              const isActiveConversation = activeId === item.id;
              const deleteDisabled =
                deleteConversation.isPending || busyConversationId === item.id;
              return (
                <div
                  key={item.id}
                  className={cn(
                    getConversationCardClassName(isActiveConversation),
                    /*
                     * The fade must be on exactly when the delete control is,
                     * and no more. Declared here rather than on the title so
                     * `has-*` can see the button; custom properties inherit, so
                     * the title reads it either way.
                     *
                     * `has-[button:focus-visible]`, never `group-focus-within`:
                     * clicking a conversation focuses its anchor, so a
                     * focus-within rule left the title faded on the row you had
                     * just opened, with no icon to explain why.
                     */
                    "[--km-title-fade:3.25rem] md:[--km-title-fade:0px]",
                    "md:hover:[--km-title-fade:3.25rem]",
                    "md:has-[button:focus-visible]:[--km-title-fade:3.25rem]",
                  )}
                >
                  {/*
                    A real anchor, not a button: the conversation is now a
                    route, so middle-click, copy-link, and Back all work.
                  */}
                  <Link
                    href={conversationHref(item.id)}
                    onClick={() => setOpenMobile(false)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cal-primary"
                    aria-current={isActiveConversation ? "page" : undefined}
                    title={item.title}
                  >
                    {/*
                      Replaces a "비공개" pill. Every conversation in this list
                      is private, so a text badge on each row was repeating one
                      fact N times at the cost of a second line. The label is
                      kept for screen readers and as a tooltip.
                    */}
                    <LockIcon
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-cal-muted"
                    />
                    <span className="sr-only">
                      {localization.personalConversationBadge}
                    </span>
                    {/*
                      Faded rather than ellipsised, and masked rather than
                      padded. A mask fades the glyphs themselves, so the title
                      passes under the delete control on any row background —
                      active, hovered, or transparent — without the gradient
                      having to know which one it is.

                      `min-w-0` again: as a flex item the span's automatic
                      minimum is its min-content, which for `nowrap` text is the
                      whole string, so without this it refuses to shrink and
                      pushes the row wide.
                    */}
                    <span
                      className={cn(
                        /*
                         * `pointer-events-none` is the fix for a control that
                         * looked right and did nothing. `mask-image` makes this
                         * span a stacking context, and it then intercepted
                         * pointer events over the delete button sitting on top
                         * of it — raising the button's `z-index` was not enough
                         * to win that reliably. Nothing is lost: the anchor is
                         * what handles the click and now carries the tooltip,
                         * and hovering the text still hits the anchor, so the
                         * row's hover state is unaffected.
                         */
                        "pointer-events-none min-w-0 flex-1 overflow-hidden whitespace-nowrap",
                        /*
                         * At `--km-title-fade: 0px` both gradient stops land on
                         * `100%` and the mask is a no-op, which is why the
                         * width is a multiplier rather than a fixed ramp — a
                         * fixed one would still fade the edge of every row at
                         * rest. The variable is set on the row.
                         */
                        "[-webkit-mask-image:linear-gradient(to_right,#000_calc(100%-var(--km-title-fade)*1.6),transparent_calc(100%-var(--km-title-fade)*0.45))]",
                        "[mask-image:linear-gradient(to_right,#000_calc(100%-var(--km-title-fade)*1.6),transparent_calc(100%-var(--km-title-fade)*0.45))]",
                        isActiveConversation && "font-medium",
                      )}
                    >
                      {item.title}
                    </span>
                  </Link>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    /*
                     * Revealed on hover and focus so a quiet list stays quiet,
                     * but always shown on touch, where there is no hover and
                     * this is the only way to delete a conversation.
                     */
                    /*
                     * Centred with `inset-y-0 my-auto`, never `-translate-y-1/2`.
                     *
                     * `Button` sets a `transform` in its `active:` state, and
                     * `transform` is one property: pressing the control
                     * replaced the centring translate, dropping the button half
                     * its height mid-press. `mousedown` then landed on the
                     * button and `mouseup` on the anchor beneath it, so the
                     * browser fired `click` on their common ancestor and the
                     * handler never ran — a control that looked correct and did
                     * nothing.
                     *
                     * `z-10` keeps it above the title, whose `mask-image` makes
                     * it a stacking context.
                     */
                    className="absolute inset-y-0 right-1 z-10 my-auto shrink-0 text-cal-muted opacity-100 hover:text-cal-error focus-visible:opacity-100 md:opacity-0 md:group-hover/conversation:opacity-100"
                    onClick={() => requestDelete(item)}
                    disabled={deleteDisabled}
                    aria-label={localization.deleteConversationLabel.replace(
                      "{title}",
                      item.title,
                    )}
                    title={
                      busyConversationId === item.id
                        ? localization.deleteConversationActiveRunDisabled
                        : localization.deleteConversationAction
                    }
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              );
            })}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
      <DeleteConversationAlertDialog
        conversation={conversationPendingDelete}
        error={deleteConversation.error}
        isPending={deleteConversation.isPending}
        localization={localization}
        onConfirm={(item) => void handleDelete(item)}
        onOpenChange={handleDialogOpenChange}
        open={Boolean(conversationPendingDelete)}
      />
    </>
  );
}

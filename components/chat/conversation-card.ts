import { cn } from "@/lib/utils";

/**
 * Row styling for a conversation in the shell sidebar's history list.
 *
 * Lives in its own module — with no `"use client"` and no JSX — because
 * `tests/chatworkspace-footer.test.ts` and `tests/component-public-exports.test.ts`
 * import it through `components/ChatWorkspace` in a node environment. Keeping it
 * out of the rendering component is what let the old `ConversationSidebar` be
 * deleted without touching either test.
 */
/**
 * A list row, not a card. Bordered cards gave every conversation the visual
 * weight of a panel, so a handful of them filled the rail; history should read
 * as a scannable list of titles. Selection is carried by a fill rather than a
 * border so rows sit flush against each other.
 *
 * Every `hover:` token on the active row restates a value the row already has —
 * hovering the current conversation must not repaint it. Asserted in
 * `tests/chatworkspace-footer.test.ts`.
 */
export function getConversationCardClassName(isActiveConversation: boolean) {
  return cn(
    "group/conversation flex items-center gap-1 rounded-md pr-1 transition-colors",
    isActiveConversation
      ? "bg-cal-primary/12 text-cal-ink hover:bg-cal-primary/12 hover:text-cal-ink"
      : "text-cal-body hover:bg-cal-surface-soft",
  );
}

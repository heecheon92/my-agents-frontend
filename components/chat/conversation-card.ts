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
    /*
     * `relative` positions the delete control over the title rather than beside
     * it, so a title is never shortened to reserve a gutter for a button that
     * is usually invisible.
     *
     * `min-w-0` is load-bearing. The row is a grid item, and a grid item's
     * default `min-width: auto` resolves to its min-content — which, for a
     * `nowrap` title, is the full untruncated string. A long title made the row
     * 578px wide inside a 271px sidebar and the list scrolled sideways.
     */
    "group/conversation relative flex min-w-0 items-center rounded-md transition-colors",
    isActiveConversation
      ? "bg-cal-primary/12 text-cal-ink hover:bg-cal-primary/12 hover:text-cal-ink"
      : "text-cal-body hover:bg-cal-surface-soft",
  );
}

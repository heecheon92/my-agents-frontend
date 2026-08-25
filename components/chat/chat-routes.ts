/**
 * Mirrors `knowledgeSourceHref` / `groupHref` in `components/admin-surfaces/shared`.
 * Chat keeps its own copy rather than importing from `admin-surfaces`, which is
 * a separate feature area.
 */
export function conversationHref(conversationId: string) {
  return `/chat/${encodeURIComponent(conversationId)}`;
}

/** Bare `/chat` is the new-conversation state: no id until the first send. */
export const NEW_CHAT_HREF = "/chat";

/**
 * The conversation id the URL currently points at, or `undefined` for a new chat.
 *
 * Reads the **pathname**, which is the only client-side source that tracks both
 * kinds of URL change this feature makes. `ensureConversationId` moves the URL
 * with `history.replaceState` to avoid remounting the workspace mid-run, and
 * that deliberately performs no route transition — so Next's route `params`
 * still report the value the page was loaded with. Deriving the active
 * conversation from params therefore reads a frozen value, and the optimistic
 * id that shadows it never gets cleared.
 *
 * Used by both `ChatWorkspace` and `ConversationHistorySidebarGroup`; they
 * previously each had their own answer and disagreed after a `replaceState`.
 */
export function conversationIdFromPathname(pathname: string) {
  if (!pathname.startsWith(`${NEW_CHAT_HREF}/`)) return undefined;
  return pathname.slice(NEW_CHAT_HREF.length + 1) || undefined;
}

/** Whether the pathname is any chat route, with or without a conversation. */
export function isChatPathname(pathname: string) {
  return pathname === NEW_CHAT_HREF || pathname.startsWith(`${NEW_CHAT_HREF}/`);
}

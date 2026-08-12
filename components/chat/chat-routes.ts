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

"use client";

import { create } from "zustand";

/**
 * A one-field bridge between the chat route and the conversation history in the
 * shell sidebar, which is a sibling of the route and so cannot be reached by
 * props. The history needs it to keep the delete button disabled while a
 * conversation has a run in flight; `isStreaming`/`isCancelling` are
 * client-only, so the query cache cannot carry them.
 *
 * **Keep this to the busy id.** No draft, no `streamedReply`, no citations.
 * Anything high-frequency here re-renders the whole sidebar on every token, at
 * which point this has become the route-global store that was deliberately
 * rejected in favour of sharing the TanStack Query cache. See DESIGN.md.
 */
type ChatActivityState = {
  busyConversationId: string | null;
  setBusyConversationId: (conversationId: string | null) => void;
};

export const useChatActivityStore = create<ChatActivityState>((set) => ({
  busyConversationId: null,
  setBusyConversationId: (busyConversationId) =>
    set((state) =>
      // Idempotent: the publishing effect re-runs on unrelated dependency
      // changes, and an unconditional `set` would notify every subscriber.
      state.busyConversationId === busyConversationId
        ? state
        : { busyConversationId },
    ),
}));

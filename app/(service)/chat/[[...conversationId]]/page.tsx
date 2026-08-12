import { ChatWorkspace } from "@/components/ChatWorkspace";

/**
 * One optional catch-all segment serving both `/chat` and `/chat/<id>`.
 *
 * Deliberately not two page files. With a static `/chat` and a separate
 * `/chat/[conversationId]`, the `router.push` that follows auto-creating a
 * conversation crosses a segment boundary, so React unmounts `ChatWorkspace`
 * and mounts a fresh one mid-run — destroying the optimistic user bubble, the
 * streaming buffer, and `isStreaming`, while the in-flight run loop carries on
 * writing to a tree that is no longer mounted. The user saw nothing at all
 * until the answer landed.
 *
 * Sharing one segment means the navigation re-renders this page with new params
 * instead of remounting it, so client state survives the URL change.
 */
export default async function ChatPage({
  params,
}: {
  params: Promise<{ conversationId?: string[] }>;
}) {
  const { conversationId } = await params;

  return <ChatWorkspace initialConversationId={conversationId?.[0]} />;
}

import type { AgentEvent, KnowledgeBaseSelection } from "@/model/my-agents";

export type ChatLocalization = typeof import("@/localization/en.json")["chat"];

export type LiveActivityEvent = Pick<
  AgentEvent,
  "id" | "sequence" | "event_type"
> & {
  payload: unknown;
};

export type QueuedMessage = {
  conversationId: string;
  content: string;
  knowledgeBaseSelection: KnowledgeBaseSelection;
  /**
   * Uploaded attachment IDs this message should read.
   *
   * Carried on the message rather than read from composer state at drain time:
   * a queued message keeps the files it was written against, so editing the
   * selection while it waits cannot silently change what the held question
   * ends up asking about.
   */
  attachmentIds: string[];
};

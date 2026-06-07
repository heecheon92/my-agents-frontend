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
};

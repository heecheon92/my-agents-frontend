import type {
  Conversation,
  KnowledgeBaseSelection,
  KnowledgeBaseSelectionMode,
  Message,
} from "@/model/my-agents";
import { isMyAgentsAPIError } from "@/services/my-agents/MyAgentsAPIError";
import type { LiveActivityEvent } from "./types";

export type RunOutcome =
  | "completed"
  | "cancelled"
  | "failed"
  | "active_conflict";

export const CHAT_BOTTOM_THRESHOLD_PX = 96;
export const ACTIVE_RUN_STALE_NOTICE_AFTER_MS = 30_000;

export function getLatestAssistantMessageId(messages: Message[]) {
  return [...messages].reverse().find((message) => message.role === "assistant")
    ?.id;
}

export function getNextConversationIdAfterDelete(
  conversations: Array<Pick<Conversation, "id">>,
  deletedConversationId: string,
  activeConversationId?: string,
) {
  if (activeConversationId !== deletedConversationId)
    return activeConversationId;

  const deletedIndex = conversations.findIndex(
    (item) => item.id === deletedConversationId,
  );
  const remainingConversations = conversations.filter(
    (item) => item.id !== deletedConversationId,
  );
  if (remainingConversations.length === 0) return undefined;
  if (deletedIndex < 0) return remainingConversations[0]?.id;
  return (
    remainingConversations[deletedIndex]?.id ??
    remainingConversations[deletedIndex - 1]?.id
  );
}

export function isActiveAgentRunStatus(status: string) {
  return status === "running" || status === "cancelling";
}

export function isObservedActiveRunStale({
  activeRunId,
  observedRunId,
  observedAt,
  now,
  thresholdMs = ACTIVE_RUN_STALE_NOTICE_AFTER_MS,
}: {
  activeRunId: string | null;
  observedRunId: string | null;
  observedAt: number | null;
  now: number;
  thresholdMs?: number;
}) {
  return Boolean(
    activeRunId &&
      activeRunId === observedRunId &&
      observedAt !== null &&
      now - observedAt >= thresholdMs,
  );
}

export function shouldRecordLiveActivityEvent(eventType: string) {
  return eventType !== "answer_delta";
}

export function createLiveActivityEvent({
  eventType,
  payload,
  sequence,
}: {
  eventType: string;
  payload: unknown;
  sequence: number;
}): LiveActivityEvent {
  return {
    id: `live-${sequence}`,
    sequence,
    event_type: eventType,
    payload,
  };
}

export function isConversationRunAlreadyActiveError(error: unknown) {
  if (!isMyAgentsAPIError(error) || error.status !== 409) return false;
  const details = [error.detail, error.message];
  if (typeof error.body === "string") {
    details.push(error.body);
  }
  if (error.body && typeof error.body === "object") {
    const body = error.body as { detail?: unknown; message?: unknown };
    if (typeof body.detail === "string") details.push(body.detail);
    if (typeof body.message === "string") details.push(body.message);
  }
  return details.some((detail) =>
    detail?.toLowerCase().includes("conversation run already active"),
  );
}

export function safeBackendDetail(value: unknown) {
  if (value && typeof value === "object" && "detail" in value) {
    const detail = (value as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return undefined;
}

export function isNearScrollBottom(element: HTMLElement) {
  return (
    element.scrollHeight - element.scrollTop - element.clientHeight <=
    CHAT_BOTTOM_THRESHOLD_PX
  );
}

export function buildActiveKnowledgeBaseSelection({
  knowledgeBaseMode,
  selectedKnowledgeBaseIds,
}: {
  knowledgeBaseMode: KnowledgeBaseSelectionMode;
  selectedKnowledgeBaseIds: string[];
}): KnowledgeBaseSelection {
  return {
    mode: knowledgeBaseMode,
    knowledge_base_ids:
      knowledgeBaseMode === "selected" ? selectedKnowledgeBaseIds : [],
  };
}

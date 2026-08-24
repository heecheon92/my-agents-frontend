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
  // The run suspended to ask the user something. Distinct from every other
  // outcome because the conversation is neither free nor producing output: the
  // queue must hold, and the partial answer must stay on screen.
  | "interrupted"
  | "active_conflict";

export const CHAT_BOTTOM_THRESHOLD_PX = 96;
export const ACTIVE_RUN_STALE_NOTICE_AFTER_MS = 30_000;

export function getLatestAssistantMessageId(messages: Message[]) {
  return [...messages].reverse().find((message) => message.role === "assistant")
    ?.id;
}

/** `conversationCreateRequestSchema` accepts 1–200 characters. */
const CONVERSATION_TITLE_MAX_LENGTH = 80;

/**
 * Names a conversation after the message that started it, so the history list
 * reads as a list of questions rather than a column of timestamps.
 *
 * The fallback covers a draft that is only whitespace or punctuation — the
 * backend rejects an empty title, and an unnamed conversation is worse than a
 * dated one.
 */
export function deriveConversationTitle(draft: string, fallback: string) {
  const collapsed = draft.replace(/\s+/g, " ").trim();
  if (!collapsed) return fallback.slice(0, CONVERSATION_TITLE_MAX_LENGTH);
  return collapsed.slice(0, CONVERSATION_TITLE_MAX_LENGTH);
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

/** A run status the backend serves for a suspended, unanswered interaction. */
export const WAITING_FOR_INPUT_STATUS = "waiting_for_input";

/**
 * A run that is actively producing output.
 *
 * Deliberately excludes `waiting_for_input`: a suspended run writes nothing, so
 * treating it as active here would render a stop button offering to interrupt
 * an answer that is not being written, and would start the streaming-run
 * staleness clock against a run that is legitimately idle for hours.
 */
export function isActiveAgentRunStatus(status: string) {
  return status === "running" || status === "cancelling";
}

export function isWaitingForInputRunStatus(status: string) {
  return status === WAITING_FOR_INPUT_STATUS;
}

/**
 * A run that prevents starting another one in the same conversation.
 *
 * Broader than `isActiveAgentRunStatus`, and the distinction is load-bearing.
 * The backend refuses a new run while an interaction is unanswered using the
 * *existing* `conversation_run_already_active` 409 — there is no distinct code
 * — so the client cannot tell "busy" from "waiting" from the error and has to
 * know from status. Before this existed, a run moving to `waiting_for_input`
 * looked exactly like completion, so the composer went idle while every send
 * was rejected.
 */
export function isBlockingAgentRunStatus(status: string) {
  return isActiveAgentRunStatus(status) || isWaitingForInputRunStatus(status);
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

/**
 * Appends a live event, numbering it from the list it is joining.
 *
 * The sequence comes from `current`, never from a counter the caller keeps.
 * One run can emit events from more than one stream: a run that suspends to
 * ask a question resumes into a second `streamResumeRunEvents` call that
 * appends to this same list. A per-stream counter restarts at 1 there and
 * collides with the `live-1` already recorded before the interrupt, which
 * React reports as two children with the same key and may resolve by dropping
 * or duplicating a row. Deriving the number from the array makes that class of
 * drift unrepresentable rather than merely fixed here.
 */
export function appendLiveActivityEvent(
  current: LiveActivityEvent[],
  { eventType, payload }: { eventType: string; payload: unknown },
): LiveActivityEvent[] {
  return [
    ...current,
    createLiveActivityEvent({
      eventType,
      payload,
      sequence: current.length + 1,
    }),
  ];
}

/**
 * The backend's "a run is already outstanding here" 409.
 *
 * Matched on the machine-readable `code`, not on the English `detail`. The
 * previous implementation substring-matched `"conversation run already active"`,
 * which meant any rewording or localization of the backend's prose would have
 * silently turned every queue-on-busy into a hard error. `code` is the contract
 * (`docs/backend-requests.md`), and `errors.byCode` already localizes from it.
 *
 * The detail fallback is kept only for a backend old enough to omit `code`.
 */
export function isConversationRunAlreadyActiveError(error: unknown) {
  if (!isMyAgentsAPIError(error) || error.status !== 409) return false;
  if (error.body && typeof error.body === "object") {
    const code = (error.body as { code?: unknown }).code;
    if (typeof code === "string") return code === CONVERSATION_RUN_ACTIVE_CODE;
  }
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

const CONVERSATION_RUN_ACTIVE_CODE = "conversation_run_already_active";

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

import { API_PATH } from "@/constants/api-path";
import { TEXT_EVENT_STREAM_CONTENT_TYPE } from "@/constants/header";
import {
  type AgentEvent,
  type AgentRunSummary,
  type AnswerDeltaEventData,
  agentEventSchema,
  agentRunSummarySchema,
  answerDeltaEventDataSchema,
  type Conversation,
  type ConversationCreateRequest,
  type ConversationRunInterruptedResponse,
  type ConversationRunRequest,
  type ConversationRunResponse,
  type ConversationRunResult,
  type ConversationRunResumeRequest,
  conversationRunInterruptedResponseSchema,
  conversationRunResponseSchema,
  conversationRunResultSchema,
  conversationRunResumeRequestSchema,
  conversationSchema,
  type DocumentSelectionOptionsPage,
  type DurableRunCancelledEventData,
  type DurableRunFailedEventData,
  documentSelectionOptionsPageSchema,
  durableRunCancelledEventDataSchema,
  durableRunFailedEventDataSchema,
  type Message,
  type MessageCreateRequest,
  messageSchema,
  type ReasoningSummaryDeltaEventData,
  type RunAdmissionReceipt,
  type RunCancelledEventData,
  type RunCancelResponse,
  type RunOutputSnapshot,
  type RunResumedActivityPayload,
  type RunStartedEventData,
  reasoningSummaryDeltaEventDataSchema,
  runAdmissionReceiptSchema,
  runCancelledEventDataSchema,
  runCancelResponseSchema,
  runOutputSnapshotSchema,
  runResumedActivityPayloadSchema,
  runStartedEventDataSchema,
} from "@/model/my-agents";
import { type MyAgentsFetchClient, myAgentsFetchClient } from "./fetch-client";
import { parseArrayWithSchema, parseWithSchema } from "./parser";
import { streamServerSentEvents } from "./sse";

export type ConversationRunStreamEvent =
  | { event: "run_started"; data: RunStartedEventData }
  | { event: "answer_delta"; data: AnswerDeltaEventData }
  /*
   * `data` is nullable here and nowhere else in this union. A reasoning summary
   * is display metadata riding on the same stream as the answer, so an
   * unparseable one is dropped rather than thrown: throwing would abort the
   * `for await` in the run loop and lose the reply over a caption.
   */
  | {
      event: "reasoning_summary_delta";
      data: ReasoningSummaryDeltaEventData | null;
    }
  | { event: "run_cancelled"; data: RunCancelledEventData }
  | { event: "run_completed"; data: ConversationRunResponse }
  | { event: "run_interrupted"; data: ConversationRunInterruptedResponse }
  | { event: "run_resumed"; data: RunResumedActivityPayload }
  | { event: string; data: unknown };

function parseStreamEventData(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function parseConversationRunStreamEvent({
  event,
  data,
}: {
  event: string;
  data: string;
}): ConversationRunStreamEvent {
  const parsedData = parseStreamEventData(data);
  if (event === "run_started") {
    return {
      event,
      data: parseWithSchema(runStartedEventDataSchema, parsedData),
    };
  }
  if (event === "answer_delta") {
    return {
      event,
      data: parseWithSchema(answerDeltaEventDataSchema, parsedData),
    };
  }
  if (event === "reasoning_summary_delta") {
    const parsed = reasoningSummaryDeltaEventDataSchema.safeParse(parsedData);
    return { event, data: parsed.success ? parsed.data : null };
  }
  if (event === "run_cancelled") {
    return {
      event,
      data: parseWithSchema(runCancelledEventDataSchema, parsedData),
    };
  }
  if (event === "run_completed") {
    return {
      event,
      data: parseWithSchema(conversationRunResponseSchema, parsedData),
    };
  }
  // The run suspended to ask the user something. The stream sends the *full*
  // interrupted response — the same body as the HTTP 202, nested `interaction`
  // and first page of options included — not the thinner persisted activity
  // payload. Parsing it strictly is therefore correct and does not need the
  // required fields relaxed.
  if (event === "run_interrupted") {
    return {
      event,
      data: parseWithSchema(
        conversationRunInterruptedResponseSchema,
        parsedData,
      ),
    };
  }
  if (event === "run_resumed") {
    return {
      event,
      data: parseWithSchema(runResumedActivityPayloadSchema, parsedData),
    };
  }
  return { event, data: parsedData };
}

/**
 * One frame from the durable listener (`GET .../runs/{rid}/stream`).
 *
 * The event names are the legacy ones, but two terminal payloads are the
 * listener's own: `run_failed` carries a stable `code`, and `run_cancelled`
 * always reports that no answer was persisted. `data` is `null` when a terminal
 * payload does not parse, so the caller still learns the run ended.
 *
 * `deliveryId` is the SSE `id` line: the run's monotonic delivery cursor. It
 * never appears inside `data`. `null` only when the line is missing or not a
 * non-negative integer, in which case the frame cannot move the cursor.
 */
export type DurableRunStreamEvent = {
  deliveryId: number | null;
} & (
  | { event: "run_failed"; data: DurableRunFailedEventData | null }
  | { event: "run_cancelled"; data: DurableRunCancelledEventData | null }
  | Exclude<
      ConversationRunStreamEvent,
      { event: "run_failed" } | { event: "run_cancelled" }
    >
);

export function parseDeliveryId(id: string | undefined): number | null {
  if (id === undefined || !/^\d{1,15}$/.test(id)) return null;
  return Number(id);
}

function parseDurableRunStreamEvent(event: {
  event: string;
  data: string;
  id?: string;
}): DurableRunStreamEvent {
  const deliveryId = parseDeliveryId(event.id);
  if (event.event === "run_failed") {
    const parsed = durableRunFailedEventDataSchema.safeParse(
      parseStreamEventData(event.data),
    );
    return {
      deliveryId,
      event: "run_failed",
      data: parsed.success ? parsed.data : null,
    };
  }
  if (event.event === "run_cancelled") {
    const parsed = durableRunCancelledEventDataSchema.safeParse(
      parseStreamEventData(event.data),
    );
    return {
      deliveryId,
      event: "run_cancelled",
      data: parsed.success ? parsed.data : null,
    };
  }
  // The terminal events carry the answer and the question, so a malformed one
  // is a contract failure and is thrown. Every other frame is display
  // metadata: one that does not parse is kept raw rather than ending a
  // server-owned answer that is still being written.
  if (event.event === "run_completed" || event.event === "run_interrupted") {
    return {
      deliveryId,
      ...parseConversationRunStreamEvent(event),
    } as DurableRunStreamEvent;
  }
  try {
    return {
      deliveryId,
      ...parseConversationRunStreamEvent(event),
    } as DurableRunStreamEvent;
  } catch {
    return {
      deliveryId,
      event: event.event,
      data: parseStreamEventData(event.data),
    } as DurableRunStreamEvent;
  }
}

export class MyAgentsConversationAPI {
  constructor(
    private readonly client: Pick<
      MyAgentsFetchClient,
      "fetch" | "fetchResponse"
    > = myAgentsFetchClient,
  ) {}

  async create(payload: ConversationCreateRequest): Promise<Conversation> {
    return parseWithSchema(
      conversationSchema,
      await this.client.fetch(API_PATH.conversations.root, {
        method: "POST",
        body: payload,
      }),
    );
  }

  async list(): Promise<Conversation[]> {
    return parseArrayWithSchema(
      conversationSchema,
      await this.client.fetch(API_PATH.conversations.root),
    );
  }

  async detail(conversationId: string): Promise<Conversation> {
    return parseWithSchema(
      conversationSchema,
      await this.client.fetch(API_PATH.conversations.detail(conversationId)),
    );
  }

  async delete(conversationId: string): Promise<void> {
    await this.client.fetch(API_PATH.conversations.detail(conversationId), {
      method: "DELETE",
    });
  }

  async addMessage(
    conversationId: string,
    payload: MessageCreateRequest,
  ): Promise<Message> {
    return parseWithSchema(
      messageSchema,
      await this.client.fetch(API_PATH.conversations.messages(conversationId), {
        method: "POST",
        body: payload,
      }),
    );
  }

  async messages(conversationId: string): Promise<Message[]> {
    return parseArrayWithSchema(
      messageSchema,
      await this.client.fetch(API_PATH.conversations.messages(conversationId)),
    );
  }

  async replayMessage(
    conversationId: string,
    messageId: string,
  ): Promise<ConversationRunResponse> {
    return parseWithSchema(
      conversationRunResponseSchema,
      await this.client.fetch(
        API_PATH.conversations.replayMessage(conversationId, messageId),
        {
          method: "POST",
        },
      ),
    );
  }

  async streamReplayMessage(
    conversationId: string,
    messageId: string,
  ): Promise<Response> {
    return this.client.fetchResponse(
      API_PATH.conversations.replayMessageStream(conversationId, messageId),
      {
        method: "POST",
        headers: { Accept: TEXT_EVENT_STREAM_CONTENT_TYPE },
      },
    );
  }

  async *streamReplayMessageEvents(
    conversationId: string,
    messageId: string,
  ): AsyncGenerator<ConversationRunStreamEvent> {
    const response = await this.streamReplayMessage(conversationId, messageId);
    for await (const event of streamServerSentEvents(response)) {
      yield parseConversationRunStreamEvent(event);
    }
  }

  async run(
    conversationId: string,
    payload: ConversationRunRequest,
  ): Promise<ConversationRunResult> {
    // 200 completed or 202 waiting_for_input. `fetchResponse` treats both as
    // success, so the union is decided by body shape, not status code.
    return parseWithSchema(
      conversationRunResultSchema,
      await this.client.fetch(API_PATH.conversations.runs(conversationId), {
        method: "POST",
        body: payload,
      }),
    );
  }

  async resumeRun(
    conversationId: string,
    runId: string,
    payload: ConversationRunResumeRequest,
  ): Promise<ConversationRunResult> {
    return parseWithSchema(
      conversationRunResultSchema,
      await this.client.fetch(
        API_PATH.conversations.resumeRun(conversationId, runId),
        {
          method: "POST",
          body: conversationRunResumeRequestSchema.parse(payload),
        },
      ),
    );
  }

  async streamResumeRun(
    conversationId: string,
    runId: string,
    payload: ConversationRunResumeRequest,
  ): Promise<Response> {
    return this.client.fetchResponse(
      API_PATH.conversations.resumeRunStream(conversationId, runId),
      {
        method: "POST",
        body: conversationRunResumeRequestSchema.parse(payload),
        headers: { Accept: TEXT_EVENT_STREAM_CONTENT_TYPE },
      },
    );
  }

  async *streamResumeRunEvents(
    conversationId: string,
    runId: string,
    payload: ConversationRunResumeRequest,
  ): AsyncGenerator<ConversationRunStreamEvent> {
    const response = await this.streamResumeRun(conversationId, runId, payload);
    for await (const event of streamServerSentEvents(response)) {
      yield parseConversationRunStreamEvent(event);
    }
  }

  async interactionOptions(
    conversationId: string,
    runId: string,
    interactionId: string,
    cursor?: string | null,
  ): Promise<DocumentSelectionOptionsPage> {
    const path = API_PATH.conversations.interactionOptions(
      conversationId,
      runId,
      interactionId,
    );
    return parseWithSchema(
      documentSelectionOptionsPageSchema,
      await this.client.fetch(
        cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path,
      ),
    );
  }

  async cancelRun(
    conversationId: string,
    runId: string,
  ): Promise<RunCancelResponse> {
    return parseWithSchema(
      runCancelResponseSchema,
      await this.client.fetch(
        API_PATH.conversations.cancelRun(conversationId, runId),
        {
          method: "POST",
        },
      ),
    );
  }

  async streamRun(
    conversationId: string,
    payload: ConversationRunRequest,
  ): Promise<Response> {
    return this.client.fetchResponse(
      API_PATH.conversations.runStream(conversationId),
      {
        method: "POST",
        body: payload,
        headers: { Accept: TEXT_EVENT_STREAM_CONTENT_TYPE },
      },
    );
  }

  async *streamRunEvents(
    conversationId: string,
    payload: ConversationRunRequest,
  ): AsyncGenerator<ConversationRunStreamEvent> {
    const response = await this.streamRun(conversationId, payload);
    for await (const event of streamServerSentEvents(response)) {
      yield parseConversationRunStreamEvent(event);
    }
  }

  /**
   * Admits a durable run. The server commits the prompt, the run, and a queued
   * job together and answers `202`; the answer is produced by a worker, not by
   * this request. Idempotent on `client_request_id`: repeating the same send
   * returns the same run with its current status, so a retry is always safe.
   */
  async admitRun(
    conversationId: string,
    payload: ConversationRunRequest & { client_request_id: string },
  ): Promise<RunAdmissionReceipt> {
    return parseWithSchema(
      runAdmissionReceiptSchema,
      await this.client.fetch(
        API_PATH.conversations.runsAsync(conversationId),
        {
          method: "POST",
          body: payload,
        },
      ),
    );
  }

  /** Durable resume. Continues the same run, so its cursor keeps counting. */
  async resumeRunAsync(
    conversationId: string,
    runId: string,
    payload: {
      client_request_id: string;
      answer: ConversationRunResumeRequest;
    },
  ): Promise<RunAdmissionReceipt> {
    return parseWithSchema(
      runAdmissionReceiptSchema,
      await this.client.fetch(
        API_PATH.conversations.resumeRunAsync(conversationId, runId),
        {
          method: "POST",
          body: {
            client_request_id: payload.client_request_id,
            answer: conversationRunResumeRequestSchema.parse(payload.answer),
          },
        },
      ),
    );
  }

  /** Durable regeneration. Creates a new run, which has its own cursor. */
  async replayMessageAsync(
    conversationId: string,
    messageId: string,
    /** `request` omitted means the server's defaults, as the sync route. */
    payload: { client_request_id: string; request?: Record<string, unknown> },
  ): Promise<RunAdmissionReceipt> {
    return parseWithSchema(
      runAdmissionReceiptSchema,
      await this.client.fetch(
        API_PATH.conversations.replayMessageAsync(conversationId, messageId),
        {
          method: "POST",
          body: payload,
        },
      ),
    );
  }

  /** One consistent read of a run's committed output, for any status. */
  async runOutput(
    conversationId: string,
    runId: string,
  ): Promise<RunOutputSnapshot> {
    return parseWithSchema(
      runOutputSnapshotSchema,
      await this.client.fetch(
        API_PATH.conversations.runOutput(conversationId, runId),
      ),
    );
  }

  /**
   * Listens to a durable run from just after `after`.
   *
   * Read-only: closing it, aborting it, or losing the connection detaches this
   * viewer and never cancels the run. Only `cancelRun` stops one.
   */
  async *subscribeRunEvents(
    conversationId: string,
    runId: string,
    { after, signal }: { after: number; signal?: AbortSignal },
  ): AsyncGenerator<DurableRunStreamEvent> {
    const response = await this.client.fetchResponse(
      `${API_PATH.conversations.runSubscription(conversationId, runId)}?after=${after}`,
      {
        method: "GET",
        headers: { Accept: TEXT_EVENT_STREAM_CONTENT_TYPE },
        signal,
      },
    );
    for await (const event of streamServerSentEvents(response)) {
      yield parseDurableRunStreamEvent(event);
    }
  }

  async runs(conversationId: string): Promise<AgentRunSummary[]> {
    return parseArrayWithSchema(
      agentRunSummarySchema,
      await this.client.fetch(API_PATH.conversations.runs(conversationId)),
    );
  }

  async runDetail(
    conversationId: string,
    runId: string,
  ): Promise<ConversationRunResult> {
    // The refresh path: a run left waiting reports its pending interaction
    // here, which is what lets a reload rebuild the card.
    return parseWithSchema(
      conversationRunResultSchema,
      await this.client.fetch(
        API_PATH.conversations.run(conversationId, runId),
      ),
    );
  }

  async events(conversationId: string, runId: string): Promise<AgentEvent[]> {
    return parseArrayWithSchema(
      agentEventSchema,
      await this.client.fetch(
        API_PATH.conversations.runEvents(conversationId, runId),
      ),
    );
  }
}

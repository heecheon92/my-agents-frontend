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
  documentSelectionOptionsPageSchema,
  type Message,
  type MessageCreateRequest,
  messageSchema,
  type RunCancelledEventData,
  type RunCancelResponse,
  type RunResumedActivityPayload,
  type RunStartedEventData,
  runCancelledEventDataSchema,
  runCancelResponseSchema,
  runResumedActivityPayloadSchema,
  runStartedEventDataSchema,
} from "@/model/my-agents";
import { type MyAgentsFetchClient, myAgentsFetchClient } from "./fetch-client";
import { parseArrayWithSchema, parseWithSchema } from "./parser";
import { streamServerSentEvents } from "./sse";

export type ConversationRunStreamEvent =
  | { event: "run_started"; data: RunStartedEventData }
  | { event: "answer_delta"; data: AnswerDeltaEventData }
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

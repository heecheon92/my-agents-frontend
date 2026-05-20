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
  type ConversationRunRequest,
  type ConversationRunResponse,
  conversationRunResponseSchema,
  conversationSchema,
  type Message,
  type MessageCreateRequest,
  messageSchema,
} from "@/model/my-agents";
import { type MyAgentsFetchClient, myAgentsFetchClient } from "./fetch-client";
import { parseArrayWithSchema, parseWithSchema } from "./parser";
import { streamServerSentEvents } from "./sse";

export type ConversationRunStreamEvent =
  | { event: "answer_delta"; data: AnswerDeltaEventData }
  | { event: "run_completed"; data: ConversationRunResponse }
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
  if (event === "answer_delta") {
    return {
      event,
      data: parseWithSchema(answerDeltaEventDataSchema, parsedData),
    };
  }
  if (event === "run_completed") {
    return {
      event,
      data: parseWithSchema(conversationRunResponseSchema, parsedData),
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

  async run(
    conversationId: string,
    payload: ConversationRunRequest,
  ): Promise<ConversationRunResponse> {
    return parseWithSchema(
      conversationRunResponseSchema,
      await this.client.fetch(API_PATH.conversations.runs(conversationId), {
        method: "POST",
        body: payload,
      }),
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
  ): Promise<ConversationRunResponse> {
    return parseWithSchema(
      conversationRunResponseSchema,
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

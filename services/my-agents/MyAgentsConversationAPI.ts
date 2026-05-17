import { API_PATH } from "@/constants/api-path";
import {
  type AgentEvent,
  type AgentRunSummary,
  agentEventSchema,
  agentRunSummarySchema,
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

export class MyAgentsConversationAPI {
  constructor(
    private readonly client: MyAgentsFetchClient = myAgentsFetchClient,
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

  async runs(conversationId: string): Promise<AgentRunSummary[]> {
    return parseArrayWithSchema(
      agentRunSummarySchema,
      await this.client.fetch(API_PATH.conversations.runs(conversationId)),
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

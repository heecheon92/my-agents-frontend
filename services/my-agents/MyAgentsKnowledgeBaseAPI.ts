import { API_PATH } from "@/constants/api-path";
import {
  type Document,
  documentSchema,
  type KnowledgeBase,
  type KnowledgeBaseCreateRequest,
  knowledgeBaseSchema,
} from "@/model/my-agents";
import { type MyAgentsFetchClient, myAgentsFetchClient } from "./fetch-client";
import { parseArrayWithSchema, parseWithSchema } from "./parser";

export class MyAgentsKnowledgeBaseAPI {
  constructor(
    private readonly client: Pick<
      MyAgentsFetchClient,
      "fetch"
    > = myAgentsFetchClient,
  ) {}

  async create(payload: KnowledgeBaseCreateRequest): Promise<KnowledgeBase> {
    return parseWithSchema(
      knowledgeBaseSchema,
      await this.client.fetch(API_PATH.knowledgeBases.root, {
        method: "POST",
        body: payload,
      }),
    );
  }

  async ensureTeamUploadStaging(): Promise<KnowledgeBase> {
    return parseWithSchema(
      knowledgeBaseSchema,
      await this.client.fetch(API_PATH.knowledgeBases.teamUploadStaging, {
        method: "POST",
      }),
    );
  }

  async list(): Promise<KnowledgeBase[]> {
    return parseArrayWithSchema(
      knowledgeBaseSchema,
      await this.client.fetch(API_PATH.knowledgeBases.root),
    );
  }

  async detail(knowledgeBaseId: string): Promise<KnowledgeBase> {
    return parseWithSchema(
      knowledgeBaseSchema,
      await this.client.fetch(API_PATH.knowledgeBases.detail(knowledgeBaseId)),
    );
  }

  async documents(knowledgeBaseId: string): Promise<Document[]> {
    return parseArrayWithSchema(
      documentSchema,
      await this.client.fetch(
        API_PATH.knowledgeBases.documents(knowledgeBaseId),
      ),
    );
  }
}

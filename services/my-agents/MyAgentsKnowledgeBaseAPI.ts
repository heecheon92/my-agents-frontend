import { API_PATH } from "@/constants/api-path";
import {
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

  async list(): Promise<KnowledgeBase[]> {
    return parseArrayWithSchema(
      knowledgeBaseSchema,
      await this.client.fetch(API_PATH.knowledgeBases.root),
    );
  }
}

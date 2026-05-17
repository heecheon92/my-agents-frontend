import { API_PATH } from "@/constants/api-path";
import { type HealthResponse, healthResponseSchema } from "@/model/my-agents";
import { myAgentsFetchClient } from "./fetch-client";
import { MyAgentsAuthAPI } from "./MyAgentsAuthAPI";
import { MyAgentsConversationAPI } from "./MyAgentsConversationAPI";
import { MyAgentsDocumentAPI } from "./MyAgentsDocumentAPI";
import { MyAgentsGroupAPI } from "./MyAgentsGroupAPI";
import { MyAgentsKnowledgeBaseAPI } from "./MyAgentsKnowledgeBaseAPI";
import { parseWithSchema } from "./parser";

export class MyAgentsAPI {
  readonly auth = new MyAgentsAuthAPI();
  readonly conversations = new MyAgentsConversationAPI();
  readonly groups = new MyAgentsGroupAPI();
  readonly knowledgeBases = new MyAgentsKnowledgeBaseAPI();
  readonly documents = new MyAgentsDocumentAPI();

  async health(): Promise<HealthResponse> {
    return parseWithSchema(
      healthResponseSchema,
      await myAgentsFetchClient.fetch(API_PATH.health),
    );
  }
}

export const myAgentsAPI = new MyAgentsAPI();

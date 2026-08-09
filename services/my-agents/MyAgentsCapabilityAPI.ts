import { API_PATH } from "@/constants/api-path";
import {
  type ReasoningCapabilities,
  reasoningCapabilitiesSchema,
} from "@/model/my-agents";
import { myAgentsFetchClient } from "./fetch-client";
import { parseWithSchema } from "./parser";

export class MyAgentsCapabilityAPI {
  private readonly client = myAgentsFetchClient;

  /**
   * What the deployed backend will accept on a run.
   *
   * Authenticated, and deliberately the only source of defaults and level
   * lists — hardcoding them here would desync the moment the backend changes
   * `MY_AGENTS_OPENAI_REASONING_EFFORT` or its model.
   */
  async reasoning(): Promise<ReasoningCapabilities> {
    const value = await this.client.fetch(API_PATH.capabilities.reasoning);
    return parseWithSchema(reasoningCapabilitiesSchema, value);
  }
}

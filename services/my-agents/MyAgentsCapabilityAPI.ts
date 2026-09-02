import { API_PATH } from "@/constants/api-path";
import {
  type DocumentWorkspaceCapability,
  documentWorkspaceCapabilitySchema,
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

  /**
   * Whether this account can attach temporary files, and on what terms.
   *
   * Both `enabled` and `eligible` must be true before any usable control is
   * rendered — a disabled deployment and an ineligible account are different
   * facts with different copy, and neither may leave a working request path
   * behind a greyed-out button.
   */
  async documentWorkspace(): Promise<DocumentWorkspaceCapability> {
    const value = await this.client.fetch(
      API_PATH.capabilities.documentWorkspace,
    );
    return parseWithSchema(documentWorkspaceCapabilitySchema, value);
  }
}

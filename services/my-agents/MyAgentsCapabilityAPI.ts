import { API_PATH } from "@/constants/api-path";
import {
  type AssistantModelCapabilities,
  assistantModelCapabilitiesSchema,
  type DocumentWorkspaceCapability,
  documentWorkspaceCapabilitySchema,
  type ReasoningCapabilities,
  reasoningCapabilitiesSchema,
  type SummarizationModelCapabilities,
  summarizationModelCapabilitiesSchema,
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
   * its configured model, whose provider recommendation sets the default.
   */
  async reasoning(): Promise<ReasoningCapabilities> {
    const value = await this.client.fetch(API_PATH.capabilities.reasoning);
    return parseWithSchema(reasoningCapabilitiesSchema, value);
  }

  /**
   * The models a registered user may choose for chat, each with its own
   * display name, recommended reasoning effort, and Pro support. The picker
   * renders this list as served; nothing here hardcodes a model.
   */
  async assistantModels(): Promise<AssistantModelCapabilities> {
    const value = await this.client.fetch(
      API_PATH.capabilities.assistantModels,
    );
    return parseWithSchema(assistantModelCapabilitiesSchema, value);
  }

  /** Models offered for summarizing earlier turns, and the recommended one. */
  async summarizationModels(): Promise<SummarizationModelCapabilities> {
    const value = await this.client.fetch(
      API_PATH.capabilities.summarizationModels,
    );
    return parseWithSchema(summarizationModelCapabilitiesSchema, value);
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

import { API_PATH } from "@/constants/api-path";
import {
  type AssistantPreferences,
  type AssistantPreferencesPatchRequest,
  assistantPreferencesSchema,
  type SummarizationPreferences,
  type SummarizationPreferencesPatchRequest,
  summarizationPreferencesSchema,
} from "@/model/my-agents";
import { type MyAgentsFetchClient, myAgentsFetchClient } from "./fetch-client";
import { parseWithSchema } from "./parser";

export class MyAgentsAssistantAPI {
  constructor(
    private readonly client: Pick<
      MyAgentsFetchClient,
      "fetch"
    > = myAgentsFetchClient,
  ) {}

  /** The signed-in account's model choice and the model runs will use. */
  async getPreferences(): Promise<AssistantPreferences> {
    return parseWithSchema(
      assistantPreferencesSchema,
      await this.client.fetch(API_PATH.assistant.preferences),
    );
  }

  /**
   * Saves the account's model. `assistant_model: null` returns to the
   * deployment default. Guests are rejected by the backend with 403.
   */
  async updatePreferences(
    payload: AssistantPreferencesPatchRequest,
  ): Promise<AssistantPreferences> {
    return parseWithSchema(
      assistantPreferencesSchema,
      await this.client.fetch(API_PATH.assistant.preferences, {
        method: "PATCH",
        body: payload,
      }),
    );
  }

  /** The model that summarizes earlier turns, and the one compaction uses. */
  async getSummarizationPreferences(): Promise<SummarizationPreferences> {
    return parseWithSchema(
      summarizationPreferencesSchema,
      await this.client.fetch(API_PATH.summarization.preferences),
    );
  }

  /** `summarization_model: null` returns to the deployment default. */
  async updateSummarizationPreferences(
    payload: SummarizationPreferencesPatchRequest,
  ): Promise<SummarizationPreferences> {
    return parseWithSchema(
      summarizationPreferencesSchema,
      await this.client.fetch(API_PATH.summarization.preferences, {
        method: "PATCH",
        body: payload,
      }),
    );
  }
}

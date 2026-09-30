import { API_PATH } from "@/constants/api-path";
import {
  type AssistantPreferences,
  type AssistantPreferencesPatchRequest,
  assistantPreferencesSchema,
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
}

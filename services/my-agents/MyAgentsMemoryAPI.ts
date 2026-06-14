import { API_PATH } from "@/constants/api-path";
import {
  type UserMemorySettings,
  type UserMemorySettingsPatchRequest,
  userMemorySettingsSchema,
} from "@/model/my-agents";
import { type MyAgentsFetchClient, myAgentsFetchClient } from "./fetch-client";
import { parseWithSchema } from "./parser";

export class MyAgentsMemoryAPI {
  constructor(
    private readonly client: Pick<
      MyAgentsFetchClient,
      "fetch"
    > = myAgentsFetchClient,
  ) {}

  async getSettings(): Promise<UserMemorySettings> {
    return parseWithSchema(
      userMemorySettingsSchema,
      await this.client.fetch(API_PATH.memories.settings),
    );
  }

  async updateSettings(
    payload: UserMemorySettingsPatchRequest,
  ): Promise<UserMemorySettings> {
    return parseWithSchema(
      userMemorySettingsSchema,
      await this.client.fetch(API_PATH.memories.settings, {
        method: "PATCH",
        body: payload,
      }),
    );
  }
}

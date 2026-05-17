import { API_PATH } from "@/constants/api-path";
import {
  type Group,
  type GroupCreateRequest,
  groupSchema,
  type MemberPatchRequest,
  type MemberUpsertRequest,
} from "@/model/my-agents";
import { type MyAgentsFetchClient, myAgentsFetchClient } from "./fetch-client";
import { parseArrayWithSchema, parseWithSchema } from "./parser";

export class MyAgentsGroupAPI {
  constructor(
    private readonly client: MyAgentsFetchClient = myAgentsFetchClient,
  ) {}

  async create(payload: GroupCreateRequest): Promise<Group> {
    return parseWithSchema(
      groupSchema,
      await this.client.fetch(API_PATH.groups.root, {
        method: "POST",
        body: payload,
      }),
    );
  }

  async list(): Promise<Group[]> {
    return parseArrayWithSchema(
      groupSchema,
      await this.client.fetch(API_PATH.groups.root),
    );
  }

  async detail(groupId: string): Promise<Group> {
    return parseWithSchema(
      groupSchema,
      await this.client.fetch(API_PATH.groups.detail(groupId)),
    );
  }

  async addMember(
    groupId: string,
    payload: MemberUpsertRequest,
  ): Promise<void> {
    await this.client.fetch(API_PATH.groups.members(groupId), {
      method: "POST",
      body: payload,
    });
  }

  async updateMember(
    groupId: string,
    userId: string,
    payload: MemberPatchRequest,
  ): Promise<void> {
    await this.client.fetch(API_PATH.groups.member(groupId, userId), {
      method: "PATCH",
      body: payload,
    });
  }
}

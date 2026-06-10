import { API_PATH } from "@/constants/api-path";
import {
  type Group,
  type GroupCreateRequest,
  type GroupInvitation,
  type GroupInvitationAcceptRequest,
  type GroupInvitationCreateRequest,
  type GroupInvitationUpdateRequest,
  groupInvitationSchema,
  groupSchema,
  type KnowledgePublishRequest,
  type KnowledgePublishRequestCreateRequest,
  knowledgePublishRequestSchema,
  type MemberPatchRequest,
} from "@/model/my-agents";
import { type MyAgentsFetchClient, myAgentsFetchClient } from "./fetch-client";
import { parseArrayWithSchema, parseWithSchema } from "./parser";

export class MyAgentsGroupAPI {
  constructor(
    private readonly client: Pick<
      MyAgentsFetchClient,
      "fetch"
    > = myAgentsFetchClient,
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

  async createInvitation(
    groupId: string,
    payload: GroupInvitationCreateRequest,
  ): Promise<GroupInvitation> {
    return parseWithSchema(
      groupInvitationSchema,
      await this.client.fetch(API_PATH.groups.invitations(groupId), {
        method: "POST",
        body: payload,
      }),
    );
  }

  async invitations(groupId: string): Promise<GroupInvitation[]> {
    return parseArrayWithSchema(
      groupInvitationSchema,
      await this.client.fetch(API_PATH.groups.invitations(groupId)),
    );
  }

  async updateInvitation(
    groupId: string,
    invitationId: string,
    payload: GroupInvitationUpdateRequest,
  ): Promise<GroupInvitation> {
    return parseWithSchema(
      groupInvitationSchema,
      await this.client.fetch(
        API_PATH.groups.invitation(groupId, invitationId),
        {
          method: "PATCH",
          body: payload,
        },
      ),
    );
  }

  async resendInvitation(
    groupId: string,
    invitationId: string,
  ): Promise<GroupInvitation> {
    return parseWithSchema(
      groupInvitationSchema,
      await this.client.fetch(
        API_PATH.groups.invitationResend(groupId, invitationId),
        { method: "POST" },
      ),
    );
  }

  async cancelInvitation(groupId: string, invitationId: string): Promise<void> {
    await this.client.fetch(API_PATH.groups.invitation(groupId, invitationId), {
      method: "DELETE",
    });
  }

  async acceptInvitation(payload: GroupInvitationAcceptRequest): Promise<void> {
    await this.client.fetch(API_PATH.groupInvitations.accept, {
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

  async createPublishRequest(
    groupId: string,
    payload: KnowledgePublishRequestCreateRequest,
  ): Promise<KnowledgePublishRequest> {
    return parseWithSchema(
      knowledgePublishRequestSchema,
      await this.client.fetch(API_PATH.groups.publishRequests(groupId), {
        method: "POST",
        body: payload,
      }),
    );
  }

  async publishRequests(groupId: string): Promise<KnowledgePublishRequest[]> {
    return parseArrayWithSchema(
      knowledgePublishRequestSchema,
      await this.client.fetch(API_PATH.groups.publishRequests(groupId)),
    );
  }

  async approvePublishRequest(
    groupId: string,
    requestId: string,
  ): Promise<KnowledgePublishRequest> {
    return parseWithSchema(
      knowledgePublishRequestSchema,
      await this.client.fetch(
        API_PATH.groups.publishRequestApprove(groupId, requestId),
        { method: "POST" },
      ),
    );
  }

  async rejectPublishRequest(
    groupId: string,
    requestId: string,
  ): Promise<KnowledgePublishRequest> {
    return parseWithSchema(
      knowledgePublishRequestSchema,
      await this.client.fetch(
        API_PATH.groups.publishRequestReject(groupId, requestId),
        { method: "POST" },
      ),
    );
  }
}

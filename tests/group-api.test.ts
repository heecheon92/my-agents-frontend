import { describe, expect, it } from "vitest";
import { MyAgentsGroupAPI } from "@/services/my-agents/MyAgentsGroupAPI";

describe("MyAgentsGroupAPI invitations", () => {
  const invitation = {
    id: "invite-1",
    group_id: "group-1",
    invited_email: "teammate@example.com",
    role: "viewer",
    status: "pending",
    created_at: "2026-06-10T07:00:00Z",
    expires_at: "2026-06-17T07:00:00Z",
    accepted_at: null,
    cancelled_at: null,
    resent_at: null,
  };
  const member = {
    member_id: "member-1",
    user_id: "user-1",
    nickname: "Test User",
    role: "viewer",
    created_at: "2026-06-10T07:00:00Z",
  };

  it("creates invitations and lists manager-only member basics without user-id activation", async () => {
    const calls: Array<{ path: string; init?: unknown }> = [];
    const api = new MyAgentsGroupAPI({
      fetch: async (path, init) => {
        calls.push({ path, init });
        if (path.endsWith("/members") && !init) return [member];
        return path.endsWith("/invitations") && !init
          ? [invitation]
          : invitation;
      },
    });

    await expect(
      api.createInvitation("group-1", {
        email: "teammate@example.com",
        role: "viewer",
      }),
    ).resolves.toMatchObject({
      invited_email: "teammate@example.com",
      status: "pending",
    });
    await expect(api.invitations("group-1")).resolves.toHaveLength(1);
    await expect(api.members("group-1")).resolves.toEqual([member]);

    expect(calls).toEqual([
      {
        path: "/groups/group-1/invitations",
        init: {
          method: "POST",
          body: { email: "teammate@example.com", role: "viewer" },
        },
      },
      { path: "/groups/group-1/invitations", init: undefined },
      { path: "/groups/group-1/members", init: undefined },
    ]);
  });

  it("updates, resends, cancels, accepts, and signs up invitations", async () => {
    const calls: Array<{ path: string; init?: unknown }> = [];
    const api = new MyAgentsGroupAPI({
      fetch: async (path, init) => {
        calls.push({ path, init });
        if (path === "/group-invitations/signup") {
          return {
            user: {
              id: "user-2",
              email: "invitee@example.com",
              nickname: "Invitee",
              email_verified_at: "2026-06-10T07:01:00Z",
              approval_status: "approved",
              is_guest: false,
              guest_expires_at: null,
            },
            member: { ...member, user_id: "user-2", nickname: "Invitee" },
          };
        }
        return invitation;
      },
    });

    await expect(
      api.updateInvitation("group-1", "invite-1", { role: "editor" }),
    ).resolves.toMatchObject({ id: "invite-1" });
    await expect(
      api.resendInvitation("group-1", "invite-1"),
    ).resolves.toMatchObject({ id: "invite-1" });
    await expect(
      api.cancelInvitation("group-1", "invite-1"),
    ).resolves.toBeUndefined();
    await expect(
      api.acceptInvitation({ token: "opaque-token" }),
    ).resolves.toBeUndefined();
    await expect(
      api.signupFromInvitation({
        token: "opaque-token",
        nickname: "Invitee",
        password: "correct horse battery staple",
      }),
    ).resolves.toMatchObject({
      user: { email: "invitee@example.com", nickname: "Invitee" },
      member: { nickname: "Invitee" },
    });

    expect(calls).toEqual([
      {
        path: "/groups/group-1/invitations/invite-1",
        init: { method: "PATCH", body: { role: "editor" } },
      },
      {
        path: "/groups/group-1/invitations/invite-1/resend",
        init: { method: "POST" },
      },
      {
        path: "/groups/group-1/invitations/invite-1",
        init: { method: "DELETE" },
      },
      {
        path: "/group-invitations/accept",
        init: { method: "POST", body: { token: "opaque-token" } },
      },
      {
        path: "/group-invitations/signup",
        init: {
          method: "POST",
          body: {
            token: "opaque-token",
            nickname: "Invitee",
            password: "correct horse battery staple",
          },
        },
      },
    ]);
  });
});

describe("MyAgentsGroupAPI publish requests", () => {
  it("creates and parses publish requests", async () => {
    const calls: Array<{ path: string; init?: unknown }> = [];
    const api = new MyAgentsGroupAPI({
      fetch: async (path, init) => {
        calls.push({ path, init });
        return {
          id: "request-1",
          requester_user_id: "user-1",
          target_group_id: "group-1",
          target_knowledge_base_id: "kb-group-1",
          source_document_id: "doc-personal-1",
          source_knowledge_base_id: null,
          source_document_title: "Private draft",
          source_document_excerpt: "Preview text for review.",
          source_document_filename: null,
          source_knowledge_base_name: null,
          target_knowledge_base_name: "Group KB",
          status: "pending",
          reviewer_user_id: null,
          published_document_id: null,
          published_knowledge_base_id: null,
          created_at: "2026-05-24T07:00:00Z",
          reviewed_at: null,
        };
      },
    });

    await expect(
      api.createPublishRequest("group-1", {
        source_document_id: "doc-personal-1",
        target_knowledge_base_id: "kb-group-1",
      }),
    ).resolves.toMatchObject({ id: "request-1", status: "pending" });
    expect(calls).toEqual([
      {
        path: "/groups/group-1/publish-requests",
        init: {
          method: "POST",
          body: {
            source_document_id: "doc-personal-1",
            target_knowledge_base_id: "kb-group-1",
          },
        },
      },
    ]);
  });

  it("lists and reviews publish requests", async () => {
    const calls: Array<{ path: string; init?: unknown }> = [];
    const api = new MyAgentsGroupAPI({
      fetch: async (path, init) => {
        calls.push({ path, init });
        const response = {
          id: "request-1",
          requester_user_id: "user-1",
          target_group_id: "group-1",
          target_knowledge_base_id: "kb-group-1",
          source_document_id: "doc-personal-1",
          source_knowledge_base_id: null,
          source_document_title: "Private draft",
          source_document_excerpt: "Preview text for review.",
          source_document_filename: "draft.md",
          source_knowledge_base_name: null,
          target_knowledge_base_name: "Group KB",
          status: path.endsWith("approve") ? "approved" : "rejected",
          reviewer_user_id: "admin-1",
          published_document_id: path.endsWith("approve")
            ? "doc-group-1"
            : null,
          published_knowledge_base_id: null,
          created_at: "2026-05-24T07:00:00Z",
          reviewed_at: "2026-05-24T07:05:00Z",
        };
        if (path === "/groups/group-1/publish-requests") return [response];
        if (path === "/groups/group-1/publish-requests/request-1/source") {
          return {
            request_id: "request-1",
            source_kind: "document",
            source_knowledge_base_id: null,
            source_knowledge_base_name: null,
            documents: [
              {
                id: "doc-personal-1",
                title: "Private draft",
                content: "Full extracted content for owner review.",
                source_type: "text",
                source_filename: "draft.md",
                source_content_type: "text/markdown",
                source_byte_size: 42,
                source_page_count: null,
                parser_name: "markdown_upload",
                created_at: "2026-05-24T07:00:00Z",
              },
            ],
          };
        }
        return response;
      },
    });

    await expect(api.publishRequests("group-1")).resolves.toMatchObject([
      {
        source_document_title: "Private draft",
        source_document_excerpt: "Preview text for review.",
        target_knowledge_base_name: "Group KB",
      },
    ]);
    await expect(
      api.publishRequestSource("group-1", "request-1"),
    ).resolves.toMatchObject({
      source_kind: "document",
      documents: [
        {
          title: "Private draft",
          content: "Full extracted content for owner review.",
        },
      ],
    });
    await expect(
      api.approvePublishRequest("group-1", "request-1"),
    ).resolves.toMatchObject({
      status: "approved",
      published_document_id: "doc-group-1",
    });
    await expect(
      api.rejectPublishRequest("group-1", "request-1"),
    ).resolves.toMatchObject({
      status: "rejected",
      published_document_id: null,
    });
    expect(calls).toEqual([
      { path: "/groups/group-1/publish-requests", init: undefined },
      {
        path: "/groups/group-1/publish-requests/request-1/source",
        init: undefined,
      },
      {
        path: "/groups/group-1/publish-requests/request-1/approve",
        init: { method: "POST" },
      },
      {
        path: "/groups/group-1/publish-requests/request-1/reject",
        init: { method: "POST" },
      },
    ]);
  });

  it("creates whole personal KB publish requests", async () => {
    const calls: Array<{ path: string; init?: unknown }> = [];
    const api = new MyAgentsGroupAPI({
      fetch: async (path, init) => {
        calls.push({ path, init });
        return {
          id: "request-kb-1",
          requester_user_id: "user-1",
          target_group_id: "group-1",
          target_knowledge_base_id: null,
          source_document_id: null,
          source_knowledge_base_id: "kb-personal-1",
          status: "pending",
          reviewer_user_id: null,
          published_document_id: null,
          published_knowledge_base_id: null,
          created_at: "2026-05-24T07:00:00Z",
          reviewed_at: null,
        };
      },
    });

    await expect(
      api.createPublishRequest("group-1", {
        source_knowledge_base_id: "kb-personal-1",
      }),
    ).resolves.toMatchObject({
      id: "request-kb-1",
      source_knowledge_base_id: "kb-personal-1",
    });
    expect(calls[0]?.init).toMatchObject({
      method: "POST",
      body: { source_knowledge_base_id: "kb-personal-1" },
    });
  });
});

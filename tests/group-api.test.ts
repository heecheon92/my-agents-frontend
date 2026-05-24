import { describe, expect, it } from "vitest";
import { MyAgentsGroupAPI } from "@/services/my-agents/MyAgentsGroupAPI";

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
          status: "pending",
          reviewer_user_id: null,
          published_document_id: null,
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
          status: path.endsWith("approve") ? "approved" : "rejected",
          reviewer_user_id: "admin-1",
          published_document_id: path.endsWith("approve")
            ? "doc-group-1"
            : null,
          created_at: "2026-05-24T07:00:00Z",
          reviewed_at: "2026-05-24T07:05:00Z",
        };
        return path === "/groups/group-1/publish-requests"
          ? [response]
          : response;
      },
    });

    await expect(api.publishRequests("group-1")).resolves.toHaveLength(1);
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
        path: "/groups/group-1/publish-requests/request-1/approve",
        init: { method: "POST" },
      },
      {
        path: "/groups/group-1/publish-requests/request-1/reject",
        init: { method: "POST" },
      },
    ]);
  });
});

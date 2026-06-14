import { describe, expect, it } from "vitest";
import { buildKnowledgeBaseCreateRequest } from "@/components/knowledge-base-create";
import { MyAgentsKnowledgeBaseAPI } from "@/services/my-agents/MyAgentsKnowledgeBaseAPI";

describe("knowledge base creation payloads", () => {
  it("builds a trimmed personal knowledge-base payload without a group id", () => {
    expect(
      buildKnowledgeBaseCreateRequest({
        name: "  Research notes  ",
        scope: "personal",
      }),
    ).toEqual({ name: "Research notes", scope: "personal" });
  });

  it("requires an existing group id for group knowledge-base payloads", () => {
    expect(
      buildKnowledgeBaseCreateRequest({
        name: "Group research",
        scope: "group",
      }),
    ).toBeNull();

    expect(
      buildKnowledgeBaseCreateRequest({
        groupId: "group-1",
        name: "Group research",
        scope: "group",
      }),
    ).toEqual({ name: "Group research", scope: "group", group_id: "group-1" });
  });
});

describe("MyAgentsKnowledgeBaseAPI", () => {
  it("creates or reuses the hidden team upload staging knowledge base", async () => {
    const calls: Array<{ path: string; init?: { method?: string } }> = [];
    const api = new MyAgentsKnowledgeBaseAPI({
      fetch: async (path, init) => {
        calls.push({ path, init });
        return {
          id: "kb-staging-1",
          name: "Group upload staging",
          scope: "personal",
          purpose: "team_upload_staging",
          owner_user_id: "user-1",
          group_id: null,
          published_group_ids: [],
        };
      },
    });

    await expect(api.ensureTeamUploadStaging()).resolves.toMatchObject({
      id: "kb-staging-1",
      purpose: "team_upload_staging",
    });
    expect(calls).toEqual([
      {
        path: "/knowledge-bases/team-upload-staging",
        init: { method: "POST" },
      },
    ]);
  });

  it("posts personal knowledge-base creation requests without a group id", async () => {
    const calls: Array<{
      path: string;
      init?: { method?: string; body?: unknown };
    }> = [];
    const api = new MyAgentsKnowledgeBaseAPI({
      fetch: async (path, init) => {
        calls.push({ path, init });
        return {
          id: "kb-personal-1",
          name: "Research notes",
          scope: "personal",
          owner_user_id: "user-1",
          group_id: null,
          created_at: "2026-05-24T08:00:00Z",
        };
      },
    });

    await expect(
      api.create({ name: "Research notes", scope: "personal" }),
    ).resolves.toMatchObject({
      id: "kb-personal-1",
      scope: "personal",
      group_id: null,
    });

    expect(calls).toEqual([
      {
        path: "/knowledge-bases",
        init: {
          method: "POST",
          body: {
            name: "Research notes",
            scope: "personal",
          },
        },
      },
    ]);
  });

  it("posts group knowledge-base creation requests to the backend contract", async () => {
    const calls: Array<{
      path: string;
      init?: { method?: string; body?: unknown };
    }> = [];
    const api = new MyAgentsKnowledgeBaseAPI({
      fetch: async (path, init) => {
        calls.push({ path, init });
        return {
          id: "kb-group-1",
          name: "Group research",
          scope: "group",
          owner_user_id: "user-1",
          group_id: "group-1",
          created_at: "2026-05-24T08:00:00Z",
        };
      },
    });

    await expect(
      api.create({
        name: "Group research",
        scope: "group",
        group_id: "group-1",
      }),
    ).resolves.toMatchObject({
      id: "kb-group-1",
      scope: "group",
      group_id: "group-1",
    });

    expect(calls).toEqual([
      {
        path: "/knowledge-bases",
        init: {
          method: "POST",
          body: {
            name: "Group research",
            scope: "group",
            group_id: "group-1",
          },
        },
      },
    ]);
  });
});

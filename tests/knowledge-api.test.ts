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
        name: "Team research",
        scope: "group",
      }),
    ).toBeNull();

    expect(
      buildKnowledgeBaseCreateRequest({
        groupId: "group-1",
        name: "Team research",
        scope: "group",
      }),
    ).toEqual({ name: "Team research", scope: "group", group_id: "group-1" });
  });
});

describe("MyAgentsKnowledgeBaseAPI", () => {
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
          name: "Team research",
          scope: "group",
          owner_user_id: "user-1",
          group_id: "group-1",
          created_at: "2026-05-24T08:00:00Z",
        };
      },
    });

    await expect(
      api.create({
        name: "Team research",
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
            name: "Team research",
            scope: "group",
            group_id: "group-1",
          },
        },
      },
    ]);
  });
});

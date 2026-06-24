import { describe, expect, it } from "vitest";
import { buildKnowledgeBaseCreateRequest } from "@/components/knowledge-base-create";
import {
  documentSchema,
  knowledgeBaseDocumentPreviewSchema,
  knowledgeBaseUpdateRequestSchema,
} from "@/model/my-agents";
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

  it("builds system knowledge-base payloads only for system managers", () => {
    expect(
      buildKnowledgeBaseCreateRequest({
        name: "Project facts",
        scope: "system",
      }),
    ).toBeNull();

    expect(
      buildKnowledgeBaseCreateRequest({
        canManageSystemKnowledge: true,
        name: "  Project facts  ",
        scope: "system",
      }),
    ).toEqual({ name: "Project facts", scope: "system" });
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

  it("posts system knowledge-base creation requests to the planned backend contract", async () => {
    const calls: Array<{
      path: string;
      init?: { method?: string; body?: unknown };
    }> = [];
    const api = new MyAgentsKnowledgeBaseAPI({
      fetch: async (path, init) => {
        calls.push({ path, init });
        return {
          id: "kb-system-1",
          name: "Project facts",
          scope: "system",
          owner_user_id: "manager-1",
          group_id: null,
          created_at: "2026-06-14T08:00:00Z",
        };
      },
    });

    await expect(
      api.create({
        name: "Project facts",
        scope: "system",
      }),
    ).resolves.toMatchObject({
      id: "kb-system-1",
      scope: "system",
      group_id: null,
    });

    expect(calls).toEqual([
      {
        path: "/knowledge-bases",
        init: {
          method: "POST",
          body: {
            name: "Project facts",
            scope: "system",
          },
        },
      },
    ]);
  });

  it("updates and deletes manageable knowledge bases through scoped paths", async () => {
    const calls: Array<{
      path: string;
      init?: { method?: string; body?: unknown };
    }> = [];
    const api = new MyAgentsKnowledgeBaseAPI({
      fetch: async (path, init) => {
        calls.push({ path, init });
        return {
          id: "kb-personal-1",
          name: "Renamed notes",
          scope: "personal",
          owner_user_id: "user-1",
          group_id: null,
          created_at: "2026-06-24T08:00:00Z",
        };
      },
    });

    await expect(
      api.update("kb-personal-1", { name: "Renamed notes" }),
    ).resolves.toMatchObject({
      id: "kb-personal-1",
      name: "Renamed notes",
    });
    await expect(api.remove("kb-personal-1")).resolves.toBeUndefined();

    expect(calls).toEqual([
      {
        path: "/knowledge-bases/kb-personal-1",
        init: {
          method: "PATCH",
          body: { name: "Renamed notes" },
        },
      },
      {
        path: "/knowledge-bases/kb-personal-1",
        init: { method: "DELETE" },
      },
    ]);
  });

  it("loads KB-scoped document previews without inflating list payloads", async () => {
    const calls: Array<{ path: string; init?: unknown }> = [];
    const api = new MyAgentsKnowledgeBaseAPI({
      fetch: async (path, init) => {
        calls.push({ path, init });
        if (path.endsWith("/preview")) {
          return {
            id: "doc-1",
            title: "Preview memo",
            content: "## Internal Markdown\n\nPreview body.",
            source_type: "markdown",
            source_filename: "memo.md",
            source_content_type: "text/markdown",
            source_byte_size: 128,
            source_page_count: null,
            parser_name: "markdown_upload",
            created_at: "2026-06-24T08:00:00Z",
          };
        }
        return [];
      },
    });

    await expect(api.documentPreview("kb-1", "doc-1")).resolves.toMatchObject({
      id: "doc-1",
      content: "## Internal Markdown\n\nPreview body.",
      parser_name: "markdown_upload",
    });

    expect(calls).toEqual([
      {
        path: "/knowledge-bases/kb-1/documents/doc-1/preview",
        init: undefined,
      },
    ]);
  });
});

describe("knowledge base API contracts", () => {
  it("parses update and document preview backend payloads", () => {
    expect(
      knowledgeBaseUpdateRequestSchema.parse({ name: "  Renamed space  " }),
    ).toEqual({ name: "Renamed space" });

    expect(
      knowledgeBaseDocumentPreviewSchema.parse({
        id: "doc-1",
        title: "Previewable source",
        content: "# Extracted Markdown\nBody",
        source_type: "word_document",
        source_filename: "source.docx",
        source_content_type:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        source_byte_size: 2048,
        source_page_count: 3,
        parser_name: "office_parser",
        created_at: "2026-06-24T01:00:00Z",
      }),
    ).toMatchObject({
      id: "doc-1",
      content: "# Extracted Markdown\nBody",
      source_type: "word_document",
    });
  });

  it("keeps document list parsing lightweight without full content", () => {
    const parsed = documentSchema.parse({
      id: "doc-1",
      title: "List row",
      owner_user_id: "user-1",
      group_id: null,
      knowledge_base_id: "kb-1",
      source_type: "text",
      content: "Full body should not be part of the list model.",
    });

    expect(parsed).not.toHaveProperty("content");
  });
});

describe("MyAgentsKnowledgeBaseAPI lifecycle methods", () => {
  it("updates, deletes, and previews through KB-scoped paths", async () => {
    const calls: Array<{
      path: string;
      init?: { method?: string; body?: unknown };
    }> = [];
    const api = new MyAgentsKnowledgeBaseAPI({
      fetch: async (path, init) => {
        calls.push({ path, init });
        if (path.endsWith("/preview")) {
          return {
            id: "doc-1",
            title: "Previewable source",
            content: "Preview body",
            source_type: "text",
            source_filename: "source.md",
            source_content_type: "text/markdown",
            source_byte_size: 42,
            source_page_count: null,
            parser_name: "markdown",
            created_at: "2026-06-24T01:00:00Z",
          };
        }
        if (init?.method === "DELETE") return null;
        return {
          id: "kb-1",
          name: "Renamed space",
          scope: "personal",
          owner_user_id: "user-1",
          group_id: null,
          purpose: "standard",
          published_group_ids: [],
        };
      },
    });

    await expect(
      api.update("kb-1", { name: "Renamed space" }),
    ).resolves.toMatchObject({ name: "Renamed space" });
    await expect(api.remove("kb-1")).resolves.toBeUndefined();
    await expect(api.documentPreview("kb-1", "doc-1")).resolves.toMatchObject({
      id: "doc-1",
      content: "Preview body",
    });

    expect(calls).toEqual([
      {
        path: "/knowledge-bases/kb-1",
        init: { method: "PATCH", body: { name: "Renamed space" } },
      },
      { path: "/knowledge-bases/kb-1", init: { method: "DELETE" } },
      {
        path: "/knowledge-bases/kb-1/documents/doc-1/preview",
        init: undefined,
      },
    ]);
  });
});

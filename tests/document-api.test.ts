import { describe, expect, it } from "vitest";
import { documentSchema, extractionRunSchema } from "@/model/my-agents";
import { MyAgentsDocumentAPI } from "@/services/my-agents/MyAgentsDocumentAPI";

describe("MyAgentsDocumentAPI", () => {
  it("uploads PDFs through the backend multipart contract", async () => {
    const calls: Array<{
      path: string;
      init?: { method?: string; body?: unknown };
    }> = [];
    const api = new MyAgentsDocumentAPI({
      fetch: async (path, init) => {
        calls.push({ path, init });
        return {
          id: "doc-1",
          title: "Phase 2 PDF",
          owner_user_id: "user-1",
          group_id: null,
          knowledge_base_id: null,
          source_type: "pdf",
          source_filename: "phase-2.pdf",
          source_content_type: "application/pdf",
          source_byte_size: 128,
          source_sha256: "abc123",
          source_page_count: 2,
          parser_name: "pypdf",
        };
      },
    });

    const file = new File(["%PDF text"], "phase-2.pdf", {
      type: "application/pdf",
    });

    await expect(
      api.upload({ title: "Phase 2 PDF", file }),
    ).resolves.toMatchObject({
      id: "doc-1",
      source_type: "pdf",
      source_filename: "phase-2.pdf",
      source_page_count: 2,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe("/documents/upload");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.init?.body).toBeInstanceOf(FormData);
    const formData = calls[0]?.init?.body as FormData;
    expect(formData.get("title")).toBe("Phase 2 PDF");
    expect(formData.get("file")).toBe(file);
  });

  it.each([
    {
      fileName: "notes.md",
      type: "text/markdown",
      sourceType: "markdown",
      parserName: "text",
    },
    {
      fileName: "notes.txt",
      type: "text/plain",
      sourceType: "text",
      parserName: "text",
    },
  ])(
    "uploads $fileName through the shared document upload contract",
    async ({ fileName, type, sourceType, parserName }) => {
      const calls: Array<{
        path: string;
        init?: { method?: string; body?: unknown };
      }> = [];
      const api = new MyAgentsDocumentAPI({
        fetch: async (path, init) => {
          calls.push({ path, init });
          return {
            id: "doc-1",
            title: "Uploaded notes",
            owner_user_id: "user-1",
            group_id: null,
            knowledge_base_id: null,
            source_type: sourceType,
            source_filename: fileName,
            source_content_type: type,
            source_byte_size: 32,
            source_sha256: "abc123",
            source_page_count: null,
            parser_name: parserName,
          };
        },
      });

      const file = new File(["# Notes\nPlain text"], fileName, { type });

      await expect(
        api.upload({ title: "Uploaded notes", file }),
      ).resolves.toMatchObject({
        id: "doc-1",
        source_type: sourceType,
        source_filename: fileName,
        parser_name: parserName,
      });

      expect(calls).toHaveLength(1);
      expect(calls[0]?.path).toBe("/documents/upload");
      expect(calls[0]?.init?.method).toBe("POST");
      const formData = calls[0]?.init?.body as FormData;
      expect(formData.get("title")).toBe("Uploaded notes");
      expect(formData.get("file")).toBe(file);
    },
  );

  it("deletes documents through the backend 204 contract", async () => {
    const calls: Array<{ path: string; init?: { method?: string } }> = [];
    const api = new MyAgentsDocumentAPI({
      fetch: async (path, init) => {
        calls.push({ path, init });
        return null;
      },
    });

    await expect(api.remove("doc-1")).resolves.toBeUndefined();

    expect(calls).toEqual([
      { path: "/documents/doc-1", init: { method: "DELETE" } },
    ]);
  });

  it("starts async ingestion and polls a single extraction run", async () => {
    const calls: Array<{ path: string; init?: { method?: string } }> = [];
    const api = new MyAgentsDocumentAPI({
      fetch: async (path, init) => {
        calls.push({ path, init });
        return {
          id: "run-1",
          document_id: "doc-1",
          status: path.endsWith("/ingest/async") ? "pending" : "completed",
          stage: path.endsWith("/ingest/async") ? "queued" : "completed",
          progress_percent: path.endsWith("/ingest/async") ? 0 : 100,
          chunk_count: 4,
          entity_count: 2,
          relationship_count: 1,
          error: null,
          started_at: "2026-05-22T00:00:00Z",
          completed_at: path.endsWith("/ingest/async")
            ? null
            : "2026-05-22T00:00:05Z",
        };
      },
    });

    await expect(api.ingestAsync("doc-1")).resolves.toMatchObject({
      id: "run-1",
      status: "pending",
      stage: "queued",
      progress_percent: 0,
    });
    await expect(api.extractionRun("doc-1", "run-1")).resolves.toMatchObject({
      id: "run-1",
      status: "completed",
      stage: "completed",
      progress_percent: 100,
    });

    expect(calls).toEqual([
      {
        path: "/documents/doc-1/ingest/async",
        init: { method: "POST" },
      },
      {
        path: "/documents/doc-1/extraction-runs/run-1",
        init: undefined,
      },
    ]);
  });

  it("accepts backend uploaded document source metadata", () => {
    expect(
      documentSchema.parse({
        id: "doc-1",
        title: "Uploaded PDF",
        owner_user_id: "user-1",
        group_id: null,
        knowledge_base_id: null,
        source_type: "pdf",
        source_filename: "uploaded.pdf",
        source_content_type: "application/pdf",
        source_byte_size: 2048,
        source_sha256: "f".repeat(64),
        source_page_count: 3,
        parser_name: "pypdf",
      }),
    ).toMatchObject({
      source_type: "pdf",
      source_filename: "uploaded.pdf",
      source_page_count: 3,
    });

    expect(
      documentSchema.parse({
        id: "doc-2",
        title: "Uploaded Markdown",
        owner_user_id: "user-1",
        group_id: null,
        knowledge_base_id: null,
        source_type: "markdown",
        source_filename: "notes.md",
        source_content_type: "text/markdown",
        source_byte_size: 128,
        source_sha256: "a".repeat(64),
        source_page_count: null,
        parser_name: "text",
      }),
    ).toMatchObject({
      source_type: "markdown",
      source_filename: "notes.md",
      parser_name: "text",
    });

    expect(
      documentSchema.parse({
        id: "doc-3",
        title: "Uploaded Text",
        owner_user_id: "user-1",
        group_id: null,
        knowledge_base_id: null,
        source_type: "text",
        source_filename: "notes.txt",
        source_content_type: "text/plain",
        source_byte_size: 128,
        source_sha256: "b".repeat(64),
        source_page_count: null,
        parser_name: "text",
      }),
    ).toMatchObject({
      source_type: "text",
      source_filename: "notes.txt",
      parser_name: "text",
    });
  });

  it("accepts async extraction run progress metadata", () => {
    expect(
      extractionRunSchema.parse({
        id: "run-1",
        document_id: "doc-1",
        status: "running",
        stage: "embedding",
        progress_percent: 45,
        chunk_count: 8,
        entity_count: 3,
        relationship_count: 2,
        error: null,
        started_at: "2026-05-22T00:00:00Z",
        completed_at: null,
      }),
    ).toMatchObject({
      id: "run-1",
      status: "running",
      stage: "embedding",
      progress_percent: 45,
    });
  });
});

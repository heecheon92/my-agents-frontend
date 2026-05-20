import { describe, expect, it } from "vitest";
import { documentSchema } from "@/model/my-agents";
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

  it("accepts backend Phase 2 document source metadata", () => {
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
  });
});

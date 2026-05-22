import { describe, expect, it } from "vitest";
import { API_PATH, toFrontendAPIPath } from "@/constants/api-path";
import { MyAgentsQueryKeys } from "@/constants/query-keys";

const conversationId = "conversation-1";
const knowledgeBaseId = "kb-1";
const documentId = "doc-1";
const runId = "run-1";

describe("API_PATH", () => {
  it("builds conversation run/event paths", () => {
    expect(API_PATH.conversations.runs(conversationId)).toBe(
      "/conversations/conversation-1/runs",
    );
    expect(API_PATH.conversations.run(conversationId, runId)).toBe(
      "/conversations/conversation-1/runs/run-1",
    );
    expect(API_PATH.conversations.cancelRun(conversationId, runId)).toBe(
      "/conversations/conversation-1/runs/run-1/cancel",
    );
    expect(API_PATH.conversations.runStream(conversationId)).toBe(
      "/conversations/conversation-1/runs/stream",
    );
    expect(API_PATH.conversations.runEvents(conversationId, runId)).toBe(
      "/conversations/conversation-1/runs/run-1/events",
    );
  });

  it("builds document operation paths", () => {
    expect(API_PATH.documents.upload).toBe("/documents/upload");
    expect(API_PATH.documents.permissions("doc-1")).toBe(
      "/documents/doc-1/permissions",
    );
    expect(API_PATH.documents.extractionRuns("doc-1")).toBe(
      "/documents/doc-1/extraction-runs",
    );
    expect(API_PATH.documents.ingestAsync("doc-1")).toBe(
      "/documents/doc-1/ingest/async",
    );
    expect(API_PATH.documents.extractionRun("doc-1", "run-1")).toBe(
      "/documents/doc-1/extraction-runs/run-1",
    );
  });

  it("builds knowledge-base nested document paths", () => {
    expect(API_PATH.knowledgeBases.detail(knowledgeBaseId)).toBe(
      "/knowledge-bases/kb-1",
    );
    expect(API_PATH.knowledgeBases.documents(knowledgeBaseId)).toBe(
      "/knowledge-bases/kb-1/documents",
    );
    expect(API_PATH.knowledgeBases.uploadDocument(knowledgeBaseId)).toBe(
      "/knowledge-bases/kb-1/documents/upload",
    );
    expect(
      API_PATH.knowledgeBases.ingestDocumentAsync(knowledgeBaseId, documentId),
    ).toBe("/knowledge-bases/kb-1/documents/doc-1/ingest/async");
    expect(
      API_PATH.knowledgeBases.extractionRun(knowledgeBaseId, documentId, runId),
    ).toBe("/knowledge-bases/kb-1/documents/doc-1/extraction-runs/run-1");
  });

  it("prefixes frontend BFF paths", () => {
    expect(toFrontendAPIPath(API_PATH.auth.me)).toBe("/api/my-agents/auth/me");
  });

  it("builds new auth lifecycle paths", () => {
    expect(API_PATH.auth.verifyEmail).toBe("/auth/verify-email");
    expect(API_PATH.auth.guestRequest).toBe("/auth/guest/request");
    expect(API_PATH.auth.guestLogin).toBe("/auth/guest/login");
    expect(API_PATH.auth.passwordResetRequest).toBe(
      "/auth/password-reset/request",
    );
    expect(API_PATH.auth.passwordResetConfirm).toBe(
      "/auth/password-reset/confirm",
    );
  });
});

describe("MyAgentsQueryKeys", () => {
  it("keeps stable scoped keys", () => {
    expect(MyAgentsQueryKeys.conversations.messages(conversationId)).toEqual([
      "my-agents",
      "conversations",
      "messages",
      conversationId,
    ]);
    expect(MyAgentsQueryKeys.conversations.run(conversationId, runId)).toEqual([
      "my-agents",
      "conversations",
      "run",
      conversationId,
      runId,
    ]);
    expect(MyAgentsQueryKeys.documents.extractionRun("doc-1", runId)).toEqual([
      "my-agents",
      "documents",
      "extraction-runs",
      "doc-1",
      runId,
    ]);
    expect(
      MyAgentsQueryKeys.knowledgeBases.extractionRun(
        knowledgeBaseId,
        documentId,
        runId,
      ),
    ).toEqual([
      "my-agents",
      "knowledge-bases",
      "documents",
      knowledgeBaseId,
      "extraction-runs",
      documentId,
      runId,
    ]);
  });
});

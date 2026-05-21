import { describe, expect, it } from "vitest";
import { API_PATH, toFrontendAPIPath } from "@/constants/api-path";
import { MyAgentsQueryKeys } from "@/constants/query-keys";

const conversationId = "conversation-1";
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
  });
});

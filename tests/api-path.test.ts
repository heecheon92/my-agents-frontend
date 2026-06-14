import { describe, expect, it } from "vitest";
import { API_PATH, toFrontendAPIPath } from "@/constants/api-path";
import { MyAgentsQueryKeys } from "@/constants/query-keys";

const conversationId = "conversation-1";
const knowledgeBaseId = "kb-1";
const documentId = "doc-1";
const runId = "run-1";

describe("API_PATH", () => {
  it("builds conversation run/event paths", () => {
    expect(API_PATH.conversations.detail(conversationId)).toBe(
      "/conversations/conversation-1",
    );
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
    expect(API_PATH.conversations.replayMessage(conversationId, "msg-1")).toBe(
      "/conversations/conversation-1/messages/msg-1/replay",
    );
    expect(
      API_PATH.conversations.replayMessageStream(conversationId, "msg-1"),
    ).toBe("/conversations/conversation-1/messages/msg-1/replay/stream");
  });

  it("builds group invitation paths", () => {
    expect(API_PATH.groups.members("group-1")).toBe("/groups/group-1/members");
    expect(API_PATH.groups.member("group-1", "user-1")).toBe(
      "/groups/group-1/members/user-1",
    );
    expect(API_PATH.groups.invitations("group-1")).toBe(
      "/groups/group-1/invitations",
    );
    expect(API_PATH.groups.invitation("group-1", "invite-1")).toBe(
      "/groups/group-1/invitations/invite-1",
    );
    expect(API_PATH.groups.invitationResend("group-1", "invite-1")).toBe(
      "/groups/group-1/invitations/invite-1/resend",
    );
    expect(API_PATH.groupInvitations.accept).toBe("/group-invitations/accept");
  });

  it("builds group publish request paths", () => {
    expect(API_PATH.groups.publishRequests("group-1")).toBe(
      "/groups/group-1/publish-requests",
    );
    expect(API_PATH.groups.publishRequestSource("group-1", "request-1")).toBe(
      "/groups/group-1/publish-requests/request-1/source",
    );
    expect(API_PATH.groups.publishRequestApprove("group-1", "request-1")).toBe(
      "/groups/group-1/publish-requests/request-1/approve",
    );
    expect(API_PATH.groups.publishRequestReject("group-1", "request-1")).toBe(
      "/groups/group-1/publish-requests/request-1/reject",
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
    expect(API_PATH.knowledgeBases.teamUploadStaging).toBe(
      "/knowledge-bases/team-upload-staging",
    );
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
    expect(MyAgentsQueryKeys.groups.invitations("group-1")).toEqual([
      "my-agents",
      "groups",
      "invitations",
      "group-1",
    ]);
    expect(MyAgentsQueryKeys.groups.members("group-1")).toEqual([
      "my-agents",
      "groups",
      "members",
      "group-1",
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

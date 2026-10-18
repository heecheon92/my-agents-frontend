export const API_PATH = {
  health: "/health",
  auth: {
    signup: "/auth/signup",
    verifyEmail: "/auth/verify-email",
    login: "/auth/login",
    guestPolicy: "/auth/guest/policy",
    guestRequest: "/auth/guest/request",
    guestLogin: "/auth/guest/login",
    passwordResetRequest: "/auth/password-reset/request",
    passwordResetConfirm: "/auth/password-reset/confirm",
    logout: "/auth/logout",
    me: "/auth/me",
    updateNickname: "/auth/me/nickname",
    updatePassword: "/auth/me/password",
  },
  capabilities: {
    reasoning: "/capabilities/reasoning",
    documentWorkspace: "/capabilities/document-workspace",
    assistantModels: "/capabilities/assistant-models",
    summarizationModels: "/capabilities/summarization-models",
  },
  assistant: {
    preferences: "/assistant/preferences",
  },
  summarization: {
    preferences: "/summarization/preferences",
  },
  conversations: {
    root: "/conversations",
    detail(conversationId: string) {
      return `${this.root}/${conversationId}`;
    },
    messages(conversationId: string) {
      return `${this.detail(conversationId)}/messages`;
    },
    replayMessage(conversationId: string, messageId: string) {
      return `${this.messages(conversationId)}/${messageId}/replay`;
    },
    replayMessageStream(conversationId: string, messageId: string) {
      return `${this.replayMessage(conversationId, messageId)}/stream`;
    },
    runs(conversationId: string) {
      return `${this.detail(conversationId)}/runs`;
    },
    run(conversationId: string, runId: string) {
      return `${this.runs(conversationId)}/${runId}`;
    },
    cancelRun(conversationId: string, runId: string) {
      return `${this.run(conversationId, runId)}/cancel`;
    },
    resumeRun(conversationId: string, runId: string) {
      return `${this.run(conversationId, runId)}/resume`;
    },
    resumeRunStream(conversationId: string, runId: string) {
      return `${this.resumeRun(conversationId, runId)}/stream`;
    },
    // `interactionId` is compound (`<run_id>:<type>`). It is interpolated raw
    // here and encoded once at the proxy boundary by `buildBackendPath`;
    // encoding it here as well would double-encode the colon.
    interactionOptions(
      conversationId: string,
      runId: string,
      interactionId: string,
    ) {
      return `${this.run(conversationId, runId)}/interactions/${interactionId}/options`;
    },
    runStream(conversationId: string) {
      return `${this.runs(conversationId)}/stream`;
    },
    runEvents(conversationId: string, runId: string) {
      return `${this.run(conversationId, runId)}/events`;
    },
    // Durable runs. Admission returns a JSON receipt; the work runs on a server
    // worker, and `runOutput` plus `runSubscription` are read-only views of it.
    runsAsync(conversationId: string) {
      return `${this.runs(conversationId)}/async`;
    },
    resumeRunAsync(conversationId: string, runId: string) {
      return `${this.resumeRun(conversationId, runId)}/async`;
    },
    replayMessageAsync(conversationId: string, messageId: string) {
      return `${this.replayMessage(conversationId, messageId)}/async`;
    },
    runOutput(conversationId: string, runId: string) {
      return `${this.run(conversationId, runId)}/output`;
    },
    runSubscription(conversationId: string, runId: string) {
      return `${this.run(conversationId, runId)}/stream`;
    },
    attachments(conversationId: string) {
      return `${this.detail(conversationId)}/attachments`;
    },
    attachment(conversationId: string, attachmentId: string) {
      return `${this.attachments(conversationId)}/${attachmentId}`;
    },
    artifacts(conversationId: string) {
      return `${this.detail(conversationId)}/artifacts`;
    },
    // Binary. The proxy streams this one through instead of reading it as
    // text; see `isBinaryDownloadPath` in the route handler.
    artifactDownload(conversationId: string, artifactId: string) {
      return `${this.artifacts(conversationId)}/${artifactId}/download`;
    },
  },
  groups: {
    root: "/groups",
    detail(groupId: string) {
      return `${this.root}/${groupId}`;
    },
    members(groupId: string) {
      return `${this.detail(groupId)}/members`;
    },
    member(groupId: string, userId: string) {
      return `${this.members(groupId)}/${userId}`;
    },
    invitations(groupId: string) {
      return `${this.detail(groupId)}/invitations`;
    },
    invitation(groupId: string, invitationId: string) {
      return `${this.invitations(groupId)}/${invitationId}`;
    },
    invitationResend(groupId: string, invitationId: string) {
      return `${this.invitation(groupId, invitationId)}/resend`;
    },
    publishRequests(groupId: string) {
      return `${this.detail(groupId)}/publish-requests`;
    },
    publishRequestSource(groupId: string, requestId: string) {
      return `${this.publishRequests(groupId)}/${requestId}/source`;
    },
    publishRequestApprove(groupId: string, requestId: string) {
      return `${this.publishRequests(groupId)}/${requestId}/approve`;
    },
    publishRequestReject(groupId: string, requestId: string) {
      return `${this.publishRequests(groupId)}/${requestId}/reject`;
    },
    publishRequestCancel(groupId: string, requestId: string) {
      return `${this.publishRequests(groupId)}/${requestId}/cancel`;
    },
  },
  groupInvitations: {
    accept: "/group-invitations/accept",
    signup: "/group-invitations/signup",
  },
  memories: {
    settings: "/memories/settings",
  },
  knowledgeBases: {
    root: "/knowledge-bases",
    teamUploadStaging: "/knowledge-bases/team-upload-staging",
    detail(knowledgeBaseId: string) {
      return `${this.root}/${knowledgeBaseId}`;
    },
    documents(knowledgeBaseId: string) {
      return `${this.detail(knowledgeBaseId)}/documents`;
    },
    uploadDocument(knowledgeBaseId: string) {
      return `${this.documents(knowledgeBaseId)}/upload`;
    },
    // Direct upload to private storage: initiate returns a signed PUT, and
    // complete turns the stored object into a document.
    documentUploads(knowledgeBaseId: string) {
      return `${this.documents(knowledgeBaseId)}/uploads`;
    },
    documentUpload(knowledgeBaseId: string, uploadId: string) {
      return `${this.documentUploads(knowledgeBaseId)}/${uploadId}`;
    },
    documentUploadRefresh(knowledgeBaseId: string, uploadId: string) {
      return `${this.documentUpload(knowledgeBaseId, uploadId)}/refresh`;
    },
    documentUploadComplete(knowledgeBaseId: string, uploadId: string) {
      return `${this.documentUpload(knowledgeBaseId, uploadId)}/complete`;
    },
    document(knowledgeBaseId: string, documentId: string) {
      return `${this.documents(knowledgeBaseId)}/${documentId}`;
    },
    documentPreview(knowledgeBaseId: string, documentId: string) {
      return `${this.document(knowledgeBaseId, documentId)}/preview`;
    },
    ingestDocument(knowledgeBaseId: string, documentId: string) {
      return `${this.document(knowledgeBaseId, documentId)}/ingest`;
    },
    ingestDocumentAsync(knowledgeBaseId: string, documentId: string) {
      return `${this.ingestDocument(knowledgeBaseId, documentId)}/async`;
    },
    extractionRuns(knowledgeBaseId: string, documentId: string) {
      return `${this.document(knowledgeBaseId, documentId)}/extraction-runs`;
    },
    extractionRun(knowledgeBaseId: string, documentId: string, runId: string) {
      return `${this.extractionRuns(knowledgeBaseId, documentId)}/${runId}`;
    },
  },
  documents: {
    root: "/documents",
    upload: "/documents/upload",
    detail(documentId: string) {
      return `${this.root}/${documentId}`;
    },
    permissions(documentId: string) {
      return `${this.detail(documentId)}/permissions`;
    },
    ingest(documentId: string) {
      return `${this.detail(documentId)}/ingest`;
    },
    ingestAsync(documentId: string) {
      return `${this.ingest(documentId)}/async`;
    },
    original(documentId: string) {
      return `${this.detail(documentId)}/original`;
    },
    reprocess(documentId: string) {
      return `${this.detail(documentId)}/reprocess`;
    },
    extractionRuns(documentId: string) {
      return `${this.detail(documentId)}/extraction-runs`;
    },
    extractionRun(documentId: string, runId: string) {
      return `${this.extractionRuns(documentId)}/${runId}`;
    },
  },
} as const;

export const FRONTEND_API_PREFIX = "/api/my-agents";

export function toFrontendAPIPath(path: string) {
  return `${FRONTEND_API_PREFIX}${path}`;
}

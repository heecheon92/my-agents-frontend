export const API_PATH = {
  health: "/health",
  auth: {
    signup: "/auth/signup",
    verifyEmail: "/auth/verify-email",
    login: "/auth/login",
    guestRequest: "/auth/guest/request",
    guestLogin: "/auth/guest/login",
    passwordResetRequest: "/auth/password-reset/request",
    passwordResetConfirm: "/auth/password-reset/confirm",
    logout: "/auth/logout",
    me: "/auth/me",
    updateNickname: "/auth/me/nickname",
    updatePassword: "/auth/me/password",
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
    runStream(conversationId: string) {
      return `${this.runs(conversationId)}/stream`;
    },
    runEvents(conversationId: string, runId: string) {
      return `${this.run(conversationId, runId)}/events`;
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
    document(knowledgeBaseId: string, documentId: string) {
      return `${this.documents(knowledgeBaseId)}/${documentId}`;
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

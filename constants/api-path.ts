export const API_PATH = {
  health: "/health",
  auth: {
    signup: "/auth/signup",
    login: "/auth/login",
    logout: "/auth/logout",
    me: "/auth/me",
  },
  conversations: {
    root: "/conversations",
    detail(conversationId: string) {
      return `${this.root}/${conversationId}`;
    },
    messages(conversationId: string) {
      return `${this.detail(conversationId)}/messages`;
    },
    runs(conversationId: string) {
      return `${this.detail(conversationId)}/runs`;
    },
    runEvents(conversationId: string, runId: string) {
      return `${this.runs(conversationId)}/${runId}/events`;
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
  },
  knowledgeBases: {
    root: "/knowledge-bases",
  },
  documents: {
    root: "/documents",
    detail(documentId: string) {
      return `${this.root}/${documentId}`;
    },
    permissions(documentId: string) {
      return `${this.detail(documentId)}/permissions`;
    },
    ingest(documentId: string) {
      return `${this.detail(documentId)}/ingest`;
    },
    extractionRuns(documentId: string) {
      return `${this.detail(documentId)}/extraction-runs`;
    },
  },
} as const;

export const FRONTEND_API_PREFIX = "/api/my-agents";

export function toFrontendAPIPath(path: string) {
  return `${FRONTEND_API_PREFIX}${path}`;
}

export const MyAgentsQueryKeys = {
  health() {
    return ["my-agents", "health"] as const;
  },
  auth: {
    me() {
      return ["my-agents", "auth", "me"] as const;
    },
    guestPolicy() {
      return ["my-agents", "auth", "guest-policy"] as const;
    },
  },
  capabilities: {
    reasoning() {
      return ["my-agents", "capabilities", "reasoning"] as const;
    },
    documentWorkspace() {
      return ["my-agents", "capabilities", "document-workspace"] as const;
    },
  },
  memories: {
    settings() {
      return ["my-agents", "memories", "settings"] as const;
    },
  },
  conversations: {
    list() {
      return ["my-agents", "conversations", "list"] as const;
    },
    detail(conversationId: string) {
      return ["my-agents", "conversations", "detail", conversationId] as const;
    },
    messages(conversationId: string) {
      return [
        "my-agents",
        "conversations",
        "messages",
        conversationId,
      ] as const;
    },
    runs(conversationId: string) {
      return ["my-agents", "conversations", "runs", conversationId] as const;
    },
    attachments(conversationId: string) {
      return [
        "my-agents",
        "conversations",
        "attachments",
        conversationId,
      ] as const;
    },
    artifacts(conversationId: string) {
      return [
        "my-agents",
        "conversations",
        "artifacts",
        conversationId,
      ] as const;
    },
    run(conversationId: string, runId: string) {
      return [
        "my-agents",
        "conversations",
        "run",
        conversationId,
        runId,
      ] as const;
    },
    interactionOptions(
      conversationId: string,
      runId: string,
      interactionId: string,
    ) {
      return [
        "my-agents",
        "conversations",
        "interaction-options",
        conversationId,
        runId,
        interactionId,
      ] as const;
    },
    events(conversationId: string, runId: string) {
      return [
        "my-agents",
        "conversations",
        "events",
        conversationId,
        runId,
      ] as const;
    },
  },
  groups: {
    list() {
      return ["my-agents", "groups", "list"] as const;
    },
    detail(groupId: string) {
      return ["my-agents", "groups", "detail", groupId] as const;
    },
    publishRequests(groupId: string) {
      return ["my-agents", "groups", "publish-requests", groupId] as const;
    },
    publishRequestSource(groupId: string, requestId: string) {
      return [
        "my-agents",
        "groups",
        "publish-requests",
        groupId,
        requestId,
        "source",
      ] as const;
    },
    invitations(groupId: string) {
      return ["my-agents", "groups", "invitations", groupId] as const;
    },
    members(groupId: string) {
      return ["my-agents", "groups", "members", groupId] as const;
    },
  },
  knowledgeBases: {
    list() {
      return ["my-agents", "knowledge-bases", "list"] as const;
    },
    detail(knowledgeBaseId: string) {
      return [
        "my-agents",
        "knowledge-bases",
        "detail",
        knowledgeBaseId,
      ] as const;
    },
    documents(knowledgeBaseId: string) {
      return [
        "my-agents",
        "knowledge-bases",
        "documents",
        knowledgeBaseId,
      ] as const;
    },
    documentPreview(knowledgeBaseId: string, documentId: string) {
      return [
        "my-agents",
        "knowledge-bases",
        "documents",
        knowledgeBaseId,
        documentId,
        "preview",
      ] as const;
    },
    extractionRuns(knowledgeBaseId: string, documentId: string) {
      return [
        "my-agents",
        "knowledge-bases",
        "documents",
        knowledgeBaseId,
        "extraction-runs",
        documentId,
      ] as const;
    },
    extractionRun(knowledgeBaseId: string, documentId: string, runId: string) {
      return [
        "my-agents",
        "knowledge-bases",
        "documents",
        knowledgeBaseId,
        "extraction-runs",
        documentId,
        runId,
      ] as const;
    },
  },
  documents: {
    list() {
      return ["my-agents", "documents", "list"] as const;
    },
    detail(documentId: string) {
      return ["my-agents", "documents", "detail", documentId] as const;
    },
    extractionRuns(documentId: string) {
      return ["my-agents", "documents", "extraction-runs", documentId] as const;
    },
    extractionRun(documentId: string, runId: string) {
      return [
        "my-agents",
        "documents",
        "extraction-runs",
        documentId,
        runId,
      ] as const;
    },
  },
} as const;

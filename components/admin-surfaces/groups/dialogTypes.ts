import type { KnowledgePublishRequestSourceDocument } from "@/model/my-agents";

export type MutationState = {
  error: unknown;
  isPending: boolean;
};

export type PublishSourceState = {
  data?: {
    source_knowledge_base_name?: string | null;
    documents: KnowledgePublishRequestSourceDocument[];
  };
  isLoading: boolean;
  error: unknown;
};

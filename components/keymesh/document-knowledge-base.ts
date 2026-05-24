import type { KnowledgeBase } from "@/model/my-agents";

export function writableDocumentKnowledgeBases(
  knowledgeBases: KnowledgeBase[],
) {
  return knowledgeBases.filter(
    (knowledgeBase) => knowledgeBase.scope === "personal",
  );
}

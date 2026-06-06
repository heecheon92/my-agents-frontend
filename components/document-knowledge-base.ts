import type { KnowledgeBase } from "@/model/my-agents";

export function writableDocumentKnowledgeBases(
  knowledgeBases: KnowledgeBase[],
  ownerUserId?: string,
) {
  return knowledgeBases.filter(
    (knowledgeBase) =>
      knowledgeBase.scope === "personal" &&
      (!ownerUserId || knowledgeBase.owner_user_id === ownerUserId),
  );
}

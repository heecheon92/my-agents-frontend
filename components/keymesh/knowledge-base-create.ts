import type { KnowledgeBaseCreateRequest } from "@/model/my-agents";

export type KnowledgeBaseCreationScope = "personal" | "group";

export function buildKnowledgeBaseCreateRequest({
  groupId,
  name,
  scope,
}: {
  groupId?: string;
  name: string;
  scope: KnowledgeBaseCreationScope;
}): KnowledgeBaseCreateRequest | null {
  const trimmedName = name.trim();
  if (!trimmedName) return null;

  if (scope === "group") {
    if (!groupId) return null;
    return {
      name: trimmedName,
      scope: "group",
      group_id: groupId,
    };
  }

  return {
    name: trimmedName,
    scope: "personal",
  };
}

import type { KnowledgeBaseCreateRequest } from "@/model/my-agents";

export type KnowledgeBaseCreationScope = "personal" | "group" | "system";

export function buildKnowledgeBaseCreateRequest({
  canManageSystemKnowledge = false,
  groupId,
  name,
  scope,
}: {
  canManageSystemKnowledge?: boolean;
  groupId?: string;
  name: string;
  scope: KnowledgeBaseCreationScope;
}): KnowledgeBaseCreateRequest | null {
  const trimmedName = name.trim();
  if (!trimmedName) return null;

  if (scope === "system") {
    if (!canManageSystemKnowledge) return null;
    return {
      name: trimmedName,
      scope: "system",
    };
  }

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

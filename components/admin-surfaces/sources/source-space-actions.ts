import type { Group, KnowledgeBase } from "@/model/my-agents";

export function canManageGroupSourceSpace(group?: Pick<Group, "role">) {
  return group?.role === "owner" || group?.role === "admin";
}

export function canManageSourceSpace({
  canManageSystemKnowledge,
  currentUserId,
  groups,
  knowledgeBase,
}: {
  canManageSystemKnowledge: boolean;
  currentUserId?: string;
  groups: Group[];
  knowledgeBase?: KnowledgeBase;
}) {
  if (!knowledgeBase || knowledgeBase.purpose !== "standard") return false;
  if (knowledgeBase.scope === "personal") {
    return Boolean(currentUserId && knowledgeBase.owner_user_id === currentUserId);
  }
  if (knowledgeBase.scope === "system") return canManageSystemKnowledge;
  if (!knowledgeBase.group_id) return false;
  return canManageGroupSourceSpace(
    groups.find((group) => group.id === knowledgeBase.group_id),
  );
}

export function canSharePersonalSourceSpace({
  currentUserId,
  knowledgeBase,
}: {
  currentUserId?: string;
  knowledgeBase?: KnowledgeBase;
}) {
  return Boolean(
    knowledgeBase &&
      currentUserId &&
      knowledgeBase.scope === "personal" &&
      knowledgeBase.purpose === "standard" &&
      knowledgeBase.owner_user_id === currentUserId,
  );
}

export function groupSourceSpacesForShareTarget({
  groupId,
  knowledgeBases,
}: {
  groupId?: string;
  knowledgeBases: KnowledgeBase[];
}) {
  if (!groupId) return [];
  return knowledgeBases.filter(
    (knowledgeBase) =>
      knowledgeBase.scope === "group" &&
      knowledgeBase.purpose === "standard" &&
      knowledgeBase.group_id === groupId,
  );
}

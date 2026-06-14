import type { Group, KnowledgeBase } from "@/model/my-agents";

export function writableDocumentKnowledgeBases(
  knowledgeBases: KnowledgeBase[],
  ownerUserId?: string,
) {
  return knowledgeBases.filter(
    (knowledgeBase) =>
      knowledgeBase.scope === "personal" &&
      knowledgeBase.purpose === "standard" &&
      (!ownerUserId || knowledgeBase.owner_user_id === ownerUserId),
  );
}

export function groupKnowledgeBasesForGroup(
  knowledgeBases: KnowledgeBase[],
  groupId?: string,
) {
  return knowledgeBases.filter(
    (knowledgeBase) =>
      knowledgeBase.scope === "group" &&
      knowledgeBase.purpose === "standard" &&
      (!groupId || knowledgeBase.group_id === groupId),
  );
}

export function systemKnowledgeBasesForManager(
  knowledgeBases: KnowledgeBase[],
  canManageSystemKnowledge: boolean,
) {
  if (!canManageSystemKnowledge) return [];
  return knowledgeBases.filter(
    (knowledgeBase) =>
      knowledgeBase.scope === "system" &&
      knowledgeBase.purpose === "standard" &&
      knowledgeBase.group_id === null,
  );
}

export function chatSelectableKnowledgeBases(knowledgeBases: KnowledgeBase[]) {
  return knowledgeBases.filter(
    (knowledgeBase) =>
      knowledgeBase.scope !== "system" && knowledgeBase.purpose === "standard",
  );
}

export function ambientSystemKnowledgeBaseCount(
  knowledgeBases: KnowledgeBase[],
) {
  return knowledgeBases.filter(
    (knowledgeBase) =>
      knowledgeBase.scope === "system" && knowledgeBase.purpose === "standard",
  ).length;
}

export function canAutoApproveTeamDocumentUpload(group?: Pick<Group, "role">) {
  return group?.role === "owner" || group?.role === "admin";
}

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

export function canAutoApproveTeamDocumentUpload(group?: Pick<Group, "role">) {
  return group?.role === "owner" || group?.role === "admin";
}

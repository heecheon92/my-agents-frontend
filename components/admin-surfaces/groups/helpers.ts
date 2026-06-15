import type {
  GroupInvitation,
  GroupInvitationStatus,
  KnowledgePublishRequest,
  KnowledgePublishRequestStatus,
} from "@/model/my-agents";

export type PublishRequestStatusFilter = KnowledgePublishRequestStatus | "all";
export type InvitationStatusFilter = GroupInvitationStatus | "all";

export const GROUP_PREVIEW_LIMIT = 3;

const PUBLISH_REQUEST_STATUS_ORDER: Record<
  KnowledgePublishRequestStatus,
  number
> = {
  pending: 0,
  approved: 1,
  rejected: 2,
};

export function previewRows<T>(rows: T[], limit = GROUP_PREVIEW_LIMIT) {
  return rows.slice(0, limit);
}

export function sortPublishRequestsForReview(
  requests: KnowledgePublishRequest[],
): KnowledgePublishRequest[] {
  return [...requests].sort((left, right) => {
    const statusDelta =
      PUBLISH_REQUEST_STATUS_ORDER[left.status] -
      PUBLISH_REQUEST_STATUS_ORDER[right.status];
    if (statusDelta !== 0) return statusDelta;
    return (
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    );
  });
}

export function publishRequestSourceLabel(
  request: KnowledgePublishRequest,
  fallbackSourceLabel: string,
) {
  return (
    request.source_document_title ??
    request.source_document_filename ??
    request.source_knowledge_base_name ??
    request.source_document_id ??
    request.source_knowledge_base_id ??
    fallbackSourceLabel
  );
}

export function publishRequestTargetLabel(request: KnowledgePublishRequest) {
  return (
    request.target_knowledge_base_name ??
    request.target_knowledge_base_id ??
    request.target_group_id
  );
}

export function publishRequestMatchesSearch({
  request,
  search,
  sourceLabel,
  targetLabel,
}: {
  request: KnowledgePublishRequest;
  search: string;
  sourceLabel: string;
  targetLabel: string;
}) {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [
    request.id,
    request.created_at,
    sourceLabel,
    targetLabel,
    request.source_document_filename,
    request.source_document_title,
    request.source_knowledge_base_name,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
}

export function invitationMatchesSearch(
  invitation: GroupInvitation,
  search: string,
) {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [
    invitation.id,
    invitation.invited_email,
    invitation.role,
    invitation.status,
    invitation.created_at,
    invitation.expires_at,
  ].some((value) => String(value).toLowerCase().includes(needle));
}

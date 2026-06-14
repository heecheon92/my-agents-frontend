import { z } from "zod";

export const membershipRoleSchema = z.enum([
  "owner",
  "admin",
  "editor",
  "viewer",
]);

export const groupSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  role: membershipRoleSchema,
});

export const groupCreateRequestSchema = z.object({
  name: z.string().min(1).max(120),
});

export const groupInvitationStatusSchema = z.enum([
  "pending",
  "accepted",
  "cancelled",
  "expired",
]);

export const groupInvitationCreateRequestSchema = z
  .object({
    email: z.string().email(),
    role: membershipRoleSchema,
  })
  .strict();

export const groupInvitationUpdateRequestSchema = z
  .object({
    role: membershipRoleSchema,
  })
  .strict();

export const groupInvitationAcceptRequestSchema = z
  .object({
    token: z.string().min(1).max(256),
  })
  .strict();

export const groupInvitationSchema = z.object({
  id: z.string().min(1),
  group_id: z.string().min(1),
  invited_email: z.string().min(1),
  role: membershipRoleSchema,
  status: groupInvitationStatusSchema,
  created_at: z.string(),
  expires_at: z.string(),
  accepted_at: z.string().nullable().optional(),
  cancelled_at: z.string().nullable().optional(),
  resent_at: z.string().nullable().optional(),
});

export const groupMemberSchema = z.object({
  member_id: z.string().min(1),
  user_id: z.string().min(1),
  nickname: z.string().min(1),
  role: membershipRoleSchema,
  created_at: z.string(),
});

export const memberPatchRequestSchema = z.object({
  role: membershipRoleSchema,
});

export const knowledgePublishRequestStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
]);

export const knowledgePublishRequestCreateRequestSchema = z.object({
  source_document_id: z.string().min(1).optional(),
  target_knowledge_base_id: z.string().min(1).optional(),
  source_knowledge_base_id: z.string().min(1).optional(),
});

export const knowledgePublishRequestSchema = z.object({
  id: z.string().min(1),
  requester_user_id: z.string().min(1),
  target_group_id: z.string().min(1),
  target_knowledge_base_id: z.string().min(1).nullable(),
  source_document_id: z.string().min(1).nullable(),
  source_knowledge_base_id: z.string().min(1).nullable(),
  status: knowledgePublishRequestStatusSchema,
  reviewer_user_id: z.string().nullable(),
  published_document_id: z.string().nullable(),
  published_knowledge_base_id: z.string().nullable(),
  created_at: z.string(),
  reviewed_at: z.string().nullable(),
});

export type MembershipRole = z.infer<typeof membershipRoleSchema>;
export type Group = z.infer<typeof groupSchema>;
export type GroupCreateRequest = z.infer<typeof groupCreateRequestSchema>;
export type GroupInvitationStatus = z.infer<typeof groupInvitationStatusSchema>;
export type GroupInvitationCreateRequest = z.infer<
  typeof groupInvitationCreateRequestSchema
>;
export type GroupInvitationUpdateRequest = z.infer<
  typeof groupInvitationUpdateRequestSchema
>;
export type GroupInvitationAcceptRequest = z.infer<
  typeof groupInvitationAcceptRequestSchema
>;
export type GroupInvitation = z.infer<typeof groupInvitationSchema>;
export type GroupMember = z.infer<typeof groupMemberSchema>;
export type MemberPatchRequest = z.infer<typeof memberPatchRequestSchema>;
export type KnowledgePublishRequestStatus = z.infer<
  typeof knowledgePublishRequestStatusSchema
>;
export type KnowledgePublishRequestCreateRequest = z.infer<
  typeof knowledgePublishRequestCreateRequestSchema
>;
export type KnowledgePublishRequest = z.infer<
  typeof knowledgePublishRequestSchema
>;

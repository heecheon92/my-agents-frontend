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

export const memberUpsertRequestSchema = z.object({
  user_id: z.string().min(1),
  role: membershipRoleSchema,
});

export const memberPatchRequestSchema = z.object({
  role: membershipRoleSchema,
});

export type MembershipRole = z.infer<typeof membershipRoleSchema>;
export type Group = z.infer<typeof groupSchema>;
export type GroupCreateRequest = z.infer<typeof groupCreateRequestSchema>;
export type MemberUpsertRequest = z.infer<typeof memberUpsertRequestSchema>;
export type MemberPatchRequest = z.infer<typeof memberPatchRequestSchema>;

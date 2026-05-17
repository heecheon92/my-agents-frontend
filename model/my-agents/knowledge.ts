import { z } from "zod";

export const knowledgeBaseScopeSchema = z.enum(["personal", "group"]);

export const knowledgeBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  scope: knowledgeBaseScopeSchema,
  owner_user_id: z.string().min(1),
  group_id: z.string().nullable(),
});

export const knowledgeBaseCreateRequestSchema = z.object({
  name: z.string().min(1).max(160),
  scope: knowledgeBaseScopeSchema.default("personal"),
  group_id: z.string().nullable().optional(),
});

export const documentSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  owner_user_id: z.string().min(1),
  group_id: z.string().nullable(),
  knowledge_base_id: z.string().nullable(),
});

export const documentCreateRequestSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().default(""),
  group_id: z.string().nullable().optional(),
  knowledge_base_id: z.string().nullable().optional(),
});

export const documentPermissionPatchRequestSchema = z.object({
  user_id: z.string().min(1),
  can_read: z.boolean().default(true),
  can_write: z.boolean().default(false),
  can_manage: z.boolean().default(false),
  can_ingest: z.boolean().default(false),
});

export const documentPermissionSchema = z.object({
  document_id: z.string().min(1),
  user_id: z.string().min(1),
  can_read: z.boolean(),
  can_write: z.boolean(),
  can_manage: z.boolean(),
  can_ingest: z.boolean(),
});

export const extractionRunSchema = z.object({
  id: z.string().min(1),
  document_id: z.string().min(1),
  status: z.string(),
  chunk_count: z.number(),
  entity_count: z.number(),
  relationship_count: z.number(),
});

export const citationSchema = z.object({
  id: z.string().min(1),
  document_id: z.string().min(1),
  chunk_id: z.string().min(1),
  snippet: z.string(),
});

export type KnowledgeBaseScope = z.infer<typeof knowledgeBaseScopeSchema>;
export type KnowledgeBase = z.infer<typeof knowledgeBaseSchema>;
export type KnowledgeBaseCreateRequest = z.infer<
  typeof knowledgeBaseCreateRequestSchema
>;
export type Document = z.infer<typeof documentSchema>;
export type DocumentCreateRequest = z.infer<typeof documentCreateRequestSchema>;
export type DocumentPermissionPatchRequest = z.infer<
  typeof documentPermissionPatchRequestSchema
>;
export type DocumentPermission = z.infer<typeof documentPermissionSchema>;
export type ExtractionRun = z.infer<typeof extractionRunSchema>;
export type Citation = z.infer<typeof citationSchema>;

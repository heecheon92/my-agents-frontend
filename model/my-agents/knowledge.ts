import { z } from "zod";

export const knowledgeBaseScopeSchema = z.enum(["personal", "group", "system"]);
export const knowledgeBasePurposeSchema = z.enum([
  "standard",
  "team_upload_staging",
]);

export const knowledgeBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  scope: knowledgeBaseScopeSchema,
  owner_user_id: z.string().min(1),
  group_id: z.string().nullable(),
  purpose: knowledgeBasePurposeSchema.default("standard"),
  published_group_ids: z.array(z.string().min(1)).default([]),
  created_at: z.string().optional(),
});

export const knowledgeBaseCreateRequestSchema = z.object({
  name: z.string().min(1).max(160),
  scope: knowledgeBaseScopeSchema.default("personal"),
  group_id: z.string().nullable().optional(),
});

export const knowledgeBaseUpdateRequestSchema = z.object({
  name: z.string().trim().min(1).max(160),
});

export const documentSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  owner_user_id: z.string().min(1),
  group_id: z.string().nullable(),
  knowledge_base_id: z.string().nullable(),
  source_type: z.string().default("text"),
  source_filename: z.string().nullable().optional(),
  source_content_type: z.string().nullable().optional(),
  source_byte_size: z.number().nullable().optional(),
  source_sha256: z.string().nullable().optional(),
  source_page_count: z.number().nullable().optional(),
  parser_name: z.string().nullable().optional(),
});

export const documentCreateRequestSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().default(""),
  group_id: z.string().nullable().optional(),
  knowledge_base_id: z.string().nullable().optional(),
});

export const knowledgeBaseDocumentPreviewSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  content: z.string().default(""),
  source_type: z.string().default("text"),
  source_filename: z.string().nullable().optional(),
  source_content_type: z.string().nullable().optional(),
  source_byte_size: z.number().nullable().optional(),
  source_page_count: z.number().nullable().optional(),
  parser_name: z.string().nullable().optional(),
  created_at: z.string(),
});

export const knowledgeBaseDocumentCreateRequestSchema =
  documentCreateRequestSchema.omit({
    knowledge_base_id: true,
  });

export type DocumentUploadRequest = {
  title: string;
  file: File;
  group_id?: string | null;
  knowledge_base_id?: string | null;
};

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

export const extractionRunStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
]);

export const extractionRunStageSchema = z.enum([
  "queued",
  "claimed",
  "chunking",
  "embedding",
  "indexing",
  "entities",
  "metadata",
  "completed",
  "failed",
]);

export const extractionRunSchema = z.object({
  id: z.string().min(1),
  document_id: z.string().min(1),
  status: extractionRunStatusSchema,
  stage: extractionRunStageSchema.nullable().optional(),
  progress_percent: z.number().default(0),
  chunk_count: z.number(),
  entity_count: z.number(),
  relationship_count: z.number(),
  error: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
});

export const citationSchema = z.object({
  id: z.string().min(1),
  document_id: z.string().min(1),
  knowledge_base_id: z.string().nullable().optional(),
  chunk_id: z.string().min(1),
  snippet: z.string(),
  source_page: z.number().nullable().optional(),
  source_filename: z.string().nullable().optional(),
});

export type KnowledgeBaseScope = z.infer<typeof knowledgeBaseScopeSchema>;
export type KnowledgeBasePurpose = z.infer<typeof knowledgeBasePurposeSchema>;
export type KnowledgeBase = z.infer<typeof knowledgeBaseSchema>;
export type KnowledgeBaseCreateRequest = z.infer<
  typeof knowledgeBaseCreateRequestSchema
>;
export type KnowledgeBaseUpdateRequest = z.infer<
  typeof knowledgeBaseUpdateRequestSchema
>;
export type Document = z.infer<typeof documentSchema>;
export type DocumentCreateRequest = z.infer<typeof documentCreateRequestSchema>;
export type KnowledgeBaseDocumentCreateRequest = z.infer<
  typeof knowledgeBaseDocumentCreateRequestSchema
>;
export type KnowledgeBaseDocumentPreview = z.infer<
  typeof knowledgeBaseDocumentPreviewSchema
>;
export type KnowledgeBaseDocumentUploadRequest = Omit<
  DocumentUploadRequest,
  "knowledge_base_id"
>;
export type DocumentPermissionPatchRequest = z.infer<
  typeof documentPermissionPatchRequestSchema
>;
export type DocumentPermission = z.infer<typeof documentPermissionSchema>;
export type ExtractionRunStatus = z.infer<typeof extractionRunStatusSchema>;
export type ExtractionRunStage = z.infer<typeof extractionRunStageSchema>;
export type ExtractionRun = z.infer<typeof extractionRunSchema>;
export type Citation = z.infer<typeof citationSchema>;

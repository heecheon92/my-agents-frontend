import { z } from "zod";
import { documentIngestionModeSchema } from "./assistant-models";

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
  name: z.string().min(1).max(160),
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
  /** How the active content was produced. Legacy documents report `standard`. */
  ingestion_mode: documentIngestionModeSchema.catch("standard"),
  /**
   * Whether the uploaded file itself is kept. `false` for every legacy
   * document: recoverability is never inferred, so download and reprocess
   * stay unavailable for them.
   */
  original_retained: z.boolean().catch(false),
  /** Display metadata; a shape this build cannot read degrades to `null`. */
  processing_provenance: z
    .lazy(() => documentProcessingProvenanceSchema)
    .nullable()
    .optional()
    .catch(null),
  processed_at: z.string().nullable().optional(),
});

/**
 * How the active content was produced. `warnings` are stable codes, mapped to
 * localized copy; an unknown one gets generic copy rather than being shown raw.
 */
export const documentProcessingProvenanceSchema = z.object({
  schema_version: z.number().int().default(1),
  mode: documentIngestionModeSchema,
  provider: z.string(),
  model: z.string().nullable().optional(),
  version: z.string(),
  input_sha256: z.string(),
  output_sha256: z.string(),
  section_count: z.number().int().min(0),
  warnings: z.array(z.string()).default([]),
});

/** `POST /knowledge-bases/{kb}/documents/uploads`. */
export const documentUploadInitiateRequestSchema = z.object({
  title: z.string().min(1).max(200),
  filename: z.string().min(1).max(255),
  content_type: z.string().min(1).max(120),
  byte_size: z.number().int().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  ingestion_mode: documentIngestionModeSchema.nullable().optional(),
});

/**
 * A signed, short-lived instruction to PUT the file to private storage. The
 * URL is a credential: it is used for one request and never logged, stored,
 * or rendered.
 */
export const documentUploadReceiptSchema = z.object({
  upload_id: z.string().min(1),
  method: z.literal("PUT").default("PUT"),
  url: z.string().min(1),
  headers: z.record(z.string(), z.string()),
  expires_at: z.string(),
  max_bytes: z.number().int().positive().optional(),
});

/** `DocumentUploadCompleted`. The run is `null` for a staged group upload. */
export const documentUploadCompletedSchema = z.object({
  document: z.lazy(() => documentSchema),
  extraction_run: z.lazy(() => extractionRunSchema).nullable(),
});

/** A signed, short-lived download of the original file. Same rules as above. */
export const documentOriginalDownloadSchema = z.object({
  url: z.string().min(1),
  expires_at: z.string(),
  filename: z.string(),
});

export const documentReprocessRequestSchema = z.object({
  ingestion_mode: documentIngestionModeSchema.nullable().optional(),
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
  /** Omitted means the user's saved default. */
  ingestion_mode?: z.infer<typeof documentIngestionModeSchema>;
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
  /**
   * Stable code for a failure, localized by `errors.byCode`. Additive and
   * nullable; when absent the legacy `error` text is shown as before.
   */
  error_code: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
});

export const citationSchema = z.object({
  id: z.string().min(1),
  document_id: z.string().min(1),
  /**
   * Display names, resolved server-side so the panel does not have to join
   * against a document list it may not have loaded. Both nullable in the served
   * contract; `source_filename` is preferred over `document_title` when present
   * because a filename is what the user recognises.
   */
  document_title: z.string().nullish(),
  knowledge_base_id: z.string().nullable().optional(),
  knowledge_base_name: z.string().nullish(),
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
export type DocumentProcessingProvenance = z.infer<
  typeof documentProcessingProvenanceSchema
>;
export type DocumentUploadInitiateRequest = z.infer<
  typeof documentUploadInitiateRequestSchema
>;
export type DocumentUploadReceipt = z.infer<typeof documentUploadReceiptSchema>;
export type DocumentUploadCompleted = z.infer<
  typeof documentUploadCompletedSchema
>;
export type DocumentOriginalDownload = z.infer<
  typeof documentOriginalDownloadSchema
>;
export type DocumentReprocessRequest = z.infer<
  typeof documentReprocessRequestSchema
>;

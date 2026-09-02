import { z } from "zod";

/**
 * Temporary conversation attachments — a file transferred to an expiring
 * OpenAI container for one conversation, not durable knowledge-base content.
 *
 * Every shape here is transcribed from the served OpenAPI document
 * (`GET /openapi.json`, captured 2026-09-02), never from backend source. Where
 * the written handoff and the served document disagreed, the document won; the
 * differences are recorded in
 * `/tmp/agent-handoff/frontend-document-workspace-result-2026-09-02.md`.
 */

/**
 * Lifecycle of both attachments and artifacts.
 *
 * `expired` is normal rather than exceptional: provider files expire after an
 * hour by default and the container after 20 idle minutes. Metadata outlives
 * the bytes on purpose, so the UI can stay honest about what happened instead
 * of the row silently disappearing.
 */
export const documentWorkspaceStatusSchema = z.enum([
  "available",
  "expired",
  "deleted",
]);

/**
 * Analysis support and downloadable output are separate promises, and
 * conflating them is the single easiest way to lie to a user here. Plenty of
 * formats can be analyzed without any file coming back.
 *
 * `certified` is a deliberately narrow claim: the output is recognized,
 * tracked with an expiry, and downloadable through the authenticated route. It
 * does **not** promise pixel-perfect cross-application fidelity, so no copy
 * built on this may imply one.
 *
 * Which extensions carry it is the backend's decision and changes without a
 * frontend release — the set widened twice on 2026-09-02 alone. Read
 * `artifact_status`; never infer it from the extension, and never write the
 * current membership into copy or a comment that will silently rot.
 */
export const documentArtifactStatusSchema = z.enum([
  "certified",
  "unavailable",
]);

export const documentFormatCapabilitySchema = z.object({
  extension: z.string(),
  category: z.string(),
  mime_types: z.array(z.string()),
  analysis_supported: z.boolean(),
  artifact_status: documentArtifactStatusSchema,
});

export const documentWorkspaceLimitsSchema = z.object({
  max_files_per_run: z.number().int(),
  max_combined_bytes: z.number().int(),
  workspace_idle_ttl_seconds: z.number().int(),
});

export const documentWorkspaceCapabilitySchema = z.object({
  enabled: z.boolean(),
  eligible: z.boolean(),
  /**
   * Why the feature is unavailable. Nullable *and* absent from the served
   * `required` list, so `.nullish()` rather than `.nullable()` — an eligible
   * account omits the key entirely.
   */
  reason_code: z.string().nullish(),
  provider: z.literal("openai").default("openai"),
  /**
   * Parsed, deliberately never rendered. `capabilities.ts` records that the
   * reasoning capability stopped serving a per-surface deployment model ID
   * because it exposed the deployed model version in the Network tab to any
   * authenticated user; this endpoint still serves one. Question Q4 in the
   * handoff asks whether that is intended. Keeping it parsed but unrendered
   * means the answer changes nothing on this side either way — the schema is
   * not `.strict()`, so the backend can drop the key without breaking us.
   */
  model: z.string(),
  /** A plain string in the served document, not a `date-time`. */
  registry_verified_at: z.string(),
  limits: documentWorkspaceLimitsSchema,
  /**
   * The authoritative accepted-format registry. Never hardcode extensions,
   * MIME types, or categories against this — a deployment can verify a new
   * family without a frontend release.
   */
  formats: z.array(documentFormatCapabilitySchema),
  consent_required: z.literal(true).default(true),
  retention: z.literal("ephemeral").default("ephemeral"),
});

export const conversationAttachmentSchema = z.object({
  id: z.string(),
  conversation_id: z.string(),
  filename: z.string(),
  content_type: z.string(),
  extension: z.string(),
  category: z.string(),
  byte_size: z.number().int(),
  status: documentWorkspaceStatusSchema,
  expires_at: z.string(),
  created_at: z.string(),
});

export const conversationArtifactSchema = z.object({
  id: z.string(),
  /**
   * Required and non-null, which is what makes cold-load recovery possible at
   * all: `AgentRunSummaryResponse` carries no artifacts, so the only way to tie
   * a generated file to the answer that produced it is to list conversation
   * artifacts and group by this. See Q3 in the handoff.
   */
  run_id: z.string(),
  conversation_id: z.string(),
  filename: z.string(),
  content_type: z.string(),
  extension: z.string(),
  /** Required but nullable — always present, sometimes unknown. */
  byte_size: z.number().int().nullable(),
  status: documentWorkspaceStatusSchema,
  download_url: z.string(),
  expires_at: z.string(),
  created_at: z.string(),
});

export const conversationAttachmentListSchema = z.array(
  conversationAttachmentSchema,
);
export const conversationArtifactListSchema = z.array(
  conversationArtifactSchema,
);

export type DocumentWorkspaceStatus = z.infer<
  typeof documentWorkspaceStatusSchema
>;
export type DocumentArtifactStatus = z.infer<
  typeof documentArtifactStatusSchema
>;
export type DocumentFormatCapability = z.infer<
  typeof documentFormatCapabilitySchema
>;
export type DocumentWorkspaceLimits = z.infer<
  typeof documentWorkspaceLimitsSchema
>;
export type DocumentWorkspaceCapability = z.infer<
  typeof documentWorkspaceCapabilitySchema
>;
export type ConversationAttachment = z.infer<
  typeof conversationAttachmentSchema
>;
export type ConversationArtifact = z.infer<typeof conversationArtifactSchema>;

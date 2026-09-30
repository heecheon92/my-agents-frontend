import { z } from "zod";

/** Durable interactions derived from the live backend OpenAPI on 2026-08-31. */
export const LEGACY_INTERACTION_SCHEMA_VERSION = 1;
export const INTERACTION_SCHEMA_VERSION = 2;
export const DOCUMENT_REFINEMENT_MAX_LENGTH = 120;
const RESUME_INTERACTION_ID_MAX = 80;

export const documentSelectionOptionSchema = z.object({
  document_id: z.string().min(1),
  title: z.string(),
  source_filename: z.string().nullish(),
  knowledge_base_id: z.string().nullish(),
  knowledge_base_name: z.string().nullish(),
});

export const documentSelectionOptionV2Schema =
  documentSelectionOptionSchema.extend({
    match_confidence: z.enum(["high", "medium", "low"]).nullish(),
    match_reason_code: z
      .enum([
        "exact_title",
        "exact_filename",
        "partial_title",
        "partial_filename",
        "metadata_overlap",
      ])
      .nullish(),
  });

const documentSelectionBaseSchema = z.object({
  interaction_id: z.string().min(1),
  type: z.literal("document_selection"),
  message_key: z.literal("clarification.document_scope.select_source"),
  expires_at: z.string(),
});

export const documentSelectionInteractionV1Schema =
  documentSelectionBaseSchema.extend({
    schema_version: z.literal(LEGACY_INTERACTION_SCHEMA_VERSION),
    reason_code: z.literal("ambiguous_document_reference"),
    option_count: z.number().int().min(0),
    options: z.array(documentSelectionOptionSchema).default([]),
    next_cursor: z.string().nullish(),
  });

export const documentSelectionInteractionV2Schema =
  documentSelectionBaseSchema.extend({
    schema_version: z.literal(INTERACTION_SCHEMA_VERSION),
    reason_code: z.enum([
      "ambiguous_document_reference",
      "unresolved_document_reference",
    ]),
    option_count: z.number().int().min(0).max(5),
    library_count: z.number().int().min(0),
    options: z.array(documentSelectionOptionV2Schema).max(5).default([]),
    next_cursor: z.null().default(null),
    refinement: z.object({
      allowed: z.boolean(),
      attempts_used: z.number().int().min(0).max(2),
      attempts_max: z.literal(2).default(2),
      max_length: z
        .literal(DOCUMENT_REFINEMENT_MAX_LENGTH)
        .default(DOCUMENT_REFINEMENT_MAX_LENGTH),
    }),
    browse: z.object({
      allowed: z.boolean(),
      cursor: z.string().nullish().default(null),
    }),
  });

export const documentSelectionInteractionSchema = z.union([
  documentSelectionInteractionV1Schema,
  documentSelectionInteractionV2Schema,
]);

/**
 * A choice among the conversation's own attachments — V2 only.
 *
 * Asked when a question refers to "the file" and more than one attachment
 * could be meant. Options are the backend's list, rendered as given; the
 * frontend adds nothing and filters nothing (see `docs/durable-interactions.md`).
 * `original_available: false` means the original bytes have expired and the
 * answer will draw on what the conversation retained instead.
 */
export const ATTACHMENT_SELECTION_MAX_CHOICES = 3;

export const attachmentSelectionOptionSchema = z.object({
  attachment_id: z.string().min(1),
  filename: z.string(),
  category: z.string(),
  original_available: z.boolean(),
  byte_size: z.number().int().nonnegative().nullish(),
  created_at: z.string().nullish(),
});

export const attachmentSelectionInteractionSchema = z.object({
  schema_version: z.literal(INTERACTION_SCHEMA_VERSION),
  interaction_id: z.string().min(1),
  type: z.literal("attachment_selection"),
  reason_code: z.literal("ambiguous_attachment_reference"),
  message_key: z.literal("clarification.attachment_scope.select_source"),
  expires_at: z.string(),
  option_count: z.number().int().min(0).max(50),
  options: z.array(attachmentSelectionOptionSchema).max(50),
  /**
   * What the answer will read: the original files, or only what the
   * conversation retained (`notes`). Kept an open string so a future value
   * parses; the card treats only `notes` specially.
   */
  access: z.string().default("original"),
});

export const unsupportedInteractionSchema = z.object({
  schema_version: z.number().int(),
  interaction_id: z.string().min(1),
  type: z.string().min(1),
  expires_at: z.string().optional(),
});

export const pendingInteractionSchema = z.union([
  documentSelectionInteractionV1Schema,
  documentSelectionInteractionV2Schema,
  attachmentSelectionInteractionSchema,
  unsupportedInteractionSchema,
]);

export const documentSelectionOptionsPageV1Schema = z.object({
  schema_version: z.literal(LEGACY_INTERACTION_SCHEMA_VERSION),
  interaction_id: z.string().min(1),
  type: z.literal("document_selection"),
  option_count: z.number().int().min(0),
  options: z.array(documentSelectionOptionSchema).default([]),
  next_cursor: z.string().nullish(),
});

export const documentSelectionOptionsPageV2Schema = z.object({
  schema_version: z.literal(INTERACTION_SCHEMA_VERSION),
  interaction_id: z.string().min(1),
  type: z.literal("document_selection"),
  mode: z.literal("broad").default("broad"),
  option_count: z.number().int().min(0),
  library_count: z.number().int().min(0),
  options: z.array(documentSelectionOptionV2Schema).default([]),
  next_cursor: z.string().nullish(),
});

export const documentSelectionOptionsPageSchema = z.union([
  documentSelectionOptionsPageV1Schema,
  documentSelectionOptionsPageV2Schema,
]);

const resumeReferenceV1Schema = z.object({
  schema_version: z.literal(LEGACY_INTERACTION_SCHEMA_VERSION),
  interaction_id: z.string().min(1).max(RESUME_INTERACTION_ID_MAX),
  type: z.literal("document_selection"),
});

const resumeReferenceV2Schema = z.object({
  schema_version: z.literal(INTERACTION_SCHEMA_VERSION),
  interaction_id: z.string().min(1).max(RESUME_INTERACTION_ID_MAX),
  type: z.literal("document_selection"),
});

export const conversationRunResumeRequestV1Schema =
  resumeReferenceV1Schema.extend({
    document_id: z.string().min(1).max(36),
  });

export const conversationRunSelectRequestV2Schema =
  resumeReferenceV2Schema.extend({
    kind: z.literal("select"),
    document_id: z.string().min(1).max(36),
  });

export const conversationRunRefineRequestV2Schema =
  resumeReferenceV2Schema.extend({
    kind: z.literal("refine"),
    text: z.string().trim().min(1).max(DOCUMENT_REFINEMENT_MAX_LENGTH),
  });

export const conversationAttachmentSelectRequestV2Schema = z.object({
  schema_version: z.literal(INTERACTION_SCHEMA_VERSION),
  interaction_id: z.string().min(1),
  type: z.literal("attachment_selection"),
  kind: z.literal("select"),
  attachment_ids: z
    .array(z.string().min(1))
    .min(1)
    .max(ATTACHMENT_SELECTION_MAX_CHOICES),
});

export const conversationRunResumeRequestSchema = z.union([
  conversationRunResumeRequestV1Schema,
  conversationRunSelectRequestV2Schema,
  conversationRunRefineRequestV2Schema,
  conversationAttachmentSelectRequestV2Schema,
]);

export const runInterruptedActivityPayloadSchema = z.object({
  run_id: z.string().min(1),
  status: z.string().optional(),
  interaction_id: z.string().min(1),
  interaction_schema_version: z.number().int(),
  interaction_type: z.string().default("document_selection"),
  option_count: z.number().int().min(0),
  expires_at: z.string(),
});

export const runResumedActivityPayloadSchema = z.object({
  run_id: z.string().min(1),
  status: z.string().optional(),
  interaction_id: z.string().min(1),
  interaction_schema_version: z.number().int(),
  interaction_type: z.string().default("document_selection"),
});

export type DocumentSelectionOption = z.infer<
  typeof documentSelectionOptionSchema
>;
export type DocumentSelectionOptionV2 = z.infer<
  typeof documentSelectionOptionV2Schema
>;
export type DocumentSelectionInteractionV1 = z.infer<
  typeof documentSelectionInteractionV1Schema
>;
export type DocumentSelectionInteractionV2 = z.infer<
  typeof documentSelectionInteractionV2Schema
>;
export type DocumentSelectionInteraction = z.infer<
  typeof documentSelectionInteractionSchema
>;
export type AttachmentSelectionOption = z.infer<
  typeof attachmentSelectionOptionSchema
>;
export type AttachmentSelectionInteraction = z.infer<
  typeof attachmentSelectionInteractionSchema
>;
export type UnsupportedInteraction = z.infer<
  typeof unsupportedInteractionSchema
>;
export type PendingInteraction = z.infer<typeof pendingInteractionSchema>;
export type DocumentSelectionOptionsPage = z.infer<
  typeof documentSelectionOptionsPageSchema
>;
export type ConversationRunResumeRequest = z.infer<
  typeof conversationRunResumeRequestSchema
>;
export type RunInterruptedActivityPayload = z.infer<
  typeof runInterruptedActivityPayloadSchema
>;
export type RunResumedActivityPayload = z.infer<
  typeof runResumedActivityPayloadSchema
>;

export function isDocumentSelection(
  interaction: PendingInteraction,
): interaction is DocumentSelectionInteraction {
  return (
    interaction.type === "document_selection" &&
    (interaction.schema_version === LEGACY_INTERACTION_SCHEMA_VERSION ||
      interaction.schema_version === INTERACTION_SCHEMA_VERSION) &&
    "option_count" in interaction
  );
}

/**
 * Type, version, and a structural field — the same three-part support decision
 * as `isDocumentSelection`. A future version parses through the unsupported
 * branch, which strips `options`, so it fails here and gets the fallback card.
 */
export function isAttachmentSelection(
  interaction: PendingInteraction,
): interaction is AttachmentSelectionInteraction {
  return (
    interaction.type === "attachment_selection" &&
    interaction.schema_version === INTERACTION_SCHEMA_VERSION &&
    "options" in interaction
  );
}

export function isDocumentSelectionV2(
  interaction: DocumentSelectionInteraction,
): interaction is DocumentSelectionInteractionV2 {
  return interaction.schema_version === INTERACTION_SCHEMA_VERSION;
}

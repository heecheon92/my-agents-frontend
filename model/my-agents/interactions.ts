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

export const unsupportedInteractionSchema = z.object({
  schema_version: z.number().int(),
  interaction_id: z.string().min(1),
  type: z.string().min(1),
  expires_at: z.string().optional(),
});

export const pendingInteractionSchema = z.union([
  documentSelectionInteractionV1Schema,
  documentSelectionInteractionV2Schema,
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

export const conversationRunResumeRequestSchema = z.union([
  conversationRunResumeRequestV1Schema,
  conversationRunSelectRequestV2Schema,
  conversationRunRefineRequestV2Schema,
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

export function isDocumentSelectionV2(
  interaction: DocumentSelectionInteraction,
): interaction is DocumentSelectionInteractionV2 {
  return interaction.schema_version === INTERACTION_SCHEMA_VERSION;
}

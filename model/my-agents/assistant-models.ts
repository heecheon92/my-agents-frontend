import { z } from "zod";
import { reasoningEffortSchema } from "./capabilities";

/**
 * Which underlying model answers a registered user's chat runs.
 *
 * Model IDs are deliberately an open string, not an enum of today's models.
 * The picker renders only the list `GET /capabilities/assistant-models`
 * serves, so a backend that adds or retires a model changes the options
 * without a frontend release, and a PATCH can only ever carry an ID the
 * backend just offered. Unlike reasoning levels, each model arrives with its
 * own display `name`, so there is no label this build could be missing.
 *
 * Per-model reasoning defaults are the backend's map, not a frontend
 * constant: read `default_reasoning_effort` here or `default_effort` from the
 * reasoning capabilities, which describe the currently effective model.
 */
export const assistantModelIdSchema = z.string().min(1);

export const assistantModelOptionSchema = z.object({
  id: assistantModelIdSchema,
  /** Display label, rendered verbatim. */
  name: z.string().min(1),
  default_reasoning_effort: reasoningEffortSchema,
  pro_supported: z.boolean(),
});

export const assistantModelCapabilitiesSchema = z.object({
  /** `false` for a guest: the backend rejects a guest PATCH with 403. */
  customizable: z.boolean(),
  /** The deployment default, used when the user has saved no choice. */
  default_model: assistantModelIdSchema,
  models: z.array(assistantModelOptionSchema),
});

/** The model choice both preference endpoints share. */
const modelPreferencesSchema = z.object({
  customizable: z.boolean(),
  default_model: assistantModelIdSchema,
  /** `null` means "follow the deployment default", not "no model". */
  selected_model: assistantModelIdSchema.nullable(),
  /** The model new runs will actually use. */
  effective_model: assistantModelIdSchema,
});

/**
 * When an answer searches the user's documents.
 *
 * `on_request` searches only when the user selects sources in the composer or
 * explicitly asks for documents in the question; an explicit "do not use
 * documents" instruction still wins.
 */
export const documentRetrievalPrioritySchema = z.enum([
  "always",
  "automatic",
  "on_request",
]);

/**
 * How an uploaded document is processed. `ai_assisted` sends the extracted
 * text to OpenAI to clean up its formatting (no summarization); choosing it is
 * the user's consent, so the UI always shows that disclosure next to it.
 */
export const documentIngestionModeSchema = z.enum(["standard", "ai_assisted"]);

/**
 * `GET/PATCH /assistant/preferences`, read from the served OpenAPI
 * (`AssistantPreferencesResponse`). The document fields are served with
 * defaults and degrade to them, so an older backend still parses.
 */
export const assistantPreferencesSchema = modelPreferencesSchema.extend({
  document_retrieval_priority:
    documentRetrievalPrioritySchema.catch("automatic"),
  document_ingestion_mode: documentIngestionModeSchema.catch("standard"),
});

/**
 * Sends only what changed: an omitted field keeps its saved value. Never
 * include a field just to fill the object — a stale value would overwrite a
 * newer choice made in another tab.
 */
export const assistantPreferencesPatchRequestSchema = z.object({
  /** `null` clears the saved choice and returns to the deployment default. */
  assistant_model: assistantModelIdSchema.nullable().optional(),
  document_retrieval_priority: documentRetrievalPrioritySchema.optional(),
  document_ingestion_mode: documentIngestionModeSchema.optional(),
});

export type AssistantModelId = z.infer<typeof assistantModelIdSchema>;
export type AssistantModelOption = z.infer<typeof assistantModelOptionSchema>;
export type AssistantModelCapabilities = z.infer<
  typeof assistantModelCapabilitiesSchema
>;
export type AssistantPreferences = z.infer<typeof assistantPreferencesSchema>;
export type DocumentRetrievalPriority = z.infer<
  typeof documentRetrievalPrioritySchema
>;
export type DocumentIngestionMode = z.infer<typeof documentIngestionModeSchema>;
export type AssistantPreferencesPatchRequest = z.infer<
  typeof assistantPreferencesPatchRequestSchema
>;

/**
 * The model that summarizes earlier turns when a conversation is compacted.
 *
 * Served in the same shape as the assistant preference — the backend reuses
 * `AssistantPreferencesResponse` for `GET/PATCH /summarization/preferences` —
 * but the catalog entries carry only `id` and `name`, and the catalog names a
 * `recommended_model`. The recommendation is served data, never a constant
 * here, so the UI marks whatever the backend currently recommends.
 */
export const summarizationModelOptionSchema = z.object({
  id: assistantModelIdSchema,
  name: z.string().min(1),
});

export const summarizationModelCapabilitiesSchema = z.object({
  customizable: z.boolean(),
  default_model: assistantModelIdSchema,
  /**
   * Served with a default, so always present today; optional here so an
   * endpoint that omits unset fields degrades to "no badge" rather than
   * failing the whole card.
   */
  recommended_model: assistantModelIdSchema.optional(),
  models: z.array(summarizationModelOptionSchema),
});

export const summarizationPreferencesSchema = modelPreferencesSchema;

export const summarizationPreferencesPatchRequestSchema = z.object({
  /** `null` clears the saved choice and returns to the deployment default. */
  summarization_model: assistantModelIdSchema.nullable(),
});

export type SummarizationModelOption = z.infer<
  typeof summarizationModelOptionSchema
>;
export type SummarizationModelCapabilities = z.infer<
  typeof summarizationModelCapabilitiesSchema
>;
export type SummarizationPreferences = z.infer<
  typeof summarizationPreferencesSchema
>;
export type SummarizationPreferencesPatchRequest = z.infer<
  typeof summarizationPreferencesPatchRequestSchema
>;

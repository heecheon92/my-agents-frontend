import { z } from "zod";

/**
 * Durable interactions — a run that suspends to ask the user something.
 *
 * Derived from the backend's hosted OpenAPI document
 * (`http://127.0.0.1:8000/openapi.json`, `feature/langgraph-checkpointer`),
 * per `AGENTS.md`. Do not edit these shapes from reading backend source.
 *
 * See `docs/durable-interactions.md` for the boundary rules. The one that
 * governs this file: the union is **open**. An unknown interaction type must
 * still parse, because the run behind it is suspended and a card that fails to
 * render leaves no way to cancel it — the conversation would be stuck until the
 * interaction expires, 24 hours later by backend default.
 */

/** Wire value of `schema_version`; an integer, not a semver string. */
export const INTERACTION_SCHEMA_VERSION = 1;

/**
 * Length bounds are enforced on the *request* only, deliberately.
 *
 * The contract declares `interaction_id` as 1–80 characters everywhere (it
 * inherits a shared `InteractionReference` base backend-side). Mirroring the
 * upper bound on responses would buy nothing and risks the failure this module
 * exists to prevent: a response that fails to parse leaves a suspended run with
 * no card, and therefore no way to cancel it. Be strict about what we send and
 * permissive about what we accept.
 */
const RESUME_INTERACTION_ID_MAX = 80;

export const documentSelectionOptionSchema = z.object({
  document_id: z.string().min(1),
  title: z.string(),
  // Nullable rather than optional: the backend sends explicit nulls for a
  // document with no file behind it, such as a pasted note.
  source_filename: z.string().nullish(),
  knowledge_base_id: z.string().nullish(),
  knowledge_base_name: z.string().nullish(),
});

/**
 * The known interaction body, faithful to the live OpenAPI contract.
 *
 * Every required field stays required. The SSE `run_interrupted` event emits
 * `ConversationRunInterruptedResponse.model_dump()` — the *same* full body as
 * the HTTP 202 — so there is no second, thinner source to loosen this for. The
 * separate `runInterruptedActivityPayloadSchema` below covers the simplified
 * persisted activity event, which is a different contract and is not fed into
 * the run loop.
 *
 * `options` is genuinely optional in the contract (only `option_count` is
 * required), so a list renderer must still tolerate an empty array and page.
 */
export const documentSelectionInteractionSchema = z.object({
  // `z.literal`, not `z.number().int()`. This branch is tried first in the
  // union, so a permissive version field would let a v2 `document_selection`
  // match as v1 and be rendered — and answered — with v1 semantics, silently
  // bypassing the unsupported-version fallback that exists for exactly that.
  schema_version: z.literal(INTERACTION_SCHEMA_VERSION),
  interaction_id: z.string().min(1),
  type: z.literal("document_selection"),
  reason_code: z.string(),
  message_key: z.string(),
  expires_at: z.string(),
  option_count: z.number().int().min(0),
  options: z.array(documentSelectionOptionSchema).default([]),
  next_cursor: z.string().nullish(),
});

/**
 * Anything this build cannot render, kept parseable on purpose.
 *
 * Only the fields every interaction is guaranteed to carry are required here,
 * because those are exactly what the fallback card needs: something to identify
 * the interaction by when cancelling, and something to explain.
 */
export const unsupportedInteractionSchema = z.object({
  // Stays permissive: this is the branch that must accept *any* version,
  // including ones from the future, so the card can still say so and cancel.
  schema_version: z.number().int(),
  interaction_id: z.string().min(1),
  type: z.string().min(1),
  expires_at: z.string().optional(),
});

/**
 * Ordered, not discriminated. `z.discriminatedUnion` would reject an unknown
 * `type` outright, which is the failure mode this union exists to avoid.
 */
export const pendingInteractionSchema = z.union([
  documentSelectionInteractionSchema,
  unsupportedInteractionSchema,
]);

export const documentSelectionOptionsPageSchema = z.object({
  schema_version: z.literal(INTERACTION_SCHEMA_VERSION),
  interaction_id: z.string().min(1),
  type: z.literal("document_selection"),
  option_count: z.number().int().min(0),
  options: z.array(documentSelectionOptionSchema).default([]),
  next_cursor: z.string().nullish(),
});

export const conversationRunResumeRequestSchema = z.object({
  // Refuses to *send* a version this build does not implement, so a stale tab
  // cannot answer a v2 question with a v1 body.
  schema_version: z.literal(INTERACTION_SCHEMA_VERSION),
  interaction_id: z.string().min(1).max(RESUME_INTERACTION_ID_MAX),
  type: z.literal("document_selection"),
  document_id: z.string().min(1).max(36),
});

/**
 * The *persisted activity event* payloads, as stored and replayed from
 * `GET .../runs/{run_id}/events`.
 *
 * Deliberately not what the SSE stream sends. The live stream emits the full
 * interrupted response (see `conversationRunInterruptedResponseSchema`); these
 * simplified, redaction-safe rows are what the activity timeline reads. Keeping
 * both means neither has to be loosened to accommodate the other.
 */
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

/**
 * Whether this build can render the interaction as a document choice.
 *
 * Checks the version as well as the type. `type` alone is not enough: a v2
 * body parses through the unsupported branch and still calls itself
 * `document_selection`, so a type-only guard would hand a future payload to the
 * v1 card — the same bypass the literal version fields exist to close.
 */
export function isDocumentSelection(
  interaction: PendingInteraction,
): interaction is DocumentSelectionInteraction {
  return (
    interaction.type === "document_selection" &&
    interaction.schema_version === INTERACTION_SCHEMA_VERSION &&
    // Structural, not just nominal. Zod strips unknown keys, so a body that
    // fell through to the unsupported branch keeps its type and version but
    // loses everything the card actually renders. Without this check such a
    // body would be handed to the v1 card with no options and no count.
    "option_count" in interaction
  );
}

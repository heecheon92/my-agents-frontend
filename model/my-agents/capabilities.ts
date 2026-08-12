import { z } from "zod";

/**
 * Reasoning controls the backend accepts on a run.
 *
 * The enums are closed deliberately. Every level has to render as a Korean
 * label and a slider stop, so a level this build has no word for cannot be
 * displayed anyway. If the backend adds one, parsing fails, the capabilities
 * query errors, and `ComposerBar` falls back to hiding the controls entirely —
 * the composer keeps working and requests keep omitting both fields. That is
 * the safe direction to fail in, and it is louder than silently rendering an
 * unlabeled stop.
 */
export const reasoningModeSchema = z.enum(["standard", "pro"]);

export const reasoningEffortSchema = z.enum([
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);

/**
 * Reported per execution surface because chat and attachment/document-workspace
 * turns are configured independently — the backend validates an attachment run
 * against `document_workspace_model` and everything else against
 * `openai_model`, so a single collapsed flag could offer Pro for a run the
 * backend then rejects.
 *
 * There is deliberately no `model` field. The backend used to report a raw
 * deployment model ID per surface, which this app never read — `pro_supported`
 * is the only value consumed — while making the deployed model version
 * readable in the Network tab by any authenticated user. The backend is
 * dropping it.
 *
 * Declaring it absent rather than optional is what makes the two repos safe to
 * deploy in either order: this schema is not `.strict()`, so Zod strips a
 * `model` key that is still being sent instead of rejecting the payload. Do not
 * add `.strict()` here without coordinating both sides.
 */
export const reasoningSurfaceSchema = z.object({
  pro_supported: z.boolean(),
});

export const reasoningCapabilitiesSchema = z.object({
  /** `false` for a guest: the backend clamps their values server-side. */
  customizable: z.boolean(),
  /**
   * The only field the backend does not mark required: it is a Pydantic field
   * with a default, so it is always serialized today and this default never
   * fires. It exists so that stops being load-bearing — setting
   * `response_model_exclude_unset` on that endpoint would drop the key, and a
   * required field here would then fail the whole schema, error the
   * capabilities query, and silently strip the composer's reasoning controls.
   *
   * `.default()` rather than `.optional()` so the parsed type stays
   * non-optional and no consumer has to branch. `standard` is both the value
   * the backend pins and the conservative direction — falling back can only
   * ever downgrade to the cheaper mode, never silently enable Pro.
   */
  default_mode: reasoningModeSchema.default("standard"),
  /** The active backend env default, not a frontend constant. */
  default_effort: reasoningEffortSchema,
  supported_modes: z.array(reasoningModeSchema),
  supported_efforts: z.array(reasoningEffortSchema),
  chat: reasoningSurfaceSchema,
  document_workspace: reasoningSurfaceSchema,
});

export type ReasoningMode = z.infer<typeof reasoningModeSchema>;
export type ReasoningEffort = z.infer<typeof reasoningEffortSchema>;
export type ReasoningSurface = z.infer<typeof reasoningSurfaceSchema>;
export type ReasoningCapabilities = z.infer<typeof reasoningCapabilitiesSchema>;

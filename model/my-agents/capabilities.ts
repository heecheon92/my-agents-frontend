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
 * Reported per execution surface because a deployment may configure different
 * model IDs for chat and for attachment/document-workspace turns.
 */
export const reasoningSurfaceSchema = z.object({
  model: z.string(),
  pro_supported: z.boolean(),
});

export const reasoningCapabilitiesSchema = z.object({
  /** `false` for a guest: the backend clamps their values server-side. */
  customizable: z.boolean(),
  default_mode: reasoningModeSchema,
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

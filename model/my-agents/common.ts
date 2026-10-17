import { z } from "zod";

export const routeLabelSchema = z.enum([
  "general_assistant",
  "learning_coach",
  "research_helper",
  "project_planner",
  "career_helper",
]);

export const routeDecisionSchema = z.object({
  label: routeLabelSchema,
  explanation: z.string().min(1),
});

export const DEFAULT_DOCUMENT_UPLOAD_CONCURRENCY = 3;

export const healthResponseSchema = z.object({
  status: z.string(),
  service: z.string(),
  version: z.string(),
  frontend_config: z
    .object({
      documents: z
        .object({
          upload_concurrency: z.number().int().min(1).max(20),
        })
        .optional(),
      /**
       * Server-owned answers, opt-in per deployment. `enabled` is the
       * configured flag and selects the durable routes for new answers and
       * regenerations. `ready` adds whether a worker is currently fresh; it is
       * information only, because with `enabled` true and no worker the
       * admission answers `503 durable_runs_unavailable` rather than falling
       * back. Absent or malformed means the legacy routes, so this can never
       * break health.
       */
      durable_runs: z
        .object({ enabled: z.boolean(), ready: z.boolean().optional() })
        .optional()
        .catch(undefined),
    })
    .optional(),
});

export type RouteLabel = z.infer<typeof routeLabelSchema>;
export type RouteDecision = z.infer<typeof routeDecisionSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export function documentUploadConcurrencyFromHealth(
  health: HealthResponse | undefined,
) {
  return (
    health?.frontend_config?.documents?.upload_concurrency ??
    DEFAULT_DOCUMENT_UPLOAD_CONCURRENCY
  );
}

/**
 * Whether new answers and regenerations use the durable routes. Off unless the
 * backend reports `enabled: true`. Never consulted for an existing run, which
 * is routed by its own `execution_mode`.
 */
export function durableRunsEnabledFromHealth(
  health: HealthResponse | undefined,
) {
  return health?.frontend_config?.durable_runs?.enabled === true;
}

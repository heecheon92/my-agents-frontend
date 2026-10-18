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
          /**
           * The upload policy, read from the served `HealthFrontendDocumentConfig`.
           * Every field is optional here so an older backend falls back to the
           * multipart route and today's limits, never to a direct upload.
           */
          direct_uploads: z.boolean().optional().catch(undefined),
          max_upload_bytes: z
            .number()
            .int()
            .positive()
            .optional()
            .catch(undefined),
          multipart_max_bytes: z
            .number()
            .int()
            .positive()
            .optional()
            .catch(undefined),
          allowed_extensions: z.array(z.string()).optional().catch(undefined),
          ai_assisted_ingestion: z.boolean().optional().catch(undefined),
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

/** Today's limit, used only when the backend does not serve one. */
export const FALLBACK_MULTIPART_MAX_BYTES = 5 * 1024 * 1024;

export type DocumentUploadPolicy = {
  /** Upload straight to private storage with a signed URL. */
  directUploads: boolean;
  /** The ceiling for a direct upload. */
  directMaxBytes: number;
  /** The ceiling through the BFF, which sits under the host's body limit. */
  multipartMaxBytes: number;
  /** Lower-case extensions with the dot, or `null` for the built-in list. */
  allowedExtensions: string[] | null;
  /** Whether `ai_assisted` processing can be chosen at all. */
  aiAssistedIngestion: boolean;
};

/**
 * The upload policy the backend serves, with conservative fallbacks: no direct
 * upload, no AI-assisted processing, and the multipart limit the frontend has
 * always enforced.
 */
export function documentUploadPolicyFromHealth(
  health: HealthResponse | undefined,
): DocumentUploadPolicy {
  const documents = health?.frontend_config?.documents;
  const multipartMaxBytes =
    documents?.multipart_max_bytes ?? FALLBACK_MULTIPART_MAX_BYTES;
  return {
    directUploads: documents?.direct_uploads === true,
    directMaxBytes: documents?.max_upload_bytes ?? multipartMaxBytes,
    multipartMaxBytes,
    allowedExtensions:
      documents?.allowed_extensions?.map((extension) => {
        const lower = extension.toLowerCase();
        return lower.startsWith(".") ? lower : `.${lower}`;
      }) ?? null,
    aiAssistedIngestion: documents?.ai_assisted_ingestion === true,
  };
}

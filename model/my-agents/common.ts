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

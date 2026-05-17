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

export const healthResponseSchema = z.object({
  status: z.string(),
  service: z.string(),
  version: z.string(),
});

export type RouteLabel = z.infer<typeof routeLabelSchema>;
export type RouteDecision = z.infer<typeof routeDecisionSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;

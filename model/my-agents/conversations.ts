import { z } from "zod";
import { reasoningEffortSchema, reasoningModeSchema } from "./capabilities";
import { routeDecisionSchema } from "./common";
import { citationSchema } from "./knowledge";

/**
 * The effective pair the backend resolved for a run.
 *
 * Optional on responses because a backend without the reasoning migration
 * omits them, and these schemas are not `.strict()` — so this stays additive
 * in both directions and an older backend keeps parsing.
 */
export const runReasoningSchema = z.object({
  reasoning_mode: reasoningModeSchema.optional(),
  reasoning_effort: reasoningEffortSchema.optional(),
});

export const conversationSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  owner_user_id: z.string().min(1),
});

export const conversationCreateRequestSchema = z.object({
  title: z.string().min(1).max(200),
});

export const messageSchema = z.object({
  id: z.string().min(1),
  conversation_id: z.string().min(1),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const messageCreateRequestSchema = z.object({
  content: z.string().min(1),
});

export const knowledgeBaseSelectionModeSchema = z.enum(["all", "selected"]);

export const knowledgeBaseSelectionSchema = z.object({
  mode: knowledgeBaseSelectionModeSchema.default("all"),
  knowledge_base_ids: z.array(z.string().min(1)).default([]),
});

export const conversationRunRequestSchema = z
  .object({
    message: z.string().min(1),
    knowledge_base_selection: knowledgeBaseSelectionSchema.optional(),
  })
  .merge(runReasoningSchema);

export const runSourceContextSchema = z.object({
  resolved_knowledge_base_ids: z.array(z.string().min(1)).default([]),
  resolved_knowledge_base_count: z.number().default(0),
});

export const conversationRunWarningSchema = z.object({
  code: z.literal("regeneration_sources_unavailable"),
  message: z.string(),
  missing_document_ids: z.array(z.string()).default([]),
  missing_source_filenames: z.array(z.string()).default([]),
});

export const agentTraceTextSchema = z.object({
  en: z.string(),
  ko: z.string(),
});

export const agentTraceStepSchema = z.object({
  id: z.string().min(1),
  event_type: z.string().min(1),
  status: z.enum(["completed", "skipped", "waiting", "failed"]),
  title: agentTraceTextSchema,
  description: agentTraceTextSchema,
  evidence: z.record(z.string(), z.unknown()).default({}),
});

export const conversationRunResponseSchema = z
  .object({
    run_id: z.string().min(1),
    conversation_id: z.string().min(1),
    reply: z.string(),
    route: routeDecisionSchema,
    handled_by: z.literal("personal_assistant_graph"),
    retrieval_route: z.string().optional(),
    answer_mode: z.string().optional(),
    document_scope: z.string().optional(),
    citations: z.array(citationSchema).default([]),
    warnings: z.array(conversationRunWarningSchema).default([]),
    agent_trace: z.array(agentTraceStepSchema).default([]),
    knowledge_base_selection: knowledgeBaseSelectionSchema.default({
      mode: "all",
      knowledge_base_ids: [],
    }),
  })
  .merge(runSourceContextSchema)
  .merge(runReasoningSchema);

export const runStartedEventDataSchema = z
  .object({
    run_id: z.string().min(1),
    conversation_id: z.string().min(1),
    status: z.string(),
    knowledge_base_selection: knowledgeBaseSelectionSchema.optional(),
  })
  .merge(runSourceContextSchema.partial())
  .merge(runReasoningSchema);

export const answerDeltaEventDataSchema = z.object({
  delta: z.string(),
  sequence: z.number().optional(),
  run_id: z.string().optional(),
});

export const runCancelledEventDataSchema = z.object({
  run_id: z.string().min(1),
  conversation_id: z.string().min(1),
  status: z.string(),
  partial_reply_persisted: z.boolean().optional(),
});

export const runCancelResponseSchema = z.object({
  run_id: z.string().min(1),
  conversation_id: z.string().min(1),
  status: z.string(),
});

export const agentRunSummarySchema = z
  .object({
    run_id: z.string().min(1),
    conversation_id: z.string().min(1),
    status: z.string(),
    route_label: z.string().nullable(),
    created_at: z.string(),
    knowledge_base_selection: knowledgeBaseSelectionSchema.default({
      mode: "all",
      knowledge_base_ids: [],
    }),
  })
  .merge(runSourceContextSchema)
  .merge(runReasoningSchema);

export const agentEventSchema = z.object({
  id: z.string().min(1),
  run_id: z.string().min(1),
  sequence: z.number(),
  event_type: z.string(),
  payload: z.record(z.string(), z.unknown()),
});

export type Conversation = z.infer<typeof conversationSchema>;
export type ConversationCreateRequest = z.infer<
  typeof conversationCreateRequestSchema
>;
export type Message = z.infer<typeof messageSchema>;
export type MessageCreateRequest = z.infer<typeof messageCreateRequestSchema>;
export type KnowledgeBaseSelectionMode = z.infer<
  typeof knowledgeBaseSelectionModeSchema
>;
export type KnowledgeBaseSelection = z.infer<
  typeof knowledgeBaseSelectionSchema
>;
export type ConversationRunRequest = z.infer<
  typeof conversationRunRequestSchema
>;
export type RunReasoning = z.infer<typeof runReasoningSchema>;
export type ConversationRunWarning = z.infer<
  typeof conversationRunWarningSchema
>;
export type AgentTraceStep = z.infer<typeof agentTraceStepSchema>;
export type RunSourceContext = z.infer<typeof runSourceContextSchema>;
export type ConversationRunResponse = z.infer<
  typeof conversationRunResponseSchema
>;
export type RunStartedEventData = z.infer<typeof runStartedEventDataSchema>;
export type AnswerDeltaEventData = z.infer<typeof answerDeltaEventDataSchema>;
export type RunCancelledEventData = z.infer<typeof runCancelledEventDataSchema>;
export type RunCancelResponse = z.infer<typeof runCancelResponseSchema>;
export type AgentRunSummary = z.infer<typeof agentRunSummarySchema>;
export type AgentEvent = z.infer<typeof agentEventSchema>;

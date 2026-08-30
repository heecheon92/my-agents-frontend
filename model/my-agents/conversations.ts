import { z } from "zod";
import { reasoningEffortSchema, reasoningModeSchema } from "./capabilities";
import { routeDecisionSchema } from "./common";
import { pendingInteractionSchema } from "./interactions";
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

/**
 * The bounded document range the backend actually read for a comprehensive
 * answer. This is provenance about retrieval coverage, not a citation claim.
 *
 * Generated from the locally served backend OpenAPI contract on 2026-08-31.
 * `source_filename` and the containing response property are both optional and
 * nullable in that document. `mode` stays authoritative: the UI must not infer
 * complete/partial from the offsets.
 */
export const documentCoverageSchema = z.object({
  mode: z.enum(["complete", "partial"]),
  document_id: z.string(),
  title: z.string(),
  source_filename: z.string().nullish(),
  start_offset: z.number().int().nonnegative(),
  end_offset: z.number().int().nonnegative(),
  total_chars: z.number().int().nonnegative(),
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
    /**
     * Every user-visible source handed to answer composition — a superset of
     * `citations`, which is the conservative answer-supported subset.
     *
     * `.nullish()` because the served contract is `anyOf [array, null]` and the
     * property is not required, so absent, `null` and `[]` are three distinct
     * states on the wire. Absent/`null` means the run predates attribution and
     * its `citations` were never verified; `[]` means attribution ran and found
     * nothing. Collapsing those with `.default([])` would erase the difference
     * and let old runs claim a check that never happened.
     */
    consulted_sources: z.array(citationSchema).nullish(),
    document_coverage: documentCoverageSchema.nullish(),
    warnings: z.array(conversationRunWarningSchema).default([]),
    agent_trace: z.array(agentTraceStepSchema).default([]),
    knowledge_base_selection: knowledgeBaseSelectionSchema.default({
      mode: "all",
      knowledge_base_ids: [],
    }),
  })
  .merge(runSourceContextSchema)
  .merge(runReasoningSchema);

/**
 * A run that stopped to ask the user something.
 *
 * Served on run creation (HTTP 202), on resume, and on `GET .../runs/{run_id}`
 * after a refresh — which is what makes a pending question survive a reload.
 */
export const conversationRunInterruptedResponseSchema = z.object({
  status: z.literal("waiting_for_input"),
  run_id: z.string().min(1),
  conversation_id: z.string().min(1),
  interaction: pendingInteractionSchema,
});

/**
 * Every run outcome, as one value.
 *
 * A plain `z.union`, not `z.discriminatedUnion`: `status` is absent on a
 * completed response from a backend predating this contract (the field carries
 * a server-side default and is not in `required`), and a discriminated union
 * cannot match a missing discriminator. Interrupted is tried first because it
 * requires `interaction`, so a completed payload cannot satisfy it by accident.
 */
export const conversationRunResultSchema = z.union([
  conversationRunInterruptedResponseSchema,
  conversationRunResponseSchema,
]);

export function isRunInterrupted(
  result: ConversationRunResult,
): result is ConversationRunInterruptedResponse {
  return "interaction" in result;
}

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
export type DocumentCoverage = z.infer<typeof documentCoverageSchema>;
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
export type ConversationRunInterruptedResponse = z.infer<
  typeof conversationRunInterruptedResponseSchema
>;
export type ConversationRunResult = z.infer<typeof conversationRunResultSchema>;

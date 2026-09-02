import { z } from "zod";
import { reasoningEffortSchema, reasoningModeSchema } from "./capabilities";
import { routeDecisionSchema } from "./common";
import {
  conversationArtifactSchema,
  conversationAttachmentSchema,
} from "./document-workspace";
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
    /**
     * Temporary conversation files this turn should read.
     *
     * Optional and omitted entirely when empty, so a deployment without the
     * document workspace sends the byte-identical request it always did. The
     * served OpenAPI declares `maxItems: 10`; the authoritative user-facing
     * limit is the capability's `limits.max_files_per_run`, which the backend
     * constrains to that same ceiling. See `attachments/staging.ts`.
     */
    attachment_ids: z.array(z.string().min(1)).optional(),
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

/**
 * What the application verified one stage actually did, as a semantic key plus
 * closed parameters. Read from `AgentTraceOperationalSummary` in the live
 * backend OpenAPI document on 2026-09-02.
 *
 * The point of the contract is that the *frontend* owns the sentence. The
 * backend sends only deterministic facts, so display text can never carry
 * implementation vocabulary the way free-form `description` prose did — an
 * interpolated reranker enum reached users through exactly that route.
 *
 * Discriminated on `message_key`, and every variant pins `schema_version` to a
 * literal. A future version of a known key therefore fails the union rather
 * than being formatted under version-1 assumptions, which is the same
 * fail-closed rule the interaction contract uses.
 */
export const agentTraceOperationalSummarySchema = z.discriminatedUnion(
  "message_key",
  [
    z.object({
      schema_version: z.literal(1),
      message_key: z.literal("agent_trace.query_planned"),
      parameters: z.object({
        retrieval_route: z.enum([
          "no_retrieval",
          "retrieval_required",
          "retrieval_optional",
          "clarification_required",
        ]),
        document_scope: z.enum([
          "current_conversation",
          "user_documents",
          "group_documents",
          "unknown",
        ]),
      }),
    }),
    z.object({
      schema_version: z.literal(1),
      message_key: z.literal("agent_trace.sources_resolved"),
      parameters: z.object({
        resolved_knowledge_base_count: z.number().int().nonnegative(),
      }),
    }),
    z.object({
      schema_version: z.literal(1),
      message_key: z.literal("agent_trace.candidates_found"),
      parameters: z.object({
        candidate_count: z.number().int().nonnegative(),
        authorized_context_count: z.number().int().nonnegative(),
      }),
    }),
    z.object({
      schema_version: z.literal(1),
      message_key: z.literal("agent_trace.relevance_ordered"),
      parameters: z.object({
        candidate_count: z.number().int().nonnegative(),
      }),
    }),
    z.object({
      schema_version: z.literal(1),
      message_key: z.literal("agent_trace.context_prepared"),
      parameters: z.object({
        injected_count: z.number().int().nonnegative(),
        rejected_count: z.number().int().nonnegative(),
        budget_truncated: z.boolean(),
      }),
    }),
    z.object({
      schema_version: z.literal(1),
      message_key: z.literal("agent_trace.graph_invoked"),
      parameters: z.object({
        retrieved_chunk_count: z.number().int().nonnegative(),
      }),
    }),
    z.object({
      schema_version: z.literal(1),
      message_key: z.literal("agent_trace.answer_prepared"),
      parameters: z.object({
        citation_count: z.number().int().nonnegative(),
      }),
    }),
    z.object({
      schema_version: z.literal(1),
      message_key: z.literal("agent_trace.clarification_requested"),
      parameters: z.object({}),
    }),
  ],
);

export const agentTraceStepSchema = z.object({
  id: z.string().min(1),
  event_type: z.string().min(1),
  status: z.enum(["completed", "skipped", "waiting", "failed"]),
  title: agentTraceTextSchema,
  description: agentTraceTextSchema,
  evidence: z.record(z.string(), z.unknown()).default({}),
  /*
   * `.catch(null)`, so an unknown key or a future version costs the summary and
   * nothing else. The step is the verified record and the answer rides on the
   * same response; neither may be lost because a caption could not be parsed.
   *
   * Normalised to a single absent value, unlike `consulted_sources` where
   * `null` and `[]` carry different meanings. Here "the field was omitted" and
   * "the summary did not parse" are the same fact — there is no summary — so
   * leaving both `undefined` and `null` reachable would only invite callers to
   * test for one and miss the other.
   */
  operational_summary: agentTraceOperationalSummarySchema
    .nullish()
    .catch(null)
    .transform((value) => value ?? null),
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

/**
 * Model-authored approach explanations, read from the live backend OpenAPI
 * document (`ReasoningSummaryItem`) on 2026-09-02.
 *
 * A separate trust channel from `agent_trace`: the trace is the verified
 * execution record, this is what the model *says* it did. The two are never
 * merged, and this one is display metadata that the product can do without.
 *
 * That last point sets the parsing policy. The served contract bounds `text` at
 * 500 characters, but this schema deliberately does **not** mirror the upper
 * bound. `reasoning_summaries` rides on the completed-run response, so a single
 * over-long item would fail the whole parse and lose the answer itself over a
 * field the reader could have done without. Bound it for display instead — see
 * `REASONING_SUMMARY_MAX_LENGTH`.
 */
export const reasoningSummaryStageSchema = z.enum([
  "retrieval_planning",
  "answer_synthesis",
]);

export const reasoningSummarySourceSchema = z.enum([
  "model_generated",
  "provider_reasoning_summary",
]);

/** The served bound, applied when rendering rather than when parsing. */
export const REASONING_SUMMARY_MAX_LENGTH = 500;

export const reasoningSummarySchema = z.object({
  stage: reasoningSummaryStageSchema,
  text: z.string().min(1),
  source: reasoningSummarySourceSchema,
});

/**
 * Published as an OpenAPI extension rather than a response body: the run,
 * resume, and replay stream operations each carry
 * `responses.200.content["text/event-stream"]["x-sse-events"]
 * ["reasoning_summary_delta"]`, and all three inline the same schema. Read from
 * the live document on 2026-09-02 — this shape is no longer inferred.
 *
 * Matched to that contract exactly: all three fields required, `delta` nonblank,
 * `sequence` a positive integer. Tightening is safe here only because
 * `parseConversationRunStreamEvent` degrades a failure to a null payload
 * instead of throwing — a rejected delta costs one caption, never the answer.
 *
 * Deliberately not `.strict()` despite `additionalProperties: false` upstream.
 * Rejecting an added field would turn a backward-compatible extension into a
 * dropped summary, and we are permissive about what we accept.
 *
 * There is intentionally no upper bound on a single delta. The completed item
 * owns the 500-character bound; see `REASONING_SUMMARY_MAX_LENGTH`.
 */
export const reasoningSummaryDeltaEventDataSchema = z.object({
  stage: reasoningSummaryStageSchema,
  delta: z.string().min(1),
  sequence: z.number().int().min(1),
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
    /*
     * `.catch([])`, not just `.default([])`. The field is optional in the
     * contract, so absence already resolves to an empty list; the catch covers
     * the other direction, where a future or malformed item would otherwise
     * take the entire answer down with it. Losing an explanation is a
     * cosmetic regression, losing the reply is not.
     */
    reasoning_summaries: z.array(reasoningSummarySchema).catch([]),
    /**
     * The temporary files this run read, and the files it produced.
     *
     * `.catch([])` matches the sibling display metadata above: an attachment
     * shape this build cannot parse must degrade to showing no files rather
     * than failing the whole run response and losing the answer with it.
     */
    attachments: z.array(conversationAttachmentSchema).catch([]),
    artifacts: z.array(conversationArtifactSchema).catch([]),
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
export type AgentTraceOperationalSummary = z.infer<
  typeof agentTraceOperationalSummarySchema
>;
export type DocumentCoverage = z.infer<typeof documentCoverageSchema>;
export type ReasoningSummary = z.infer<typeof reasoningSummarySchema>;
export type ReasoningSummaryStage = z.infer<typeof reasoningSummaryStageSchema>;
/**
 * What the panel actually renders.
 *
 * Narrower than the wire type on purpose. `source` names the producer the
 * backend used, and a half-streamed summary has no honest value for it — the
 * delta event does not carry one. Rendering from a type that omits the field
 * removes the temptation to infer it from `stage`, which would silently
 * misreport provenance the moment the backend moved a stage to another
 * producer. A settled `ReasoningSummary` is assignable to this.
 */
export type ReasoningSummaryDisplay = {
  stage: ReasoningSummaryStage;
  text: string;
};
export type ReasoningSummaryDeltaEventData = z.infer<
  typeof reasoningSummaryDeltaEventDataSchema
>;
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

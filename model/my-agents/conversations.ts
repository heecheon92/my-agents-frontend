import { z } from "zod";
import { routeDecisionSchema } from "./common";
import { citationSchema } from "./knowledge";

export const conversationSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  owner_user_id: z.string().min(1),
  group_id: z.string().nullable(),
});

export const conversationCreateRequestSchema = z.object({
  title: z.string().min(1).max(200),
  group_id: z.string().nullable().optional(),
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

export const conversationRunRequestSchema = z.object({
  message: z.string().min(1),
});

export const conversationRunResponseSchema = z.object({
  run_id: z.string().min(1),
  conversation_id: z.string().min(1),
  reply: z.string(),
  route: routeDecisionSchema,
  handled_by: z.literal("personal_assistant_graph"),
  citations: z.array(citationSchema).default([]),
});

export const runStartedEventDataSchema = z.object({
  run_id: z.string().min(1),
  conversation_id: z.string().min(1),
  status: z.string(),
});

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

export const agentRunSummarySchema = z.object({
  run_id: z.string().min(1),
  conversation_id: z.string().min(1),
  status: z.string(),
  route_label: z.string().nullable(),
  created_at: z.string(),
});

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
export type ConversationRunRequest = z.infer<
  typeof conversationRunRequestSchema
>;
export type ConversationRunResponse = z.infer<
  typeof conversationRunResponseSchema
>;
export type RunStartedEventData = z.infer<typeof runStartedEventDataSchema>;
export type AnswerDeltaEventData = z.infer<typeof answerDeltaEventDataSchema>;
export type RunCancelledEventData = z.infer<typeof runCancelledEventDataSchema>;
export type RunCancelResponse = z.infer<typeof runCancelResponseSchema>;
export type AgentRunSummary = z.infer<typeof agentRunSummarySchema>;
export type AgentEvent = z.infer<typeof agentEventSchema>;

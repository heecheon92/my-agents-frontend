import { z } from "zod";
import {
  conversationRunResponseSchema,
  reasoningSummaryStageSchema,
} from "./conversations";
import { pendingInteractionSchema } from "./interactions";

/**
 * Durable, server-owned answer generation.
 *
 * Checked against the backend's served OpenAPI on 2026-10-17 (local
 * development server, `DurableAdmission`, `DurableOutput`, `DurableActivity`,
 * `DurableError`, and the listener's `x-sse-events` `DurableFailure` and
 * `DurableCancellation`). The contract itself is frozen in
 * `docs/backend-requests.md`. Refetch the document and diff these schemas
 * before a hosted release; the served document, not this file, is the source
 * of truth. Nothing outside this module should hand-write a durable-run shape.
 *
 * New answers and regenerations reach these schemas only when health reports
 * `durable_runs.enabled: true`; otherwise they use the legacy routes. An
 * existing durable run reaches them through its `execution_mode` whatever the
 * flag says, so they must stay correct with the flag off too.
 */

/** `202` receipt from `runs/async`, `resume/async`, and `replay/async`. */
export const runAdmissionReceiptSchema = z.object({
  run_id: z.string().min(1),
  conversation_id: z.string().min(1),
  /** The run's CURRENT status: a repeated admission may report a finished run. */
  status: z.string(),
  client_request_id: z.string().min(1),
});

/** Safe failure on a snapshot: a stable code plus allowlisted detail. */
export const durableRunErrorSchema = z.object({
  code: z.string().min(1),
  detail: z.string(),
});

/**
 * A replayable activity frame. `id` is the delivery cursor, the same counter as
 * the SSE `id` line, never the audit event's own sequence.
 */
export const durableActivityEnvelopeSchema = z.object({
  id: z.number().int().min(1),
  event: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
});

/**
 * A summary as it stands mid-run. Lenient on purpose: summaries are display
 * metadata, so an unexpected item costs that item, never the snapshot.
 */
const partialReasoningSummariesSchema = z
  .array(
    z
      .object({ stage: reasoningSummaryStageSchema, text: z.string() })
      .passthrough()
      .nullable()
      .catch(null),
  )
  .catch([])
  .transform((items) =>
    items.flatMap((item) =>
      item ? [{ stage: item.stage, text: item.text }] : [],
    ),
  );

/**
 * `GET /conversations/{cid}/runs/{rid}/output`: one consistent read of a run.
 *
 * The snapshot replaces client state; a subscription then appends only frames
 * whose delivery id is greater than `cursor`.
 */
export const runOutputSnapshotSchema = z.object({
  // Served with a default, so it may be omitted; a different value is a
  // contract this build does not know and is rejected.
  schema_version: z.literal(1).default(1),
  run_id: z.string().min(1),
  conversation_id: z.string().min(1),
  client_request_id: z.string().nullable(),
  status: z.string(),
  cursor: z.number().int().min(0),
  /** Committed answer text for the same logical run, across every phase. */
  partial_reply: z.string().default(""),
  reasoning_summaries: partialReasoningSummariesSchema,
  activity_events: z.array(durableActivityEnvelopeSchema).default([]),
  /** The open interaction union: an unknown type still renders a cancel card. */
  interaction: pendingInteractionSchema.nullable().default(null),
  /** The canonical completion. When present it wins over `partial_reply`. */
  result: conversationRunResponseSchema.nullable().default(null),
  error: durableRunErrorSchema.nullable().default(null),
});

/**
 * The durable listener's own `run_failed` payload. A new route-specific shape,
 * not extra fields on the legacy stream or audit payloads.
 */
export const durableRunFailedEventDataSchema = z.object({
  run_id: z.string().min(1),
  conversation_id: z.string().min(1),
  status: z.literal("failed").default("failed"),
  code: z.string().min(1),
  detail: z.string(),
});

/** The durable listener's `run_cancelled`. Nothing was written as an answer. */
export const durableRunCancelledEventDataSchema = z.object({
  run_id: z.string().min(1),
  conversation_id: z.string().min(1),
  status: z.literal("cancelled").default("cancelled"),
  partial_reply_persisted: z.literal(false).default(false),
});

/** Stable codes this client names explicitly. Others still get safe copy. */
export const DURABLE_RUN_ERROR_CODES = {
  workerLost: "worker_lost",
  requestIdConflict: "run_request_id_conflict",
  cursorExpired: "run_output_cursor_expired",
  invalidCursor: "invalid_stream_cursor",
  /** The deployment cannot run durable work right now. */
  unavailable: "durable_runs_unavailable",
  /** Client-side: reconnecting gave up. The run may still be going. */
  streamLost: "durable_stream_lost",
} as const;

export type RunAdmissionReceipt = z.infer<typeof runAdmissionReceiptSchema>;
export type DurableRunError = z.infer<typeof durableRunErrorSchema>;
export type DurableActivityEnvelope = z.infer<
  typeof durableActivityEnvelopeSchema
>;
export type RunOutputSnapshot = z.infer<typeof runOutputSnapshotSchema>;
export type DurableRunFailedEventData = z.infer<
  typeof durableRunFailedEventDataSchema
>;
export type DurableRunCancelledEventData = z.infer<
  typeof durableRunCancelledEventDataSchema
>;

/**
 * The chat run lifecycle, as one derived value.
 *
 * Run state used to be an ad-hoc combination of booleans read at several call
 * sites: `isStreaming` for the stop button, `isStreaming || serverActiveRun`
 * for "is the composer busy", and the disappearance of the server's active run
 * for "may the queue drain". That worked while a run was either in flight or
 * finished. It breaks once a run can *suspend* — stop mid-answer to ask the
 * user something and sit there until answered, cancelled, or expired — because
 * a suspended run is neither, and each of those three decisions wants a
 * different answer about it.
 *
 * So the phase is derived once, here, from state the workspace already holds,
 * and the three decisions are named functions over it. This is deliberately
 * *not* a second source of truth: there is no reducer and no stored phase.
 * Streaming, the pending interaction, and the server's run list remain the only
 * state; this module just stops each consumer from re-deriving the combination
 * and getting it subtly different.
 */

export type RunPhase =
  /** Nothing outstanding. The composer is free. */
  | "idle"
  /** An answer is being written. */
  | "streaming"
  /** Suspended on a question. Holds the conversation, produces nothing. */
  | "waiting"
  /** A question was answered and the continuation is in flight. */
  | "resuming";

export function deriveRunPhase({
  isStreaming,
  hasPendingInteraction,
  hasServerActiveRun,
  hasServerWaitingRun,
}: {
  isStreaming: boolean;
  hasPendingInteraction: boolean;
  hasServerActiveRun: boolean;
  hasServerWaitingRun: boolean;
}): RunPhase {
  // A mounted pending question wins over a live stream during refinement: the
  // card remains the action surface and the phase is `resuming`.
  if (hasPendingInteraction) {
    return isStreaming ? "resuming" : "waiting";
  }
  // A final selection clears the card before the server's waiting row has
  // refetched. That local stream is producing an answer, not still waiting.
  if (hasServerWaitingRun) return isStreaming ? "streaming" : "waiting";
  if (isStreaming || hasServerActiveRun) return "streaming";
  return "idle";
}

/**
 * Whether the composer must refuse to start a new run.
 *
 * `waiting` counts. The backend rejects a new run in a conversation holding an
 * unanswered interaction with the *existing* `conversation_run_already_active`
 * 409 — there is no distinct code — so the client cannot tell "busy" from
 * "waiting" by error alone and has to know from state.
 */
export function blocksNewRun(phase: RunPhase) {
  return phase !== "idle";
}

/**
 * Whether to offer the stop control.
 *
 * Deliberately *not* the same set as `blocksNewRun`. A suspended run produces
 * nothing, so a stop button there would offer to interrupt an answer that is
 * not being written. Releasing a waiting run is still possible — it is the
 * cancel affordance on the interaction card, not a stop on the composer.
 */
export function showsStopControl(phase: RunPhase) {
  return phase === "streaming";
}

/**
 * Whether a queued message may be sent now.
 *
 * The queue must *pause* rather than drain while a question is open. The
 * existing drain fires when the server's active run disappears, and a run
 * moving to `waiting_for_input` looks exactly like completion to a predicate
 * that only knows `running` and `cancelling` — so without this the queued
 * message is sent into a conversation that will refuse it.
 */
export function canDrainQueue(phase: RunPhase) {
  return phase === "idle";
}

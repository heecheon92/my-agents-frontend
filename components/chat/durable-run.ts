import {
  type ConversationRunResponse,
  DURABLE_RUN_ERROR_CODES,
  type RunAdmissionReceipt,
  type RunOutputSnapshot,
} from "@/model/my-agents";
import {
  isMyAgentsAPIError,
  MyAgentsAPIError,
} from "@/services/my-agents/MyAgentsAPIError";
import type { DurableRunStreamEvent } from "@/services/my-agents/MyAgentsConversationAPI";

/**
 * Following a durable run: the server owns the answer, this viewer only reads.
 *
 * The rules come from the frozen contract in `docs/backend-requests.md`:
 *
 * - A snapshot *replaces* client state; the stream then *appends* only frames
 *   whose delivery id is greater than the cursor.
 * - A stream that closes without a terminal or phase-ending event means
 *   "reconnect from the last id". That is the normal path, not an error:
 *   hosting limits will cut long streams.
 * - A terminal or phase-ending event ends the subscription even when its id is
 *   at or below the cursor. The server may repeat one as an idempotent close
 *   signal, and dropping it as a duplicate would turn that into a reconnect
 *   loop.
 * - `410` means the cursor's frames were pruned: refetch the snapshot and
 *   continue from its cursor. Any other 4xx is a definite refusal.
 * - Aborting detaches this viewer. It never cancels the run.
 */

/** Events after which this subscription ends. The run may not have. */
const PHASE_ENDING_EVENTS = new Set([
  "run_completed",
  "run_failed",
  "run_cancelled",
  "run_interrupted",
]);

/** Snapshot statuses with no further output to follow. */
const SETTLED_STATUSES = new Set([
  "completed",
  "failed",
  "cancelled",
  "waiting_for_input",
]);

export function isPhaseEndingEvent(event: string) {
  return PHASE_ENDING_EVENTS.has(event);
}

export function isSettledRunStatus(status: string) {
  return SETTLED_STATUSES.has(status);
}

/**
 * What a follower hands its consumer.
 *
 * `snapshot` replaces the view; `event` appends to it; `reconnecting` is only
 * an announcement, emitted before a wait so a screen reader hears it once.
 */
export type DurableFollowFrame =
  | { kind: "snapshot"; snapshot: RunOutputSnapshot }
  | { kind: "event"; event: DurableRunStreamEvent }
  | { kind: "reconnecting" };

export type DurableRunPort = {
  runOutput: (
    conversationId: string,
    runId: string,
  ) => Promise<RunOutputSnapshot>;
  subscribeRunEvents: (
    conversationId: string,
    runId: string,
    options: { after: number; signal?: AbortSignal },
  ) => AsyncIterable<DurableRunStreamEvent>;
};

/** Consecutive reconnects without a new frame before giving up. */
export const DURABLE_MAX_IDLE_RECONNECTS = 6;

/** Waits between reconnects without progress: short first, then capped. */
export function reconnectDelayMs(idleReconnects: number) {
  return Math.min(250 * 2 ** Math.max(0, idleReconnects - 1), 4000);
}

export function abortableSleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(abortError());
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function abortError() {
  return new DOMException(
    "The durable subscription was detached.",
    "AbortError",
  );
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

/** A refusal that a retry cannot change: any 4xx except timeouts and limits. */
function isDefiniteRefusal(error: unknown) {
  if (!isMyAgentsAPIError(error)) return false;
  // No worker is ready. A 503, but a definite answer rather than a transient
  // fault: retrying at once only delays the copy that says so.
  if (errorCode(error) === DURABLE_RUN_ERROR_CODES.unavailable) return true;
  return (
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 408 &&
    error.status !== 429
  );
}

function errorCode(error: MyAgentsAPIError) {
  const body = error.body;
  if (!body || typeof body !== "object") return undefined;
  const code = (body as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function isCursorExpired(error: unknown) {
  return isMyAgentsAPIError(error) && error.status === 410;
}

/** Thrown when reconnecting gives up. The run itself may still be going. */
export function durableStreamLostError() {
  return new MyAgentsAPIError({
    message: "durable stream lost",
    status: 0,
    body: { code: DURABLE_RUN_ERROR_CODES.streamLost },
  });
}

/**
 * Follows a run from `startCursor` until its current phase ends.
 *
 * With `snapshotFirst`, the view is replaced from `/output` before listening:
 * that is how a reload, a second tab, or a resume with no known cursor joins a
 * run that already produced output. A settled snapshot ends the follow there,
 * with no subscription at all.
 *
 * Returns the last cursor seen, so a later phase of the same run (a resume)
 * continues from it rather than replaying text already on screen.
 */
export async function* followDurableRun({
  api,
  conversationId,
  runId,
  startCursor = 0,
  snapshotFirst = false,
  signal,
  sleep = abortableSleep,
  onCursor,
}: {
  api: DurableRunPort;
  conversationId: string;
  runId: string;
  startCursor?: number;
  snapshotFirst?: boolean;
  signal?: AbortSignal;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Called whenever the cursor advances, so a resume can pick it up. */
  onCursor?: (cursor: number) => void;
}): AsyncGenerator<DurableFollowFrame, number> {
  let cursor = startCursor;
  const advance = (next: number) => {
    if (next <= cursor) return;
    cursor = next;
    onCursor?.(cursor);
  };

  if (snapshotFirst) {
    const snapshot = await api.runOutput(conversationId, runId);
    yield { kind: "snapshot", snapshot };
    cursor = snapshot.cursor;
    onCursor?.(cursor);
    if (isSettledRunStatus(snapshot.status)) return cursor;
  }

  let idleReconnects = 0;
  while (true) {
    if (signal?.aborted) throw abortError();
    let progressed = false;
    try {
      for await (const event of api.subscribeRunEvents(conversationId, runId, {
        after: cursor,
        signal,
      })) {
        const phaseEnding = isPhaseEndingEvent(event.event);
        const { deliveryId } = event;
        // A frame the view already holds. Terminal and control frames are the
        // exception: they still end the subscription, see the module comment.
        if (deliveryId !== null && deliveryId <= cursor && !phaseEnding) {
          continue;
        }
        if (deliveryId !== null && deliveryId > cursor) {
          advance(deliveryId);
          progressed = true;
        }
        yield { kind: "event", event };
        if (phaseEnding) return cursor;
      }
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) throw error;
      if (isCursorExpired(error)) {
        const snapshot = await api.runOutput(conversationId, runId);
        yield { kind: "snapshot", snapshot };
        cursor = snapshot.cursor;
        onCursor?.(cursor);
        if (isSettledRunStatus(snapshot.status)) return cursor;
        idleReconnects = 0;
        continue;
      }
      if (isDefiniteRefusal(error)) throw error;
      // Only transport failures are worth a reconnect: an HTTP error, or the
      // `TypeError` fetch raises for a dropped connection. Anything else is a
      // frame that broke the contract (a terminal payload that does not
      // parse), and reconnecting would only replay the same frame until the
      // give-up limit.
      if (!isMyAgentsAPIError(error) && !(error instanceof TypeError)) {
        throw error;
      }
      // A dropped connection or a server error: fall through and reconnect.
    }
    idleReconnects = progressed ? 0 : idleReconnects + 1;
    if (idleReconnects > DURABLE_MAX_IDLE_RECONNECTS) {
      throw durableStreamLostError();
    }
    yield { kind: "reconnecting" };
    await sleep(reconnectDelayMs(Math.max(idleReconnects, 1)), signal);
  }
}

/**
 * Admits durable work, retrying only where a retry cannot double it.
 *
 * Admission is idempotent on `client_request_id`, so a dropped connection or a
 * server error is retried with the same key: the backend returns the original
 * run instead of creating a second one. A 4xx is a definite answer and is
 * thrown at once — including `conversation_run_already_active`, which the
 * caller turns into a queued message.
 */
export async function admitWithRetry(
  admit: () => Promise<RunAdmissionReceipt>,
  {
    attempts = 3,
    signal,
    sleep = abortableSleep,
  }: {
    attempts?: number;
    signal?: AbortSignal;
    sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  } = {},
): Promise<RunAdmissionReceipt> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await admit();
    } catch (error) {
      if (isAbortError(error) || isDefiniteRefusal(error)) throw error;
      lastError = error;
      if (attempt < attempts) await sleep(reconnectDelayMs(attempt), signal);
    }
  }
  throw lastError;
}

/**
 * The error a durable `run_failed` stands for: its stable code, so the shared
 * copy table can name it. The served `detail` stays in the body for logs and is
 * never rendered — `resolveErrorMessage` reads only the code.
 *
 * Status 500, not 0: the run was admitted and the server reported the failure,
 * so this is neither a dropped connection nor an ambiguous admission, and a
 * code the copy table does not know falls back to server-failure copy rather
 * than network copy.
 */
export function durableRunFailedError(
  data: { code: string; detail: string } | null,
) {
  return new MyAgentsAPIError({
    message: "durable run failed",
    status: 500,
    body: data
      ? { code: data.code, detail: data.detail }
      : { code: "conversation_run_failed" },
  });
}

/**
 * Admits durable work and follows it to its end without showing progress.
 *
 * For regeneration, whose UI reports only the finished result, exactly as the
 * synchronous route did. The difference is durability: the work is
 * server-owned, so leaving the page does not lose it, and a reload finds it
 * through the run list.
 *
 * Resolves with the completed response, or `null` when the run stopped to ask
 * the user something: the waiting run is then recovered from the run list like
 * any other. A failure or a stop rejects with a coded error.
 */
export async function awaitDurableCompletion({
  api,
  admit,
  conversationId,
  signal,
}: {
  api: DurableRunPort;
  admit: () => Promise<RunAdmissionReceipt>;
  conversationId: string;
  signal?: AbortSignal;
}): Promise<ConversationRunResponse | null> {
  const receipt = await admitWithRetry(admit, { signal });
  for await (const frame of followDurableRun({
    api,
    conversationId,
    runId: receipt.run_id,
    signal,
  })) {
    if (frame.kind === "snapshot") {
      const { snapshot } = frame;
      if (snapshot.result) return snapshot.result;
      if (snapshot.status === "waiting_for_input") return null;
      if (snapshot.status === "failed") {
        throw durableRunFailedError(snapshot.error);
      }
      if (snapshot.status === "cancelled") throw durableRunStoppedError();
      continue;
    }
    if (frame.kind !== "event") continue;
    const { event } = frame;
    if (event.event === "run_completed") {
      return event.data as ConversationRunResponse;
    }
    if (event.event === "run_interrupted") return null;
    if (event.event === "run_failed") {
      throw durableRunFailedError(
        event.data as { code: string; detail: string } | null,
      );
    }
    if (event.event === "run_cancelled") throw durableRunStoppedError();
  }
  throw durableStreamLostError();
}

/** A durable run stopped by an explicit cancel, possibly from another tab. */
export function durableRunStoppedError() {
  return new MyAgentsAPIError({
    message: "durable run stopped",
    status: 500,
    body: { code: "run_cancelled" },
  });
}

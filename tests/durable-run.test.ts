import { describe, expect, it, vi } from "vitest";
import {
  admitWithRetry,
  awaitDurableCompletion,
  DURABLE_MAX_IDLE_RECONNECTS,
  type DurableFollowFrame,
  type DurableRunPort,
  followDurableRun,
  isAbortError,
} from "@/components/chat/durable-run";
import type { RunOutputSnapshot } from "@/model/my-agents";
import { MyAgentsAPIError } from "@/services/my-agents/MyAgentsAPIError";
import type { DurableRunStreamEvent } from "@/services/my-agents/MyAgentsConversationAPI";
import { errorCodeOf } from "@/utils/error-message";

const CONVERSATION = "c-1";
const RUN = "r-1";

function delta(id: number | null, text: string): DurableRunStreamEvent {
  return {
    deliveryId: id,
    event: "answer_delta",
    data: { delta: text, sequence: id ?? 1 },
  };
}

function completed(id: number, reply = "done"): DurableRunStreamEvent {
  return {
    deliveryId: id,
    event: "run_completed",
    data: {
      run_id: RUN,
      conversation_id: CONVERSATION,
      reply,
    } as never,
  };
}

function snapshot(
  overrides: Partial<RunOutputSnapshot> = {},
): RunOutputSnapshot {
  return {
    schema_version: 1,
    run_id: RUN,
    conversation_id: CONVERSATION,
    client_request_id: "req-1",
    status: "running",
    cursor: 0,
    partial_reply: "",
    reasoning_summaries: [],
    activity_events: [],
    interaction: null,
    result: null,
    error: null,
    ...overrides,
  };
}

function apiError(status: number, code?: string) {
  return new MyAgentsAPIError({
    message: "refused",
    status,
    body: code ? { code, detail: "x" } : undefined,
  });
}

/**
 * A fake listener. Each call to `subscribeRunEvents` consumes the next script:
 * a list of frames that ends normally (the server closed the stream), or an
 * error thrown before any frame.
 */
function fakePort(
  scripts: Array<DurableRunStreamEvent[] | Error>,
  snapshots: RunOutputSnapshot[] = [],
) {
  const afters: number[] = [];
  const port: DurableRunPort = {
    runOutput: vi.fn(async () => {
      const next = snapshots.shift();
      if (!next) throw new Error("no snapshot scripted");
      return next;
    }),
    subscribeRunEvents: (_conversationId, _runId, { after }) => {
      afters.push(after);
      const script = scripts.shift();
      return (async function* () {
        if (!script) throw new Error("no subscription scripted");
        if (script instanceof Error) throw script;
        for (const frame of script) yield frame;
      })();
    },
  };
  return { port, afters };
}

const noSleep = () => Promise.resolve();

async function collect(generator: AsyncGenerator<DurableFollowFrame, number>) {
  const frames: DurableFollowFrame[] = [];
  let result: IteratorResult<DurableFollowFrame, number>;
  do {
    result = await generator.next();
    if (!result.done) frames.push(result.value);
  } while (!result.done);
  return { frames, cursor: result.value };
}

function deltas(frames: DurableFollowFrame[]) {
  return frames.flatMap((frame) =>
    frame.kind === "event" && frame.event.event === "answer_delta"
      ? [(frame.event.data as { delta: string }).delta]
      : [],
  );
}

describe("following a durable run", () => {
  it("reconnects from the last delivery id when a stream closes early", async () => {
    // Hosting limits cut long streams. That is the normal path, so the
    // follower picks up after the last frame it applied, not from zero.
    const { port, afters } = fakePort([
      [delta(1, "Hel"), delta(2, "lo")],
      [delta(3, " world"), completed(4)],
    ]);
    const { frames, cursor } = await collect(
      followDurableRun({
        api: port,
        conversationId: CONVERSATION,
        runId: RUN,
        sleep: noSleep,
      }),
    );
    expect(afters).toEqual([0, 2]);
    expect(deltas(frames)).toEqual(["Hel", "lo", " world"]);
    expect(
      frames.filter((frame) => frame.kind === "reconnecting"),
    ).toHaveLength(1);
    expect(cursor).toBe(4);
  });

  it("drops frames the view already holds, so no text is doubled", async () => {
    const { port } = fakePort([
      [delta(1, "a"), delta(2, "b")],
      // A server replaying an overlap after the reconnect.
      [delta(2, "b"), delta(3, "c"), completed(4)],
    ]);
    const { frames } = await collect(
      followDurableRun({
        api: port,
        conversationId: CONVERSATION,
        runId: RUN,
        sleep: noSleep,
      }),
    );
    expect(deltas(frames).join("")).toBe("abc");
  });

  it("honours a repeated terminal event at or below the cursor as the close", async () => {
    // The server may repeat an acknowledged terminal as an idempotent close.
    // Dropping it as a duplicate would reconnect forever.
    const { port, afters } = fakePort([[completed(5)]]);
    const { frames } = await collect(
      followDurableRun({
        api: port,
        conversationId: CONVERSATION,
        runId: RUN,
        startCursor: 5,
        sleep: noSleep,
      }),
    );
    expect(afters).toEqual([5]);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({
      kind: "event",
      event: { event: "run_completed" },
    });
  });

  it("ends the phase on run_interrupted without reconnecting", async () => {
    const { port, afters } = fakePort([
      [
        delta(1, "Which file?"),
        {
          deliveryId: 2,
          event: "run_interrupted",
          data: {
            status: "waiting_for_input",
            run_id: RUN,
            conversation_id: CONVERSATION,
            interaction: {} as never,
          },
        },
      ],
    ]);
    await collect(
      followDurableRun({
        api: port,
        conversationId: CONVERSATION,
        runId: RUN,
        sleep: noSleep,
      }),
    );
    expect(afters).toEqual([0]);
  });

  it("refetches the snapshot when the cursor has expired", async () => {
    const { port, afters } = fakePort(
      [
        apiError(410, "run_output_cursor_expired"),
        [delta(9, "!"), completed(10)],
      ],
      [snapshot({ cursor: 8, partial_reply: "pruned frames" })],
    );
    const { frames } = await collect(
      followDurableRun({
        api: port,
        conversationId: CONVERSATION,
        runId: RUN,
        startCursor: 3,
        sleep: noSleep,
      }),
    );
    expect(afters).toEqual([3, 8]);
    expect(frames[0]).toMatchObject({
      kind: "snapshot",
      snapshot: { partial_reply: "pruned frames" },
    });
  });

  it("stops at a settled snapshot instead of subscribing", async () => {
    const { port, afters } = fakePort(
      [],
      [snapshot({ status: "completed", cursor: 12 })],
    );
    const { frames, cursor } = await collect(
      followDurableRun({
        api: port,
        conversationId: CONVERSATION,
        runId: RUN,
        snapshotFirst: true,
        sleep: noSleep,
      }),
    );
    expect(afters).toEqual([]);
    expect(frames).toHaveLength(1);
    expect(cursor).toBe(12);
  });

  it("joins a running run at its snapshot cursor", async () => {
    const { port, afters } = fakePort(
      [[delta(7, " more"), completed(8)]],
      [snapshot({ cursor: 6, partial_reply: "so far" })],
    );
    await collect(
      followDurableRun({
        api: port,
        conversationId: CONVERSATION,
        runId: RUN,
        snapshotFirst: true,
        sleep: noSleep,
      }),
    );
    expect(afters).toEqual([6]);
  });

  it("does not retry a definite refusal", async () => {
    const { port, afters } = fakePort([apiError(400, "invalid_stream_cursor")]);
    await expect(
      collect(
        followDurableRun({
          api: port,
          conversationId: CONVERSATION,
          runId: RUN,
          sleep: noSleep,
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(afters).toEqual([0]);
  });

  it("fails at once on a frame that breaks the contract", async () => {
    // Reconnecting would replay the same malformed frame until the give-up
    // limit; a parse failure is not a transport failure.
    const { port, afters } = fakePort([new SyntaxError("bad terminal frame")]);
    await expect(
      collect(
        followDurableRun({
          api: port,
          conversationId: CONVERSATION,
          runId: RUN,
          sleep: noSleep,
        }),
      ),
    ).rejects.toBeInstanceOf(SyntaxError);
    expect(afters).toEqual([0]);
  });

  it("gives up after repeated reconnects that deliver nothing", async () => {
    const scripts = Array.from(
      { length: DURABLE_MAX_IDLE_RECONNECTS + 2 },
      () => new TypeError("Failed to fetch"),
    );
    const { port, afters } = fakePort(scripts);
    const error = await collect(
      followDurableRun({
        api: port,
        conversationId: CONVERSATION,
        runId: RUN,
        sleep: noSleep,
      }),
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MyAgentsAPIError);
    expect(errorCodeOf(error as MyAgentsAPIError)).toBe("durable_stream_lost");
    expect(afters).toHaveLength(DURABLE_MAX_IDLE_RECONNECTS + 1);
  });

  it("keeps reconnecting while each attempt makes progress", async () => {
    const scripts: DurableRunStreamEvent[][] = Array.from(
      { length: DURABLE_MAX_IDLE_RECONNECTS + 3 },
      (_, index) => [delta(index + 1, "x")],
    );
    scripts.push([completed(100)]);
    const { port } = fakePort(scripts);
    const { frames } = await collect(
      followDurableRun({
        api: port,
        conversationId: CONVERSATION,
        runId: RUN,
        sleep: noSleep,
      }),
    );
    expect(deltas(frames)).toHaveLength(DURABLE_MAX_IDLE_RECONNECTS + 3);
  });

  it("detaches on abort without subscribing again", async () => {
    const controller = new AbortController();
    const { port, afters } = fakePort([[delta(1, "a")], [completed(2)]]);
    const follow = followDurableRun({
      api: port,
      conversationId: CONVERSATION,
      runId: RUN,
      signal: controller.signal,
      sleep: noSleep,
    });
    await follow.next();
    controller.abort();
    const error = await collect(follow).catch((caught: unknown) => caught);
    expect(isAbortError(error)).toBe(true);
    expect(afters).toEqual([0]);
  });

  it("reports cursor progress so a resume can continue from it", async () => {
    const seen: number[] = [];
    const { port } = fakePort([[delta(1, "a"), delta(2, "b"), completed(3)]]);
    await collect(
      followDurableRun({
        api: port,
        conversationId: CONVERSATION,
        runId: RUN,
        sleep: noSleep,
        onCursor: (cursor) => seen.push(cursor),
      }),
    );
    expect(seen).toEqual([1, 2, 3]);
  });
});

describe("durable admission", () => {
  it("retries a dropped connection with the same request", async () => {
    // Admission is idempotent on client_request_id, so a retry returns the
    // original run instead of starting a second one.
    const receipt = {
      run_id: RUN,
      conversation_id: CONVERSATION,
      status: "queued",
      client_request_id: "req-1",
    };
    const admit = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(receipt);
    await expect(admitWithRetry(admit, { sleep: noSleep })).resolves.toEqual(
      receipt,
    );
    expect(admit).toHaveBeenCalledTimes(2);
  });

  it("does not retry a busy conversation", async () => {
    const admit = vi
      .fn()
      .mockRejectedValue(apiError(409, "conversation_run_already_active"));
    await expect(
      admitWithRetry(admit, { sleep: noSleep }),
    ).rejects.toMatchObject({ status: 409 });
    expect(admit).toHaveBeenCalledTimes(1);
  });

  it("does not retry when no worker is ready", async () => {
    // A definite answer, not a transient fault: never retried, and never
    // replaced by the legacy stream.
    const admit = vi
      .fn()
      .mockRejectedValue(apiError(503, "durable_runs_unavailable"));
    await expect(
      admitWithRetry(admit, { sleep: noSleep }),
    ).rejects.toMatchObject({ status: 503 });
    expect(admit).toHaveBeenCalledTimes(1);
  });

  it("gives up after the configured attempts", async () => {
    const admit = vi.fn().mockRejectedValue(apiError(503));
    await expect(
      admitWithRetry(admit, { sleep: noSleep, attempts: 3 }),
    ).rejects.toMatchObject({ status: 503 });
    expect(admit).toHaveBeenCalledTimes(3);
  });
});

describe("durable regeneration", () => {
  const receipt = {
    run_id: RUN,
    conversation_id: CONVERSATION,
    status: "queued",
    client_request_id: "req-1",
  };

  it("resolves with the completed response", async () => {
    const { port } = fakePort([[delta(1, "new"), completed(2, "new answer")]]);
    await expect(
      awaitDurableCompletion({
        api: port,
        conversationId: CONVERSATION,
        admit: async () => receipt,
      }),
    ).resolves.toMatchObject({ reply: "new answer" });
  });

  it("rejects a durable failure with its stable code", async () => {
    const { port } = fakePort([
      [
        {
          deliveryId: 3,
          event: "run_failed",
          data: {
            run_id: RUN,
            conversation_id: CONVERSATION,
            status: "failed",
            code: "worker_lost",
            detail: "safe",
          },
        },
      ],
    ]);
    const error = await awaitDurableCompletion({
      api: port,
      conversationId: CONVERSATION,
      admit: async () => receipt,
    }).catch((caught: unknown) => caught);
    expect(errorCodeOf(error as MyAgentsAPIError)).toBe("worker_lost");
  });

  it("resolves null when the regenerated answer asks a question", async () => {
    const { port } = fakePort([
      [
        {
          deliveryId: 1,
          event: "run_interrupted",
          data: {
            status: "waiting_for_input",
            run_id: RUN,
            conversation_id: CONVERSATION,
            interaction: {} as never,
          },
        },
      ],
    ]);
    await expect(
      awaitDurableCompletion({
        api: port,
        conversationId: CONVERSATION,
        admit: async () => receipt,
      }),
    ).resolves.toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { isStreamPath } from "@/app/api/my-agents/[...path]/route";
import {
  agentRunSummarySchema,
  durableRunCancelledEventDataSchema,
  durableRunFailedEventDataSchema,
  durableRunsEnabledFromHealth,
  healthResponseSchema,
  runOutputSnapshotSchema,
} from "@/model/my-agents";
import {
  forwardedLastEventId,
  forwardedQueryString,
  isAllowedBackendPath,
} from "@/server/my-agents/proxy-policy";
import { parseDeliveryId } from "@/services/my-agents/MyAgentsConversationAPI";
import { streamServerSentEvents } from "@/services/my-agents/sse";

const LISTENER = "/conversations/c-1/runs/r-1/stream";

describe("BFF routing for durable runs", () => {
  it("allows the durable routes with the right methods only", () => {
    expect(
      isAllowedBackendPath("POST", "/conversations/c-1/runs/async").allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath("POST", "/conversations/c-1/runs/r-1/resume/async")
        .allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath(
        "POST",
        "/conversations/c-1/messages/m-1/replay/async",
      ).allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath("GET", "/conversations/c-1/runs/r-1/output").allowed,
    ).toBe(true);
    expect(isAllowedBackendPath("GET", LISTENER).allowed).toBe(true);
    // The listener is read-only; nothing may be posted to it.
    expect(isAllowedBackendPath("POST", LISTENER).allowed).toBe(false);
  });

  it("streams the listener unbuffered, and only the listener", () => {
    expect(isStreamPath(LISTENER)).toBe(true);
    // Receipts are JSON, not streams.
    expect(isStreamPath("/conversations/c-1/runs/async")).toBe(false);
    expect(isStreamPath("/conversations/c-1/runs/r-1/output")).toBe(false);
    // The existing streams are unaffected.
    expect(isStreamPath("/conversations/c-1/runs/stream")).toBe(true);
    expect(isStreamPath("/conversations/c-1/runs/r-1/resume/stream")).toBe(
      true,
    );
  });

  it("forwards only an integer cursor, and only to the listener", () => {
    const params = (query: string) => new URLSearchParams(query);
    expect(forwardedQueryString("GET", LISTENER, params("after=42"))).toBe(
      "?after=42",
    );
    expect(forwardedQueryString("GET", LISTENER, params("after=0"))).toBe(
      "?after=0",
    );
    // Everything else is dropped, including a smuggled parameter.
    expect(
      forwardedQueryString("GET", LISTENER, params("after=42&debug=1")),
    ).toBe("?after=42");
    expect(forwardedQueryString("GET", LISTENER, params("after=-1"))).toBe("");
    expect(forwardedQueryString("GET", LISTENER, params("after=1e3"))).toBe("");
    expect(forwardedQueryString("GET", LISTENER, params("debug=1"))).toBe("");
    // No other route gains query forwarding.
    expect(
      forwardedQueryString(
        "GET",
        "/conversations/c-1/runs/r-1/output",
        params("after=42"),
      ),
    ).toBe("");
    expect(forwardedQueryString("POST", LISTENER, params("after=42"))).toBe("");
  });

  it("forwards Last-Event-ID only to the listener, under the same rule", () => {
    const headers = (value: string) => new Headers({ "last-event-id": value });
    expect(forwardedLastEventId("GET", LISTENER, headers("17"))).toBe("17");
    expect(forwardedLastEventId("GET", LISTENER, headers("abc"))).toBeNull();
    expect(
      forwardedLastEventId(
        "GET",
        "/conversations/c-1/runs/r-1/events",
        headers("17"),
      ),
    ).toBeNull();
  });
});

describe("durable run models", () => {
  it("selects durable routes only when the flag is explicitly on", () => {
    const health = (frontend_config: unknown) =>
      healthResponseSchema.parse({
        status: "ok",
        service: "my-agents",
        version: "0.1.0",
        frontend_config,
      });
    const documents = { upload_concurrency: 3 };
    expect(
      durableRunsEnabledFromHealth(
        health({ documents, durable_runs: { enabled: true, ready: true } }),
      ),
    ).toBe(true);
    // On but no worker: still durable. Admission answers 503; no fallback.
    expect(
      durableRunsEnabledFromHealth(
        health({ documents, durable_runs: { enabled: true, ready: false } }),
      ),
    ).toBe(true);
    expect(
      durableRunsEnabledFromHealth(
        health({ documents, durable_runs: { enabled: false, ready: false } }),
      ),
    ).toBe(false);
    expect(durableRunsEnabledFromHealth(health({ documents }))).toBe(false);
    // Malformed must not break health for the rest of the app.
    expect(
      durableRunsEnabledFromHealth(
        health({ documents, durable_runs: { enabled: "yes" } }),
      ),
    ).toBe(false);
    expect(durableRunsEnabledFromHealth(undefined)).toBe(false);
  });

  it("fills the snapshot's served defaults", () => {
    const parsed = runOutputSnapshotSchema.parse({
      run_id: "r-1",
      conversation_id: "c-1",
      client_request_id: null,
      status: "queued",
      cursor: 0,
    });
    expect(parsed).toMatchObject({
      schema_version: 1,
      partial_reply: "",
      reasoning_summaries: [],
      activity_events: [],
      interaction: null,
      result: null,
      error: null,
    });
  });

  it("rejects a snapshot version this build does not know", () => {
    expect(
      runOutputSnapshotSchema.safeParse({
        schema_version: 2,
        run_id: "r-1",
        conversation_id: "c-1",
        client_request_id: null,
        status: "running",
        cursor: 0,
      }).success,
    ).toBe(false);
  });

  it("keeps the snapshot when a reasoning summary is malformed", () => {
    // Display metadata costs itself, never the answer.
    const parsed = runOutputSnapshotSchema.parse({
      run_id: "r-1",
      conversation_id: "c-1",
      client_request_id: "req-1",
      status: "running",
      cursor: 3,
      partial_reply: "text",
      reasoning_summaries: [
        { stage: "answer_synthesis", text: "ok", source: "model_generated" },
        { stage: "unknown_stage", text: "dropped" },
      ],
    });
    expect(parsed.partial_reply).toBe("text");
    expect(parsed.reasoning_summaries).toEqual([
      { stage: "answer_synthesis", text: "ok" },
    ]);
  });

  it("parses the listener's own terminal payloads with their defaults", () => {
    expect(
      durableRunFailedEventDataSchema.parse({
        run_id: "r-1",
        conversation_id: "c-1",
        code: "worker_lost",
        detail: "safe",
      }),
    ).toMatchObject({ status: "failed", code: "worker_lost" });
    expect(
      durableRunCancelledEventDataSchema.parse({
        run_id: "r-1",
        conversation_id: "c-1",
      }),
    ).toMatchObject({ status: "cancelled", partial_reply_persisted: false });
  });

  it("treats an absent or unknown execution mode as unknown", () => {
    const base = {
      run_id: "r-1",
      conversation_id: "c-1",
      status: "running",
      route_label: null,
      created_at: "2026-10-17T00:00:00Z",
    };
    expect(
      agentRunSummarySchema.parse({ ...base, execution_mode: "durable" })
        .execution_mode,
    ).toBe("durable");
    expect(agentRunSummarySchema.parse(base).execution_mode).toBeUndefined();
    expect(
      agentRunSummarySchema.parse({ ...base, execution_mode: "future" })
        .execution_mode,
    ).toBeUndefined();
  });
});

describe("delivery cursors on the wire", () => {
  it("reads only non-negative integer ids", () => {
    expect(parseDeliveryId("12")).toBe(12);
    expect(parseDeliveryId("0")).toBe(0);
    expect(parseDeliveryId(undefined)).toBeNull();
    expect(parseDeliveryId("-1")).toBeNull();
    expect(parseDeliveryId("abc")).toBeNull();
  });

  it("ignores heartbeat comments and releases the body when stopped early", async () => {
    let cancelled = false;
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            ': heartbeat\n\nid: 1\nevent: answer_delta\ndata: {"delta":"a","sequence":1}\n\n',
          ),
        );
      },
      cancel() {
        cancelled = true;
      },
    });
    const events = [];
    for await (const event of streamServerSentEvents(new Response(body))) {
      events.push(event);
      break;
    }
    expect(events).toEqual([
      {
        event: "answer_delta",
        data: '{"delta":"a","sequence":1}',
        id: "1",
      },
    ]);
    expect(cancelled).toBe(true);
  });
});

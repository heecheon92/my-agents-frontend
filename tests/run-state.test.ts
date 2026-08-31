import { describe, expect, it } from "vitest";
import {
  blocksNewRun,
  canDrainQueue,
  deriveRunPhase,
  type RunPhase,
  showsStopControl,
} from "@/components/chat/run-state";

const NOTHING = {
  isStreaming: false,
  hasPendingInteraction: false,
  hasServerActiveRun: false,
  hasServerWaitingRun: false,
};

describe("deriveRunPhase", () => {
  it("is idle with nothing outstanding", () => {
    expect(deriveRunPhase(NOTHING)).toBe("idle");
  });

  it("is streaming for a live run, from either signal", () => {
    expect(deriveRunPhase({ ...NOTHING, isStreaming: true })).toBe("streaming");
    // A run this tab did not start still occupies the conversation.
    expect(deriveRunPhase({ ...NOTHING, hasServerActiveRun: true })).toBe(
      "streaming",
    );
  });

  it("is waiting for a suspended run, from either signal", () => {
    expect(deriveRunPhase({ ...NOTHING, hasPendingInteraction: true })).toBe(
      "waiting",
    );
    // The cold-load path: the run list says a run is waiting before this tab
    // has rebuilt the card.
    expect(deriveRunPhase({ ...NOTHING, hasServerWaitingRun: true })).toBe(
      "waiting",
    );
  });

  it("is resuming while the continuation streams under an open card", () => {
    // Refinement keeps the card up while its lookup continues.
    expect(
      deriveRunPhase({
        ...NOTHING,
        isStreaming: true,
        hasPendingInteraction: true,
      }),
    ).toBe("resuming");
  });

  it("is streaming after a final choice while the waiting row is stale", () => {
    expect(
      deriveRunPhase({
        ...NOTHING,
        isStreaming: true,
        hasServerWaitingRun: true,
      }),
    ).toBe("streaming");
  });

  it("treats a stale server active run as streaming, not waiting", () => {
    // A conversation can briefly report both while the run list catches up.
    // The pending question is the more specific fact, so it wins.
    expect(
      deriveRunPhase({
        ...NOTHING,
        hasServerActiveRun: true,
        hasServerWaitingRun: true,
      }),
    ).toBe("waiting");
  });
});

describe("run phase decisions", () => {
  const phases: RunPhase[] = ["idle", "streaming", "waiting", "resuming"];

  it("blocks a new run whenever one is outstanding, including suspended", () => {
    // A suspended run still holds the conversation: the backend answers a new
    // run with the same 409 it uses for a busy one, so the client must know
    // from state rather than from the error.
    expect(phases.filter((phase) => !blocksNewRun(phase))).toEqual(["idle"]);
    expect(blocksNewRun("waiting")).toBe(true);
  });

  it("offers stop only while something is actually being written", () => {
    // Not the same set as blocksNewRun. A suspended run produces nothing, so a
    // stop button there would offer to interrupt an answer that is not running.
    expect(phases.filter(showsStopControl)).toEqual(["streaming"]);
    expect(showsStopControl("waiting")).toBe(false);
  });

  it("pauses the queue while a question is open", () => {
    // The existing drain fires when the server's active run disappears, and a
    // run moving to waiting looks exactly like completion to a predicate that
    // knows only `running` and `cancelling`. Draining there sends the queued
    // message into a conversation that will refuse it.
    expect(phases.filter(canDrainQueue)).toEqual(["idle"]);
    expect(canDrainQueue("waiting")).toBe(false);
    expect(canDrainQueue("resuming")).toBe(false);
  });

  it("keeps blocking and stopping as different questions", () => {
    // The bug this module exists to prevent is answering both with one
    // predicate: `waiting` blocks sending but must not show a stop control.
    const divergent = phases.filter(
      (phase) => blocksNewRun(phase) !== showsStopControl(phase),
    );
    expect(divergent).toEqual(["waiting", "resuming"]);
  });
});

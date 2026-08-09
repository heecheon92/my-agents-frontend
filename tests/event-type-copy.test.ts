import { describe, expect, it } from "vitest";
import { describeEventType } from "@/components/chat/evidence-panel/sections";
import en from "@/localization/en.json";
import ko from "@/localization/ko.json";

describe("describeEventType", () => {
  it("localizes the event types the backend actually emits", () => {
    // Read from the backend source at ../my-agents; the contract is not
    // published, which is why the fallback below matters.
    const emitted = [
      "run_started",
      "graph_invoked",
      "retrieval_completed",
      "answer_composed",
      "run_completed",
      "run_failed",
      "run_cancelled",
    ];

    for (const eventType of emitted) {
      const korean = describeEventType(eventType, ko.chat);
      expect(korean, eventType).toMatch(/[가-힣]/);
      expect(korean, eventType).not.toContain("_");
      expect(describeEventType(eventType, en.chat), eventType).not.toContain(
        "_",
      );
    }
  });

  it("degrades readably for an event type it has never seen", () => {
    // The backend can add types without a frontend release, so an unknown
    // enum must not reach the user as raw snake_case.
    expect(describeEventType("tool_call_started", ko.chat)).toBe(
      "Tool call started",
    );
    expect(describeEventType("", ko.chat)).toBe("");
  });
});

import { describe, expect, it } from "vitest";
import { isStreamPath } from "@/app/api/my-agents/[...path]/route";

describe("my-agents BFF stream passthrough", () => {
  it("passes through both normal run and replay SSE paths without buffering", () => {
    expect(isStreamPath("/conversations/conversation-1/runs/stream")).toBe(
      true,
    );
    expect(
      isStreamPath(
        "/conversations/conversation-1/messages/message-1/replay/stream",
      ),
    ).toBe(true);
    expect(
      isStreamPath("/conversations/conversation-1/messages/message-1/replay"),
    ).toBe(false);
  });

  it("treats a resumed run as a stream", () => {
    // A run that stopped to ask a question resumes over SSE. Leaving this out
    // of `isStreamPath` does not error — the proxy buffers the whole body and
    // the resumed answer lands in one jump, which reads as "streaming randomly
    // stops working" rather than as a missing route.
    expect(
      isStreamPath("/conversations/conversation-1/runs/run-1/resume/stream"),
    ).toBe(true);
    // The interaction ID is compound (`<run_id>:<type>`); a colon in the run
    // segment must not stop it being recognised as a stream.
    expect(
      isStreamPath(
        "/conversations/conversation-1/runs/run-1:document_selection/resume/stream",
      ),
    ).toBe(true);
    // The synchronous resume shares the prefix and must stay unbuffered-false.
    expect(
      isStreamPath("/conversations/conversation-1/runs/run-1/resume"),
    ).toBe(false);
  });
});

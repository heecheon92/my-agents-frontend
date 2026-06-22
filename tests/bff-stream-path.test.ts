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
});

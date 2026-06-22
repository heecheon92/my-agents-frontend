import { describe, expect, it } from "vitest";
import {
  isStreamPath,
  proxyResponseHeaders,
} from "@/app/api/my-agents/[...path]/route";

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

  it("marks normal proxied API responses as no-store", () => {
    expect(proxyResponseHeaders("application/json")).toEqual({
      "cache-control": "no-store, no-transform",
      "content-type": "application/json",
    });
  });
});

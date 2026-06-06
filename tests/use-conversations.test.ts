import { describe, expect, it, vi } from "vitest";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import { invalidateConversationReplayState } from "@/hooks/use-conversations";

describe("conversation query invalidation", () => {
  it("refreshes replay-adjacent state after regenerate failures", () => {
    const invalidateQueries = vi.fn();

    invalidateConversationReplayState({ invalidateQueries }, "conversation-1");

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: MyAgentsQueryKeys.conversations.messages("conversation-1"),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: MyAgentsQueryKeys.conversations.runs("conversation-1"),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["my-agents", "conversations", "run", "conversation-1"],
    });
  });
});

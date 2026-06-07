import { describe, expect, it, vi } from "vitest";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import {
  invalidateConversationReplayState,
  putCreatedConversationFirst,
} from "@/hooks/use-conversations";

describe("conversation query invalidation", () => {
  it("places newly created conversations at the top of cached lists", () => {
    const existing = [
      {
        id: "old-1",
        title: "Old",
        owner_user_id: "user-1",
      },
      {
        id: "old-2",
        title: "Older",
        owner_user_id: "user-1",
      },
    ];
    const created = {
      id: "new-1",
      title: "새 대화",
      owner_user_id: "user-1",
    };

    expect(putCreatedConversationFirst(existing, created)).toEqual([
      created,
      ...existing,
    ]);
  });

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

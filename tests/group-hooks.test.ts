import { describe, expect, it, vi } from "vitest";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import { invalidatePublishRequestCreationState } from "@/hooks/use-groups";

describe("group publish-request invalidation", () => {
  it("refreshes review state and knowledge-base list after share creation", () => {
    const queryClient = { invalidateQueries: vi.fn() };

    invalidatePublishRequestCreationState(queryClient, "group-1");

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: MyAgentsQueryKeys.groups.publishRequests("group-1"),
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: MyAgentsQueryKeys.knowledgeBases.list(),
    });
  });
});

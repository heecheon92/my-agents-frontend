import { describe, expect, it, vi } from "vitest";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import {
  invalidateKnowledgeBaseUpdateState,
  isKnowledgeBaseDocumentPreviewEnabled,
  removeKnowledgeBaseDeletedState,
} from "@/hooks/use-knowledge";
import type { KnowledgeBase } from "@/model/my-agents";

const knowledgeBase: KnowledgeBase = {
  id: "kb-1",
  name: "Renamed space",
  scope: "personal",
  owner_user_id: "user-1",
  group_id: null,
  purpose: "standard",
  published_group_ids: [],
};

describe("knowledge query invalidation helpers", () => {
  it("refreshes list and detail after a knowledge-base rename", () => {
    const queryClient = {
      invalidateQueries: vi.fn(),
      removeQueries: vi.fn(),
      setQueryData: vi.fn(),
    };

    invalidateKnowledgeBaseUpdateState(queryClient, "kb-1", knowledgeBase);

    expect(queryClient.setQueryData).toHaveBeenCalledWith(
      MyAgentsQueryKeys.knowledgeBases.detail("kb-1"),
      knowledgeBase,
    );
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: MyAgentsQueryKeys.knowledgeBases.list(),
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: MyAgentsQueryKeys.knowledgeBases.detail("kb-1"),
    });
  });

  it("removes stale detail, document, preview, and extraction query state after delete", () => {
    const queryClient = {
      invalidateQueries: vi.fn(),
      removeQueries: vi.fn(),
      setQueryData: vi.fn(),
    };

    removeKnowledgeBaseDeletedState(queryClient, "kb-1");

    expect(queryClient.setQueryData).toHaveBeenCalledWith(
      MyAgentsQueryKeys.knowledgeBases.list(),
      expect.any(Function),
    );
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: MyAgentsQueryKeys.knowledgeBases.list(),
    });
    expect(queryClient.removeQueries).toHaveBeenCalledWith({
      queryKey: MyAgentsQueryKeys.knowledgeBases.detail("kb-1"),
    });
    expect(queryClient.removeQueries).toHaveBeenCalledWith({
      queryKey: ["my-agents", "knowledge-bases", "documents", "kb-1"],
    });
  });

  it("enables document preview only when drawer activation and both ids are present", () => {
    expect(isKnowledgeBaseDocumentPreviewEnabled("kb-1", "doc-1", true)).toBe(
      true,
    );
    expect(isKnowledgeBaseDocumentPreviewEnabled("kb-1", "doc-1", false)).toBe(
      false,
    );
    expect(isKnowledgeBaseDocumentPreviewEnabled("kb-1", undefined, true)).toBe(
      false,
    );
    expect(
      isKnowledgeBaseDocumentPreviewEnabled(undefined, "doc-1", true),
    ).toBe(false);
  });
});

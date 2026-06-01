import { describe, expect, it } from "vitest";
import { writableDocumentKnowledgeBases } from "@/components/document-knowledge-base";
import type { KnowledgeBase } from "@/model/my-agents";

function knowledgeBase(partial: Partial<KnowledgeBase>): KnowledgeBase {
  return {
    id: partial.id ?? "kb-1",
    name: partial.name ?? "Knowledge",
    scope: partial.scope ?? "personal",
    owner_user_id: partial.owner_user_id ?? "user-1",
    group_id: partial.group_id ?? null,
    published_group_ids: partial.published_group_ids ?? [],
  };
}

describe("document writable knowledge bases", () => {
  it("keeps direct document create/upload scoped to personal KBs only", () => {
    const personal = knowledgeBase({ id: "kb-personal", scope: "personal" });
    const group = knowledgeBase({
      id: "kb-group",
      scope: "group",
      group_id: "group-1",
    });

    expect(writableDocumentKnowledgeBases([group, personal])).toEqual([
      personal,
    ]);
  });

  it("excludes shared personal KBs owned by another member from direct writes", () => {
    const ownPersonal = knowledgeBase({
      id: "kb-own",
      owner_user_id: "user-1",
    });
    const publishedByAnotherMember = knowledgeBase({
      id: "kb-shared",
      owner_user_id: "user-2",
      published_group_ids: ["group-1"],
    });

    expect(
      writableDocumentKnowledgeBases(
        [publishedByAnotherMember, ownPersonal],
        "user-1",
      ),
    ).toEqual([ownPersonal]);
  });
});

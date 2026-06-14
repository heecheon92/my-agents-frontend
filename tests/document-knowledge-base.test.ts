import { describe, expect, it } from "vitest";
import {
  ambientSystemKnowledgeBaseCount,
  canAutoApproveTeamDocumentUpload,
  chatSelectableKnowledgeBases,
  groupKnowledgeBasesForGroup,
  systemKnowledgeBasesForManager,
  writableDocumentKnowledgeBases,
} from "@/components/document-knowledge-base";
import type { KnowledgeBase } from "@/model/my-agents";

function knowledgeBase(partial: Partial<KnowledgeBase>): KnowledgeBase {
  return {
    id: partial.id ?? "kb-1",
    name: partial.name ?? "Knowledge",
    scope: partial.scope ?? "personal",
    owner_user_id: partial.owner_user_id ?? "user-1",
    group_id: partial.group_id ?? null,
    purpose: partial.purpose ?? "standard",
    published_group_ids: partial.published_group_ids ?? [],
  };
}

describe("document writable knowledge bases", () => {
  it("excludes hidden staging KBs from visible direct-write choices", () => {
    const staging = knowledgeBase({
      id: "kb-staging",
      purpose: "team_upload_staging",
    });
    const personal = knowledgeBase({ id: "kb-personal", scope: "personal" });

    expect(writableDocumentKnowledgeBases([staging, personal])).toEqual([
      personal,
    ]);
  });

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

  it("does not include system source spaces in ordinary personal write choices", () => {
    const personal = knowledgeBase({ id: "kb-personal", scope: "personal" });
    const system = knowledgeBase({
      id: "kb-system",
      scope: "system",
    });

    expect(writableDocumentKnowledgeBases([system, personal])).toEqual([
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

  it("finds group knowledge spaces for the selected group destination", () => {
    const teamA = knowledgeBase({
      id: "kb-team-a",
      scope: "group",
      group_id: "group-a",
    });
    const teamB = knowledgeBase({
      id: "kb-team-b",
      scope: "group",
      group_id: "group-b",
    });
    const personal = knowledgeBase({ id: "kb-personal", scope: "personal" });

    expect(
      groupKnowledgeBasesForGroup([teamA, personal, teamB], "group-a"),
    ).toEqual([teamA]);
  });

  it("auto-approves team uploads only for owners and admins", () => {
    expect(canAutoApproveTeamDocumentUpload({ role: "owner" })).toBe(true);
    expect(canAutoApproveTeamDocumentUpload({ role: "admin" })).toBe(true);
    expect(canAutoApproveTeamDocumentUpload({ role: "editor" })).toBe(false);
    expect(canAutoApproveTeamDocumentUpload({ role: "viewer" })).toBe(false);
  });

  it("exposes system source spaces only through the manager filter", () => {
    const system = knowledgeBase({ id: "kb-system", scope: "system" });
    const group = knowledgeBase({
      id: "kb-group",
      scope: "group",
      group_id: "group-1",
    });

    expect(systemKnowledgeBasesForManager([group, system], false)).toEqual([]);
    expect(systemKnowledgeBasesForManager([group, system], true)).toEqual([
      system,
    ]);
  });

  it("keeps ambient system spaces out of explicit chat source toggles", () => {
    const personal = knowledgeBase({ id: "kb-personal", scope: "personal" });
    const system = knowledgeBase({ id: "kb-system", scope: "system" });
    const staging = knowledgeBase({
      id: "kb-staging",
      purpose: "team_upload_staging",
    });

    expect(chatSelectableKnowledgeBases([system, staging, personal])).toEqual([
      personal,
    ]);
    expect(ambientSystemKnowledgeBaseCount([system, staging, personal])).toBe(
      1,
    );
  });
});

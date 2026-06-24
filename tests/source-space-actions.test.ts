import { describe, expect, it } from "vitest";
import {
  canManageSourceSpace,
  canSharePersonalSourceSpace,
  groupSourceSpacesForShareTarget,
} from "@/components/admin-surfaces/sources/source-space-actions";
import type { Group, KnowledgeBase } from "@/model/my-agents";

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

const ownerGroup: Group = { id: "group-1", name: "Alpha", role: "owner" };
const viewerGroup: Group = { id: "group-2", name: "Beta", role: "viewer" };

describe("source-space lifecycle eligibility", () => {
  it("allows owners to manage personal standard spaces but not staging or read-only personal spaces", () => {
    expect(
      canManageSourceSpace({
        canManageSystemKnowledge: false,
        currentUserId: "user-1",
        groups: [],
        knowledgeBase: knowledgeBase({ owner_user_id: "user-1" }),
      }),
    ).toBe(true);
    expect(
      canManageSourceSpace({
        canManageSystemKnowledge: false,
        currentUserId: "user-1",
        groups: [],
        knowledgeBase: knowledgeBase({ purpose: "team_upload_staging" }),
      }),
    ).toBe(false);
    expect(
      canManageSourceSpace({
        canManageSystemKnowledge: false,
        currentUserId: "user-1",
        groups: [],
        knowledgeBase: knowledgeBase({ owner_user_id: "user-2" }),
      }),
    ).toBe(false);
  });

  it("allows group owner/admin lifecycle controls but not viewer controls", () => {
    expect(
      canManageSourceSpace({
        canManageSystemKnowledge: false,
        currentUserId: "user-1",
        groups: [ownerGroup, viewerGroup],
        knowledgeBase: knowledgeBase({
          id: "kb-group-1",
          scope: "group",
          group_id: ownerGroup.id,
        }),
      }),
    ).toBe(true);
    expect(
      canManageSourceSpace({
        canManageSystemKnowledge: false,
        currentUserId: "user-1",
        groups: [ownerGroup, viewerGroup],
        knowledgeBase: knowledgeBase({
          id: "kb-group-2",
          scope: "group",
          group_id: viewerGroup.id,
        }),
      }),
    ).toBe(false);
  });

  it("shares only personal-owned standard source spaces and filters group target spaces", () => {
    const personal = knowledgeBase({ id: "kb-personal" });
    const groupTarget = knowledgeBase({
      id: "kb-group-target",
      scope: "group",
      group_id: ownerGroup.id,
    });
    const otherGroupTarget = knowledgeBase({
      id: "kb-other-group",
      scope: "group",
      group_id: viewerGroup.id,
    });

    expect(
      canSharePersonalSourceSpace({
        currentUserId: "user-1",
        knowledgeBase: personal,
      }),
    ).toBe(true);
    expect(
      canSharePersonalSourceSpace({
        currentUserId: "user-1",
        knowledgeBase: { ...personal, owner_user_id: "user-2" },
      }),
    ).toBe(false);
    expect(
      groupSourceSpacesForShareTarget({
        groupId: ownerGroup.id,
        knowledgeBases: [personal, groupTarget, otherGroupTarget],
      }),
    ).toEqual([groupTarget]);
  });
});

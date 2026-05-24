import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";

const now = "2026-05-24T07:55:00.000Z";
const user = {
  id: "u-owner",
  email: "owner@example.com",
  email_verified_at: null,
  is_guest: false,
};
const ownerGroup = { id: "g-alpha", name: "Alpha Research", role: "owner" };
const viewerGroup = { ...ownerGroup, role: "viewer" };
const personalKb = {
  id: "kb-personal",
  name: "Private Notes",
  scope: "personal",
  owner_user_id: user.id,
  group_id: null,
  created_at: now,
};
const groupKb = {
  id: "kb-group",
  name: "Alpha Shared KB",
  scope: "group",
  owner_user_id: user.id,
  group_id: ownerGroup.id,
  created_at: now,
};
const groupConversation = {
  id: "c-group",
  title: "Alpha Group Chat",
  owner_user_id: user.id,
  group_id: ownerGroup.id,
};
const personalConversation = {
  id: "c-personal",
  title: "Personal Chat",
  owner_user_id: user.id,
  group_id: null,
};
const publishRequest = {
  id: "pr-1",
  requester_user_id: user.id,
  target_group_id: ownerGroup.id,
  target_knowledge_base_id: groupKb.id,
  source_document_id: "doc-personal",
  status: "pending",
  reviewer_user_id: null,
  published_document_id: null,
  created_at: now,
  reviewed_at: null,
};

type MockOptions = { role?: "owner" | "viewer" };

async function mockGroupKnowledgeApi(
  page: import("@playwright/test").Page,
  { role = "owner" }: MockOptions = {},
) {
  const requests: Array<{ method: string; path: string; body: unknown }> = [];
  const group = role === "owner" ? ownerGroup : viewerGroup;
  await page.route("**/api/my-agents/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/my-agents", "");
    const method = request.method();
    let body: unknown = null;
    try {
      body = request.postDataJSON();
    } catch {
      body = null;
    }
    requests.push({ method, path, body });
    const json = (value: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(value),
      });

    if (method === "GET" && path === "/auth/me") return json(user);
    if (method === "GET" && path === "/groups") return json([group]);
    if (method === "GET" && path === "/knowledge-bases") {
      return json([groupKb, personalKb]);
    }
    if (method === "GET" && path === "/conversations") {
      return json([groupConversation, personalConversation]);
    }
    if (method === "GET" && path === `/conversations/${groupConversation.id}`) {
      return json(groupConversation);
    }
    if (
      method === "GET" &&
      path === `/conversations/${personalConversation.id}`
    ) {
      return json(personalConversation);
    }
    if (method === "GET" && path.endsWith("/messages")) {
      return json([
        {
          id: "m-1",
          conversation_id: groupConversation.id,
          role: "user",
          content: "Use group context.",
        },
      ]);
    }
    if (method === "GET" && path.endsWith("/runs")) return json([]);
    if (method === "GET" && path === `/groups/${group.id}/publish-requests`) {
      return json([publishRequest]);
    }
    if (method === "POST" && path === `/groups/${group.id}/publish-requests`) {
      return json(publishRequest, 201);
    }
    if (
      method === "POST" &&
      path ===
        `/groups/${group.id}/publish-requests/${publishRequest.id}/approve`
    ) {
      return json({
        ...publishRequest,
        status: "approved",
        reviewer_user_id: user.id,
        published_document_id: "doc-group-copy",
        reviewed_at: now,
      });
    }
    return json([]);
  });
  return requests;
}

test("Group Chat shows private source boundaries and sends mandatory group selection", async ({
  page,
}) => {
  const requests = await mockGroupKnowledgeApi(page);
  await page.goto("/chat");

  await expect(page.getByText(ko.chat.groupChatMode).first()).toBeVisible();
  await expect(page.getByText(ko.chat.groupChatBoundaryCopy)).toBeVisible();
  await expect(page.getByText("Alpha Shared KB")).toBeVisible();
  await expect(page.getByText("Private Notes")).toBeVisible();

  await page.getByText("Private Notes").click();
  await page
    .getByPlaceholder(ko.chat.groupComposerPlaceholder)
    .fill("Use group and private context");
  await page.getByRole("button", { name: ko.chat.send }).click();

  await expect
    .poll(
      () =>
        requests.find(
          (item) =>
            item.method === "POST" && item.path.endsWith("/runs/stream"),
        )?.body,
    )
    .toMatchObject({
      message: "Use group and private context",
      knowledge_base_selection: { mode: "all", knowledge_base_ids: [] },
      optional_personal_knowledge_base_ids: ["kb-personal"],
    });
});

test("Publish review controls are owner-only in Group admin UI", async ({
  page,
}) => {
  await mockGroupKnowledgeApi(page, { role: "viewer" });
  await page.goto("/groups");

  await expect(
    page.getByRole("heading", { name: ko.admin.groups.publishBoundaryTitle }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: ko.admin.groups.publishRequestButton }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: ko.admin.groups.publishApproveButton }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: ko.admin.groups.publishRejectButton }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: ko.admin.groups.upsertMember }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: ko.admin.groups.patchRole }),
  ).toBeDisabled();
  await expect(
    page.getByText(ko.admin.groups.membershipManagerOnlyHint),
  ).toBeVisible();
});

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
const betaGroup = { id: "g-beta", name: "Beta Insights", role: "admin" };
const viewerGroup = { ...ownerGroup, role: "viewer" };
const personalKb = {
  id: "kb-personal",
  name: "Private Notes",
  scope: "personal",
  owner_user_id: user.id,
  group_id: null,
  published_group_ids: [],
  created_at: now,
};
const publishedMemberKb = {
  id: "kb-published-member",
  name: "Published Member Knowledge",
  scope: "personal",
  owner_user_id: "u-member",
  group_id: null,
  published_group_ids: [ownerGroup.id],
  created_at: now,
};
const groupKb = {
  id: "kb-group",
  name: "Alpha Shared Knowledge",
  scope: "group",
  owner_user_id: user.id,
  group_id: ownerGroup.id,
  published_group_ids: [],
  created_at: now,
};
const betaGroupKb = {
  id: "kb-beta",
  name: "Beta Shared Knowledge",
  scope: "group",
  owner_user_id: user.id,
  group_id: betaGroup.id,
  published_group_ids: [],
  created_at: now,
};
const groupConversation = {
  id: "c-group",
  title: "Alpha group knowledge source",
  owner_user_id: user.id,
  group_id: ownerGroup.id,
};
const personalConversation = {
  id: "c-personal",
  title: "Private conversation",
  owner_user_id: user.id,
  group_id: null,
};
const publishRequest = {
  id: "pr-1",
  requester_user_id: user.id,
  target_group_id: ownerGroup.id,
  target_knowledge_base_id: groupKb.id,
  source_document_id: "doc-personal",
  source_knowledge_base_id: null,
  status: "pending",
  reviewer_user_id: null,
  published_document_id: null,
  published_knowledge_base_id: null,
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
    if (method === "GET" && path === "/groups") return json([group, betaGroup]);
    if (method === "GET" && path === "/knowledge-bases") {
      return json([groupKb, betaGroupKb, personalKb, publishedMemberKb]);
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
        published_knowledge_base_id: null,
        reviewed_at: now,
      });
    }
    return json([]);
  });
  return requests;
}

test("group knowledge source stays private and sends selected group context", async ({
  page,
}) => {
  const requests = await mockGroupKnowledgeApi(page);
  await page.goto("/chat");

  const includeGroupKnowledge = page.getByLabel(
    ko.chat.includeGroupKnowledgeLabel,
  );
  await expect(includeGroupKnowledge).toBeVisible();
  await includeGroupKnowledge.check();
  await expect(page.getByText(ko.chat.groupChatBoundaryCopy)).toBeVisible();
  await expect(
    page.getByRole("button", { name: ownerGroup.name }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: betaGroup.name }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: betaGroup.name }).click();
  await expect(
    page.getByRole("button", { name: betaGroup.name }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByText(ko.chat.groupKnowledgeSourceDescription).click();
  await expect(page.getByText("Alpha Shared Knowledge")).toBeVisible();
  await expect(page.getByText("Beta Shared Knowledge")).toBeVisible();
  await expect(page.getByText("Published Member Knowledge")).toBeVisible();
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
      knowledge_base_selection: {
        mode: "selected",
        knowledge_base_ids: ["kb-group", "kb-beta", "kb-published-member"],
      },
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

test("Admin creation controls stay compact and aligned", async ({ page }) => {
  await mockGroupKnowledgeApi(page);
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.goto("/groups");
  const groupNameInput = page.getByRole("textbox", {
    name: ko.admin.groups.nameLabel,
  });
  const createGroupButton = page.getByRole("button", {
    name: ko.admin.groups.createButton,
  });
  await expect(groupNameInput).toBeVisible();
  await expect(createGroupButton).toBeVisible();
  const groupNameBox = await groupNameInput.boundingBox();
  const createGroupBox = await createGroupButton.boundingBox();
  const groupCreateFormBox = await page
    .getByTestId("group-create-form")
    .boundingBox();
  expect(groupNameBox).not.toBeNull();
  expect(createGroupBox).not.toBeNull();
  expect(groupCreateFormBox).not.toBeNull();
  expect(
    Math.abs((groupNameBox?.y ?? 0) - (createGroupBox?.y ?? 0)),
  ).toBeLessThan(12);
  expect(groupNameBox?.width).toBeLessThanOrEqual(360);
  expect(groupCreateFormBox?.height).toBeLessThanOrEqual(120);

  await page.goto("/knowledge");
  const scopeSelect = page.getByRole("combobox", {
    name: ko.admin.knowledge.scopeLabel,
  });
  const groupSelect = page.getByRole("combobox", {
    name: ko.admin.knowledge.groupLabel,
  });
  await expect(scopeSelect).toBeVisible();
  await expect(groupSelect).toBeVisible();
  const scopeBox = await scopeSelect.boundingBox();
  const groupBox = await groupSelect.boundingBox();
  expect(scopeBox).not.toBeNull();
  expect(groupBox).not.toBeNull();
  expect(Math.abs((scopeBox?.y ?? 0) - (groupBox?.y ?? 0))).toBeLessThan(4);
  expect(
    Math.abs((scopeBox?.height ?? 0) - (groupBox?.height ?? 0)),
  ).toBeLessThan(2);
});

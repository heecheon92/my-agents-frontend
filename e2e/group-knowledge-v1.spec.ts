import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";

const now = "2026-05-24T07:55:00.000Z";
const user = {
  id: "u-owner",
  email: "owner@example.com",
  nickname: "Owner Display",
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
const personalConversation = {
  id: "c-personal",
  title: "Private conversation",
  owner_user_id: user.id,
};
const invitation = {
  id: "invite-1",
  group_id: ownerGroup.id,
  invited_email: "teammate@example.com",
  role: "viewer",
  status: "pending",
  created_at: now,
  expires_at: "2026-06-17T07:55:00.000Z",
  accepted_at: null,
  cancelled_at: null,
  resent_at: null,
};
const member = {
  member_id: "member-1",
  user_id: user.id,
  nickname: user.nickname,
  role: "owner",
  created_at: now,
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
      return json([personalConversation]);
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
          conversation_id: personalConversation.id,
          role: "user",
          content: "Use group context.",
        },
      ]);
    }
    if (method === "GET" && path.endsWith("/runs")) return json([]);
    if (method === "GET" && path === `/groups/${group.id}/invitations`) {
      return json(
        role === "owner" ? [invitation] : [],
        role === "owner" ? 200 : 403,
      );
    }
    if (method === "GET" && path === `/groups/${group.id}/members`) {
      return json(
        role === "owner" ? [member] : [],
        role === "owner" ? 200 : 403,
      );
    }
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

test("unified knowledge selection sends personal and group sources through one contract", async ({
  page,
}) => {
  const requests = await mockGroupKnowledgeApi(page);
  await page.goto("/chat");

  await page.getByText(ko.chat.knowledgeSourceTitle).click();
  await page
    .getByRole("button", { name: ko.chat.knowledgeSourceSelected })
    .click();
  await expect(
    page.getByText(ko.chat.knowledgeSourceBoundaryCopy),
  ).toBeVisible();
  await expect(page.getByText("Alpha Shared Knowledge")).toBeVisible();
  await expect(page.getByText("Beta Shared Knowledge")).toBeVisible();
  await expect(page.getByText("Published Member Knowledge")).toBeVisible();
  await expect(page.getByText("Private Notes")).toBeVisible();

  await page.getByText("Alpha Shared Knowledge").click();
  await page.getByText("Beta Shared Knowledge").click();
  await page.getByText("Published Member Knowledge").click();
  await page.getByText("Private Notes").click();
  await page
    .getByPlaceholder(ko.chat.composerPlaceholder)
    .fill("Use selected context");
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
      message: "Use selected context",
      knowledge_base_selection: {
        mode: "selected",
        knowledge_base_ids: [
          "kb-group",
          "kb-beta",
          "kb-published-member",
          "kb-personal",
        ],
      },
    });
});

test("Publish review controls are owner-only in Group admin UI", async ({
  page,
}) => {
  await mockGroupKnowledgeApi(page, { role: "viewer" });
  await page.goto("/groups");

  await expect(
    page.getByRole("heading", { name: ko.admin.groups.publishRequestsTitle }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("button", { name: ko.admin.groups.requestShareAction })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: ko.admin.groups.publishApproveButton }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: ko.admin.groups.publishRejectButton }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: ko.admin.groups.inviteMemberAction }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: ko.admin.groups.sendInvitation }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: ko.admin.groups.patchRole }),
  ).toHaveCount(0);
  await expect(
    page.getByText(ko.admin.groups.membershipManagerOnlyHint),
  ).toBeVisible();
});

test("Member roster shows nickname while keeping user ID secondary", async ({
  page,
}) => {
  await mockGroupKnowledgeApi(page);
  await page.goto("/groups");

  const memberRow = page.locator("article").filter({ hasText: user.nickname });
  await expect(memberRow.getByText(user.nickname)).toBeVisible();
  await expect(
    memberRow.getByText(`${ko.admin.groups.memberUserIdLabel}: ${user.id}`),
  ).toBeHidden();
  await memberRow.getByText(ko.admin.groups.advancedGroupDetails).click();
  await expect(
    memberRow.getByText(`${ko.admin.groups.memberUserIdLabel}: ${user.id}`),
  ).toBeVisible();
});

test("Admin creation controls stay dialog-scoped and aligned", async ({
  page,
}) => {
  await mockGroupKnowledgeApi(page);
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.goto("/groups");
  const groupNameInput = page.getByRole("textbox", {
    name: ko.admin.groups.nameLabel,
  });
  await expect(groupNameInput).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: ko.admin.groups.sendInvitation }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: ko.admin.groups.patchRole }),
  ).toHaveCount(0);

  await page
    .getByRole("button", { name: ko.admin.groups.createButton })
    .first()
    .click();
  await expect(groupNameInput).toBeVisible();
  const createGroupButton = page
    .getByTestId("group-create-form")
    .getByRole("button", {
      name: ko.admin.groups.createButton,
    });
  await expect(createGroupButton).toBeVisible();
  const groupNameBox = await groupNameInput.boundingBox();
  const createGroupBox = await createGroupButton.boundingBox();
  const groupCreateFormBox = await page
    .getByTestId("group-create-form")
    .boundingBox();
  expect(groupNameBox).not.toBeNull();
  expect(createGroupBox).not.toBeNull();
  expect(groupCreateFormBox).not.toBeNull();
  expect(groupNameBox?.width).toBeLessThanOrEqual(520);
  expect(groupCreateFormBox?.height).toBeLessThanOrEqual(240);

  await page.goto("/knowledge");
  await page
    .getByRole("button", { name: ko.admin.documents.addSourceSpaceAction })
    .first()
    .click();
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

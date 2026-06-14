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
const extraGroupKbs = [
  {
    id: "kb-group-2",
    name: "Alpha Field Notes",
    scope: "group",
    owner_user_id: user.id,
    group_id: ownerGroup.id,
    published_group_ids: [],
    created_at: now,
  },
  {
    id: "kb-group-3",
    name: "Alpha Experiments",
    scope: "group",
    owner_user_id: user.id,
    group_id: ownerGroup.id,
    published_group_ids: [],
    created_at: now,
  },
  {
    id: "kb-group-4",
    name: "Alpha Archive",
    scope: "group",
    owner_user_id: user.id,
    group_id: ownerGroup.id,
    published_group_ids: [],
    created_at: now,
  },
];
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
const invitations = [
  invitation,
  {
    ...invitation,
    id: "invite-2",
    invited_email: "accepted@example.com",
    role: "editor",
    status: "accepted",
    accepted_at: now,
  },
  {
    ...invitation,
    id: "invite-3",
    invited_email: "cancelled@example.com",
    role: "admin",
    status: "cancelled",
    cancelled_at: now,
  },
  {
    ...invitation,
    id: "invite-4",
    invited_email: "expired@example.com",
    status: "expired",
  },
];
const member = {
  member_id: "member-1",
  user_id: user.id,
  nickname: user.nickname,
  role: "owner",
  created_at: now,
};
const members = [
  member,
  {
    member_id: "member-2",
    user_id: "u-editor",
    nickname: "Editor Display",
    role: "editor",
    created_at: now,
  },
  {
    member_id: "member-3",
    user_id: "u-admin",
    nickname: "Admin Display",
    role: "admin",
    created_at: now,
  },
  {
    member_id: "member-4",
    user_id: "u-viewer",
    nickname: "Viewer Display",
    role: "viewer",
    created_at: now,
  },
];

const publishRequest = {
  id: "pr-1",
  requester_user_id: user.id,
  target_group_id: ownerGroup.id,
  target_knowledge_base_id: groupKb.id,
  source_document_id: "doc-personal",
  source_knowledge_base_id: null,
  source_document_title: "Personal strategy memo",
  source_document_excerpt: "A short preview for owner review.",
  source_document_filename: "strategy.md",
  source_knowledge_base_name: null,
  target_knowledge_base_name: groupKb.name,
  status: "pending",
  reviewer_user_id: null,
  published_document_id: null,
  published_knowledge_base_id: null,
  created_at: now,
  reviewed_at: null,
};
const publishRequests = [
  publishRequest,
  {
    ...publishRequest,
    id: "pr-2",
    source_document_id: null,
    source_knowledge_base_id: personalKb.id,
    source_document_title: null,
    source_document_filename: null,
    source_knowledge_base_name: "Private Notes",
    status: "approved",
    reviewer_user_id: user.id,
    published_knowledge_base_id: "kb-copy-approved",
    created_at: "2026-05-23T07:55:00.000Z",
    reviewed_at: now,
  },
  {
    ...publishRequest,
    id: "pr-3",
    source_document_id: "doc-rejected",
    source_document_title: "Rejected field memo",
    source_document_filename: "rejected.md",
    status: "rejected",
    reviewer_user_id: user.id,
    created_at: "2026-05-22T07:55:00.000Z",
    reviewed_at: now,
  },
  {
    ...publishRequest,
    id: "pr-4",
    source_document_id: "doc-archived",
    source_document_title: "Archived context memo",
    source_document_filename: "archive.md",
    status: "approved",
    reviewer_user_id: user.id,
    created_at: "2026-05-21T07:55:00.000Z",
    reviewed_at: now,
  },
];

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
    if (method === "POST" && path === "/groups") {
      return json(
        { id: "g-created", name: "Created Group", role: "owner" },
        201,
      );
    }
    if (method === "GET" && path === "/knowledge-bases") {
      return json([
        groupKb,
        ...extraGroupKbs,
        betaGroupKb,
        personalKb,
        publishedMemberKb,
      ]);
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
        role === "owner" ? invitations : [],
        role === "owner" ? 200 : 403,
      );
    }
    if (method === "GET" && path === `/groups/${group.id}/members`) {
      return json(
        role === "owner" ? members : [],
        role === "owner" ? 200 : 403,
      );
    }
    if (method === "GET" && path === `/groups/${group.id}/publish-requests`) {
      return json(role === "owner" ? publishRequests : [publishRequest]);
    }
    if (method === "GET" && path === `/groups/${betaGroup.id}/invitations`) {
      return json([]);
    }
    if (method === "GET" && path === `/groups/${betaGroup.id}/members`) {
      return json([]);
    }
    if (
      method === "GET" &&
      path === `/groups/${betaGroup.id}/publish-requests`
    ) {
      return json([]);
    }
    if (
      method === "GET" &&
      path ===
        `/groups/${group.id}/publish-requests/${publishRequest.id}/source`
    ) {
      return json(
        role === "owner"
          ? {
              request_id: publishRequest.id,
              source_kind: "document",
              source_knowledge_base_id: null,
              source_knowledge_base_name: null,
              documents: [
                {
                  id: publishRequest.source_document_id,
                  title: publishRequest.source_document_title,
                  content:
                    "## Review section\n\nFull extracted source content that the owner can inspect before approval.",
                  source_type: "markdown",
                  source_filename: publishRequest.source_document_filename,
                  source_content_type: "text/markdown",
                  source_byte_size: 128,
                  source_page_count: null,
                  parser_name: "markdown_upload",
                  created_at: now,
                },
              ],
            }
          : {},
        role === "owner" ? 200 : 403,
      );
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

test("Groups route selection deep-links and browser links select the active group", async ({
  page,
}) => {
  await mockGroupKnowledgeApi(page);

  await page.goto(`/groups/${betaGroup.id}`);
  await expect(page).toHaveURL(new RegExp(`/groups/${betaGroup.id}$`));
  await expect(
    page.getByRole("heading", { name: betaGroup.name }),
  ).toBeVisible();

  await page.getByRole("link", { name: /Alpha Research/ }).click();
  await expect(page).toHaveURL(new RegExp(`/groups/${ownerGroup.id}$`));
  await expect(
    page.getByRole("heading", { name: ownerGroup.name }),
  ).toBeVisible();
});

test("Groups dashboard caps previews and opens full management drawers", async ({
  page,
}) => {
  await mockGroupKnowledgeApi(page);
  await page.goto(`/groups/${ownerGroup.id}`);

  await expect(page.getByText("Viewer Display")).toHaveCount(0);
  await expect(page.getByText("expired@example.com")).toHaveCount(0);
  await expect(page.getByText("Alpha Archive")).toHaveCount(0);
  await expect(page.getByText("Archived context memo")).toHaveCount(0);
  await expect(page.getByText(/^\+1/)).toHaveCount(4);

  await page
    .getByRole("button", { name: ko.admin.groups.manageMembersAction })
    .first()
    .click();
  let drawer = page
    .getByRole("dialog")
    .filter({ hasText: ko.admin.groups.manageMembersAction });
  await expect(drawer.getByText("Viewer Display")).toBeVisible();
  await expect(
    drawer.getByText(`${ko.admin.groups.memberUserIdLabel}: u-viewer`),
  ).toBeHidden();
  await drawer.getByText(ko.admin.groups.advancedGroupDetails).last().click();
  await expect(
    drawer.getByText(`${ko.admin.groups.memberUserIdLabel}: u-viewer`),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page
    .getByRole("button", { name: ko.admin.groups.viewInvitationsAction })
    .first()
    .click();
  drawer = page
    .getByRole("dialog")
    .filter({ hasText: ko.admin.groups.viewInvitationsAction });
  await expect(drawer.getByText("expired@example.com")).toHaveCount(0);
  await drawer
    .getByRole("button", { name: ko.admin.groups.allStatusFilter })
    .click();
  await expect(drawer.getByText("expired@example.com")).toBeVisible();
  await drawer
    .getByRole("textbox", { name: ko.admin.groups.invitationSearchLabel })
    .fill("cancelled");
  await expect(drawer.getByText("cancelled@example.com")).toBeVisible();
  await expect(drawer.getByText("teammate@example.com")).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page
    .getByRole("button", { name: ko.admin.groups.manageSourceSpacesAction })
    .first()
    .click();
  drawer = page
    .getByRole("dialog")
    .filter({ hasText: ko.admin.groups.manageSourceSpacesAction });
  await expect(drawer.getByText("Alpha Archive")).toBeVisible();
  await page.keyboard.press("Escape");

  await page
    .getByRole("button", { name: ko.admin.groups.viewPublishRequestsAction })
    .first()
    .click();
  drawer = page
    .getByRole("dialog")
    .filter({ hasText: ko.admin.groups.viewPublishRequestsAction });
  await expect(drawer.getByText("Personal strategy memo")).toBeVisible();
  await expect(drawer.getByText("Private Notes")).toHaveCount(0);
  await drawer
    .getByRole("button", {
      name: ko.admin.groups.publishRequestStatuses.approved,
    })
    .click();
  await expect(drawer.getByText("Private Notes")).toBeVisible();
  await expect(drawer.getByText("Rejected field memo")).toHaveCount(0);
  await drawer
    .getByRole("button", { name: ko.admin.groups.allStatusFilter })
    .click();
  await drawer
    .getByRole("textbox", { name: ko.admin.groups.publishRequestSearchLabel })
    .fill("Rejected");
  await expect(drawer.getByText("Rejected field memo")).toBeVisible();
  await expect(drawer.getByText("Personal strategy memo")).toHaveCount(0);
});

test("Publish review controls are owner-only in Group admin UI", async ({
  page,
}) => {
  await mockGroupKnowledgeApi(page);
  await page.goto("/groups");

  await expect(
    page.getByRole("button", { name: ko.admin.groups.publishApproveNowButton }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: ko.admin.groups.publishRejectNowButton }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: ko.admin.groups.reviewRequestAction })
    .click();
  await expect(
    page.getByRole("heading", { name: ko.admin.groups.reviewRequestAction }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Personal strategy memo" }),
  ).toBeVisible();
  await expect(page.getByText(groupKb.name).first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Review section" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Full extracted source content that the owner can inspect before approval.",
    ),
  ).toBeVisible();

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
    page.getByRole("button", { name: ko.admin.groups.publishApproveNowButton }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: ko.admin.groups.publishRejectNowButton }),
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

import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";

const now = "2026-06-07T00:00:00.000Z";
const user = {
  id: "new-user-tour",
  email: "new-user@example.com",
  nickname: "New User",
  email_verified_at: now,
  is_guest: false,
};
const knowledgeBase = {
  id: "kb-new-user-tour",
  name: "제품 안내 지식",
  scope: "personal",
  purpose: "standard",
  owner_user_id: user.id,
  group_id: null,
  published_group_ids: [],
  created_at: now,
};
const conversation = {
  id: "c-new-user-tour",
  title: "첫 질문",
  owner_user_id: user.id,
};
const run = {
  run_id: "run-new-user-tour",
  conversation_id: conversation.id,
  status: "completed",
  route_label: "rag_agent",
  created_at: now,
};

async function mockNewUserWorkspace(page: import("@playwright/test").Page) {
  await page.route("**/api/my-agents/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/my-agents", "");
    const method = request.method();
    const json = (value: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(value),
      });

    if (method === "GET" && path === "/auth/me") return json(user);
    if (method === "GET" && path === "/groups") return json([]);
    if (method === "GET" && path === "/knowledge-bases") {
      return json([knowledgeBase]);
    }
    if (
      method === "GET" &&
      path === `/knowledge-bases/${knowledgeBase.id}/documents`
    ) {
      return json([]);
    }
    if (method === "GET" && path === "/conversations") {
      return json([conversation]);
    }
    if (method === "GET" && path === `/conversations/${conversation.id}`) {
      return json(conversation);
    }
    if (
      method === "GET" &&
      path === `/conversations/${conversation.id}/messages`
    ) {
      return json([
        {
          id: "m-user",
          conversation_id: conversation.id,
          role: "user",
          content: "제품 안내 문서를 어떻게 확인하나요?",
        },
        {
          id: "m-assistant",
          conversation_id: conversation.id,
          role: "assistant",
          content:
            "답변 옆의 출처와 에이전트 흐름에서 근거를 확인할 수 있습니다.",
        },
      ]);
    }
    if (method === "GET" && path === `/conversations/${conversation.id}/runs`) {
      return json([run]);
    }
    if (
      method === "GET" &&
      path === `/conversations/${conversation.id}/runs/${run.run_id}`
    ) {
      return json({
        ...run,
        reply: "답변 옆의 출처와 에이전트 흐름에서 근거를 확인할 수 있습니다.",
        handled_by: "rag_agent",
        citations: [
          {
            id: "citation-new-user-tour",
            document_id: "doc-new-user-tour",
            knowledge_base_id: knowledgeBase.id,
            chunk_id: "chunk-new-user-tour",
            snippet: "출처와 에이전트 흐름에서 근거를 확인합니다.",
            source_filename: "product-guide.md",
            source_page: null,
          },
        ],
      });
    }
    if (
      method === "GET" &&
      path === `/conversations/${conversation.id}/runs/${run.run_id}/events`
    ) {
      return json([
        {
          id: "event-new-user-tour",
          run_id: run.run_id,
          sequence: 1,
          event_type: "answer_ready",
          payload: { summary: "ready" },
        },
      ]);
    }

    return json([]);
  });
}

test("authenticated users can complete the normal workflow tour", async ({
  page,
}) => {
  await mockNewUserWorkspace(page);
  await page.goto("/chat");

  await expect(page.getByText(ko.onboarding.newUserPromptTitle)).toBeVisible();
  await page.getByRole("button", { name: ko.onboarding.start }).click();

  for (const title of [
    ko.onboarding.steps.newKnowledgeSpaceTitle,
    ko.onboarding.steps.newUploadSourceTitle,
    ko.onboarding.steps.newChatThreadTitle,
    ko.onboarding.steps.newSelectKnowledgeTitle,
    ko.onboarding.steps.newAskQuestionTitle,
    ko.onboarding.steps.newReviewEvidenceTitle,
  ]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    const isLast = title === ko.onboarding.steps.newReviewEvidenceTitle;
    await page
      .getByRole("button", {
        name: isLast ? ko.onboarding.done : ko.onboarding.next,
      })
      .click();
  }

  const persisted = await page.evaluate(() =>
    window.localStorage.getItem("my-agents:onboarding:v1"),
  );
  expect(persisted).toContain('"completed":true');
  expect(persisted).not.toContain("new-user@example.com");
  expect(persisted).not.toContain("new-user-tour");
});

test("authenticated tour respects user navigation away before completion", async ({
  page,
}) => {
  await mockNewUserWorkspace(page);
  await page.goto("/chat");

  await expect(page.getByText(ko.onboarding.newUserPromptTitle)).toBeVisible();
  await page.getByRole("button", { name: ko.onboarding.start }).click();

  await expect(page).toHaveURL(/\/knowledge$/);
  await expect(
    page.getByRole("heading", {
      name: ko.onboarding.steps.newKnowledgeSpaceTitle,
    }),
  ).toBeVisible();

  await page.locator('a[href="/settings"]').evaluate((link) => {
    if (!(link instanceof HTMLAnchorElement)) {
      throw new Error("settings link is not an anchor");
    }
    link.click();
  });

  await expect(page).toHaveURL(/\/settings\/account$/);
  await expect(
    page.getByRole("heading", { name: ko.settings.account.title }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: ko.onboarding.steps.newKnowledgeSpaceTitle,
    }),
  ).toHaveCount(0);

  const persisted = await page.evaluate(() =>
    window.localStorage.getItem("my-agents:onboarding:v1"),
  );
  expect(persisted).toContain('"dismissed":true');
  expect(persisted).not.toContain("new-user@example.com");
  expect(persisted).not.toContain("new-user-tour");
});

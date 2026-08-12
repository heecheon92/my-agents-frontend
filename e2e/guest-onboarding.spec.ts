import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";

const now = "2026-06-07T00:00:00.000Z";
const guestUser = {
  id: "guest-tour-user",
  email: null,
  nickname: "Guest",
  email_verified_at: null,
  is_guest: true,
  guest_expires_at: "2026-06-08T00:00:00.000Z",
};
const conversation = {
  id: "guest-tour-conversation",
  title: "게스트 둘러보기",
  owner_user_id: guestUser.id,
};
const run = {
  run_id: "guest-tour-run",
  conversation_id: conversation.id,
  status: "completed",
  route_label: "rag_agent",
  created_at: now,
};
const knowledgeBase = {
  id: "kb-guest-tour",
  name: "게스트 안내 문서",
  scope: "personal",
  owner_user_id: guestUser.id,
  group_id: null,
  published_group_ids: [],
  created_at: now,
};

async function mockGuestWorkspace(page: import("@playwright/test").Page) {
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

    if (method === "GET" && path === "/auth/me") return json(guestUser);
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
          content: "게스트 안내를 보여 주세요.",
        },
        {
          id: "m-assistant",
          conversation_id: conversation.id,
          role: "assistant",
          content:
            "게스트 데모에서는 인용과 작업 내역을 함께 확인할 수 있습니다.",
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
        reply: "게스트 데모에서는 인용과 작업 내역을 함께 확인할 수 있습니다.",
        handled_by: "rag_agent",
        citations: [
          {
            id: "citation-guest-tour",
            document_id: "doc-guest-tour",
            knowledge_base_id: knowledgeBase.id,
            chunk_id: "chunk-guest-tour",
            snippet: "게스트 데모 안내 문장",
            source_filename: "guest-guide.md",
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
          id: "event-guest-tour",
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

test("guest users can start and complete the guided tour", async ({ page }) => {
  await mockGuestWorkspace(page);
  await page.goto("/chat");

  await expect(page.getByText(ko.onboarding.guestPromptTitle)).toBeVisible();
  await page.getByRole("button", { name: ko.onboarding.start }).click();

  await expect(
    page.getByRole("heading", { name: ko.onboarding.steps.guestLimitsTitle }),
  ).toBeVisible();

  for (const title of [
    ko.onboarding.steps.guestAskTitle,
    ko.onboarding.steps.guestSourcesTitle,
    ko.onboarding.steps.guestAddSourcesTitle,
    ko.onboarding.steps.guestEvidenceTitle,
  ]) {
    await page.getByRole("button", { name: ko.onboarding.next }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }

  await expect(page).toHaveURL(/\/chat$/);
  await page.getByRole("button", { name: ko.onboarding.done }).click();
  await expect(
    page.getByText(ko.onboarding.steps.guestEvidenceTitle),
  ).toHaveCount(0);

  const sessionDecision = await page.evaluate(() =>
    window.sessionStorage.getItem("my-agents:onboarding:guest:guest:v1"),
  );
  expect(sessionDecision).toContain('"completed":true');

  // The card, not just the step. A guest completion used to be written only to
  // sessionStorage, which nothing subscribed to, so the prompt could return.
  await expect(page.getByText(ko.onboarding.guestPromptTitle)).toHaveCount(0);
});

test("dismissing the guest tour with 나중에 keeps it dismissed", async ({
  page,
}) => {
  await mockGuestWorkspace(page);
  await page.goto("/chat");

  const promptTitle = page.getByText(ko.onboarding.guestPromptTitle);
  await expect(promptTitle).toBeVisible();

  // Click the real button. Seeding sessionStorage in `addInitScript` — which is
  // what the other guest specs do — is exactly what hid this bug: it made the
  // one-shot read in the gate return a decision on first render, so the
  // re-prompt loop never ran.
  await page.getByRole("button", { name: ko.onboarding.notNow }).click();
  await expect(promptTitle).toHaveCount(0);

  const sessionDecision = await page.evaluate(() =>
    window.sessionStorage.getItem("my-agents:onboarding:guest:guest:v1"),
  );
  expect(sessionDecision).toContain('"dismissed":true');

  // It used to reappear within a frame of being dismissed.
  await page.waitForTimeout(500);
  await expect(promptTitle).toHaveCount(0);

  // And it must stay gone across a client navigation, since `ServiceShell`
  // keeps `OnboardingRuntime` mounted between service routes.
  await page.getByRole("link", { name: ko.service.nav.knowledge }).click();
  await expect(page).toHaveURL(/\/knowledge$/);
  await expect(promptTitle).toHaveCount(0);
});

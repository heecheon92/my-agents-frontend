import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";

const now = "2026-06-01T00:00:00.000Z";
const user = {
  id: "u-new-chat",
  email: "reader@example.com",
  nickname: "Reader",
  email_verified_at: now,
  is_guest: false,
};
const created = {
  id: "c-created",
  title: "첫 질문입니다",
  // `owner_user_id` is required by `conversationSchema`; without it the create
  // response fails to parse and the send silently does nothing.
  owner_user_id: user.id,
};

/**
 * Starting a new chat after the composer auto-created one.
 *
 * `ensureConversationId` moves the URL with `history.replaceState` rather than
 * `router.push`, because a real navigation crosses a dynamic segment and
 * remounts the workspace mid-run. The cost is that Next's route `params` never
 * learn the new id — so anything deriving the active conversation from params
 * is reading a value frozen at page load.
 */
async function mockNewChatFlow(page: import("@playwright/test").Page) {
  await page.route("**/api/my-agents/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/my-agents", "");
    const method = request.method();
    const json = (value: unknown) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(value),
      });

    if (method === "POST" && path === "/conversations") return json(created);
    if (method === "POST" && path.includes("/runs")) {
      return json({
        run_id: "run-1",
        conversation_id: created.id,
        reply: "답변입니다.",
        route: { label: "research_helper", explanation: "설명" },
        handled_by: "personal_assistant_graph",
        citations: [],
      });
    }
    if (method === "GET" && path === "/auth/me") return json(user);
    if (method === "GET" && path === "/conversations") return json([created]);
    if (method === "GET" && path === `/conversations/${created.id}`) {
      return json(created);
    }
    if (method === "GET" && path === `/conversations/${created.id}/messages`) {
      return json([
        {
          id: "m-user",
          conversation_id: created.id,
          role: "user",
          content: "첫 질문입니다",
        },
        {
          id: "m-assistant",
          conversation_id: created.id,
          role: "assistant",
          content: "답변입니다.",
        },
      ]);
    }
    return json([]);
  });
}

test("starting a new chat after an auto-created one clears the workspace", async ({
  page,
}) => {
  await mockNewChatFlow(page);
  await page.goto("/chat");

  // Send once, which creates the conversation and moves the URL by
  // `replaceState` without a route transition.
  const composer = page.getByPlaceholder(ko.chat.composerPlaceholder);
  await composer.fill("첫 질문입니다");
  await composer.press("Enter");
  await expect(page).toHaveURL(/\/chat\/c-created$/);
  await expect(page.getByText("답변입니다.")).toBeVisible();

  // Now start a new chat from that conversation. This is the reported bug:
  // the workspace kept showing the previous conversation, because its active
  // id came from route params that `replaceState` never updated, so the
  // optimistic id was never cleared and outranked the empty route.
  await page.getByRole("link", { name: ko.chat.newButton }).first().click();

  await expect(page).toHaveURL(/\/chat$/);

  // Scoped to the transcript on purpose: the conversation title legitimately
  // stays in the sidebar history, so asserting page-wide would pass or fail
  // for the wrong reason.
  const transcript = page.getByTestId("chat-scroll-region");
  await expect(transcript.getByText("답변입니다.")).toHaveCount(0);
  await expect(transcript.getByText("첫 질문입니다")).toHaveCount(0);
  await expect(
    page.getByTestId("chat-workspace-panel").getByText(ko.chat.newChatTitle),
  ).toBeVisible();
});

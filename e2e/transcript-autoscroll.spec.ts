import { expect, type Page, test } from "@playwright/test";
import { dismissOnboarding, mockWorkspace } from "./helpers/mock-workspace";

/**
 * A diagram is the sharpest reproducer for late-growing content: it renders on
 * its own schedule after the answer settles and adds over a thousand pixels
 * that no tracked state change announces. Artifacts and images grow the
 * transcript the same way.
 */
const DIAGRAM_ANSWER = [
  "정리했습니다.",
  "",
  "```mermaid",
  "flowchart TD",
  ...Array.from({ length: 12 }, (_, index) => `  N${index} --> N${index + 1}`),
  "```",
].join("\n");

function streamAnswer(page: Page, answer: string) {
  return page.route("**/api/my-agents/**/runs/stream", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body:
        'event: run_started\ndata: {"run_id":"run-visual","conversation_id":"c-visual","status":"running"}\n\n' +
        `event: answer_delta\ndata: ${JSON.stringify({ delta: answer })}\n\n` +
        `event: run_completed\ndata: {"run_id":"run-visual","conversation_id":"c-visual","reply":${JSON.stringify(
          answer,
        )},"route":{"target":"general_assistant","reason":"test"},"handled_by":"general_assistant","retrieval_route":"no_retrieval","answer_mode":"general_knowledge","document_scope":"current_conversation","knowledge_base_selection":{"mode":"all","knowledge_base_ids":[]}}\n\n`,
    }),
  );
}

function distanceFromBottom(page: Page) {
  return page
    .getByTestId("chat-scroll-region")
    .evaluate(
      (element) =>
        element.scrollHeight - element.scrollTop - element.clientHeight,
    );
}

test("follows content that grows after the answer settles", async ({
  page,
}) => {
  // The regression. `autoScrollTrigger` names only what the workspace already
  // tracks — messages, streamed text, activity events — so a diagram rendering
  // a moment later left the reader stranded 1229px above the bottom with
  // nothing to tell them the answer had grown.
  await page.setViewportSize({ width: 1280, height: 720 });
  await mockWorkspace(page);
  await streamAnswer(page, DIAGRAM_ANSWER);
  await page.goto("/chat/c-visual");
  await dismissOnboarding(page);

  const composer = page.getByPlaceholder(/질문|입력/).first();
  await composer.fill("다이어그램을 그려 주세요");
  await composer.press("Enter");

  await expect(page.getByTestId("mermaid-diagram").locator("img")).toBeVisible({
    timeout: 15_000,
  });
  // Settle a frame past the render so the observer's deferred write has run.
  await page.waitForTimeout(400);
  expect(await distanceFromBottom(page)).toBeLessThanOrEqual(0);
});

test("leaves a reader who scrolled up where they put themselves", async ({
  page,
}) => {
  // The other half, and the reason this follows the bottom rather than always
  // scrolling: growth below a reader fires no scroll event, so their position
  // must never be reclaimed by content they did not ask to see.
  await page.setViewportSize({ width: 1280, height: 720 });
  await mockWorkspace(page);
  await streamAnswer(page, DIAGRAM_ANSWER);
  await page.goto("/chat/c-visual");
  await dismissOnboarding(page);

  const composer = page.getByPlaceholder(/질문|입력/).first();
  await composer.fill("다이어그램을 그려 주세요");
  await composer.press("Enter");
  await page.waitForTimeout(150);

  const region = page.getByTestId("chat-scroll-region");
  await region.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event("scroll"));
  });
  const parked = await region.evaluate((element) => element.scrollTop);

  await expect(page.getByTestId("mermaid-diagram").locator("img")).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(400);
  expect(await region.evaluate((element) => element.scrollTop)).toBe(parked);
});

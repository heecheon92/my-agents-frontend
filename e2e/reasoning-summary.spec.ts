import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";
import { expectNoHorizontalOverflow } from "./helpers/layout";
import {
  dismissOnboarding,
  LONG_KOREAN_SUMMARY,
  mockWorkspace,
} from "./helpers/mock-workspace";

const LIVE_ROW = '[data-slot="live-reasoning-summary"]';
/** Long enough to exceed the two-line clamp at 390px, which is the bound. */
const PLANNING =
  "질문이 갱신 조건에 한정되어 있어 문서 전체가 아니라 갱신, 통지, 자동 연장에 해당하는 관련 조항만 먼저 찾기로 했습니다. 이후 각 조항의 기한과 예외를 비교할 예정입니다.";

/** A run that reports its planning summary and then keeps working. */
async function startRunWithPlanningSummary(
  page: import("@playwright/test").Page,
) {
  await mockWorkspace(page);
  await page.route("**/api/my-agents/conversations", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: "c-live",
        title: "실행 중",
        owner_user_id: "u-visual",
      }),
    });
  });
  await page.addInitScript((planning: string) => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const target =
        typeof args[0] === "string"
          ? args[0]
          : args[0] instanceof Request
            ? args[0].url
            : String(args[0]);
      if (!target.includes("/runs/stream")) return nativeFetch(...args);
      const encoder = new TextEncoder();
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'event: run_started\ndata: {"run_id":"r","conversation_id":"c-live","status":"running"}\n\n',
              ),
            );
            window.setTimeout(() => {
              controller.enqueue(
                encoder.encode(
                  `event: reasoning_summary_delta\ndata: ${JSON.stringify({ stage: "retrieval_planning", delta: planning, sequence: 1 })}\n\n`,
                ),
              );
            }, 250);
          },
        }),
        { headers: { "Content-Type": "text/event-stream" }, status: 200 },
      );
    };
  }, PLANNING);
  await page.goto("/chat");
  await dismissOnboarding(page);
  await page
    .getByPlaceholder(chat.composerPlaceholder)
    .fill("갱신 조건 알려줘");
  await page.getByPlaceholder(chat.composerPlaceholder).press("Enter");
  return page.locator(LIVE_ROW);
}

const chat = ko.chat;
const CONVERSATION_URL = "/chat/c-visual";
const SUMMARY = '[data-slot="reasoning-summary"]';

test("keeps model-authored explanations behind the process disclosure", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await mockWorkspace(page, { reasoningSummaries: true });
  await page.goto(CONVERSATION_URL);
  await dismissOnboarding(page);

  const panel = page.getByTestId("agent-process-panel");
  // Collapsed on arrival. A summary must never push the answer down to
  // announce itself, which is the regression the panel was moved to fix.
  // Hidden rather than absent: a closed `<details>` keeps its children in the
  // DOM, so `toHaveCount(0)` here would pass for the wrong reason.
  await expect(panel).not.toHaveAttribute("open", "");
  await expect(page.locator(SUMMARY)).toBeHidden();

  await panel.locator("summary").click();
  const summary = panel.locator(SUMMARY);
  await expect(summary).toBeVisible();
  await expect(summary.locator("blockquote")).toHaveCount(2);
  await expectNoHorizontalOverflow(page, "reasoning summaries @ 390px");
});

test("shows the explanation without a heading, a disclaimer, or stage labels", async ({
  page,
}) => {
  await mockWorkspace(page, { reasoningSummaries: true });
  await page.goto(CONVERSATION_URL);
  await dismissOnboarding(page);

  const panel = page.getByTestId("agent-process-panel");
  await panel.locator("summary").click();
  const summary = panel.locator(SUMMARY);

  for (const removed of [
    "AI가 설명한 접근 방식",
    "AI가 직접 작성한 설명이며",
    "자료를 찾은 방식",
    "답변을 구성한 방식",
  ]) {
    await expect(summary).not.toContainText(removed);
  }
  // The hidden name is the assistive replacement for the divider, so it must
  // exist in the accessibility tree while staying out of the visible layout.
  const hiddenName = summary.getByRole("heading", {
    name: chat.reasoningSummary.label,
  });
  await expect(hiddenName).toBeAttached();
  // Measured rather than asserted on a class name: the point is that the name
  // reaches the accessibility tree without taking visible space.
  const box = await hiddenName.boundingBox();
  expect(box?.height ?? 0).toBeLessThanOrEqual(1);
});

test("reveals a clamped Korean explanation on demand", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await mockWorkspace(page, { reasoningSummaries: "long" });
  await page.goto(CONVERSATION_URL);
  await dismissOnboarding(page);

  const panel = page.getByTestId("agent-process-panel");
  await panel.locator("summary").click();
  const quote = panel.locator(SUMMARY).locator("blockquote").first();
  const expander = panel
    .locator(SUMMARY)
    .getByRole("button", { name: chat.reasoningSummary.expand });

  // The control is offered because the text is actually clipped, not because
  // it passed a character count.
  await expect(expander).toBeVisible();
  const clamped = await quote.evaluate(
    (node) => node.scrollHeight > node.clientHeight + 1,
  );
  expect(clamped).toBe(true);

  await expander.click();
  await expect(
    panel
      .locator(SUMMARY)
      .getByRole("button", { name: chat.reasoningSummary.collapse }),
  ).toBeVisible();
  const revealed = await quote.evaluate(
    (node) => node.scrollHeight <= node.clientHeight + 1,
  );
  expect(revealed).toBe(true);
  await expect(quote).toContainText("마지막 문장이 여기에 있습니다.");
  await expectNoHorizontalOverflow(page, "expanded reasoning summary @ 390px");
});

test("keeps explanation text out of the copied answer", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await mockWorkspace(page, { reasoningSummaries: "long" });
  await page.goto(CONVERSATION_URL);
  await dismissOnboarding(page);

  await page.getByRole("button", { name: chat.copyAction }).first().click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());

  expect(copied).not.toContain(LONG_KOREAN_SUMMARY);
  expect(copied).not.toContain("마지막 문장이 여기에 있습니다.");
  expect(copied.length).toBeGreaterThan(0);
});

test("renders no explanation section for an empty completed list", async ({
  page,
}) => {
  await mockWorkspace(page);
  await page.goto(CONVERSATION_URL);
  await dismissOnboarding(page);

  const panel = page.getByTestId("agent-process-panel");
  await panel.locator("summary").click();
  await expect(panel.locator(SUMMARY)).toHaveCount(0);
});

test("carries the live process message while the run works", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const row = await startRunWithPlanningSummary(page);

  await expect(row).toContainText("관련 조항만");
  // Two lines, and clipped rather than allowed to grow the collapsed row.
  const geometry = await row.evaluate((node) => ({
    height: Math.round(node.getBoundingClientRect().height),
    clipped: node.scrollHeight > node.clientHeight + 1,
  }));
  expect(geometry.height).toBeLessThanOrEqual(44);
  expect(geometry.clipped).toBe(true);
  await expectNoHorizontalOverflow(page, "live process row @ 390px");
});

test("shimmers the live row while working", async ({ page }) => {
  const row = await startRunWithPlanningSummary(page);
  await expect(row).toContainText("관련 조항만");

  /*
   * Asserted on the rendered result, not on the mechanism: at any instant the
   * characters hold a spread of colours, because each one is offset from the
   * one before it. A uniform pulse would satisfy "it animates" and still be
   * the wrong effect.
   */
  await page.waitForTimeout(500);
  const painted = await row.evaluate((node) => {
    const characters = Array.from(
      node.querySelectorAll("span span span"),
    ) as HTMLElement[];
    return {
      count: characters.length,
      distinctColors: new Set(
        characters.slice(0, 30).map((c) => getComputedStyle(c).color),
      ).size,
    };
  });

  expect(painted.count).toBeGreaterThan(10);
  expect(painted.distinctColors).toBeGreaterThan(3);
});

/*
 * Under reduced motion no animated node is mounted at all — the words render as
 * plain text — so there is no paused frame to get wrong.
 */
test("leaves the live row as plain text under reduced motion", async ({
  browser,
}) => {
  const context = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const row = await startRunWithPlanningSummary(page);
  await expect(row).toContainText("관련 조항만");

  const painted = await row.evaluate((node) => ({
    animatedNodes: node.querySelectorAll("span span span").length,
    color: getComputedStyle(node).color,
  }));

  expect(painted.animatedNodes).toBe(0);
  // Never transparent: the effect animates `color` between real values, so a
  // still row is legible by construction rather than by withholding paint.
  expect(painted.color).not.toBe("rgba(0, 0, 0, 0)");
  await context.close();
});

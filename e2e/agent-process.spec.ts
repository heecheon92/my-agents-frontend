import { expect, type Locator, test } from "@playwright/test";
import ko from "@/localization/ko.json";
import { expectNoHorizontalOverflow, VIEWPORTS } from "./helpers/layout";
import {
  dismissOnboarding,
  hideDevIndicators,
  mockWorkspace,
} from "./helpers/mock-workspace";

const chat = ko.chat;
const CONVERSATION_URL = "/chat/c-visual";

const staticStates = [
  { state: "completed", terminal: null },
  { state: "failed", terminal: "failed" },
  { state: "cancelled", terminal: "cancelled" },
  { state: "suspended", terminal: "waitingForConfirmation" },
  { state: "needs_evidence", terminal: "needsEvidence" },
  { state: "no_events", terminal: null },
] as const;

async function captureGateB(
  page: import("@playwright/test").Page,
  testInfo: import("@playwright/test").TestInfo,
  name: string,
) {
  await hideDevIndicators(page);
  await dismissOnboarding(page);
  const screenshot = await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: false,
  });
  await testInfo.attach(name, { body: screenshot, contentType: "image/png" });
}

async function captureProcessPanel(
  process: Locator,
  testInfo: import("@playwright/test").TestInfo,
  name: string,
) {
  // Let ordered detail reveals settle so the review frame captures the resting
  // treatment rather than a legitimate mid-transition opacity.
  await process.page().waitForTimeout(250);
  const screenshot = await process.screenshot({
    path: testInfo.outputPath(`${name}-panel.png`),
    // The durable interaction card intentionally overlays the transcript on
    // compact screens. The full-page attachment keeps that real relationship;
    // this isolated crop removes only the overlay so Gate B can inspect the
    // frozen process panel itself.
    style:
      '[data-slot="chat-composer-overlay"] { visibility: hidden !important; }',
  });
  await testInfo.attach(`${name}-panel`, {
    body: screenshot,
    contentType: "image/png",
  });
}

for (const viewport of VIEWPORTS) {
  for (const fixture of staticStates) {
    test(`${fixture.state} process at ${viewport.width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await mockWorkspace(
        page,
        fixture.state === "suspended"
          ? { interaction: "document_selection" }
          : {
              processState: fixture.state,
            },
      );
      await page.goto(CONVERSATION_URL);

      const process = page.getByTestId("agent-process-panel");
      if (fixture.state === "no_events") {
        await expect(process).toHaveCount(0);
      } else {
        await expect(process).toBeVisible();
        if (fixture.state === "completed") {
          await expect(process).not.toHaveAttribute("open", "");
          await expect(process).toContainText(chat.agentTrace.title);
        }
        if (fixture.terminal) {
          await expect(
            process.locator(`[data-terminal="${fixture.terminal}"]`),
          ).toBeVisible();
        }
      }
      if (fixture.state === "suspended") {
        await expect(page.getByLabel(chat.agentComposing)).toHaveCount(0);
        await expect(
          page.locator('[data-slot="interaction-card"]'),
        ).toBeVisible();
      }
      if (fixture.state !== "no_events") {
        await process.scrollIntoViewIfNeeded();
        await captureProcessPanel(
          process,
          testInfo,
          `${fixture.state}-${viewport.width}`,
        );
      }
      if (fixture.state === "suspended") {
        await page.getByTestId("chat-scroll-region").evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        });
      }
      await expectNoHorizontalOverflow(
        page,
        `${fixture.state} process @ ${viewport.width}px`,
      );
      await captureGateB(page, testInfo, `${fixture.state}-${viewport.width}`);
      if (fixture.state === "completed") {
        await process.locator("summary").click();
        await expect(process.getByText("질문 의도 정리")).toBeVisible();
        await captureProcessPanel(
          process,
          testInfo,
          `completed-expanded-${viewport.width}`,
        );
      }
    });
  }

  test(`running process at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await mockWorkspace(page, { empty: true });
    await page.route("**/api/my-agents/conversations", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "c-process-running",
          title: "실행 중인 답변",
          owner_user_id: "u-visual",
        }),
      });
    });
    await page.addInitScript(() => {
      const nativeFetch = window.fetch.bind(window);
      window.fetch = async (...args) => {
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
                  'event: run_started\ndata: {"run_id":"run-process","conversation_id":"c-process-running","status":"running"}\n\n',
                ),
              );
              window.setTimeout(() => {
                controller.enqueue(
                  encoder.encode(
                    'event: retrieval_completed\ndata: {"authorized_context_count":2,"agent_trace":[{"id":"candidate_scouts","event_type":"candidates_retrieved","status":"waiting","title":{"ko":"관련 문서 탐색","en":"Finding relevant documents"},"description":{"ko":"질문과 관련된 문서를 확인하고 있습니다.","en":"Checking documents related to the question."},"evidence":{}}]}\n\n',
                  ),
                );
              }, 1500);
            },
          }),
          { headers: { "Content-Type": "text/event-stream" }, status: 200 },
        );
      };
    });

    await page.goto("/chat");
    const composer = page.getByPlaceholder(chat.composerPlaceholder);
    await composer.fill("계약서에서 갱신 조건을 찾아 주세요");
    await composer.press("Enter");

    const process = page.getByTestId("agent-process-panel");
    await expect(process).toBeVisible();
    await expect(process).toContainText(chat.agentTrace.starting);
    await captureProcessPanel(process, testInfo, `starting-${viewport.width}`);
    await captureGateB(page, testInfo, `starting-${viewport.width}`);
    await expect(process.locator('[data-current="true"]')).toContainText(
      chat.agentTrace.stages.searchingKnowledge,
    );
    await captureProcessPanel(process, testInfo, `running-${viewport.width}`);
    await expectNoHorizontalOverflow(
      page,
      `running process @ ${viewport.width}px`,
    );
    await captureGateB(page, testInfo, `running-${viewport.width}`);
    if (viewport.width === 390) {
      await page.emulateMedia({ reducedMotion: "reduce" });
      const currentDot = process
        .locator('[data-current="true"]')
        .locator('[aria-hidden="true"]');
      await expect
        .poll(() =>
          currentDot.evaluate(
            (element) => window.getComputedStyle(element).animationName,
          ),
        )
        .toBe("none");
      await captureGateB(page, testInfo, "running-reduced-motion-390");
    }
  });
}

test("copies the quiet answer handle without rendering the raw id", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await mockWorkspace(page);
  await page.goto(CONVERSATION_URL);

  await expect(page.getByText("run-visual", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: chat.copyRunIdAction, exact: true })
    .click();
  await expect(page.getByText(chat.runIdCopiedAnnouncement)).toBeAttached();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("run-visual");
});

test("reveals the answer handle only when clipboard access fails", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });
  await mockWorkspace(page);
  await page.goto(CONVERSATION_URL);

  await expect(page.getByText("run-visual", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: chat.copyRunIdAction, exact: true })
    .click();
  await expect(page.getByText(chat.runIdCopyFailedAnnouncement)).toBeAttached();
  await expect(page.getByText("run-visual", { exact: true })).toBeVisible();
});

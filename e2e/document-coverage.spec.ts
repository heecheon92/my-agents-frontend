import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";
import { expectNoHorizontalOverflow } from "./helpers/layout";
import { dismissOnboarding, mockWorkspace } from "./helpers/mock-workspace";

const chat = ko.chat;
const conversationUrl = "/chat/c-visual";

for (const fixture of [
  { mode: "complete" as const, width: 1280 },
  { mode: "partial" as const, width: 390 },
]) {
  test(`renders ${fixture.mode} document coverage without changing the source count`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: fixture.width, height: 900 });
    await mockWorkspace(page, {
      attribution: "supported",
      documentCoverage: fixture.mode,
    });
    await page.goto(conversationUrl);
    await dismissOnboarding(page);

    const sourceDisclosure = page.locator("details").filter({
      hasText: chat.consultedSummary.replace("{count}", "2"),
    });
    await expect(sourceDisclosure).toBeVisible();
    await expect(sourceDisclosure.locator("summary")).toHaveText(
      chat.consultedSummary.replace("{count}", "2"),
    );
    await sourceDisclosure.locator("summary").click();

    const coverage = sourceDisclosure.locator(
      '[data-slot="document-coverage"]',
    );
    await expect(coverage).toHaveAttribute("data-coverage-mode", fixture.mode);
    await expect(coverage).toHaveText(
      fixture.mode === "complete"
        ? "문서 전체를 읽고 답했습니다 · 2026 파트너 계약서"
        : "문서 일부만 읽고 답했습니다 · 2026 파트너 계약서 · 0–12000자 / 전체 32000자",
    );
    await expect(
      sourceDisclosure.locator('[data-slot="supported-source-badge"]'),
    ).toHaveCount(1);
    await expectNoHorizontalOverflow(
      page,
      `${fixture.mode} document coverage @ ${fixture.width}px`,
    );
  });
}

test("keeps ordinary answers free of a coverage row", async ({ page }) => {
  await mockWorkspace(page, { attribution: "supported" });
  await page.goto(conversationUrl);
  await dismissOnboarding(page);

  const sourceDisclosure = page.locator("details").filter({
    hasText: chat.consultedSummary.replace("{count}", "2"),
  });
  await sourceDisclosure.locator("summary").click();
  await expect(
    sourceDisclosure.locator('[data-slot="document-coverage"]'),
  ).toHaveCount(0);
});

test("does not revive the previous run's coverage for a new ordinary answer", async ({
  page,
}) => {
  await mockWorkspace(page, {
    attribution: "supported",
    documentCoverage: "complete",
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
      const completed = {
        run_id: "run-ordinary",
        conversation_id: "c-visual",
        reply: "일반 답변입니다.",
        route: { label: "general_assistant", explanation: "test" },
        handled_by: "personal_assistant_graph",
        citations: [],
        consulted_sources: [],
        document_coverage: null,
      };
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'event: run_started\ndata: {"run_id":"run-ordinary","conversation_id":"c-visual","status":"running"}\n\n',
              ),
            );
            controller.enqueue(
              encoder.encode(
                `event: run_completed\ndata: ${JSON.stringify(completed)}\n\n`,
              ),
            );
            controller.close();
          },
        }),
        { headers: { "Content-Type": "text/event-stream" }, status: 200 },
      );
    };
  });
  await page.goto(conversationUrl);
  await dismissOnboarding(page);
  await expect(page.locator('[data-slot="document-coverage"]')).toHaveCount(1);

  const composer = page.getByPlaceholder(chat.composerPlaceholder);
  await composer.fill("일반 질문입니다");
  await composer.press("Enter");

  await expect(page.locator('[data-slot="document-coverage"]')).toHaveCount(0);
});

import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";
import { dismissOnboarding, mockWorkspace } from "./helpers/mock-workspace";

const sources = [
  "flowchart TD\nA[질문] --> B[답변]",
  "sequenceDiagram\n사용자->>서버: 질문\n서버-->>사용자: 답변",
  "stateDiagram-v2\n[*] --> Ready\nReady --> Done",
  "erDiagram\nUSER ||--o{ MESSAGE : writes",
  "classDiagram\nAnimal <|-- Duck",
];

test("renders five families, preserves source, handles failure and theme changes", async ({
  page,
}) => {
  await mockWorkspace(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const started = Date.now();
  const content =
    sources.map((source) => `\n\n\`\`\`mermaid\n${source}\n\`\`\``).join("") +
    "\n\n```mermaid\nflowchart TD\nA --> [broken\n```\n\n```mermaid\nflowchart TD\nclick A href 'https://evil.invalid'\n```\n\nSurrounding answer";
  await page.route(
    "**/api/my-agents/conversations/c-visual/messages",
    (route) =>
      route.fulfill({
        json: [
          {
            id: "m-assistant",
            conversation_id: "c-visual",
            role: "assistant",
            content,
          },
        ],
      }),
  );
  await page.goto("/chat/c-visual");
  await expect(
    page.getByRole("button", { name: ko.onboarding.notNow }),
  ).toBeVisible();
  await dismissOnboarding(page);
  const diagrams = page.getByTestId("mermaid-diagram");
  await expect(diagrams).toHaveCount(7);
  await expect(diagrams.locator("img")).toHaveCount(5, { timeout: 20000 });
  console.log(
    `Mermaid cold navigation to five diagrams: ${Date.now() - started} ms`,
  );
  await expect(diagrams.locator("output")).toHaveCount(2);
  await expect(page.getByText("Surrounding answer")).toBeVisible();
  expect(
    await diagrams
      .locator("img")
      .evaluateAll((images) =>
        images.every((img) => (img as HTMLImageElement).naturalWidth > 0),
      ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/mermaid-light.png" });
  await diagrams.first().locator("summary").focus();
  await diagrams.first().locator("summary").press("Enter");
  await expect(diagrams.first().locator("code")).toHaveText(sources[0]);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .getByRole("button", { name: ko.chat.copyAction, exact: true })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    content,
  );
  await page.emulateMedia({ reducedMotion: "reduce", media: "print" });
  await expect(diagrams.first().locator("img")).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await expect(diagrams.first()).toHaveAttribute("data-theme", "dark");
  await expect(diagrams.locator("img")).toHaveCount(5);
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/mermaid-dark-${width}.png` });
  }
  await page.screenshot({
    path: "test-results/mermaid-dark.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByTestId("mermaid-diagram").locator("img")).toHaveCount(
    5,
  );
  expect(errors).toEqual([]);
});

test("streaming keeps a complete fence as source until the run completes", async ({
  page,
}) => {
  await mockWorkspace(page);
  const content = "```mermaid\nflowchart TD\nA-->B\n```";
  await page.addInitScript((reply) => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const target = String(args[0] instanceof Request ? args[0].url : args[0]);
      if (!target.includes("/runs/stream")) return nativeFetch(...args);
      return new Response(
        new ReadableStream({
          start(controller) {
            const send = (event: string, data: unknown) =>
              controller.enqueue(
                new TextEncoder().encode(
                  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
                ),
              );
            send("run_started", {
              run_id: "r-diagram",
              conversation_id: "c-visual",
              status: "running",
            });
            send("answer_delta", { delta: reply, sequence: 1 });
            Object.assign(window, {
              finishDiagram: () => {
                send("run_completed", {
                  run_id: "r-diagram",
                  conversation_id: "c-visual",
                  reply,
                  route: { label: "general_assistant", explanation: "test" },
                  handled_by: "personal_assistant_graph",
                });
                controller.close();
              },
            });
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      );
    };
  }, content);
  await page.goto("/chat/c-visual");
  await page
    .getByPlaceholder(ko.chat.composerPlaceholder)
    .fill("다이어그램으로 설명해줘");
  await page.getByPlaceholder(ko.chat.composerPlaceholder).press("Enter");
  await expect(page.locator("code.language-mermaid")).toBeVisible();
  await expect(page.getByTestId("mermaid-diagram")).toHaveCount(0);
  // Persist the same finished answer for the refetch that follows completion.
  await page.route(
    "**/api/my-agents/conversations/c-visual/messages",
    (route) =>
      route.fulfill({
        json: [
          {
            id: "m-assistant",
            conversation_id: "c-visual",
            role: "assistant",
            content,
          },
        ],
      }),
  );
  await page.evaluate(() =>
    (window as unknown as { finishDiagram: () => void }).finishDiagram(),
  );
  await expect(page.getByTestId("mermaid-diagram").locator("img")).toHaveCount(
    1,
  );
});

test("ordinary answers do not load the diagram library", async ({ page }) => {
  await mockWorkspace(page);
  const requests: string[] = [];
  const scripts: Promise<string>[] = [];
  page.on("response", (response) => {
    if (
      response.url().includes("/_next/static/") &&
      response.url().endsWith(".js")
    )
      scripts.push(response.text().catch(() => ""));
  });
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/chat/c-visual");
  await expect(page.getByTestId("chat-scroll-region")).toBeVisible();
  await expect(page.getByTestId("mermaid-diagram")).toHaveCount(0);
  expect(requests.filter((url) => /node_modules.*mermaid/i.test(url))).toEqual(
    [],
  );
  expect(
    (await Promise.all(scripts)).some((body) => body.includes("mermaidAPI")),
  ).toBe(false);
});

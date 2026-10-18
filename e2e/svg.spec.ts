import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";
import { dismissOnboarding, mockWorkspace } from "./helpers/mock-workspace";

const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 240">
<title>질문에서 답변까지</title><desc>문서를 검색해 답변을 만드는 과정</desc>
<defs>
<linearGradient id="card"><stop stop-color="#eff6ff"/><stop offset="1" stop-color="#ccfbf1"/></linearGradient>
<marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10" fill="#0f766e"/></marker>
</defs>
<rect x="20" y="60" width="170" height="110" rx="16" fill="url(#card)" stroke="#0f766e"/>
<rect x="235" y="60" width="170" height="110" rx="16" fill="url(#card)" stroke="#0f766e"/>
<rect x="450" y="60" width="170" height="110" rx="16" fill="url(#card)" stroke="#0f766e"/>
<g style="font-family:sans-serif;font-size:24px;text-anchor:middle;fill:#14213d"><text x="105" y="125">질문</text><text x="320" y="125">문서 검색</text><text x="535" y="125">답변</text></g>
<g stroke="#0f766e" stroke-width="3" marker-end="url(#arrow)"><line x1="192" y1="115" x2="225" y2="115"/><line x1="407" y1="115" x2="440" y2="115"/></g>
</svg>`;
const fence = (source: string) => `\n\n\`\`\`svg\n${source}\n\`\`\`\n\n`;

async function answer(page: import("@playwright/test").Page, content: string) {
  await mockWorkspace(page);
  await page.route(
    "**/api/my-agents/conversations/c-visual/messages",
    (route) =>
      route.fulfill({
        json: [
          {
            id: "m-svg",
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
}

test("renders static SVG, preserves source/copy, and fits mobile and dark mode", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const content = `과정은 다음과 같습니다.${fence(SAMPLE)}끝입니다.`;
  await answer(page, content);
  const preview = page.getByTestId("svg-diagram");
  const image = preview.locator("img");
  await expect(image).toHaveAttribute("alt", "질문에서 답변까지");
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(640);
  expect(await preview.locator("svg, iframe, object").count()).toBe(0);
  await preview.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(preview.locator("code")).toHaveText(SAMPLE);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .getByRole("button", { name: ko.chat.copyAction, exact: true })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    content,
  );
  await preview.locator("summary").click();
  await preview.screenshot({ path: "test-results/svg-desktop.png" });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(image).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await image.evaluate(
        (img) => getComputedStyle(img.parentElement as Element).backgroundColor,
      ),
    ).toBe("rgb(255, 255, 255)");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const canvas = preview.locator("section");
  await canvas.focus();
  await canvas.press("ArrowRight");
  await expect
    .poll(() => canvas.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  expect(
    await image.evaluate((element) => element.getBoundingClientRect().width),
  ).toBeGreaterThanOrEqual(480);
  await preview.screenshot({ path: "test-results/svg-mobile-dark.png" });
  await page.reload();
  await expect(image).toBeVisible();
  expect(errors).toEqual([]);
});

test("rebuilds namespace-less SVG and derives a viewBox from explicit dimensions", async ({
  page,
}) => {
  await answer(
    page,
    fence(
      '<svg width="240" height="100"><title>Simple image</title><circle cx="50" cy="50" r="35" fill="teal"/><text x="100" y="55">Hello</text></svg>',
    ),
  );
  const image = page.getByTestId("svg-diagram").locator("img");
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(240);
  const serialized = await image.evaluate(async (img: HTMLImageElement) =>
    (await fetch(img.src)).text(),
  );
  expect(serialized).toContain('xmlns="http://www.w3.org/2000/svg"');
  expect(serialized).toContain('viewBox="0 0 240 100"');
});

test("rejects unsafe, malformed, oversized, recursive, and unsupported SVG without requests", async ({
  page,
}) => {
  const wrap = (inner: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${inner}</svg>`;
  const rejected = [
    wrap("<script>window.svgExecuted = true</script>"),
    '<svg viewBox="0 0 100 100" onload="window.svgExecuted = true"/>',
    wrap(
      '<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">HTML</div></foreignObject>',
    ),
    wrap('<image href="https://svg-attack.invalid/image"/>'),
    wrap('<a href="https://svg-attack.invalid/link"><text>Link</text></a>'),
    wrap('<style>@import "https://svg-attack.invalid/style";</style>'),
    wrap('<rect fill="url(https://svg-attack.invalid/paint)"/>'),
    wrap('<rect style="fill:u&#114;l(https://svg-attack.invalid/paint)"/>'),
    wrap('<rect style="fill:u\\72l(https://svg-attack.invalid/paint)"/>'),
    wrap('<animate attributeName="x" dur="1s" repeatCount="indefinite"/>'),
    wrap('<use href="#loop" id="loop"/>'),
    wrap(
      '<defs><marker id="loop"><path d="M0 0 L1 1" marker-end="url(#loop)"/></marker></defs>',
    ),
    wrap('<rect fill="url(#missing)"/>'),
    wrap('<rect id="same"/><rect id="same"/>'),
    '<svg viewBox="0 0 1e999 2"/>',
    '<svg width="1" height="12001"/>',
    '<svg width="100%" height="100%"/>',
    '<svg viewBox="0 0 10 10"><path></svg>',
    wrap('<rect xmlns="http://www.w3.org/1999/xhtml"/>'),
    `<!DOCTYPE svg [<!ENTITY x "boom">]>${wrap("<text>&x;</text>")}`,
    `<?xml-stylesheet href="https://svg-attack.invalid/style"?>${wrap("")}`,
    wrap("<g>".repeat(34) + "</g>".repeat(34)),
    wrap('<rect width="1" height="1"/>'.repeat(1001)),
    wrap(`<text>${"x".repeat(100001)}</text>`),
  ];
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("svg-attack.invalid"))
      requests.push(request.url());
  });
  await answer(page, rejected.map(fence).join(""));
  const previews = page.getByTestId("svg-diagram");
  await expect(previews).toHaveCount(rejected.length);
  await expect(previews.locator("output")).toHaveText(
    rejected.map(() => ko.chat.svg.error),
  );
  await expect(previews.locator("img")).toHaveCount(0);
  await expect(previews.locator("details[open]")).toHaveCount(rejected.length);
  expect(requests).toEqual([]);
  expect(
    await page.evaluate(
      () => (window as unknown as { svgExecuted?: boolean }).svgExecuted,
    ),
  ).toBeUndefined();
});

test("streaming keeps a complete fence as source until the run completes", async ({
  page,
}) => {
  await mockWorkspace(page);
  const content = fence(SAMPLE);
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
              run_id: "r-svg",
              conversation_id: "c-visual",
              status: "running",
            });
            send("answer_delta", { delta: reply, sequence: 1 });
            Object.assign(window, {
              finishSvg: () => {
                send("run_completed", {
                  run_id: "r-svg",
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
  await expect(page.locator("code.language-svg")).toBeVisible();
  await expect(page.getByTestId("svg-diagram")).toHaveCount(0);
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
    (window as unknown as { finishSvg: () => void }).finishSvg(),
  );
  await expect(page.getByTestId("svg-diagram").locator("img")).toHaveCount(1);
});

import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";
import {
  expectChatTranscriptLayoutBounded,
  expectNoHorizontalOverflow,
  expectNoNestedChatScroll,
  VIEWPORTS,
} from "./helpers/layout";

const now = "2026-06-01T00:00:00.000Z";
const user = {
  id: "u-citation-reader",
  email: "reader@example.com",
  nickname: "Citation Reader",
  email_verified_at: now,
  is_guest: false,
};
const conversation = {
  id: "c-citations",
  title: "Compact citations",
  owner_user_id: user.id,
};
const run = {
  run_id: "run-citations",
  conversation_id: conversation.id,
  status: "completed",
  route_label: "research_helper",
  created_at: now,
};
const citation = {
  id: "citation-1",
  document_id: "doc-compact",
  knowledge_base_id: "kb-compact",
  chunk_id: "chunk-compact",
  snippet: "A compact citation should not dominate the assistant answer.",
  source_page: 3,
  source_filename: "workspace-guide.pdf",
};

async function mockCompactCitationChat(page: import("@playwright/test").Page) {
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
    if (method === "GET" && path === "/knowledge-bases") return json([]);
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
          content: "How should citations behave?",
        },
        {
          id: "m-assistant",
          conversation_id: conversation.id,
          role: "assistant",
          content:
            "Citations stay close to the answer, but details stay folded.",
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
        reply: "Citations stay close to the answer, but details stay folded.",
        route: {
          label: "research_helper",
          explanation: "Use added knowledge.",
        },
        handled_by: "personal_assistant_graph",
        citations: [citation],
      });
    }
    if (
      method === "GET" &&
      path === `/conversations/${conversation.id}/runs/${run.run_id}/events`
    ) {
      return json([
        {
          id: "event-1",
          run_id: run.run_id,
          sequence: 1,
          event_type: "retrieval_completed",
          payload: { documents: 1 },
        },
      ]);
    }

    return json([]);
  });
}

test("assistant citation references stay compact until opened", async ({
  page,
}) => {
  await mockCompactCitationChat(page);
  await page.goto("/chat");

  const footer = page.getByTestId("assistant-message-footer").last();
  await expect(
    page.getByText("Citations stay close to the answer"),
  ).toBeVisible();
  await expect(footer).toBeVisible();
  await expect(
    footer.getByText(ko.chat.citationSummary.replace("{count}", "1")),
  ).toBeVisible();
  await expect(footer.getByText(citation.source_filename)).toBeHidden();
  await expect(footer.getByText(citation.snippet)).toBeHidden();
  await expect(footer.getByText(citation.document_id)).toBeHidden();

  await footer.getByLabel(new RegExp(ko.chat.viewCitationDetails)).click();

  await expect(footer.getByText(citation.source_filename)).toBeVisible();
  await expect(footer.getByText(citation.snippet)).toBeVisible();
  await expect(footer.getByText(citation.document_id)).toBeHidden();

  await footer.getByText(ko.chat.advancedDetails).first().click();
  await expect(footer.getByText(citation.document_id)).toBeVisible();
});

// The measured counterpart to the class-name assertions in
// `tests/chatworkspace-footer.test.ts`. Vitest has no DOM, so this is the only
// place the transcript's bounded-and-internally-scrollable contract is actually
// verified — and the only place it is verified at narrow widths.
for (const viewport of VIEWPORTS) {
  test(`chat transcript stays bounded at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await mockCompactCitationChat(page);
    await page.goto("/chat");

    await expect(page.getByTestId("chat-workspace-panel")).toBeVisible();
    await expectNoHorizontalOverflow(page, `/chat @ ${viewport.width}px`);
    await expectChatTranscriptLayoutBounded(page);
    await expectNoNestedChatScroll(page);
  });
}

test("composer sends on Enter and inserts a newline on Shift+Enter", async ({
  page,
}) => {
  let runCount = 0;
  await page.route("**/api/my-agents/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/my-agents", "");
    const json = (value: unknown) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(value),
      });

    if (request.method() === "POST" && path.includes("/runs")) {
      runCount += 1;
      return json({ ...run, reply: "ok", citations: [] });
    }
    if (request.method() === "GET" && path === "/auth/me") return json(user);
    if (request.method() === "GET" && path === "/conversations") {
      return json([conversation]);
    }
    if (
      request.method() === "GET" &&
      path === `/conversations/${conversation.id}`
    ) {
      return json(conversation);
    }
    if (
      request.method() === "GET" &&
      path === `/conversations/${conversation.id}/messages`
    ) {
      return json([]);
    }
    return json([]);
  });

  await page.goto("/chat");
  const composer = page.getByPlaceholder(ko.chat.composerPlaceholder);
  await expect(composer).toBeVisible();

  // Shift+Enter must not submit.
  await composer.fill("첫 줄");
  await composer.press("Shift+Enter");
  await composer.pressSequentially("둘째 줄");
  expect(await composer.inputValue()).toContain("\n");
  expect(runCount).toBe(0);

  // It also has to have grown rather than scrolling a one-line box.
  const twoLineHeight = await composer.evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  await composer.fill("한 줄");
  const oneLineHeight = await composer.evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  expect(twoLineHeight).toBeGreaterThan(oneLineHeight);

  await composer.press("Enter");
  await expect.poll(() => runCount).toBe(1);
});

test("composer does not submit while an IME composition is active", async ({
  page,
}) => {
  // Korean input commits a syllable with Enter. Submitting on that keystroke
  // would send a half-typed phrase, so the handler checks `isComposing`.
  await mockCompactCitationChat(page);
  await page.goto("/chat");

  const composer = page.getByPlaceholder(ko.chat.composerPlaceholder);
  await composer.fill("한글");

  const submitted = await composer.evaluate((element) => {
    const form = element.closest("form");
    let didSubmit = false;
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      didSubmit = true;
    });
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        // Chromium reports an in-flight IME commit this way.
        isComposing: true,
      } as KeyboardEventInit),
    );
    return didSubmit;
  });

  expect(submitted).toBe(false);
});

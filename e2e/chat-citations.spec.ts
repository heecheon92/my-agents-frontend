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
  await page.goto(`/chat/${conversation.id}`);

  const footer = page.getByTestId("assistant-message-footer").last();
  await expect(
    page.getByText("Citations stay close to the answer"),
  ).toBeVisible();
  await expect(footer).toBeVisible();
  await expect(
    footer.getByText(ko.chat.citationSummary.replace("{count}", "1")),
  ).toBeVisible();
  await expect(footer.getByText(citation.source_filename)).toBeHidden();
  await expect(footer.getByText(citation.document_id)).toHaveCount(0);

  await footer.getByLabel(new RegExp(ko.chat.viewCitationDetails)).click();

  // Opened, the panel names the document and nothing else.
  await expect(footer.getByText(citation.source_filename)).toBeVisible();

  /*
   * Chunk-level detail is gone from the panel entirely, not merely collapsed.
   * The snippet duplicated the answer while adding nothing actionable, and
   * `document_id`/`chunk_id` are internal handles that meant nothing to a
   * reader — they were most of what the old 상세 정보 disclosure held, so it went
   * with them. `toHaveCount(0)` rather than `toBeHidden`: the assertion is that
   * these never reach the DOM, which `toBeHidden` would also accept for markup
   * that is merely collapsed.
   */
  await expect(footer.getByText(citation.snippet)).toHaveCount(0);
  await expect(footer.getByText(citation.document_id)).toHaveCount(0);
  await expect(footer.getByText(citation.chunk_id)).toHaveCount(0);
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
    await page.goto(`/chat/${conversation.id}`);

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

  await page.goto(`/chat/${conversation.id}`);
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
  await page.goto(`/chat/${conversation.id}`);

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

test("a first message from bare /chat creates exactly one conversation", async ({
  page,
}) => {
  // The first-run path: the composer is live with no conversation open, and
  // sending creates one before the run. Previously the input was disabled
  // until the user found a "새 대화" button, which is what confused newcomers.
  const createdId = "c-autocreated";
  const createCalls: unknown[] = [];
  let runCount = 0;

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

    if (method === "POST" && path === "/conversations") {
      createCalls.push(request.postDataJSON());
      return json({
        id: createdId,
        title: "배포 절차를 알려주세요",
        owner_user_id: user.id,
      });
    }
    if (method === "POST" && path.includes("/runs")) {
      runCount += 1;
      return json({
        ...run,
        conversation_id: createdId,
        reply: "ok",
        citations: [],
      });
    }
    if (method === "GET" && path === "/auth/me") return json(user);
    if (method === "GET" && path === "/conversations") return json([]);
    if (method === "GET" && path === `/conversations/${createdId}`) {
      return json({
        id: createdId,
        title: "배포 절차를 알려주세요",
        owner_user_id: user.id,
      });
    }
    return json([]);
  });

  await page.goto("/chat");

  // No conversation, and the composer is still usable.
  const composer = page.getByPlaceholder(ko.chat.composerPlaceholder);
  await expect(composer).toBeEnabled();
  await expect(page.getByText(ko.chat.newChatGreeting)).toBeVisible();

  await composer.fill("배포 절차를 알려주세요");
  await composer.press("Enter");

  await expect(page).toHaveURL(new RegExp(`/chat/${createdId}$`));
  await expect.poll(() => runCount).toBe(1);
  expect(createCalls).toHaveLength(1);
  // The conversation is named after the message, not the clock.
  expect(createCalls[0]).toMatchObject({ title: "배포 절차를 알려주세요" });
});

test("double-submitting a first message still creates one conversation", async ({
  page,
}) => {
  // `createConversation.isPending` is React state and lands a tick late, so the
  // guard is a ref holding the in-flight promise. Two Enters in quick
  // succession must not open two conversations.
  const createdId = "c-once";
  let createCount = 0;

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

    if (method === "POST" && path === "/conversations") {
      createCount += 1;
      // Slow enough that a second submit lands while the first is in flight.
      await new Promise((resolve) => setTimeout(resolve, 300));
      return json({ id: createdId, title: "질문", owner_user_id: user.id });
    }
    if (method === "POST" && path.includes("/runs")) {
      return json({
        ...run,
        conversation_id: createdId,
        reply: "ok",
        citations: [],
      });
    }
    if (method === "GET" && path === "/auth/me") return json(user);
    if (method === "GET" && path === "/conversations") return json([]);
    if (method === "GET" && path === `/conversations/${createdId}`) {
      return json({ id: createdId, title: "질문", owner_user_id: user.id });
    }
    return json([]);
  });

  await page.goto("/chat");
  const composer = page.getByPlaceholder(ko.chat.composerPlaceholder);
  await composer.fill("질문");

  // Two submits in ONE tick. Pressing Enter twice does not reproduce this:
  // the first handler clears the draft synchronously and React re-renders
  // before the second keypress, so the second submit early-returns on the
  // empty draft and the guard is never reached. Submitting twice from the same
  // tick keeps the original closure — draft still populated — which is exactly
  // the race `creatingConversationRef` exists for.
  await composer.evaluate((element) => {
    const form = (element as HTMLTextAreaElement).closest("form");
    form?.requestSubmit();
    form?.requestSubmit();
  });

  await expect(page).toHaveURL(new RegExp(`/chat/${createdId}$`));
  expect(createCount).toBe(1);
});

test("a deep-linked conversation is marked current in the sidebar history", async ({
  page,
}) => {
  await mockCompactCitationChat(page);
  await page.goto(`/chat/${conversation.id}`);

  // The history lives in the app shell sidebar now, and its rows are links.
  const activeRow = page.getByRole("link", {
    name: new RegExp(conversation.title),
  });
  await expect(activeRow).toHaveAttribute("aria-current", "page");
  await expect(activeRow).toHaveAttribute("href", `/chat/${conversation.id}`);
});

test("conversation history is reachable on mobile through the shell sidebar", async ({
  page,
}) => {
  // The route-local conversation sheet was removed; the shell sidebar is itself
  // a Sheet below 768px, so its trigger is now the only browser affordance.
  // The history group hides on the collapsed *desktop* rail, and that hide must
  // not leak into the mobile sheet.
  await page.setViewportSize({ width: 390, height: 844 });
  await mockCompactCitationChat(page);
  await page.goto(`/chat/${conversation.id}`);

  // This user is not a guest, so the new-user tour prompts and would otherwise
  // sit over the sidebar trigger.
  await page.getByRole("button", { name: ko.onboarding.notNow }).click();

  const historyLink = page.getByRole("link", {
    name: new RegExp(conversation.title),
  });
  await expect(historyLink).toBeHidden();

  await page.getByRole("button", { name: ko.service.toggleSidebar }).click();
  await expect(historyLink).toBeVisible();
  await expect(
    page.getByRole("link", { name: ko.chat.newButton }).first(),
  ).toBeVisible();
});

test("copies an assistant answer to the clipboard", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await mockCompactCitationChat(page);
  await page.goto(`/chat/${conversation.id}`);

  const footer = page.getByTestId("assistant-message-footer").last();
  await footer.getByRole("button", { name: ko.chat.copyAction }).click();

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe(
    "Citations stay close to the answer, but details stay folded.",
  );

  // The result is announced rather than only shown as an icon swap.
  await expect(page.getByText(ko.chat.copiedAnnouncement)).toBeAttached();
});

test("copy is offered on older answers, not just the latest", async ({
  page,
}) => {
  // Citations and the activity trail are latest-only because the backend keeps
  // them per run. Copy is not — an older answer is still worth copying.
  await mockCompactCitationChat(page);
  await page.goto(`/chat/${conversation.id}`);

  const copyButtons = page.getByRole("button", { name: ko.chat.copyAction });
  await expect(copyButtons).toHaveCount(1);
  await expect(copyButtons.first()).toBeEnabled();
});

test("a new chat stays visible while the first answer streams", async ({
  page,
}) => {
  // Regression: auto-create used to `router.push` to `/chat/<id>`, which
  // crosses a dynamic segment boundary and makes Next remount the page. That
  // tore down ChatWorkspace mid-run — the optimistic user bubble, `isStreaming`
  // and the streamed reply all went with it, while the run loop kept writing to
  // an unmounted tree. The user saw an empty transcript until the answer
  // landed, with no indication anything was happening.
  const createdId = "c-streaming";
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

    if (method === "POST" && path === "/conversations") {
      return json({ id: createdId, title: "질문", owner_user_id: user.id });
    }
    if (method === "POST" && path.endsWith("/runs/stream")) {
      // Held open so the in-flight UI is observable rather than raced past.
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: 'event: run_started\ndata: {"run_id":"run-1"}\n\n',
      });
    }
    if (method === "GET" && path === "/auth/me") return json(user);
    if (method === "GET" && path === "/conversations") return json([]);
    if (method === "GET" && path === `/conversations/${createdId}`) {
      return json({ id: createdId, title: "질문", owner_user_id: user.id });
    }
    return json([]);
  });

  await page.goto("/chat");
  const composer = page.getByPlaceholder(ko.chat.composerPlaceholder);
  await composer.fill("배포 절차를 알려 주세요");
  await composer.press("Enter");

  const bubble = page.getByText("배포 절차를 알려 주세요");
  const generating = page.getByLabel(ko.chat.agentComposing);
  await expect(bubble).toBeVisible();
  await expect(generating).toBeVisible();

  // The URL updates without a route transition, so both must survive it.
  await expect(page).toHaveURL(new RegExp(`/chat/${createdId}$`));
  await expect(bubble).toBeVisible();
  await expect(generating).toBeVisible();
});

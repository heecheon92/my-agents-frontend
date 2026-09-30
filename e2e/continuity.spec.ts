import { expect, type Page, test } from "@playwright/test";
import ko from "@/localization/ko.json";
import {
  dismissOnboarding,
  mockAttachmentSelectionInteraction,
  mockWorkspace,
} from "./helpers/mock-workspace";

const chat = ko.chat;
const account = ko.settings.account;
const CONVERSATION_URL = "/chat/c-visual";

test.describe("attachment_selection interaction", () => {
  test("answers with the chosen files, at most three, over the V2 contract", async ({
    page,
  }) => {
    await mockWorkspace(page, { interaction: "attachment_selection" });
    let resumeBody: unknown;
    await page.route("**/api/my-agents/**/resume/stream", async (route) => {
      resumeBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `event: run_resumed\ndata: ${JSON.stringify({ run_id: "run-waiting", status: "running", interaction_id: mockAttachmentSelectionInteraction.interaction_id, interaction_schema_version: 2, interaction_type: "attachment_selection" })}\n\n`,
      });
    });
    await page.goto(CONVERSATION_URL);

    // Rebuilt from the run list after a cold load, like the document card.
    const card = page.locator(
      '[data-slot="interaction-card"][data-interaction-type="attachment_selection"]',
    );
    await expect(card).toBeVisible();
    await expect(
      card.getByText(chat.attachmentInteractionTitle, { exact: true }).first(),
    ).toBeVisible();
    // Options are the backend's list, rendered as given.
    await expect(card.getByRole("checkbox")).toHaveCount(2);
    await expect(
      card.getByText(chat.attachmentInteractionOriginalExpired),
    ).toBeVisible();

    const submit = card.getByRole("button", {
      name: chat.attachmentInteractionSubmit,
    });
    await expect(submit).toBeDisabled();
    await card.getByRole("checkbox", { name: /q3-forecast\.xlsx/ }).check();
    await submit.click();

    await expect
      .poll(() => resumeBody)
      .toEqual({
        schema_version: 2,
        interaction_id: mockAttachmentSelectionInteraction.interaction_id,
        type: "attachment_selection",
        kind: "select",
        attachment_ids: ["att-1"],
      });
  });

  test("refuses an expired original when the answer must read originals", async ({
    page,
  }) => {
    await mockWorkspace(page, { interaction: "attachment_selection" });
    await page.goto(CONVERSATION_URL);
    const card = page.locator('[data-slot="interaction-card"]');
    await expect(
      card.getByRole("checkbox", { name: /old-notes\.csv/ }),
    ).toBeDisabled();
    await expect(
      card.getByRole("checkbox", { name: /q3-forecast\.xlsx/ }),
    ).toBeEnabled();
    await expect(
      card.getByText(chat.attachmentInteractionOriginalExpiredHelper),
    ).toBeVisible();
  });

  test("allows every option in notes access and tells same-named files apart", async ({
    page,
  }) => {
    await mockWorkspace(page, { interaction: "attachment_selection_notes" });
    let resumeBody: unknown;
    await page.route("**/api/my-agents/**/resume/stream", async (route) => {
      resumeBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `event: run_resumed\ndata: ${JSON.stringify({ run_id: "run-waiting", status: "running", interaction_id: mockAttachmentSelectionInteraction.interaction_id, interaction_schema_version: 2, interaction_type: "attachment_selection" })}\n\n`,
      });
    });
    await page.goto(CONVERSATION_URL);
    const card = page.locator('[data-slot="interaction-card"]');
    await expect(
      card.locator('[data-slot="attachment-interaction-notes-access"]'),
    ).toHaveText(chat.attachmentInteractionNotesAccess);
    // The expired original is still choosable: notes answer from retention.
    const expired = card.getByRole("checkbox", { name: /old-notes\.csv/ });
    await expect(expired).toBeEnabled();
    // Two report.pdf rows, each carrying its own upload time.
    const twins = card.getByRole("checkbox", { name: /report\.pdf/ });
    await expect(twins).toHaveCount(2);
    const firstTwin = await twins
      .nth(0)
      .evaluate((input) => input.closest("label")?.textContent ?? "");
    const secondTwin = await twins
      .nth(1)
      .evaluate((input) => input.closest("label")?.textContent ?? "");
    expect(firstTwin).not.toBe(secondTwin);
    await expect(
      card
        .getByText(
          chat.attachmentInteractionAttachedAt.split("{time}")[0].trim() ||
            /첨부/,
        )
        .first(),
    ).toBeVisible();

    await expired.check();
    await twins.nth(1).check();
    await card
      .getByRole("button", { name: chat.attachmentInteractionSubmit })
      .click();
    await expect
      .poll(() => (resumeBody as { attachment_ids?: string[] })?.attachment_ids)
      .toEqual(["att-old", "att-report-2"]);
  });

  test("keeps Cancel reachable and the composer blocked while it waits", async ({
    page,
  }) => {
    await mockWorkspace(page, { interaction: "attachment_selection" });
    await page.goto(CONVERSATION_URL);
    const card = page.locator('[data-slot="interaction-card"]');
    await expect(
      card.getByRole("button", { name: chat.interactionCancel }),
    ).toBeEnabled();
    // A suspended run blocks new runs but produces nothing: no stop or
    // send-now control, and the composer reports the conversation as busy.
    await expect(page.getByLabel(chat.agentComposing)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: chat.sendNow, exact: true }),
    ).toHaveCount(0);
    await expect(page.getByPlaceholder(chat.composerPlaceholder)).toHaveCount(
      0,
    );
  });
});

test.describe("summarization model settings", () => {
  test("marks the served recommendation and warns when off it", async ({
    page,
  }) => {
    await mockWorkspace(page, { summarizationModels: true });
    await page.goto("/settings/account");
    const card = page.locator('[data-slot="summarization-model-settings"]');
    await expect(
      card.getByRole("heading", { name: account.summarizationTitle }),
    ).toBeVisible();
    // Only the served catalog, plus the reset option.
    await expect(card.getByRole("radio")).toHaveCount(4);
    const badge = card.locator('[data-slot="model-recommended-badge"]');
    await expect(badge).toHaveCount(1);
    await expect(badge).toHaveText(account.summarizationRecommendedBadge);
    await expect(
      card.getByRole("radio", { name: "GPT-6 Luna", exact: false }).nth(1),
    ).toBeVisible();
    await expect(
      card.locator('[data-slot="summarization-recommendation"]'),
    ).toHaveText(account.summarizationRecommendation);

    const patch = page.waitForRequest(
      (request) =>
        request.method() === "PATCH" &&
        request.url().endsWith("/summarization/preferences"),
    );
    await card.getByRole("radio", { name: "GPT-6.1 Sol" }).click();
    expect((await patch).postDataJSON()).toEqual({
      summarization_model: "gpt-6.1-sol",
    });
    await expect(
      card.locator('[data-slot="summarization-recommendation"]'),
    ).toHaveText(account.summarizationOffRecommendation);
  });

  test("locks the choice for a guest", async ({ page }) => {
    await mockWorkspace(page, { summarizationModels: true, guest: true });
    await page.goto("/settings/account");
    const card = page.locator('[data-slot="summarization-model-settings"]');
    await expect(
      card.getByRole("radio", { name: "GPT-6.1 Sol" }),
    ).toBeDisabled();
    await expect(
      card.getByText(account.summarizationLockedGuest),
    ).toBeVisible();
  });

  test("says the server offers no choice when the endpoint is absent", async ({
    page,
  }) => {
    await mockWorkspace(page);
    await page.goto("/settings/account");
    await expect(
      page
        .locator('[data-slot="summarization-model-settings"]')
        .getByText(account.summarizationUnavailable),
    ).toBeVisible();
  });
});

test.describe("attachments on user messages", () => {
  test("shows the files a message was sent with, lapsed ones marked", async ({
    page,
  }) => {
    await mockWorkspace(page, { messageAttachments: true });
    await page.goto(CONVERSATION_URL);
    const list = page.locator('[data-slot="message-attachments"]');
    await expect(list.getByText("q3-forecast.xlsx")).toBeVisible();
    await expect(list.getByText("old-notes.csv")).toBeVisible();
    await expect(list.getByText(chat.attachments.statusExpired)).toBeVisible();
  });

  test("renders nothing extra for a legacy message", async ({ page }) => {
    await mockWorkspace(page);
    await page.goto(CONVERSATION_URL);
    await expect(
      page.getByText("이 계약서의 갱신 리스크를 알려 주세요."),
    ).toBeVisible();
    await expect(page.locator('[data-slot="message-attachments"]')).toHaveCount(
      0,
    );
  });
});

test.describe("the optimistic message carries its files", () => {
  for (const source of ["library", "fresh upload"] as const) {
    test(`shows a ${source} file with the question the moment it is sent`, async ({
      page,
    }) => {
      // The stream is held open, so nothing stored has come back yet: the
      // chip can only come from the optimistic copy of the question.
      await mockWorkspace(page, { documentWorkspace: "enabled" });
      let release: () => void = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/api/my-agents/**/runs/stream", async (route) => {
        await held;
        await route.fulfill({ status: 503, body: "" }).catch(() => {});
      });
      await page.goto(CONVERSATION_URL);
      await dismissOnboarding(page);
      if (source === "library") {
        await addLibraryFileToTurn(page);
      } else {
        await page.locator('input[type="file"]').setInputFiles({
          name: "q3-forecast.xlsx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          buffer: Buffer.from("x"),
        });
        await page.getByRole("checkbox", { name: /동의/ }).check();
      }
      await sendDraft(page, "이 파일을 요약해 주세요");

      const bubble = page
        .locator('[data-slot="message-attachments"]')
        .filter({ hasText: "q3-forecast.xlsx" });
      await expect(bubble).toBeVisible();
      await expect(page.getByText("이 파일을 요약해 주세요")).toBeVisible();
      release();
    });
  }
});

test.describe("a stream that ends early after admission", () => {
  test("shows the stored message with its files instead of the local copy", async ({
    page,
  }) => {
    // The server stored the question and its files before the stream ended.
    // Keeping the optimistic copy would hide the files until a reload.
    await mockWorkspace(page, { documentWorkspace: "enabled" });
    let admitted = false;
    await page.route("**/api/my-agents/**/runs/stream", async (route) => {
      admitted = true;
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: 'event: run_started\ndata: {"run_id":"run-cut","conversation_id":"c-visual","status":"running"}\n\n',
      });
    });
    await page.route(
      "**/api/my-agents/conversations/c-visual/messages",
      async (route) => {
        if (!admitted || route.request().method() !== "GET") {
          return route.fallback();
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: "m-stored",
              conversation_id: "c-visual",
              role: "user",
              content: "요약해 주세요",
              attachments: [
                {
                  id: "att-1",
                  conversation_id: "c-visual",
                  filename: "q3-forecast.xlsx",
                  content_type:
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  extension: ".xlsx",
                  category: "spreadsheet",
                  byte_size: 2048,
                  status: "available",
                  expires_at: "2030-01-01T00:00:00.000Z",
                  created_at: "2026-09-30T00:00:00.000Z",
                },
              ],
            },
          ]),
        });
      },
    );
    await page.goto(CONVERSATION_URL);
    await dismissOnboarding(page);
    await addLibraryFileToTurn(page);
    await sendDraft(page, "요약해 주세요");

    await expect(
      page
        .locator('[data-slot="message-attachments"]')
        .getByText("q3-forecast.xlsx"),
    ).toBeVisible();
    await expect(page.getByText("요약해 주세요", { exact: true })).toHaveCount(
      1,
    );
  });
});

test.describe("retention and recall copy", () => {
  test("states the served retention period and recall", async ({ page }) => {
    await mockWorkspace(page, { documentWorkspace: "enabled" });
    await page.goto(CONVERSATION_URL);
    await dismissOnboarding(page);
    await page.locator('input[type="file"]').setInputFiles({
      name: "q3.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from("x"),
    });
    await expect(
      page.getByText(
        chat.attachments.consentDescriptionRetention.replace(
          "{duration}",
          chat.attachments.retentionDays.replace("{n}", "7"),
        ),
      ),
    ).toBeVisible();
    await expect(
      page.locator('[data-slot="attachment-recall-note"]'),
    ).toHaveText(chat.attachments.recallNote);
  });

  test("keeps a submitted file attached when the server cannot recall it", async ({
    page,
  }) => {
    await mockWorkspace(page, {
      documentWorkspace: "enabled",
      automaticRecall: false,
    });
    await page.route("**/api/my-agents/**/runs/stream", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: 'event: run_started\ndata: {"run_id":"run-x","conversation_id":"c-visual","status":"running"}\n\n',
      }),
    );
    await page.goto(CONVERSATION_URL);
    await dismissOnboarding(page);
    const chips = await addLibraryFileToTurn(page);
    await sendDraft(page, "요약해 주세요");
    // Admitted, but without recall the next turn only sees what it names.
    await expect(
      page.locator('[data-slot="attachment-recall-note"]'),
    ).toHaveCount(0);
    await expect(chips.getByText("q3-forecast.xlsx")).toBeVisible();
  });
});

test.describe("connection lost before the run is acknowledged", () => {
  const sent = "Q3 매출을 요약해 주세요";

  /**
   * `afterDrop.run`: what the run list shows once the stream has dropped —
   * this send's own run (echoing the request's `client_request_id`), another
   * send's run with the same text, or nothing new.
   */
  async function setUp(
    page: Page,
    afterDrop: { run: "own" | "other" | "none" } | "offline",
  ) {
    await mockWorkspace(page, { documentWorkspace: "enabled" });
    let sentRequestId: string | undefined;
    const streamBodies: Array<{ client_request_id?: string }> = [];
    await page.route("**/api/my-agents/**/runs/stream", async (route) => {
      const body = route.request().postDataJSON() as {
        client_request_id?: string;
      };
      streamBodies.push(body);
      sentRequestId = body.client_request_id;
      await route.abort("connectionreset");
    });
    // Registered after `mockWorkspace`, so it wins for the run list the
    // reconciliation reads — but only once the stream has dropped.
    await page.route(
      "**/api/my-agents/conversations/c-visual/runs",
      async (route) => {
        if (!sentRequestId || route.request().method() !== "GET") {
          return route.fallback();
        }
        if (afterDrop === "offline") return route.abort("internetdisconnected");
        const run = (clientRequestId: string) => ({
          run_id: `run-${clientRequestId.slice(0, 8)}`,
          conversation_id: "c-visual",
          status: "running",
          route_label: null,
          reasoning_mode: "standard",
          reasoning_effort: "medium",
          knowledge_base_selection: { mode: "all", knowledge_base_ids: [] },
          created_at: "2030-01-01T00:00:00Z",
          client_request_id: clientRequestId,
        });
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            afterDrop.run === "own"
              ? [run(sentRequestId)]
              : afterDrop.run === "other"
                ? [run("22222222-2222-4222-8222-222222222222")]
                : [],
          ),
        });
      },
    );
    await page.goto(CONVERSATION_URL);
    await dismissOnboarding(page);
    const chips = await addLibraryFileToTurn(page);
    return { chips, streamBodies };
  }

  test("treats the run echoing this send's ID as admitted and never resends", async ({
    page,
  }) => {
    const { chips, streamBodies } = await setUp(page, { run: "own" });
    await sendDraft(page, sent);

    await expect(chips).toHaveCount(0);
    await expect(
      page.getByText(chat.admittedAfterDisconnectAnnouncement).first(),
    ).toBeAttached();
    // The draft is not handed back for a resend, and nothing was resent.
    await expect(
      page
        .getByPlaceholder(chat.composerPlaceholder)
        .or(page.getByPlaceholder(chat.streamingComposerPlaceholder)),
    ).toHaveValue("");
    expect(streamBodies).toHaveLength(1);
    expect(streamBodies[0].client_request_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  test("does not claim another send's identical run", async ({ page }) => {
    // Same text, different send: an ID mismatch is a definite "not ours".
    const { chips } = await setUp(page, { run: "other" });
    await sendDraft(page, sent);
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(chips.getByText("q3-forecast.xlsx")).toBeVisible();
    await expect(
      page.getByText(chat.admittedAfterDisconnectAnnouncement),
    ).toHaveCount(0);
  });

  test("keeps the selection when no run was recorded", async ({ page }) => {
    const { chips } = await setUp(page, { run: "none" });
    await sendDraft(page, sent);
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(chips.getByText("q3-forecast.xlsx")).toBeVisible();
    await expect(
      page.getByText(ko.errors.byCode.run_admission_unknown),
    ).toHaveCount(0);
  });

  test("says it could not verify, rather than guessing, when offline", async ({
    page,
  }) => {
    const { chips } = await setUp(page, "offline");
    await sendDraft(page, sent);
    await expect(
      page.getByText(ko.errors.byCode.run_admission_unknown).first(),
    ).toBeVisible();
    await expect(chips.getByText("q3-forecast.xlsx")).toBeVisible();
  });
});

async function addLibraryFileToTurn(page: Page) {
  const chips = page.locator('[data-slot="attachment-chips"]');
  const library = page.locator('[data-slot="attachment-library"]');
  await library.locator("summary").click();
  await library
    .getByRole("button", { name: chat.attachments.addToTurn })
    .click();
  await expect(chips.getByText("q3-forecast.xlsx")).toBeVisible();
  return chips;
}

async function sendDraft(page: Page, text: string) {
  const composer = page.getByPlaceholder(chat.composerPlaceholder);
  await composer.fill(text);
  await composer.press("Enter");
}

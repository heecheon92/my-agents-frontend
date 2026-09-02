import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";
import { expectNoHorizontalOverflow, VIEWPORTS } from "./helpers/layout";
import { dismissOnboarding, mockWorkspace } from "./helpers/mock-workspace";

const chat = ko.chat;
const copy = chat.attachments;
const CONVERSATION_URL = "/chat/c-visual";

const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function xlsx(name = "q3-forecast.xlsx") {
  return {
    name,
    mimeType: XLSX_TYPE,
    buffer: Buffer.from("spreadsheet-bytes"),
  };
}

test.describe("temporary conversation files", () => {
  test("renders no attachment control when the backend lacks the feature", async ({
    page,
  }) => {
    // The decisive gate. A 404 capability must leave the composer exactly as it
    // is today — not a disabled button, which would imply a request path that
    // does not exist.
    await mockWorkspace(page);
    await page.goto(CONVERSATION_URL);

    await expect(page.getByPlaceholder(chat.composerPlaceholder)).toBeVisible();
    await expect(
      page.getByRole("button", { name: copy.attachAction }),
    ).toHaveCount(0);
    await expect(page.locator('[data-slot="attachment-controls"]')).toHaveCount(
      0,
    );
  });

  for (const state of ["disabled", "ineligible"] as const) {
    test(`renders no attachment control when the account is ${state}`, async ({
      page,
    }) => {
      // Disabled deployment and ineligible account are different facts, but
      // they share one requirement: no usable request path may remain.
      await mockWorkspace(page, { documentWorkspace: state });
      await page.goto(CONVERSATION_URL);

      await expect(
        page.getByPlaceholder(chat.composerPlaceholder),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: copy.attachAction }),
      ).toHaveCount(0);
    });
  }

  test("stages a file locally and refuses to send it without consent", async ({
    page,
  }) => {
    await mockWorkspace(page, { documentWorkspace: "enabled" });
    const uploads: string[] = [];
    await page.route("**/api/my-agents/**/attachments", async (route) => {
      if (route.request().method() === "POST")
        uploads.push(route.request().url());
      return route.fallback();
    });
    await page.goto(CONVERSATION_URL);
    await dismissOnboarding(page);

    await page.locator('input[type="file"]').setInputFiles(xlsx());
    // Scoped to the staged list: the conversation already holds an uploaded
    // file of the same name, which is exactly the case where an unscoped
    // locator would pass for the wrong reason.
    // Scoped to the chip row: the conversation already holds an uploaded file
    // of the same name, which is exactly the case where an unscoped locator
    // would pass for the wrong reason.
    const chips = page.locator('[data-slot="attachment-chips"]');
    await expect(chips.getByText("q3-forecast.xlsx")).toBeVisible();
    // Nothing has left the browser yet, and the copy has to say so.
    await expect(page.getByText(copy.stagedHelper)).toBeVisible();
    const panels = page.locator('[data-slot="attachment-panels"]');
    await expect(panels.getByText(copy.consentRequired)).toBeVisible();

    await page.getByPlaceholder(chat.composerPlaceholder).fill("요약해 주세요");
    await page.getByPlaceholder(chat.composerPlaceholder).press("Enter");

    // Refused before any transfer: no upload request, and the draft survives.
    // Scoped to the panel — the same sentence also reaches the live region and
    // the toast, which is deliberate rather than a duplicate to collapse.
    await expect(panels.getByText(copy.consentRequired)).toBeVisible();
    expect(uploads).toHaveLength(0);
    await expect(page.getByPlaceholder(chat.composerPlaceholder)).toHaveValue(
      "요약해 주세요",
    );
  });

  test("names the served provider in the consent sentence", async ({
    page,
  }) => {
    // Read from the capability rather than hardcoded, so the sentence names
    // whoever actually receives the bytes.
    await mockWorkspace(page, { documentWorkspace: "enabled" });
    await page.goto(CONVERSATION_URL);
    await dismissOnboarding(page);

    await page.locator('input[type="file"]').setInputFiles(xlsx());
    await expect(
      page.getByText(copy.consentLabel.replace("{provider}", "openai")),
    ).toBeVisible();
    // The deployment model is parsed but must never reach the DOM.
    await expect(page.getByText("served-model-id")).toHaveCount(0);
  });

  test("rejects an unsupported format locally, before consent is offered", async ({
    page,
  }) => {
    await mockWorkspace(page, { documentWorkspace: "enabled" });
    await page.goto(CONVERSATION_URL);
    await dismissOnboarding(page);

    await page.locator('input[type="file"]').setInputFiles({
      name: "clip.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from("video"),
    });
    await expect(
      page.getByText(copy.rejections.unsupported_attachment_type),
    ).toBeVisible();
    await expect(page.locator('[data-slot="attachment-consent"]')).toHaveCount(
      0,
    );
  });

  test("separates analysis-only formats from ones with a downloadable result", async ({
    page,
  }) => {
    // The promise the UI must never blur. Which extensions are certified is
    // the backend's call and moved twice on 2026-09-02, so the badge is driven
    // by `artifact_status` and the analysis-only case is whatever the served
    // registry says it is — plain text here, not a format anyone would guess.
    await mockWorkspace(page, { documentWorkspace: "enabled" });
    await page.goto(CONVERSATION_URL);
    await dismissOnboarding(page);

    await page.locator('input[type="file"]').setInputFiles([
      xlsx(),
      {
        name: "memo.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("notes"),
      },
    ]);
    await expect(page.getByText(copy.editableOutput)).toBeVisible();
    await expect(page.getByText(copy.analysisOnly)).toBeVisible();
  });

  test("keeps the prompt and the files when every upload fails", async ({
    page,
  }) => {
    // The rule that prevents the worst outcome: an attachment-free run that
    // answers a question about a file the assistant never received.
    await mockWorkspace(page, {
      documentWorkspace: "enabled",
      attachmentUploadFails: true,
    });
    let runStarted = false;
    await page.route("**/api/my-agents/**/runs/stream", async (route) => {
      runStarted = true;
      return route.fallback();
    });
    await page.goto(CONVERSATION_URL);
    await dismissOnboarding(page);

    await page.locator('input[type="file"]').setInputFiles(xlsx());
    await page.getByRole("checkbox", { name: /동의/ }).check();
    await page.getByPlaceholder(chat.composerPlaceholder).fill("요약해 주세요");
    await page.getByPlaceholder(chat.composerPlaceholder).press("Enter");

    // Announced three ways on purpose: the toast, the screen-reader live
    // region, and the panel. `.first()` asserts it arrived, not how many.
    await expect(page.getByText(copy.uploadAllFailed).first()).toBeVisible();
    expect(runStarted).toBe(false);
    await expect(page.getByPlaceholder(chat.composerPlaceholder)).toHaveValue(
      "요약해 주세요",
    );
    // The bytes are still on disk; the staged row stays so a retry is obvious.
    await expect(
      page
        .locator('[data-slot="attachment-chips"]')
        .getByText("q3-forecast.xlsx"),
    ).toBeVisible();
  });

  test("recovers the conversation's files after a cold load and locks expired ones", async ({
    page,
  }) => {
    await mockWorkspace(page, { documentWorkspace: "enabled" });
    await page.goto(CONVERSATION_URL);
    await dismissOnboarding(page);

    // The library is management, not composition: collapsed by default so it
    // stays out of the send path.
    const library = page.locator('[data-slot="attachment-library"]');
    await expect(library).toBeVisible();
    await expect(library).not.toHaveAttribute("open", "");
    await library.locator("summary").click();

    await expect(library.getByText("q3-forecast.xlsx")).toBeVisible();
    await expect(
      library.getByRole("button", { name: copy.addToTurn }),
    ).toBeEnabled();

    // Expiry is normal here. A lapsed file stays visible and offers no way
    // back into a turn, so the user learns what happened instead of losing a
    // row or hitting `attachment_expired` on send.
    const expiredRow = library.locator('li[data-status="expired"]');
    await expect(expiredRow).toBeVisible();
    await expect(expiredRow.getByText("old-notes.csv")).toBeVisible();
    await expect(
      expiredRow.getByRole("button", { name: copy.addToTurn }),
    ).toHaveCount(0);
    await expect(library.getByText(copy.expiredHelper)).toBeVisible();
  });

  test("carries a file forward as a chip on the next turn", async ({
    page,
  }) => {
    // The deliberate divergence from the per-message convention: someone
    // dissecting one spreadsheet asks several follow-ups about it. What changed
    // from the roster is that carrying forward is a visible chip on the turn it
    // applies to, not a checkbox to maintain.
    await mockWorkspace(page, { documentWorkspace: "enabled" });
    await page.goto(CONVERSATION_URL);
    await dismissOnboarding(page);

    const chips = page.locator('[data-slot="attachment-chips"]');
    const library = page.locator('[data-slot="attachment-library"]');
    await library.locator("summary").click();
    await library.getByRole("button", { name: copy.addToTurn }).click();

    await expect(chips.getByText("q3-forecast.xlsx")).toBeVisible();
    // Removing from the turn does not delete the file: it stays in the library
    // and can be added back.
    await chips
      .getByRole("button", {
        name: `${copy.removeFromTurn}: q3-forecast.xlsx`,
      })
      .click();
    await expect(chips).toHaveCount(0);
    await expect(library.getByText("q3-forecast.xlsx")).toBeVisible();
  });

  test("offers the generated file on the answer that produced it", async ({
    page,
  }) => {
    await mockWorkspace(page, { documentWorkspace: "enabled" });
    await page.goto(CONVERSATION_URL);
    await dismissOnboarding(page);

    const artifacts = page.locator('[data-slot="artifact-list"]');
    await expect(artifacts).toBeVisible();
    await expect(artifacts.getByText("q3-forecast-revised.xlsx")).toBeVisible();
    await expect(
      artifacts.getByRole("button", { name: chat.artifacts.download }),
    ).toBeEnabled();
  });

  test("accepts a file dropped anywhere on the conversation", async ({
    page,
  }) => {
    await mockWorkspace(page, { documentWorkspace: "enabled" });
    await page.goto(CONVERSATION_URL);
    await dismissOnboarding(page);

    const panel = page.getByTestId("chat-workspace-panel");
    const overlay = page.locator('[data-slot="attachment-drop-overlay"]');
    await expect(overlay).toHaveCount(0);

    // Playwright cannot synthesise an OS drag with a payload, so the
    // DataTransfer is built in the page and dispatched. That still exercises
    // the real handlers, the `Files` type guard, and the counter.
    const dataTransfer = await page.evaluateHandle(() => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File(["spreadsheet"], "dropped.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      return transfer;
    });

    await panel.dispatchEvent("dragenter", { dataTransfer });
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText(copy.dropHint);

    await panel.dispatchEvent("drop", { dataTransfer });
    await expect(overlay).toHaveCount(0);
    await expect(
      page.locator('[data-slot="attachment-chips"]').getByText("dropped.xlsx"),
    ).toBeVisible();
  });

  test("ignores a text drag and stays inert without the capability", async ({
    page,
  }) => {
    // Two ways the highlight would be a lie: a drag carrying no files, and a
    // deployment where dropping one could not do anything.
    await mockWorkspace(page, { documentWorkspace: "enabled" });
    await page.goto(CONVERSATION_URL);
    await dismissOnboarding(page);

    const panel = page.getByTestId("chat-workspace-panel");
    const textDrag = await page.evaluateHandle(() => {
      const transfer = new DataTransfer();
      transfer.setData("text/plain", "just some text");
      return transfer;
    });
    await panel.dispatchEvent("dragenter", { dataTransfer: textDrag });
    await expect(
      page.locator('[data-slot="attachment-drop-overlay"]'),
    ).toHaveCount(0);

    await page.goto("/chat/c-visual?nocap=1");
    await mockWorkspace(page);
    await page.reload();
    await dismissOnboarding(page);
    await expect(page.locator('[data-slot="attachment-dropzone"]')).toHaveCount(
      0,
    );
  });

  for (const viewport of VIEWPORTS) {
    test(`attachment panels stay bounded at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await mockWorkspace(page, { documentWorkspace: "enabled" });
      await page.goto(CONVERSATION_URL);
      await dismissOnboarding(page);

      await page.locator('input[type="file"]').setInputFiles(xlsx());
      await expect(
        page.locator('[data-slot="attachment-chips"]'),
      ).toBeVisible();
      await expectNoHorizontalOverflow(
        page,
        `attachment panels @ ${viewport.width}px`,
      );
    });
  }
});

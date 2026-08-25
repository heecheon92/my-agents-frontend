import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";
import { mockWorkspace } from "./helpers/mock-workspace";

const chat = ko.chat;
const CONVERSATION_URL = "/chat/c-visual";

test.describe("durable document-source choice", () => {
  test("rebuilds the pending question after a cold load", async ({ page }) => {
    // The decisive test. After a reload there is no stream, so the card can
    // only come from the run list plus the run detail. Without this recovery a
    // refresh strands the conversation: the composer looks idle while the
    // backend refuses every message until the interaction expires — 24 hours
    // later by server default.
    await mockWorkspace(page, { interaction: "document_selection" });
    await page.goto(CONVERSATION_URL);

    const card = page.locator('[data-slot="interaction-card"]');
    await expect(card).toBeVisible();
    await expect(card.getByText(chat.interactionTitle)).toBeVisible();
    // Options arrive inline with the run detail, so no fetch is needed to draw
    // the list.
    await expect(card.getByText("2026 파트너 계약서")).toBeVisible();
    await expect(card.getByText("온보딩 메모")).toBeVisible();
  });

  test("blocks sending but offers no stop control while suspended", async ({
    page,
  }) => {
    // The two decisions that used to be one boolean. A suspended run holds the
    // conversation, so sending must be refused — but it produces nothing, so a
    // stop button would offer to interrupt an answer nobody is writing.
    await mockWorkspace(page, { interaction: "document_selection" });
    await page.goto(CONVERSATION_URL);

    await expect(page.locator('[data-slot="interaction-card"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: chat.sendNow, exact: true }),
    ).toHaveCount(0);
    // The composer reports the conversation as busy rather than ready.
    await expect(page.getByPlaceholder(chat.composerPlaceholder)).toHaveCount(
      0,
    );
  });

  test("keeps cancel available so the waiting run can be released", async ({
    page,
  }) => {
    await mockWorkspace(page, { interaction: "document_selection" });
    await page.goto(CONVERSATION_URL);

    await expect(
      page.getByRole("button", { name: chat.interactionCancel }),
    ).toBeEnabled();
  });

  test("disables answering once the deadline has passed", async ({ page }) => {
    // Expiry has to change behaviour, not just copy: the server answers a late
    // resume with `run_interaction_expired`, so offering the button would be
    // offering a request known to fail. Cancel must stay live — it is what
    // releases the run.
    await mockWorkspace(page, { interaction: "expired" });
    await page.goto(CONVERSATION_URL);

    await expect(
      page.locator('[data-slot="interaction-expired"]'),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: chat.interactionChoose }).first(),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: chat.interactionCancel }),
    ).toBeEnabled();
  });

  test("falls back to a cancellable card for an unknown interaction type", async ({
    page,
  }) => {
    // A closed union would leave nothing on screen here, and the run behind it
    // would hold the conversation with no way out.
    await mockWorkspace(page, { interaction: "unsupported_type" });
    await page.goto(CONVERSATION_URL);

    const card = page.locator('[data-unsupported="unsupported_type"]');
    await expect(card).toBeVisible();
    await expect(
      card.getByText(chat.interactionUnsupportedTypeDescription),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: chat.interactionCancel }),
    ).toBeEnabled();
  });

  test("tells the user to reload when the protocol version is ahead", async ({
    page,
  }) => {
    // Distinct from an unknown type: reloading may genuinely fix this one, so
    // the copy differs. A version-permissive schema would have rendered this
    // as a normal v1 card and answered it with v1 semantics.
    await mockWorkspace(page, { interaction: "unsupported_version" });
    await page.goto(CONVERSATION_URL);

    const card = page.locator('[data-unsupported="unsupported_version"]');
    await expect(card).toBeVisible();
    await expect(
      card.getByText(chat.interactionUnsupportedVersionDescription),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: chat.interactionChoose }),
    ).toHaveCount(0);
  });

  test("tells the user the queue is paused, not merely waiting", async ({
    page,
  }) => {
    // A queued message under an open question is not waiting for an answer in
    // progress — nothing is being answered. The default queue helper would
    // imply it sends itself shortly, which it will not.
    await mockWorkspace(page, { interaction: "document_selection" });
    await page.goto(CONVERSATION_URL);

    const composer = page.getByRole("textbox").first();
    await composer.fill("두 번째 질문입니다");
    await composer.press("Enter");

    await expect(page.getByText(chat.interactionQueuePaused)).toBeVisible();
  });

  test("shows the suspended run's stored activity after a cold load", async ({
    page,
  }) => {
    // The waiting run is excluded from the "active run" branch because it has
    // no stream — which is exactly why its stored events are the only source
    // the panel has here. Excluding it from the events query too left the
    // activity trail blank behind an open question.
    await mockWorkspace(page, { interaction: "document_selection" });
    await page.goto(CONVERSATION_URL);

    await expect(page.locator('[data-slot="interaction-card"]')).toBeVisible();
    await page
      .getByRole("group")
      .filter({ hasText: chat.responseEvidence })
      .first()
      .getByText(chat.responseEvidence)
      .click();

    await expect(page.getByText(chat.noEventsTitle)).toHaveCount(0);
    await expect(
      page.getByText(chat.eventTypes.run_interrupted, { exact: false }).first(),
    ).toBeVisible();
  });

  for (const viewport of [
    { name: "mobile", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 720 },
  ]) {
    test(`keeps the panel usable when the option list is long (${viewport.name})`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      // The regression this guards. The card renders inside the composer, which
      // is absolutely positioned against the panel at `bottom-0`; the panel is
      // `overflow-hidden`. An uncapped option list therefore grows the composer
      // upward until it covers the transcript entirely and then spills past the
      // panel's top edge, where it is clipped away with no way to scroll it back
      // — the card's own title and first options become unreachable.
      await mockWorkspace(page, { interaction: "many_options" });
      await page.goto(CONVERSATION_URL);

      const card = page.locator('[data-slot="interaction-card"]');
      await expect(card).toBeVisible();

      const panelBox = await page
        .getByTestId("chat-workspace-panel")
        .boundingBox();
      const cardBox = await card.boundingBox();
      if (!panelBox || !cardBox) throw new Error("expected both boxes");

      // Nothing may sit above the panel, because the panel clips it.
      expect(
        cardBox.y,
        `the card starts ${Math.round(panelBox.y - cardBox.y)}px above the panel, where overflow-hidden clips it`,
      ).toBeGreaterThanOrEqual(panelBox.y);

      // And the transcript must keep a usable strip rather than being covered.
      expect(
        cardBox.height,
        "the option card must not consume the whole panel",
      ).toBeLessThan(panelBox.height * 0.7);
    });
  }

  test("scrolls a long option list inside the card", async ({ page }) => {
    // The list is the scroller, not the card and not the composer: the title,
    // the expiry notice and — critically — Cancel must stay put, because a
    // suspended run blocks the conversation and cancel is the release valve.
    await mockWorkspace(page, { interaction: "many_options" });
    await page.goto(CONVERSATION_URL);

    const list = page.locator('[data-slot="interaction-options"]');
    await expect(list).toBeVisible();

    const overflows = await list.evaluate((node) => {
      const style = window.getComputedStyle(node);
      return {
        scrolls: style.overflowY === "auto" || style.overflowY === "scroll",
        clipped: node.scrollHeight > node.clientHeight + 1,
      };
    });
    expect(overflows).toEqual({ scrolls: true, clipped: true });

    await expect(
      page.getByRole("button", { name: chat.interactionCancel }),
    ).toBeVisible();
  });

  test("leaves the composer untouched when no interaction is pending", async ({
    page,
  }) => {
    // Flags-off parity. Both backend flags default off, and until the
    // checkpointer is enabled the composer must look exactly as it did before
    // any of this shipped.
    await mockWorkspace(page);
    await page.goto(CONVERSATION_URL);

    await expect(page.getByPlaceholder(chat.composerPlaceholder)).toBeVisible();
    await expect(page.locator('[data-slot="interaction-card"]')).toHaveCount(0);
  });
});

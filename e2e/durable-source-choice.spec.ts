import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";
import {
  dismissOnboarding,
  hideDevIndicators,
  mockPendingInteractionV2,
  mockWorkspace,
} from "./helpers/mock-workspace";

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

  test("announces the available action on an unresolved cold load", async ({
    page,
  }) => {
    await mockWorkspace(page, { interaction: "v2_unresolved" });
    await page.goto(CONVERSATION_URL);

    await expect(
      page.getByText(chat.interactionRefinementWaitingAnnouncement),
    ).toBeVisible();
    await expect(page.getByLabel(chat.interactionRefineLabel)).toBeVisible();
  });

  test("refines a V2 interaction on the same run without submitting chat", async ({
    page,
  }) => {
    await mockWorkspace(page, { interaction: "document_selection_v2" });
    let resumeBody: unknown;
    let hasRefined = false;
    let releaseResume: (() => void) | undefined;
    const resumeGate = new Promise<void>((resolve) => {
      releaseResume = resolve;
    });
    const nextInteraction = {
      ...mockPendingInteractionV2,
      interaction_id: "abf5519e-12c5-44c8-8a91-0a6881a23cc1",
      option_count: 2,
      options: [
        ...mockPendingInteractionV2.options,
        {
          ...mockPendingInteractionV2.options[0],
          document_id: "doc-second",
          title: "Pydantic Annotated Literal examples",
        },
      ],
      refinement: {
        ...mockPendingInteractionV2.refinement,
        attempts_used: 1,
      },
    };
    await page.route(
      "**/api/my-agents/conversations/c-visual/runs/run-waiting",
      async (route) => {
        if (route.request().method() !== "GET") return route.fallback();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            status: "waiting_for_input",
            run_id: "run-waiting",
            conversation_id: "c-visual",
            interaction: hasRefined
              ? nextInteraction
              : mockPendingInteractionV2,
          }),
        });
      },
    );
    await page.route("**/api/my-agents/**/resume/stream", async (route) => {
      resumeBody = route.request().postDataJSON();
      hasRefined = true;
      await resumeGate;
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body:
          `event: run_resumed\ndata: ${JSON.stringify({ run_id: "run-waiting", status: "running", interaction_id: mockPendingInteractionV2.interaction_id, interaction_schema_version: 2, interaction_type: "document_selection" })}\n\n` +
          `event: run_interrupted\ndata: ${JSON.stringify({ status: "waiting_for_input", run_id: "run-waiting", conversation_id: "c-visual", interaction: nextInteraction })}\n\n`,
      });
    });
    await page.goto(CONVERSATION_URL);

    const card = page.locator('[data-slot="interaction-card"]');
    await expect(card).toBeVisible();
    await expect(card.locator("form")).toHaveCount(0);
    const clue = card.getByLabel(chat.interactionRefineLabel);
    const composer = page.getByPlaceholder(chat.streamingComposerPlaceholder);
    await composer.fill("예약되면 안 되는 후속 질문");
    await clue.press("Enter");
    expect(resumeBody).toBeUndefined();
    await expect(page.getByText(chat.queuedTitle)).toHaveCount(0);
    await clue.fill("Pydantic Annotated Literal.md");
    await clue.dispatchEvent("keydown", {
      key: "Enter",
      code: "Enter",
      isComposing: true,
    });
    expect(resumeBody).toBeUndefined();
    await clue.press("Enter");

    await expect
      .poll(() => resumeBody)
      .toEqual({
        schema_version: 2,
        interaction_id: mockPendingInteractionV2.interaction_id,
        type: "document_selection",
        kind: "refine",
        text: "Pydantic Annotated Literal.md",
      });
    await expect(card).toBeVisible();
    await expect(clue).toBeDisabled();
    releaseResume?.();
    await expect(
      card.getByText("Pydantic Annotated Literal examples"),
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: chat.interactionChoose }).first(),
    ).toBeFocused();
  });

  test("recovers the fresh attempt when the refine stream disconnects", async ({
    page,
  }) => {
    await mockWorkspace(page, { interaction: "document_selection_v2" });
    let advanced = false;
    const recoveredInteraction = {
      ...mockPendingInteractionV2,
      interaction_id: "f708ab31-e9df-41b0-a5b2-67aa67f41f25",
      option_count: 1,
      options: [
        {
          ...mockPendingInteractionV2.options[0],
          document_id: "doc-recovered",
          title: "Recovered candidate",
        },
      ],
      refinement: {
        ...mockPendingInteractionV2.refinement,
        attempts_used: 1,
      },
    };
    await page.route(
      "**/api/my-agents/conversations/c-visual/runs/run-waiting",
      async (route) => {
        if (route.request().method() !== "GET") return route.fallback();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            status: "waiting_for_input",
            run_id: "run-waiting",
            conversation_id: "c-visual",
            interaction: advanced
              ? recoveredInteraction
              : mockPendingInteractionV2,
          }),
        });
      },
    );
    await page.route("**/api/my-agents/**/resume/stream", async (route) => {
      advanced = true;
      await route.abort("failed");
    });
    await page.goto(CONVERSATION_URL);

    const card = page.locator('[data-slot="interaction-card"]');
    const clue = card.getByLabel(chat.interactionRefineLabel);
    await clue.fill("recovered filename");
    await clue.press("Enter");

    await expect(card.getByText("Recovered candidate")).toBeVisible();
    await expect(
      card.getByText("Markdown Langgraph - Pydantic Annotated Literal", {
        exact: true,
      }),
    ).toHaveCount(0);
  });

  test("sends the V2 select answer shape", async ({ page }) => {
    await mockWorkspace(page, { interaction: "document_selection_v2" });
    let resumeBody: unknown;
    await page.route("**/api/my-agents/**/resume/stream", async (route) => {
      resumeBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body:
          `event: run_resumed\ndata: ${JSON.stringify({ run_id: "run-waiting", status: "running", interaction_id: mockPendingInteractionV2.interaction_id, interaction_schema_version: 2, interaction_type: "document_selection" })}\n\n` +
          'event: run_failed\ndata: {"run_id":"run-waiting","safe_error_type":"TestEnd"}\n\n',
      });
    });
    await page.goto(CONVERSATION_URL);

    await page
      .getByRole("button", { name: chat.interactionChoose })
      .first()
      .click();
    await expect
      .poll(() => resumeBody)
      .toEqual({
        schema_version: 2,
        interaction_id: mockPendingInteractionV2.interaction_id,
        type: "document_selection",
        kind: "select",
        document_id: "doc-contract",
      });
  });

  test("loads the broad authorized list only after refinement is exhausted", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockWorkspace(page, { interaction: "v2_browse" });
    await page.goto(CONVERSATION_URL);

    const card = page.locator('[data-slot="interaction-card"]');
    await expect(
      card.getByText(chat.interactionBrowseAvailableDescription),
    ).toBeVisible();
    await expect(card.getByLabel(chat.interactionRefineLabel)).toHaveCount(0);
    await card
      .getByRole("button", { name: chat.interactionBrowseAction })
      .click();
    await expect(
      card.getByText(chat.interactionBrowseLoadedDescription),
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: chat.interactionChoose }).first(),
    ).toBeFocused();
    await expect(card.getByText("2026 파트너 계약서")).toBeVisible();
    await card.getByRole("button", { name: chat.interactionLoadMore }).click();
    await expect(card.getByText("보안 검토 메모")).toBeVisible();
    await expect(card.getByText("온보딩 메모")).toHaveCount(1);
    await expect(
      card.getByText(
        chat.interactionV2CountLabel
          .replace("{count}", "1")
          .replace("{total}", "4"),
      ),
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: chat.interactionCancel }),
    ).toBeVisible();
  });

  test("keeps the maximum V2 shortlist inside the mobile panel", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockWorkspace(page, { interaction: "v2_max_shortlist" });
    await page.goto(CONVERSATION_URL);

    const panel = page.getByTestId("chat-workspace-panel");
    const card = page.locator('[data-slot="interaction-card"]');
    const [panelBox, cardBox] = await Promise.all([
      panel.boundingBox(),
      card.boundingBox(),
    ]);
    if (!panelBox || !cardBox) throw new Error("expected panel and V2 card");
    expect(cardBox.y).toBeGreaterThanOrEqual(panelBox.y);
    expect(cardBox.height).toBeLessThan(panelBox.height * 0.75);
    await expect(
      card.getByText(
        "organization-project-pydantic-annotated-literal-candidate-1-final-review.md",
        { exact: false },
      ),
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: chat.interactionCancel }),
    ).toBeVisible();
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
    await expect(page.getByLabel(chat.agentComposing)).toHaveCount(0);
    const process = page.getByTestId("agent-process-panel");
    await expect(process).toBeVisible();
    await expect(
      process.locator('[data-terminal="waitingForConfirmation"]'),
    ).toContainText(chat.answerProcess.terminals.waiting);
    await expect(
      page.getByRole("button", { name: chat.sendNow, exact: true }),
    ).toHaveCount(0);
    // The composer reports the conversation as busy rather than ready.
    await expect(page.getByPlaceholder(chat.composerPlaceholder)).toHaveCount(
      0,
    );
  });

  for (const viewport of [
    { name: "mobile", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    test(`becomes a streaming answer immediately after choosing (${viewport.name})`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await mockWorkspace(page, { interaction: "document_selection" });
      let releaseResume: (() => void) | undefined;
      const resumeGate = new Promise<void>((resolve) => {
        releaseResume = resolve;
      });
      let markResumeRequested: (() => void) | undefined;
      const resumeRequested = new Promise<void>((resolve) => {
        markResumeRequested = resolve;
      });
      await page.route("**/api/my-agents/**/resume/stream", async (route) => {
        markResumeRequested?.();
        await resumeGate;
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body:
            'event: run_resumed\ndata: {"run_id":"run-waiting","status":"running","interaction_id":"run-waiting:document_selection","interaction_schema_version":1,"interaction_type":"document_selection"}\n\n' +
            'event: run_failed\ndata: {"run_id":"run-waiting","safe_error_type":"TestEnd"}\n\n',
        });
      });
      await page.goto(CONVERSATION_URL);
      await hideDevIndicators(page);
      await page.waitForTimeout(350);
      await dismissOnboarding(page);

      await page
        .getByRole("button", { name: chat.interactionChoose })
        .first()
        .click();
      await resumeRequested;

      // This is deliberately before the first resume-stream event. Choosing
      // is control input, so the card and waiting terminal must disappear
      // immediately rather than staying frozen for the backend's re-plan.
      await expect(page.locator('[data-slot="interaction-card"]')).toHaveCount(
        0,
      );
      await expect(
        page.locator('[data-terminal="waitingForConfirmation"]'),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: chat.sendNow, exact: true }),
      ).toBeVisible();
      const composer = page.getByPlaceholder(chat.streamingComposerPlaceholder);
      await expect(composer).toBeVisible();
      await expect(page.getByTestId("agent-process-panel")).toBeVisible({
        timeout: 5_000,
      });
      const currentStageBox = await page
        .locator('[data-current="true"]')
        .boundingBox();
      const composerBox = await page
        .locator('[data-slot="chat-composer-overlay"]')
        .boundingBox();
      expect(currentStageBox).not.toBeNull();
      expect(composerBox).not.toBeNull();
      expect(
        (currentStageBox?.y ?? 0) + (currentStageBox?.height ?? 0),
      ).toBeLessThanOrEqual(composerBox?.y ?? 0);

      await page.screenshot({
        path: testInfo.outputPath(`slow-resume-${viewport.width}.png`),
        fullPage: false,
      });

      await composer.fill("후속 질문을 예약합니다");
      await expect(
        page.getByRole("button", { name: chat.sendNow, exact: true }),
      ).toBeEnabled();
      await composer.press("Enter");
      await expect(page.getByText(chat.queuedTitle)).toBeVisible();

      releaseResume?.();
    });
  }

  test("does not steal scroll position when a reader moved away from the bottom", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockWorkspace(page, { interaction: "document_selection" });
    let releaseResume: (() => void) | undefined;
    const resumeGate = new Promise<void>((resolve) => {
      releaseResume = resolve;
    });
    await page.route("**/api/my-agents/**/resume/stream", async (route) => {
      await resumeGate;
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body:
          'event: run_resumed\ndata: {"run_id":"run-waiting","status":"running","interaction_id":"run-waiting:document_selection","interaction_schema_version":1,"interaction_type":"document_selection"}\n\n' +
          'event: run_failed\ndata: {"run_id":"run-waiting","safe_error_type":"TestEnd"}\n\n',
      });
    });
    await page.goto(CONVERSATION_URL);
    await page.waitForTimeout(350);
    await dismissOnboarding(page);
    const scrollRegion = page.getByTestId("chat-scroll-region");
    await scrollRegion.evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event("scroll"));
    });

    await page
      .getByRole("button", { name: chat.interactionChoose })
      .first()
      .click();
    await expect(page.locator('[data-slot="interaction-card"]')).toHaveCount(0);
    await page.waitForTimeout(100);
    expect(await scrollRegion.evaluate((element) => element.scrollTop)).toBe(0);
    releaseResume?.();
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
    const process = page.getByTestId("agent-process-panel");
    await expect(process).toBeVisible();
    await expect(
      process.locator('[data-terminal="waitingForConfirmation"]'),
    ).toContainText(chat.answerProcess.terminals.waiting);
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

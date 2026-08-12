import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";
import { mockWorkspace } from "./helpers/mock-workspace";

const effortLabel = ko.chat.reasoningEffortLabel;
const proLabel = ko.chat.reasoningProLabel;

/**
 * The controls live behind a compact trigger in the composer now, so every
 * assertion about the slider or the switch has to open it first. The trigger
 * itself is the one thing that must stay readable without a click — it states
 * the current level, which is what keeps collapsing them honest.
 */
function reasoningTrigger(page: import("@playwright/test").Page) {
  return page.getByRole("button", { name: new RegExp(effortLabel) });
}

async function openReasoningControls(page: import("@playwright/test").Page) {
  await reasoningTrigger(page).click();
  await expect(page.getByRole("slider")).toBeVisible();
}

test.describe("composer reasoning controls", () => {
  test("states the current effort on the trigger without opening it", async ({
    page,
  }) => {
    await mockWorkspace(page);
    await page.goto("/chat");

    // Defaults come from the served capabilities, not a frontend constant.
    await expect(reasoningTrigger(page)).toContainText(
      ko.chat.reasoningEffortLabels.medium,
    );
    // Collapsed means collapsed: the settings themselves are not on screen.
    await expect(page.getByRole("slider")).toHaveCount(0);
  });

  test("renders the effort slider and pro toggle for a registered user", async ({
    page,
  }) => {
    await mockWorkspace(page);
    await page.goto("/chat");
    await openReasoningControls(page);

    await expect(page.getByRole("slider")).toBeEnabled();
    await expect(page.getByRole("switch", { name: proLabel })).toBeEnabled();

    // The stop names read as a quality scale unless this is stated. A lower
    // level is a shorter review, not a weaker model, and losing this line
    // would undersell every level below the top one.
    await page
      .getByRole("button", { name: ko.chat.reasoningEffortGuideAction })
      .click();
    await expect(
      page.getByText(ko.chat.reasoningEffortGuideDescription),
    ).toBeVisible();
    // Every level is documented, not just the extremes.
    await expect(
      page.getByText(ko.chat.reasoningEffortDetails.low),
    ).toBeVisible();
    await expect(
      page.getByText(ko.chat.reasoningEffortDetails.max),
    ).toBeVisible();
  });

  test("reserves two lines for the effort hint so copy cannot reflow the panel", async ({
    page,
  }) => {
    // Asserting equal heights across stops is NOT enough: today's hints all fit
    // one line at every width, so that passes with the fix removed. What must
    // hold is that the block is explicitly sized for two lines, so a future
    // longer hint wraps inside reserved space instead of resizing the popover
    // mid-drag. h-10 = 2 x leading-5.
    await page.setViewportSize({ width: 390, height: 844 });
    await mockWorkspace(page);
    await page.goto("/chat");
    await openReasoningControls(page);

    const hintBlock = page.locator('[data-slot="reasoning-hint"]');
    const slider = page.getByRole("slider");
    await slider.focus();

    for (let step = 0; step < 7; step += 1) {
      await expect(hintBlock).toHaveCSS("height", "40px");
      await slider.press("ArrowRight");
    }
  });

  test("renders a filled slider thumb", async ({ page }) => {
    // `bg-cal-surface` is not a token, so it compiled to nothing and the thumb
    // was a ring around transparency. Assert a real fill rather than trusting
    // the class name.
    await mockWorkspace(page);
    await page.goto("/chat");
    await openReasoningControls(page);

    const fill = await page
      .locator(
        '[data-slot="slider"] [class*="rounded-full"][class*="border-2"]',
      )
      .first()
      .evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(fill).not.toBe("rgba(0, 0, 0, 0)");
    expect(fill).not.toBe("transparent");
  });

  test("hides the controls when the backend does not serve capabilities", async ({
    page,
  }) => {
    // This is production today: the endpoint 404s until the reasoning
    // migration deploys, and the composer must look exactly as it did before.
    await mockWorkspace(page, { reasoning: false });
    await page.goto("/chat");

    await expect(
      page.getByPlaceholder(ko.chat.composerPlaceholder),
    ).toBeVisible();
    await expect(reasoningTrigger(page)).toHaveCount(0);
    await expect(page.getByRole("slider")).toHaveCount(0);
  });

  test("locks the controls for a guest and says why", async ({ page }) => {
    // The backend clamps guests server-side. Showing the real values as
    // disabled is honest; hiding them would imply the feature is absent.
    await mockWorkspace(page, { guest: true });
    await page.goto("/chat");
    await openReasoningControls(page);

    await expect(page.getByRole("slider")).toBeDisabled();
    await expect(page.getByRole("switch", { name: proLabel })).toBeDisabled();
    await expect(page.getByText(ko.chat.reasoningLockedGuest)).toBeVisible();
  });

  test("keeps a raised effort after a reload", async ({ page }) => {
    await mockWorkspace(page);
    await page.goto("/chat");
    await openReasoningControls(page);

    const slider = page.getByRole("slider");
    await slider.focus();
    await slider.press("ArrowRight");
    // Scoped to the panel: the label is deliberately in two places now — here
    // and on the trigger — so an unscoped match is ambiguous.
    await expect(
      page
        .locator('[data-slot="popover-content"]')
        .getByText(ko.chat.reasoningEffortLabels.high, { exact: true }),
    ).toBeVisible();

    await page.reload();
    // Read it off the collapsed trigger — the persisted value has to survive
    // without the panel being reopened.
    await expect(reasoningTrigger(page)).toContainText(
      ko.chat.reasoningEffortLabels.high,
    );
  });
});

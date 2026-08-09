import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";
import { mockWorkspace } from "./helpers/mock-workspace";

const effortLabel = ko.chat.reasoningEffortLabel;
const proLabel = ko.chat.reasoningProLabel;

test.describe("composer reasoning controls", () => {
  test("renders the effort slider and pro toggle for a registered user", async ({
    page,
  }) => {
    await mockWorkspace(page);
    await page.goto("/chat");

    await expect(page.getByText(effortLabel)).toBeVisible();
    await expect(page.getByRole("slider")).toBeEnabled();
    await expect(page.getByRole("switch", { name: proLabel })).toBeEnabled();

    // Defaults come from the served capabilities, not a frontend constant.
    await expect(
      page.getByText(ko.chat.reasoningEffortLabels.medium, { exact: true }),
    ).toBeVisible();

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

  test("reserves two lines for the effort hint so copy cannot reflow the composer", async ({
    page,
  }) => {
    // Asserting equal composer height across stops is NOT enough: today's
    // hints all fit one line at every width, so that passes with the fix
    // removed. What must hold is that the block is explicitly sized for two
    // lines, so a future longer hint wraps inside reserved space instead of
    // growing the composer mid-drag. h-10 = 2 x leading-5.
    await page.setViewportSize({ width: 390, height: 844 });
    await mockWorkspace(page);
    await page.goto("/chat");

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
    await expect(page.getByText(effortLabel)).toHaveCount(0);
    await expect(page.getByRole("slider")).toHaveCount(0);
  });

  test("locks the controls for a guest and says why", async ({ page }) => {
    // The backend clamps guests server-side. Showing the real values as
    // disabled is honest; hiding them would imply the feature is absent.
    await mockWorkspace(page, { guest: true });
    await page.goto("/chat");

    await expect(page.getByText(effortLabel)).toBeVisible();
    await expect(page.getByRole("slider")).toBeDisabled();
    await expect(page.getByRole("switch", { name: proLabel })).toBeDisabled();
    await expect(page.getByText(ko.chat.reasoningLockedGuest)).toBeVisible();
  });

  test("keeps a raised effort after a reload", async ({ page }) => {
    await mockWorkspace(page);
    await page.goto("/chat");

    const slider = page.getByRole("slider");
    await slider.focus();
    await slider.press("ArrowRight");
    await expect(
      page.getByText(ko.chat.reasoningEffortLabels.high, { exact: true }),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByText(ko.chat.reasoningEffortLabels.high, { exact: true }),
    ).toBeVisible();
  });
});

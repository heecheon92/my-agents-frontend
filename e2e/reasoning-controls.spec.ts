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

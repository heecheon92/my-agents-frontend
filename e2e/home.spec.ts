import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";

test("landing page renders localized Korean copy", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: ko.home.title }),
  ).toBeVisible();
  const header = page.locator("header");
  await expect(
    header.getByRole("link", { name: ko.home.login }),
  ).toHaveAttribute("href", "/login");
  await expect(
    header.getByRole("link", { name: ko.home.signup }),
  ).toHaveAttribute("href", "/signup");
});

import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";

async function expectSingleLineText(
  page: import("@playwright/test").Page,
  text: string,
) {
  const lineCount = await page
    .getByText(text, { exact: true })
    .evaluate((node) => {
      const textNode = Array.from(node.childNodes).find(
        (child) => child.nodeType === Node.TEXT_NODE,
      );
      if (!textNode) return 0;
      const range = document.createRange();
      range.selectNodeContents(textNode);
      return range.getClientRects().length;
    });
  expect(lineCount).toBe(1);
}

test.describe("auth pages", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test("login keeps the form, guest access, and signup path without the service description pane", async ({
    page,
  }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: ko.auth.welcomeBack }),
    ).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: ko.auth.loginSubmit }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: ko.auth.signupLink }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: ko.auth.guestSubmit }),
    ).toBeVisible();
    await expect(page.getByText(ko.auth.heroTitle)).toHaveCount(0);
    await expect(page.getByText(ko.auth.heroDescription)).toHaveCount(0);
    await expectSingleLineText(page, ko.auth.welcomeBack);
  });

  test("signup keeps the account form, guest access, and login path without the service description pane", async ({
    page,
  }) => {
    await page.goto("/signup");

    await expect(
      page.getByRole("heading", { name: ko.auth.createAccount }),
    ).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: ko.auth.signupSubmit }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: ko.auth.loginLink }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: ko.auth.guestSubmit }),
    ).toBeVisible();
    await expect(page.getByText(ko.auth.heroTitle)).toHaveCount(0);
    await expect(page.getByText(ko.auth.heroDescription)).toHaveCount(0);
  });
});

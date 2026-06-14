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
    await expect(
      page.getByRole("textbox", { exact: true, name: ko.auth.email }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", {
        name: new RegExp(`^${ko.auth.nickname}`),
      }),
    ).toHaveCount(0);
    await expect(page.getByText(ko.auth.nicknameHint)).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: ko.auth.loginSubmit }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: ko.auth.signupLink }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", {
        name: new RegExp(`^${ko.auth.guestEmailLabel}`),
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: ko.auth.guestRequestSubmit }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", {
        name: new RegExp(`^${ko.auth.guestCodeLabel}`),
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: ko.auth.guestCodeSubmit }),
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
    await expect(
      page.getByRole("textbox", { exact: true, name: ko.auth.email }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", {
        name: new RegExp(`^${ko.auth.nickname}`),
      }),
    ).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: ko.auth.signupSubmit }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: ko.auth.loginLink }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", {
        name: new RegExp(`^${ko.auth.guestEmailLabel}`),
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: ko.auth.guestRequestSubmit }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", {
        name: new RegExp(`^${ko.auth.guestCodeLabel}`),
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: ko.auth.guestCodeSubmit }),
    ).toBeVisible();
    await expect(page.getByText(ko.auth.heroTitle)).toHaveCount(0);
    await expect(page.getByText(ko.auth.heroDescription)).toHaveCount(0);
  });

  test("guest access request posts email and shows a generic accepted message", async ({
    page,
  }) => {
    let guestRequestBody: unknown;
    let guestLoginCalls = 0;

    await page.route("**/api/my-agents/auth/guest/request", async (route) => {
      guestRequestBody = route.request().postDataJSON();
      await route.fulfill({
        body: JSON.stringify({ status: "accepted" }),
        contentType: "application/json",
        status: 200,
      });
    });
    await page.route("**/api/my-agents/auth/guest/login", async (route) => {
      guestLoginCalls += 1;
      await route.fulfill({
        body: JSON.stringify({ detail: "unexpected code redemption" }),
        contentType: "application/json",
        status: 500,
      });
    });

    await page.goto("/login");
    await page
      .getByRole("textbox", {
        name: new RegExp(`^${ko.auth.guestEmailLabel}`),
      })
      .fill("reviewer@example.com");
    await page
      .getByRole("button", { name: ko.auth.guestRequestSubmit })
      .click();

    await expect(
      page.getByText(ko.auth.guestRequestReceivedTitle),
    ).toBeVisible();
    await expect(
      page.getByText(
        ko.auth.guestRequestReceivedDescription.replace(
          "{email}",
          "reviewer@example.com",
        ),
      ),
    ).toBeVisible();
    expect(guestRequestBody).toEqual({ email: "reviewer@example.com" });
    expect(guestLoginCalls).toBe(0);
  });
});

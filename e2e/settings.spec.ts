import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";

const settingsBaseURL = process.env.SETTINGS_E2E_BASE_URL ?? "";

const user = {
  id: "settings-user",
  email: "settings@example.com",
  nickname: "Settings User",
  email_verified_at: "2026-06-14T00:00:00.000Z",
  is_guest: false,
};

async function mockSettingsWorkspace(page: import("@playwright/test").Page) {
  let currentUser = { ...user };
  let memoryEnabled = false;

  await page.route("**/api/my-agents/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/my-agents", "");
    const method = request.method();
    const json = (value: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(value),
      });

    if (method === "GET" && path === "/auth/me") return json(currentUser);
    if (method === "PATCH" && path === "/auth/me/nickname") {
      const payload = request.postDataJSON() as {
        nickname: string;
        current_password: string;
      };
      currentUser = { ...currentUser, nickname: payload.nickname.trim() };
      return json(currentUser);
    }
    if (method === "PATCH" && path === "/auth/me/password") {
      return route.fulfill({ status: 204, body: "" });
    }
    if (method === "GET" && path === "/memories/settings") {
      return json({
        enabled: memoryEnabled,
        updated_at: "2026-06-14T00:00:00.000Z",
      });
    }
    if (method === "PATCH" && path === "/memories/settings") {
      const payload = request.postDataJSON() as { enabled: boolean };
      memoryEnabled = payload.enabled;
      return json({
        enabled: memoryEnabled,
        updated_at: "2026-06-14T00:01:00.000Z",
      });
    }
    if (method === "GET" && path === "/groups") return json([]);
    if (method === "GET" && path === "/knowledge-bases") return json([]);
    if (method === "GET" && path === "/conversations") return json([]);

    return json([]);
  });
}

test("settings account and experimental routes are navigable and submit expected settings calls", async ({
  page,
}) => {
  await mockSettingsWorkspace(page);

  await page.goto(`${settingsBaseURL}/settings`);
  await expect(page).toHaveURL(/\/settings\/account$/);
  await expect(
    page.getByRole("heading", { name: ko.settings.account.title }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: ko.service.nav.settings }),
  ).toHaveAttribute("aria-current", "page");

  await page.getByLabel(ko.settings.account.nicknameLabel).fill("새 표시 이름");
  await page
    .getByLabel(ko.settings.account.currentPasswordLabel)
    .first()
    .fill("current-password");
  await page
    .getByRole("button", { name: ko.settings.account.nicknameSubmit })
    .click();
  await expect(
    page.getByText(ko.settings.account.nicknameSuccess),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "새 표시 이름" }),
  ).toBeVisible();

  await page.getByRole("link", { name: ko.settings.tabs.experimental }).click();
  await expect(page).toHaveURL(/\/settings\/experimental$/);
  await expect(
    page.getByRole("heading", { name: ko.settings.experimental.title }),
  ).toBeVisible();
  await expect(
    page.getByText(ko.settings.experimental.disabledStatus),
  ).toBeVisible();

  await page
    .getByRole("button", { name: ko.settings.experimental.enableSubmit })
    .click();
  await expect(
    page.getByText(ko.settings.experimental.enabledStatus),
  ).toBeVisible();
});

test("password confirmation mismatch is blocked before the password mutation", async ({
  page,
}) => {
  await mockSettingsWorkspace(page);
  let passwordPatchCount = 0;
  await page.route("**/api/my-agents/auth/me/password", async (route) => {
    passwordPatchCount += 1;
    await route.fulfill({ status: 204, body: "" });
  });

  await page.goto(`${settingsBaseURL}/settings/account`);
  await page
    .getByLabel(ko.settings.account.currentPasswordLabel)
    .nth(1)
    .fill("current-password");
  await page
    .locator('input[autocomplete="new-password"]')
    .first()
    .fill("new-pass-1");
  await page
    .getByLabel(ko.settings.account.confirmPasswordLabel)
    .fill("new-pass-2");
  await page
    .getByRole("button", { name: ko.settings.account.passwordSubmit })
    .click();

  await expect(
    page.getByText(ko.settings.account.passwordMismatch),
  ).toBeVisible();
  expect(passwordPatchCount).toBe(0);
});

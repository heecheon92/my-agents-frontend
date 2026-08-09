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

  test("login keeps the form and signup path, and links out to guest access", async ({
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
    // Guest access moved to its own route; the auth pages only link to it.
    await expect(
      page.getByRole("link", { name: ko.auth.guestAccessLink }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: ko.auth.guestRequestSubmit }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: ko.auth.guestCodeSubmit }),
    ).toHaveCount(0);
    await expect(page.getByText(ko.auth.heroTitle)).toHaveCount(0);
    await expect(page.getByText(ko.auth.heroDescription)).toHaveCount(0);
    await expectSingleLineText(page, ko.auth.welcomeBack);
  });

  test("signup keeps the account form and login path, and links out to guest access", async ({
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
    // Guest access moved to its own route; the auth pages only link to it.
    await expect(
      page.getByRole("link", { name: ko.auth.guestAccessLink }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: ko.auth.guestRequestSubmit }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: ko.auth.guestCodeSubmit }),
    ).toHaveCount(0);
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
    // Reach guest access the way a visitor does, which also covers the link.
    await page.getByRole("link", { name: ko.auth.guestAccessLink }).click();
    await expect(page).toHaveURL(/\/guest$/);
    await expect(
      page.getByRole("heading", { name: ko.auth.guestPageTitle }),
    ).toBeVisible();

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

    // And the way back, so neither page is a dead end.
    await page.getByRole("link", { name: ko.auth.backToLoginLink }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: ko.auth.welcomeBack }),
    ).toBeVisible();
  });

  test("group invitation accept sends signed-out recipients to nickname/password signup", async ({
    page,
  }) => {
    let acceptCalls = 0;
    await page.route("**/api/my-agents/auth/me", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ detail: "not authenticated" }),
        contentType: "application/json",
        status: 401,
      });
    });
    await page.route(
      "**/api/my-agents/group-invitations/accept",
      async (route) => {
        acceptCalls += 1;
        await route.fulfill({
          body: JSON.stringify({
            detail: "signed-out user should not accept yet",
          }),
          contentType: "application/json",
          status: 500,
        });
      },
    );

    await page.goto("/group-invitations/accept?token=opaque-token");

    await page.waitForURL("**/signup?invite_token=opaque-token");
    await expect(
      page.getByRole("heading", { name: ko.auth.createAccount }),
    ).toBeVisible();
    await expect(
      page.getByText(ko.auth.groupInvitationSignupTitle),
    ).toBeVisible();
    await expect(
      page.getByText(ko.auth.groupInvitationSignupDescription),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { exact: true, name: ko.auth.email }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("textbox", {
        name: new RegExp(`^${ko.auth.nickname}`),
      }),
    ).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(
      page.getByRole("textbox", {
        name: new RegExp(`^${ko.auth.guestEmailLabel}`),
      }),
    ).toHaveCount(0);
    expect(acceptCalls).toBe(0);
  });

  test("group invitation signup posts token nickname and password, not email", async ({
    page,
  }) => {
    let signupBody: unknown;
    await page.route(
      "**/api/my-agents/group-invitations/signup",
      async (route) => {
        signupBody = route.request().postDataJSON();
        await route.fulfill({
          body: JSON.stringify({
            user: {
              id: "user-2",
              email: "invitee@example.com",
              nickname: "Mom Display",
              email_verified_at: "2026-06-14T12:00:00+00:00",
              approval_status: "approved",
              is_guest: false,
              guest_expires_at: null,
            },
            member: {
              member_id: "member-2",
              user_id: "user-2",
              nickname: "Mom Display",
              role: "editor",
              created_at: "2026-06-14T12:00:00+00:00",
            },
          }),
          contentType: "application/json",
          status: 201,
        });
      },
    );
    await page.route("**/api/my-agents/groups", async (route) => {
      await route.fulfill({
        body: JSON.stringify([]),
        contentType: "application/json",
        status: 200,
      });
    });

    await page.goto("/signup?invite_token=opaque-token");
    await page
      .getByRole("textbox", {
        name: new RegExp(`^${ko.auth.nickname}`),
      })
      .fill("  Mom Display  ");
    await page
      .locator('input[type="password"]')
      .fill("correct horse battery staple");
    await page.getByRole("button", { name: ko.auth.signupSubmit }).click();

    await page.waitForURL("**/groups");
    expect(signupBody).toEqual({
      token: "opaque-token",
      nickname: "Mom Display",
      password: "correct horse battery staple",
    });
  });
});

test("login offers a reachable password reset request", async ({ page }) => {
  // `/password-reset` and `requestPasswordReset` both existed already, but no
  // UI called them, so the route could only be reached from an email nobody
  // could trigger.
  let requestedEmail: string | null = null;

  await page.route("**/api/my-agents/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/my-agents", "");
    if (request.method() === "POST" && path.includes("password-reset")) {
      requestedEmail = JSON.parse(request.postData() ?? "{}").email ?? null;
      return route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ status: "accepted" }),
      });
    }
    return route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Not authenticated" }),
    });
  });

  await page.goto("/login");
  await page
    .getByRole("button", { name: ko.auth.passwordResetRequestLink })
    .click();

  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText(ko.auth.passwordResetRequestTitle),
  ).toBeVisible();

  await dialog.getByLabel(ko.auth.email).fill("reset@example.com");
  await dialog
    .getByRole("button", { name: ko.auth.passwordResetRequestSubmit })
    .click();

  await expect(
    dialog.getByText(ko.auth.passwordResetRequestSentDescription),
  ).toBeVisible();
  expect(requestedEmail).toBe("reset@example.com");
});

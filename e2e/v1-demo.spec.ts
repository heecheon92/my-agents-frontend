import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";

const demoEmail = process.env.V1_DEMO_EMAIL;
const demoPassword = process.env.V1_DEMO_PASSWORD;
const publicVisitorSmoke = process.env.V1_PUBLIC_VISITOR_SMOKE === "1";
const seededDocumentTitle = "V1 Product Chat Service Demo";
const sensitiveStoragePattern =
  /(api[_-]?key|csrf|password|session|sk-[a-zA-Z0-9]|token)/i;

async function expectChatTranscriptLayoutBounded(
  page: import("@playwright/test").Page,
) {
  const metrics = await page
    .getByTestId("chat-workspace-panel")
    .evaluate((panel) => {
      const scrollRegion = panel.querySelector(
        '[data-testid="chat-scroll-region"]',
      );
      if (!(scrollRegion instanceof HTMLElement)) {
        throw new Error("chat scroll region missing");
      }
      return {
        panelHeight: panel.getBoundingClientRect().height,
        scrollHeight: scrollRegion.getBoundingClientRect().height,
        viewportHeight: window.innerHeight,
        scrollOverflowY: window.getComputedStyle(scrollRegion).overflowY,
        panelOverflowY: window.getComputedStyle(panel).overflowY,
      };
    });

  expect(metrics.panelHeight).toBeGreaterThan(0);
  expect(metrics.scrollHeight).toBeGreaterThan(0);
  expect(metrics.panelHeight).toBeLessThanOrEqual(metrics.viewportHeight);
  expect(metrics.scrollOverflowY).toMatch(/auto|scroll/);
  expect(metrics.panelOverflowY).toBe("hidden");
}

function latestAssistantFooter(page: import("@playwright/test").Page) {
  return page.getByTestId("assistant-message-footer").last();
}

async function expectLatestAssistantFooterEvidence(
  page: import("@playwright/test").Page,
  eventName: string | RegExp,
) {
  const footer = latestAssistantFooter(page);
  await expect(footer).toBeVisible();
  await expect(
    page.locator("aside").filter({ hasText: ko.chat.latestCitations }),
  ).toHaveCount(0);

  await footer
    .getByLabel(new RegExp(escapeRegExp(ko.chat.viewRunHistory)))
    .click();
  await expect(
    footer.getByText(ko.chat.runStatuses.completed).first(),
  ).toBeVisible();

  await footer
    .getByLabel(new RegExp(escapeRegExp(ko.chat.viewLatestCitations)))
    .click();
  await expect(footer.getByText(ko.chat.documentLabel).first()).toBeVisible();

  await footer
    .getByLabel(new RegExp(escapeRegExp(ko.chat.viewActivityEvents)))
    .click();
  await expect(footer.getByText(eventName).first()).toBeVisible();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function requirePublicVisitorConfig() {
  const emailTemplate = process.env.V1_PUBLIC_VISITOR_EMAIL_TEMPLATE;
  const password = process.env.V1_PUBLIC_VISITOR_PASSWORD;
  const verificationMode =
    process.env.V1_PUBLIC_VISITOR_VERIFICATION_MODE ?? "login-after-signup";
  const verificationCommand =
    process.env.V1_PUBLIC_VISITOR_VERIFICATION_COMMAND;

  const missing: string[] = [];
  if (!emailTemplate) missing.push("V1_PUBLIC_VISITOR_EMAIL_TEMPLATE");
  if (emailTemplate && !emailTemplate.includes("{nonce}")) {
    missing.push("V1_PUBLIC_VISITOR_EMAIL_TEMPLATE must include {nonce}");
  }
  if (!password) missing.push("V1_PUBLIC_VISITOR_PASSWORD");
  if (verificationMode === "provider-command" && !verificationCommand) {
    missing.push(
      "V1_PUBLIC_VISITOR_VERIFICATION_COMMAND for provider-command mode",
    );
  }
  if (!/^(login-after-signup|provider-command)$/.test(verificationMode)) {
    missing.push(
      "V1_PUBLIC_VISITOR_VERIFICATION_MODE must be login-after-signup or provider-command",
    );
  }
  if (missing.length > 0) {
    throw new Error(
      `Public visitor smoke is enabled but required provider env is incomplete: ${missing.join(
        ", ",
      )}. This final-proof mode must fail explicitly instead of skipping.`,
    );
  }

  if (!emailTemplate || !password) {
    throw new Error(
      "Public visitor smoke config validation failed unexpectedly.",
    );
  }
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: emailTemplate.replaceAll("{nonce}", nonce),
    password,
    verificationMode,
    verificationCommand,
    documentTitle: `Public visitor smoke ${nonce}`,
    documentContent:
      "This public visitor smoke document proves a unique account can create knowledge, ingest it, stream an assistant answer, render citations, and preserve redacted activity events after refresh.",
  };
}

async function assertBrowserStorageHasNoSecrets(
  page: import("@playwright/test").Page,
) {
  const entries = await page.evaluate(() => {
    const readStorage = (storage: Storage, type: string) =>
      Array.from({ length: storage.length }, (_, index) => {
        const key = storage.key(index) ?? "";
        return { type, key, value: storage.getItem(key) ?? "" };
      });
    return [
      ...readStorage(window.localStorage, "localStorage"),
      ...readStorage(window.sessionStorage, "sessionStorage"),
    ];
  });

  const leaked = entries.filter(
    (entry) =>
      sensitiveStoragePattern.test(entry.key) ||
      sensitiveStoragePattern.test(entry.value),
  );
  expect(
    leaked,
    "browser storage must not expose auth/provider secrets",
  ).toEqual([]);
}

async function completePublicVisitorVerification(config: {
  email: string;
  verificationMode: string;
  verificationCommand?: string;
  page: import("@playwright/test").Page;
}) {
  if (config.verificationMode === "login-after-signup") return;

  if (!config.verificationCommand) {
    throw new Error(
      "V1_PUBLIC_VISITOR_VERIFICATION_COMMAND is required for provider-command mode.",
    );
  }

  const stdout = execSync(config.verificationCommand, {
    env: {
      ...process.env,
      V1_PUBLIC_VISITOR_EMAIL: config.email,
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
  }).trim();
  const verificationUrl = stdout.match(/https?:\/\/\S+/)?.[0];
  if (!verificationUrl) {
    throw new Error(
      "V1_PUBLIC_VISITOR_VERIFICATION_COMMAND must print a verification URL for the generated visitor email.",
    );
  }
  await config.page.goto(verificationUrl);
  await config.page.waitForLoadState("networkidle");
}

test.describe("V1 seeded demo", () => {
  test.skip(
    !demoEmail || !demoPassword,
    "Set V1_DEMO_EMAIL and V1_DEMO_PASSWORD to run the seeded V1 demo smoke.",
  );

  test("completes ingest, SSE chat, citations, and events", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const prompt =
      "How does the product chat service stream answers and persist app state?";

    await page.goto("/login");
    await page.getByLabel(ko.auth.email).fill(demoEmail ?? "");
    await page.getByLabel(ko.auth.password).fill(demoPassword ?? "");
    await page.getByRole("button", { name: ko.auth.loginSubmit }).click();

    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.getByText(ko.service.sessionRestored)).toBeVisible();

    await page.getByRole("link", { name: ko.service.nav.documents }).click();
    await expect(
      page.getByRole("heading", {
        name: ko.admin.documents.title,
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: new RegExp(seededDocumentTitle) }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: new RegExp(seededDocumentTitle) })
      .click();
    await page
      .getByRole("button", { name: ko.admin.documents.runIngest })
      .click();
    await expect(
      page.getByRole("heading", {
        name: ko.admin.documents.extractionRuns,
        exact: true,
      }),
    ).toBeVisible();
    const extractionRunsSection = page
      .locator("section")
      .filter({ hasText: ko.admin.documents.extractionRuns });
    await expect(
      extractionRunsSection
        .getByText(new RegExp(`\\d+ ${ko.admin.common.chunks}`))
        .first(),
    ).toBeVisible();

    await page.getByRole("link", { name: ko.service.nav.chat }).click();
    const activeConversationHeading = page
      .getByText(ko.chat.activeConversationLabel)
      .locator("..")
      .getByRole("heading");
    const previousConversationTitle =
      await activeConversationHeading.textContent();
    await page.getByRole("button", { name: ko.chat.newButton }).click();
    await expect
      .poll(() => activeConversationHeading.textContent(), {
        timeout: 10_000,
      })
      .not.toBe(previousConversationTitle);
    await expect(activeConversationHeading).toBeVisible();
    const conversationTitle = await activeConversationHeading.textContent();
    if (!conversationTitle)
      throw new Error("Created conversation title missing.");

    await page.getByPlaceholder(ko.chat.composerPlaceholder).fill(prompt);
    await page.getByRole("button", { name: ko.chat.send }).click();

    await expect(page.getByText(prompt)).toBeVisible();
    await expect(page.getByText(ko.chat.agentComposing)).toBeVisible();
    await expect(page.getByText(ko.chat.agentComposing)).toBeHidden({
      timeout: 20_000,
    });
    await expect(
      page.getByPlaceholder(ko.chat.composerPlaceholder),
    ).toBeEnabled({
      timeout: 90_000,
    });

    await expect(latestAssistantFooter(page)).toBeVisible({ timeout: 15_000 });
    await expectChatTranscriptLayoutBounded(page);
    await expectLatestAssistantFooterEvidence(page, "retrieval_completed");

    await page.reload();
    await page
      .getByRole("button", {
        name: new RegExp(escapeRegExp(conversationTitle)),
      })
      .click();
    await expect(activeConversationHeading).toHaveText(conversationTitle);
    await expectChatTranscriptLayoutBounded(page);
    await expectLatestAssistantFooterEvidence(page, "retrieval_completed");
  });
});

test.describe("V1 public visitor smoke", () => {
  test.skip(
    !publicVisitorSmoke,
    "Set V1_PUBLIC_VISITOR_SMOKE=1 to run the public visitor final-proof smoke.",
  );

  test("creates a unique visitor account and proves refresh-safe product evidence", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const config = requirePublicVisitorConfig();
    const prompt = `Use the document titled ${config.documentTitle} to summarize what this public visitor smoke proves.`;

    await page.goto("/signup");
    await page.getByLabel(ko.auth.email).fill(config.email);
    await page.getByLabel(ko.auth.password).fill(config.password);
    await page.getByRole("button", { name: ko.auth.signupSubmit }).click();
    await expect(page.getByText(ko.auth.signupSuccessTitle)).toBeVisible();
    await expect(page.getByText(config.email)).toBeVisible();

    await completePublicVisitorVerification({ ...config, page });

    await page.goto("/login");
    await page.getByLabel(ko.auth.email).fill(config.email);
    await page.getByLabel(ko.auth.password).fill(config.password);
    await page.getByRole("button", { name: ko.auth.loginSubmit }).click();
    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.getByText(ko.service.sessionRestored)).toBeVisible();
    await assertBrowserStorageHasNoSecrets(page);

    await page.reload();
    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.getByText(ko.service.sessionRestored)).toBeVisible();
    await assertBrowserStorageHasNoSecrets(page);

    await page.getByRole("link", { name: ko.service.nav.documents }).click();
    await page
      .getByLabel(ko.admin.documents.titleLabel)
      .fill(config.documentTitle);
    await page
      .getByLabel(ko.admin.documents.contentLabel)
      .fill(config.documentContent);
    await page
      .getByRole("button", { name: ko.admin.documents.createButton })
      .click();
    await expect(
      page.getByRole("button", {
        name: new RegExp(escapeRegExp(config.documentTitle)),
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: ko.admin.documents.runIngest })
      .click();

    const extractionRunsSection = page
      .locator("section")
      .filter({ hasText: ko.admin.documents.extractionRuns });
    await expect(
      extractionRunsSection
        .getByText(new RegExp(`\\d+ ${ko.admin.common.chunks}`))
        .first(),
    ).toBeVisible({ timeout: 30_000 });

    await page.getByRole("link", { name: ko.service.nav.chat }).click();
    const activeConversationHeading = page
      .getByText(ko.chat.activeConversationLabel)
      .locator("..")
      .getByRole("heading");
    const previousConversationTitle =
      await activeConversationHeading.textContent();
    await page.getByRole("button", { name: ko.chat.newButton }).click();
    await expect
      .poll(() => activeConversationHeading.textContent(), { timeout: 10_000 })
      .not.toBe(previousConversationTitle);
    const conversationTitle = await activeConversationHeading.textContent();
    if (!conversationTitle)
      throw new Error("Created public visitor conversation title missing.");

    await page.getByPlaceholder(ko.chat.composerPlaceholder).fill(prompt);
    await page.getByRole("button", { name: ko.chat.send }).click();
    await expect(page.getByText(prompt)).toBeVisible();
    await expect(page.getByText(ko.chat.agentComposing)).toBeHidden({
      timeout: 30_000,
    });
    await expect(
      page.getByPlaceholder(ko.chat.composerPlaceholder),
    ).toBeEnabled({
      timeout: 90_000,
    });

    await expect(latestAssistantFooter(page)).toBeVisible({ timeout: 20_000 });
    await expectChatTranscriptLayoutBounded(page);
    await expectLatestAssistantFooterEvidence(page, /retrieval_/);

    await page.reload();
    await page
      .getByRole("button", {
        name: new RegExp(escapeRegExp(conversationTitle)),
      })
      .click();
    await expect(activeConversationHeading).toHaveText(conversationTitle);
    await expectChatTranscriptLayoutBounded(page);
    await expectLatestAssistantFooterEvidence(page, /retrieval_/);
    await assertBrowserStorageHasNoSecrets(page);
  });
});

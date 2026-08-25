import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";
import { expectChatTranscriptLayoutBounded } from "./helpers/layout";

const demoEmail = process.env.V1_DEMO_EMAIL;
const demoPassword = process.env.V1_DEMO_PASSWORD;
const publicVisitorSmoke = process.env.V1_PUBLIC_VISITOR_SMOKE === "1";
const seededDocumentTitle = "V1 Product Chat Service Demo";
const sensitiveStoragePattern =
  /(api[_-]?key|csrf|password|session|sk-[a-zA-Z0-9]|token)/i;

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

  // Either label, because the disclosure is named for what the run reported:
  // an attributed run lists consulted sources, a pre-attribution one lists
  // citations. The demo runs against a live backend that may be either.
  await footer
    .getByLabel(
      new RegExp(
        `${escapeRegExp(ko.chat.viewCitationDetails)}|${escapeRegExp(
          ko.chat.viewConsultedDetails,
        )}`,
      ),
    )
    .click();
  // The panel lists documents by name now. It deliberately shows no
  // `document_id`, `chunk_id` or snippet, so the old assertion on
  // `chat.documentLabel` was asserting the presence of something removed.
  await expect(
    footer
      .getByText(
        new RegExp(
          `${escapeRegExp(ko.chat.citationSourcesTitle)}|${escapeRegExp(
            ko.chat.consultedSourcesTitle,
          )}`,
        ),
      )
      .first(),
  ).toBeVisible();
  await footer
    .getByLabel(new RegExp(escapeRegExp(ko.chat.viewResponseEvidence)))
    .click();
  await expect(
    footer.getByText(ko.chat.runStatuses.completed).first(),
  ).toBeVisible();
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
    nickname: `Visitor ${nonce}`,
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
      .getByRole("button", {
        name: ko.admin.documents.sourceRowActionsLabel.replace(
          "{title}",
          seededDocumentTitle,
        ),
      })
      .click();
    await page
      .getByRole("menuitem", { name: ko.admin.documents.reingestSourceAction })
      .click();
    await expect(
      page.getByRole("heading", {
        name: ko.admin.documents.prepareRecoveryTitle,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: ko.admin.documents.runIngest })
      .click();
    const extractionRunsSection = page.getByRole("dialog", {
      name: ko.admin.documents.prepareRecoveryTitle,
    });
    await expect(
      extractionRunsSection
        .getByText(new RegExp(`\\d+ ${ko.admin.common.chunks}`))
        .first(),
    ).toBeVisible();
    await page.getByRole("button", { name: ko.admin.common.close }).click();

    await page.getByRole("link", { name: ko.service.nav.chat }).click();
    // `새 대화` is a link to the empty new-chat state now, not a POST. The
    // conversation is created by the first send and named after it.
    await page.getByRole("link", { name: ko.chat.newButton }).first().click();
    await expect(page).toHaveURL(/\/chat$/);

    await page.getByPlaceholder(ko.chat.composerPlaceholder).fill(prompt);
    await page.getByRole("button", { name: ko.chat.send }).click();

    await expect(page).toHaveURL(/\/chat\/[^/]+$/);
    const conversationUrl = page.url();
    const conversationTitle = prompt;

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

    // The conversation is in the URL now, so a reload restores it rather than
    // dropping back to the most recent one.
    await page.reload();
    await expect(page).toHaveURL(conversationUrl);
    await expect(
      page
        .getByRole("link", {
          name: new RegExp(escapeRegExp(conversationTitle)),
        })
        .first(),
    ).toHaveAttribute("aria-current", "page");
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
    await page.getByLabel(ko.auth.nickname).fill(config.nickname);
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
      .getByRole("button", {
        name: ko.admin.documents.sourceRowActionsLabel.replace(
          "{title}",
          config.documentTitle,
        ),
      })
      .click();
    await page
      .getByRole("menuitem", { name: ko.admin.documents.reingestSourceAction })
      .click();
    await expect(
      page.getByRole("heading", {
        name: ko.admin.documents.prepareRecoveryTitle,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: ko.admin.documents.runIngest })
      .click();

    const extractionRunsSection = page.getByRole("dialog", {
      name: ko.admin.documents.prepareRecoveryTitle,
    });
    await expect(
      extractionRunsSection
        .getByText(new RegExp(`\\d+ ${ko.admin.common.chunks}`))
        .first(),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: ko.admin.common.close }).click();

    await page.getByRole("link", { name: ko.service.nav.chat }).click();
    // See the authenticated smoke above: `새 대화` navigates, the first send
    // creates.
    await page.getByRole("link", { name: ko.chat.newButton }).first().click();
    await expect(page).toHaveURL(/\/chat$/);

    await page.getByPlaceholder(ko.chat.composerPlaceholder).fill(prompt);
    await page.getByRole("button", { name: ko.chat.send }).click();
    await expect(page).toHaveURL(/\/chat\/[^/]+$/);
    const conversationUrl = page.url();
    const conversationTitle = prompt;
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
    await expect(page).toHaveURL(conversationUrl);
    await expect(
      page
        .getByRole("link", {
          name: new RegExp(escapeRegExp(conversationTitle)),
        })
        .first(),
    ).toHaveAttribute("aria-current", "page");
    await expectChatTranscriptLayoutBounded(page);
    await expectLatestAssistantFooterEvidence(page, /retrieval_/);
    await assertBrowserStorageHasNoSecrets(page);
  });
});

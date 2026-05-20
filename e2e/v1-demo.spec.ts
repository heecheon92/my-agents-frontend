import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";

const demoEmail = process.env.V1_DEMO_EMAIL;
const demoPassword = process.env.V1_DEMO_PASSWORD;
const seededDocumentTitle = "V1 Portfolio Chat Service Demo";

function panelByHeading(page: import("@playwright/test").Page, name: string) {
  return page.getByRole("heading", { name, exact: true }).locator("..");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.skip(
  !demoEmail || !demoPassword,
  "Set V1_DEMO_EMAIL and V1_DEMO_PASSWORD to run the seeded V1 demo smoke.",
);

test("V1 seeded demo completes ingest, SSE chat, citations, and events", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const prompt =
    "How does the portfolio chat service stream answers and persist app state?";

  await page.goto("/login");
  await page.getByLabel(ko.auth.email).fill(demoEmail ?? "");
  await page.getByLabel(ko.auth.password).fill(demoPassword ?? "");
  await page.getByRole("button", { name: ko.auth.loginSubmit }).click();

  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByText(ko.service.sessionRestored)).toBeVisible();

  await page.getByRole("link", { name: ko.service.nav.documents }).click();
  await expect(
    page.getByRole("heading", { name: ko.admin.documents.title, exact: true }),
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
  await expect(page.getByPlaceholder(ko.chat.composerPlaceholder)).toBeEnabled({
    timeout: 90_000,
  });

  await expect(
    panelByHeading(page, ko.chat.runHistory).getByText(
      ko.chat.runStatuses.completed,
    ),
  ).toBeVisible({ timeout: 15_000 });
  const citationsPanel = panelByHeading(page, ko.chat.latestCitations);
  const eventsPanel = panelByHeading(page, ko.chat.activityEvents);
  await expect(
    citationsPanel.getByText(ko.chat.documentLabel).first(),
  ).toBeVisible();
  await expect(
    eventsPanel.getByText("retrieval_completed").first(),
  ).toBeVisible();

  await page.reload();
  await page
    .getByRole("button", { name: new RegExp(escapeRegExp(conversationTitle)) })
    .click();
  await expect(activeConversationHeading).toHaveText(conversationTitle);
  await expect(
    citationsPanel.getByText(ko.chat.documentLabel).first(),
  ).toBeVisible();
  await expect(
    eventsPanel.getByText("retrieval_completed").first(),
  ).toBeVisible();
});

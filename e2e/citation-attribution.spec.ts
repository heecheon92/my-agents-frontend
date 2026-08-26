import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";
import { mockWorkspace } from "./helpers/mock-workspace";

const chat = ko.chat;
const CONVERSATION_URL = "/chat/c-visual";

/**
 * Citations used to be every positive-score chunk handed to the model, so the
 * panel presented consulted sources as cited ones. The backend now splits them:
 * `consulted_sources` is the superset, `citations` the answer-supported subset.
 *
 * The attribution selector is deliberately conservative and only sees the
 * 240-character disclosed snippet, so "nothing matched" is a normal outcome —
 * these specs treat it as a first-class case, not an edge one.
 */
test.describe("citation attribution", () => {
  test("badges only the sources the answer verifiably used", async ({
    page,
  }) => {
    await mockWorkspace(page, { attribution: "supported" });
    await page.goto(CONVERSATION_URL);

    const summary = page.getByText(
      chat.consultedSummary.replace("{count}", "2"),
    );
    await expect(summary).toBeVisible();
    await expect(page.getByText("응답 근거", { exact: true })).toHaveCount(0);
    await expect(page.getByText("작업 내역", { exact: true })).toHaveCount(0);
    await expect(
      page.locator('[data-onboarding-target="chat.response-evidence"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-onboarding-target="chat.agent-process"]'),
    ).toBeVisible();
    await summary.click();

    // Two documents from three chunks: the cited document contributed two, and
    // they collapse into one row carrying both page numbers.
    const badges = page.locator('[data-slot="supported-source-badge"]');
    await expect(badges).toHaveCount(1);
    await expect(page.getByText("partner-contract-2026.pdf")).toHaveCount(1);
    await expect(
      page.getByText(chat.citationPages.replace("{pages}", "4, 9")),
    ).toBeVisible();
    await expect(page.getByText("product-roadmap-2026.pdf")).toBeVisible();
    await expect(page.getByText(chat.supportedSourceHint)).toBeVisible();

    // Nothing chunk-level reaches the panel: no snippets, no identifiers, and
    // no advanced disclosure that used to carry them.
    const panel = page
      .locator('[data-slot="supported-source-badge"]')
      .locator("xpath=ancestor::div[1]");
    await expect(panel.getByText("갱신 통지는", { exact: false })).toHaveCount(
      0,
    );
    await expect(panel.getByText("doc-contract")).toHaveCount(0);
    await expect(panel.getByText("chunk-4")).toHaveCount(0);
  });

  test("keeps the panel and explains itself when nothing matched", async ({
    page,
  }) => {
    // The regression this guards. The panel used to be gated on
    // `citations.length > 0`, so an answer with zero verified sources would
    // have made the whole disclosure disappear — which reads as the product
    // losing a feature, not as it being honest.
    await mockWorkspace(page, { attribution: "none" });
    await page.goto(CONVERSATION_URL);

    const summary = page.getByText(
      chat.consultedSummary.replace("{count}", "2"),
    );
    await expect(summary).toBeVisible();
    await summary.click();

    await expect(
      page.locator('[data-slot="no-supported-source"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-slot="supported-source-badge"]'),
    ).toHaveCount(0);
    // The consulted sources are still listed, which is the entire point.
    await expect(page.getByText("product-roadmap-2026.pdf")).toBeVisible();
  });

  test("never badges a run that predates attribution", async ({ page }) => {
    // A backend without the attribution migration omits `consulted_sources`.
    // Those citations were never verified, so badging them would put a
    // stronger claim on old answers than on new ones.
    await mockWorkspace(page);
    await page.goto(CONVERSATION_URL);

    const summary = page.getByText(
      chat.citationSummary.replace("{count}", "1"),
    );
    await expect(summary).toBeVisible();
    await summary.click();

    await expect(
      page.locator('[data-slot="supported-source-badge"]'),
    ).toHaveCount(0);
    await expect(page.locator('[data-slot="no-supported-source"]')).toHaveCount(
      0,
    );
    // Legacy wording, not the consulted wording.
    await expect(page.getByText(chat.citationSourcesTitle)).toBeVisible();
  });
});

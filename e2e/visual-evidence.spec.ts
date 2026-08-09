import { expect, test } from "@playwright/test";
import {
  expectChatTranscriptLayoutBounded,
  expectNoHorizontalOverflow,
  expectNoNestedChatScroll,
  VIEWPORTS,
} from "./helpers/layout";
import {
  dismissOnboarding,
  hideDevIndicators,
  mockWorkspace,
} from "./helpers/mock-workspace";

/**
 * Visual evidence harness.
 *
 * This is deliberately not a snapshot suite — it captures screenshots for human
 * review before and after a visual change, and asserts only the layout
 * contracts that cannot regress silently. Screenshots land in
 * `test-results/visual-evidence/`, which is gitignored.
 *
 * Run a labelled pass with:
 *   VISUAL_EVIDENCE_LABEL=before pnpm exec playwright test visual-evidence
 */

const LABEL = process.env.VISUAL_EVIDENCE_LABEL ?? "current";
const OUTPUT_DIR = `test-results/visual-evidence/${LABEL}`;

const ROUTES = [
  { name: "landing", path: "/", anonymous: true },
  { name: "login", path: "/login", anonymous: true },
  { name: "guest", path: "/guest", anonymous: true },
  { name: "chat", path: "/chat", anonymous: false },
  { name: "knowledge", path: "/knowledge", anonymous: false },
  { name: "groups", path: "/groups", anonymous: false },
  { name: "settings-account", path: "/settings/account", anonymous: false },
  {
    name: "settings-experimental",
    path: "/settings/experimental",
    anonymous: false,
  },
] as const;

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} (${viewport.width}px)`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of ROUTES) {
      test(`${route.name} renders without horizontal overflow`, async ({
        page,
      }) => {
        await mockWorkspace(page, { anonymous: route.anonymous });
        await page.goto(route.path);
        await page.waitForLoadState("networkidle");
        if (!route.anonymous) await dismissOnboarding(page);
        await hideDevIndicators(page);

        await expectNoHorizontalOverflow(
          page,
          `${route.name} @ ${viewport.width}px`,
        );

        await page.screenshot({
          path: `${OUTPUT_DIR}/${viewport.name}-${route.name}.png`,
          fullPage: true,
        });
      });
    }

    test("chat transcript stays bounded with a single scroller", async ({
      page,
    }) => {
      await mockWorkspace(page);
      await page.goto("/chat");
      await page.waitForLoadState("networkidle");
      await hideDevIndicators(page);

      await expect(page.getByTestId("chat-workspace-panel")).toBeVisible();
      await expectChatTranscriptLayoutBounded(page);
      await expectNoNestedChatScroll(page);
    });
  });
}

test.describe("empty states", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  for (const route of ["/chat", "/knowledge", "/groups"] as const) {
    test(`${route} empty state`, async ({ page }) => {
      await mockWorkspace(page, { empty: true });
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await hideDevIndicators(page);

      await expectNoHorizontalOverflow(page, `${route} empty @ 1280px`);
      await page.screenshot({
        path: `${OUTPUT_DIR}/empty${route.replace(/\//g, "-")}.png`,
        fullPage: true,
      });
    });
  }
});

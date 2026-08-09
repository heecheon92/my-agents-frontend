import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";
import { expectNoHorizontalOverflow } from "./helpers/layout";
import {
  dismissOnboarding,
  hideDevIndicators,
  mockWorkspace,
} from "./helpers/mock-workspace";

const LABEL = process.env.VISUAL_EVIDENCE_LABEL ?? "current";
const OUTPUT_DIR = `test-results/visual-evidence/${LABEL}/dark`;

const THEMED_ROUTES = ["/chat", "/knowledge", "/groups"] as const;

/** Relative luminance per WCAG 2.x. */
function luminance([r, g, b]: number[]) {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: number[], b: number[]) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function parseRgb(value: string): number[] | null {
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  const parts = match[1].split(",").map((part) => Number.parseFloat(part));
  // A fully transparent colour tells us nothing about rendered contrast.
  if (parts.length > 3 && parts[3] === 0) return null;
  return parts.slice(0, 3);
}

test.describe("dark theme", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("applies from the cookie with no light flash", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: "theme", value: "dark", url: "http://localhost:3000" },
    ]);
    await mockWorkspace(page);
    await page.goto("/chat");

    // Server-rendered, so the class is present in the first HTML byte rather
    // than applied after hydration.
    await expect(page.locator("html")).toHaveClass(/dark/);
    const colorScheme = await page.evaluate(
      () => document.documentElement.style.colorScheme,
    );
    expect(colorScheme).toBe("dark");
  });

  test("resolves the system preference before paint", async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: "dark" });
    const page = await context.newPage();
    await mockWorkspace(page);
    await page.goto("/chat");

    // No cookie set, so this can only come from the pre-paint script.
    await expect(page.locator("html")).toHaveClass(/dark/);
    await context.close();
  });

  test("stays light when the preference overrides a dark system", async ({
    browser,
  }) => {
    const context = await browser.newContext({ colorScheme: "dark" });
    await context.addCookies([
      { name: "theme", value: "light", url: "http://localhost:3000" },
    ]);
    const page = await context.newPage();
    await mockWorkspace(page);
    await page.goto("/chat");

    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await context.close();
  });

  for (const route of THEMED_ROUTES) {
    test(`${route} meets AA contrast in dark mode`, async ({
      page,
      context,
    }) => {
      await context.addCookies([
        { name: "theme", value: "dark", url: "http://localhost:3000" },
      ]);
      await mockWorkspace(page);
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await dismissOnboarding(page);
      await hideDevIndicators(page);

      await expectNoHorizontalOverflow(page, `${route} dark @ 1280px`);

      const samples = await page.evaluate(() => {
        const results: Array<{
          text: string;
          color: string;
          background: string;
          fontSize: number;
          bold: boolean;
        }> = [];

        /** Walks ancestors for the nearest non-transparent background. */
        const effectiveBackground = (element: Element) => {
          let node: Element | null = element;
          while (node) {
            const bg = window.getComputedStyle(node).backgroundColor;
            const parts = bg.match(/rgba?\(([^)]+)\)/);
            if (parts) {
              const values = parts[1].split(",").map(Number.parseFloat);
              if (values.length < 4 || values[3] > 0.9) return bg;
            }
            node = node.parentElement;
          }
          return "rgb(255, 255, 255)";
        };

        for (const element of Array.from(
          document.querySelectorAll("p, span, h1, h2, h3, label, td, th, a"),
        )) {
          const text = element.textContent?.trim() ?? "";
          if (!text || text.length > 120) continue;
          if (element.querySelector("*")) continue; // leaf nodes only
          const rect = element.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          const style = window.getComputedStyle(element);
          if (style.visibility === "hidden" || style.opacity === "0") continue;

          results.push({
            text: text.slice(0, 40),
            color: style.color,
            background: effectiveBackground(element),
            fontSize: Number.parseFloat(style.fontSize),
            bold: Number.parseInt(style.fontWeight, 10) >= 700,
          });
        }
        return results;
      });

      expect(samples.length).toBeGreaterThan(10);

      const failures: string[] = [];
      for (const sample of samples) {
        const foreground = parseRgb(sample.color);
        const background = parseRgb(sample.background);
        if (!foreground || !background) continue;

        const ratio = contrastRatio(foreground, background);
        // WCAG 2.2 AA: 3.0 for large text (>=24px, or >=18.66px bold), else 4.5.
        const isLarge =
          sample.fontSize >= 24 || (sample.bold && sample.fontSize >= 18.66);
        const required = isLarge ? 3 : 4.5;
        if (ratio < required) {
          failures.push(
            `"${sample.text}" ${ratio.toFixed(2)}:1 (needs ${required}) ${sample.color} on ${sample.background}`,
          );
        }
      }

      expect(
        failures,
        `dark-mode contrast failures on ${route}:\n${failures.join("\n")}`,
      ).toEqual([]);

      await page.screenshot({
        path: `${OUTPUT_DIR}${route.replace(/\//g, "-")}.png`,
        fullPage: true,
      });
    });
  }

  test("settings exposes the theme control", async ({ page }) => {
    await mockWorkspace(page);
    await page.goto("/settings/appearance");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
    await hideDevIndicators(page);

    const dark = page.getByRole("radio", {
      name: ko.settings.appearance.themeOptions.dark,
    });
    await expect(dark).toBeVisible();
    // The input itself is `sr-only`, so click the label the way a user does.
    await page
      .getByText(ko.settings.appearance.themeOptions.dark, { exact: true })
      .click();
    await expect(dark).toBeChecked();

    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.screenshot({
      path: `${OUTPUT_DIR}-settings-appearance.png`,
      fullPage: true,
    });
  });
});

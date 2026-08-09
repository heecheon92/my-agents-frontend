import { expect, type Page } from "@playwright/test";

/**
 * Layout contracts that can only be checked against real computed style.
 *
 * Vitest runs in a node environment with no DOM, so the unit tests around
 * `CHAT_WORKSPACE_PANEL_CLASS_NAME` can only string-match class names. These
 * helpers assert what those class names are *for*: the transcript stays inside
 * the viewport, exactly one element scrolls, and no route overflows sideways.
 */

export const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
] as const;

export type ViewportName = (typeof VIEWPORTS)[number]["name"];

/**
 * The page must never scroll horizontally. This is the single most common
 * mobile failure mode and nothing in the suite checked for it before.
 */
export async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const offenders: string[] = [];
    // Report the widest offending elements so a failure is actionable rather
    // than just "something is too wide".
    for (const element of Array.from(document.body.querySelectorAll("*"))) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0) continue;
      if (rect.right > root.clientWidth + 1 || rect.left < -1) {
        const tag = element.tagName.toLowerCase();
        const testId = element.getAttribute("data-testid");
        const className =
          typeof element.className === "string" ? element.className : "";
        offenders.push(
          `${tag}${testId ? `[${testId}]` : ""}.${className.split(/\s+/).slice(0, 4).join(".")} (right=${Math.round(rect.right)})`,
        );
      }
      if (offenders.length >= 5) break;
    }
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      offenders,
    };
  });

  expect(
    overflow.scrollWidth,
    `${label} overflows horizontally by ${overflow.scrollWidth - overflow.clientWidth}px. First offenders: ${overflow.offenders.join(" | ") || "none identified"}`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

/**
 * The chat transcript must fit the viewport and scroll internally, rather than
 * growing the page. Lifted out of `v1-demo.spec.ts`, where it was gated behind
 * `V1_DEMO_*` env vars and therefore never ran.
 */
export async function expectChatTranscriptLayoutBounded(page: Page) {
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

/**
 * The transcript's scroll region must not itself sit inside another scroller.
 *
 * Note what this deliberately does *not* forbid: bounded, internally scrolling
 * evidence and citation cards inside a message footer are intended
 * (`DESIGN.md`: "long payloads scroll inside the card"). The failure mode worth
 * catching is scroll nesting along the transcript's own ancestor chain — a page
 * that scrolls, containing a panel that scrolls, containing the transcript —
 * which is what `docs/mobile-responsiveness.md` warns about and what the
 * `calc(100dvh - …)` panel height used to cause.
 */
export async function expectNoNestedChatScroll(page: Page) {
  const ancestors = await page
    .getByTestId("chat-scroll-region")
    .evaluate((scrollRegion) => {
      const offenders: string[] = [];
      let node = scrollRegion.parentElement;
      while (node && node !== document.documentElement) {
        const overflowY = window.getComputedStyle(node).overflowY;
        const scrolls =
          (overflowY === "auto" || overflowY === "scroll") &&
          node.scrollHeight > node.clientHeight + 1;
        if (scrolls) {
          const testId = node.getAttribute("data-testid");
          const className =
            typeof node.className === "string" ? node.className : "";
          offenders.push(
            `${node.tagName.toLowerCase()}${testId ? `[${testId}]` : ""}{${className}}`,
          );
        }
        node = node.parentElement;
      }
      return offenders;
    });

  expect(
    ancestors,
    `the chat transcript must be the only scroller on its ancestor chain, but these also scroll: ${ancestors.join(" | ")}`,
  ).toEqual([]);
}

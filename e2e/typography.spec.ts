import { expect, test } from "@playwright/test";
import { mockWorkspace } from "./helpers/mock-workspace";

/**
 * Typography evidence.
 *
 * Asserts the two things a screenshot cannot prove: that the self-hosted
 * Korean face actually loaded and is what body text resolves to, and that
 * Hangul line-breaking follows `keep-all` rather than breaking mid-word.
 */

test("serves Pretendard and resolves body text to it", async ({ page }) => {
  const fontRequests: string[] = [];
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("/fonts/pretendard/")) {
      fontRequests.push(`${response.status()} ${url.split("/").pop()}`);
    }
  });

  await mockWorkspace(page);
  await page.goto("/chat");
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);

  // The dynamic-subset build only fetches the ranges a page uses, so this is
  // a handful of files, not all 92.
  expect(fontRequests.length).toBeGreaterThan(0);
  expect(fontRequests.every((entry) => entry.startsWith("200"))).toBe(true);

  const loaded = await page.evaluate(() =>
    document.fonts.check('16px "Pretendard Variable"'),
  );
  expect(loaded).toBe(true);

  const bodyFont = await page.evaluate(
    () => window.getComputedStyle(document.body).fontFamily,
  );
  expect(bodyFont).toContain("Pretendard Variable");
  // Geist Sans carried no Hangul and must not be in the chain any more.
  expect(bodyFont).not.toContain("Geist");
});

test("breaks Korean text at word boundaries, not mid-word", async ({
  page,
}) => {
  await mockWorkspace(page);
  await page.goto("/chat");
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);

  const result = await page.evaluate(() => {
    // Long unspaced Korean compounds, in a container narrow enough that at
    // least one of them cannot fit on a line.
    const sentence =
      "지식베이스에서 문서를추가하면 답변옆에서 인용을확인할수있습니다";

    /** Counts words that a line break lands inside. */
    const countMidWordBreaks = (wordBreak: string) => {
      const element = document.createElement("p");
      element.textContent = sentence;
      element.style.cssText = `position:absolute;visibility:hidden;width:150px;font-size:16px;line-height:24px;overflow-wrap:normal;word-break:${wordBreak};`;
      document.body.appendChild(element);

      const textNode = element.firstChild as Text;
      let broken = 0;
      let offset = 0;
      for (const word of sentence.split(" ")) {
        const range = document.createRange();
        range.setStart(textNode, offset);
        range.setEnd(textNode, offset + word.length);
        // A word rendered across two lines produces rects at two different
        // vertical positions.
        const lineTops = new Set(
          Array.from(range.getClientRects()).map((rect) =>
            Math.round(rect.top),
          ),
        );
        if (lineTops.size > 1) broken += 1;
        offset += word.length + 1;
      }

      element.remove();
      return broken;
    };

    return {
      keepAll: countMidWordBreaks("keep-all"),
      normal: countMidWordBreaks("normal"),
      bodyWordBreak: window.getComputedStyle(document.body).wordBreak,
    };
  });

  expect(result.bodyWordBreak).toBe("keep-all");
  // Guards the probe itself: if the default did not break mid-word here, the
  // container was not narrow enough and the assertion below proves nothing.
  expect(result.normal).toBeGreaterThan(0);
  expect(result.keepAll).toBe(0);
});

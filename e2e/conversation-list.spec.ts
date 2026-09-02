import { expect, type Page, test } from "@playwright/test";
import ko from "@/localization/ko.json";
import { dismissOnboarding, mockWorkspace } from "./helpers/mock-workspace";

/** No spaces to break on, which is the case that used to widen the rail. */
const UNBROKEN_TITLE =
  "Pydantic_Annotated_Literal_설계검토_2026_최종본_v3_공유용_확정.md";
const SHORT_TITLE = "짧은 제목";

async function openConversationList(page: Page, isTouchWidth = false) {
  await mockWorkspace(page);
  await page.route("**/api/my-agents/conversations", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: "c-2", title: UNBROKEN_TITLE, owner_user_id: "u-visual" },
        { id: "c-visual", title: SHORT_TITLE, owner_user_id: "u-visual" },
      ]),
    });
  });
  await page.goto("/chat/c-2");
  await dismissOnboarding(page);
  // Below `md` the whole sidebar is a closed Sheet, so the history is not in
  // the tree until it is opened — and the onboarding card sits over the very
  // trigger that opens it, so it has to be gone first. `dismissOnboarding`
  // checks visibility once and returns early if the prompt has not mounted
  // yet, hence the settle before a second attempt.
  if (isTouchWidth) {
    await page.waitForTimeout(400);
    await dismissOnboarding(page);
    await page
      .getByRole("button", { name: ko.service.toggleSidebar })
      .first()
      .click();
  }
  const link = page
    .locator("a")
    .filter({ hasText: "Pydantic_Annotated" })
    .first();
  await expect(link).toBeVisible({ timeout: 5000 });
  return link;
}

/*
 * The list is a grid, and a grid item's default `min-width: auto` resolves to
 * its min-content — for a `nowrap` title, the whole untruncated string. One long
 * title made a row 578px wide inside a 271px rail and the history scrolled
 * sideways. `overflow-y: auto` also forces the computed `overflow-x` to `auto`,
 * so there was a real scroller to scroll.
 */
test("never scrolls the conversation list sideways", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const link = await openConversationList(page);

  const measured = await link.evaluate((anchor) => {
    const row = anchor.parentElement as HTMLElement;
    const list = row.parentElement as HTMLElement;
    const title = anchor.querySelectorAll("span")[1] as HTMLElement;
    return {
      listScrollsX: list.scrollWidth > list.clientWidth + 1,
      rowWidth: Math.round(row.getBoundingClientRect().width),
      listWidth: list.clientWidth,
      titleClipped: title.scrollWidth > title.clientWidth + 1,
      documentOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  });

  expect(measured.listScrollsX).toBe(false);
  expect(measured.rowWidth).toBeLessThanOrEqual(measured.listWidth);
  expect(measured.documentOverflow).toBe(0);
  // Truncated rather than wrapped or widened.
  expect(measured.titleClipped).toBe(true);
});

/*
 * The control sits *over* the title rather than beside it, so a row never gives
 * up width to a button that is invisible most of the time. The title then has to
 * get out from under it, which a mask does on any row background — active,
 * hovered, or transparent — without the fade needing to know which.
 */
test("lays the delete control over the title only while it is offered", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const link = await openConversationList(page);
  const row = link.locator("..");

  await page.mouse.move(5, 5);
  const atRest = await link.evaluate((anchor) => {
    const title = anchor.querySelectorAll("span")[1] as HTMLElement;
    return getComputedStyle(title).getPropertyValue("--km-title-fade").trim();
  });
  // Nothing is covering the title, so none of it is given away.
  expect(atRest).toBe("0px");

  await row.hover();
  const hovered = await link.evaluate((anchor) => {
    const rowElement = anchor.parentElement as HTMLElement;
    const button = rowElement.querySelector("button") as HTMLElement;
    const title = anchor.querySelectorAll("span")[1] as HTMLElement;
    const titleBox = title.getBoundingClientRect();
    const buttonBox = button.getBoundingClientRect();
    const rowBox = rowElement.getBoundingClientRect();
    return {
      fade: getComputedStyle(title).getPropertyValue("--km-title-fade").trim(),
      position: getComputedStyle(button).position,
      overlapsTitle: buttonBox.left < titleBox.right,
      insideRow:
        buttonBox.right <= rowBox.right + 0.5 && buttonBox.left >= rowBox.left,
    };
  });

  expect(hovered.fade).not.toBe("0px");
  expect(hovered.position).toBe("absolute");
  expect(hovered.overlapsTitle).toBe(true);
  // Overlaid, but never hanging outside the row it belongs to.
  expect(hovered.insideRow).toBe(true);
});

/*
 * The assertions above all passed while the control was completely dead, which
 * is the reason this test exists. `Button` sets a `transform` in its `active:`
 * state, and `transform` is a single property, so centring the overlay with
 * `-translate-y-1/2` meant pressing it replaced the centring and dropped the
 * button half its height mid-press: `mousedown` landed on the button,
 * `mouseup` on the anchor beneath it, and the browser fired `click` on their
 * common ancestor. Geometry and computed styles cannot see that. Only pressing
 * it can.
 */
test("opens the delete dialog when the overlaid control is actually pressed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const link = await openConversationList(page);
  const row = link.locator("..");
  await row.hover();

  await row.locator("button").first().click();

  await expect(page.getByRole("alertdialog")).toBeVisible();
  // Pressing delete must not also follow the link underneath it.
  expect(page.url().endsWith("/chat/c-2")).toBe(true);
});

/*
 * The fade and the control have to be on together or not at all. They were
 * once on different conditions — the fade also answered to `focus-within`,
 * which a plain click on the conversation satisfies — so opening a
 * conversation left its title faded with no icon to explain the gap.
 */
test("clears the fade with the control when the row is no longer hovered", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const link = await openConversationList(page);
  const row = link.locator("..");

  const state = () =>
    link.evaluate((anchor) => {
      const title = anchor.querySelectorAll("span")[1] as HTMLElement;
      const button = (anchor.parentElement as HTMLElement).querySelector(
        "button",
      ) as HTMLElement;
      return {
        fade: getComputedStyle(title)
          .getPropertyValue("--km-title-fade")
          .trim(),
        control: getComputedStyle(button).opacity,
      };
    });

  await row.hover();
  const hovered = await state();
  expect(hovered.fade).not.toBe("0px");
  expect(hovered.control).toBe("1");

  // Clicking focuses the anchor, which is exactly what used to strand the fade.
  await link.click();
  await page.mouse.move(700, 700);
  await expect.poll(async () => (await state()).control).toBe("0");
  expect((await state()).fade).toBe("0px");
});

test("brings the fade back when the control takes keyboard focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const link = await openConversationList(page);

  const focusedTrash = await link.evaluate((anchor) => {
    const button = (anchor.parentElement as HTMLElement).querySelector(
      "button",
    ) as HTMLButtonElement;
    button.focus();
    const title = anchor.querySelectorAll("span")[1] as HTMLElement;
    return {
      fade: getComputedStyle(title).getPropertyValue("--km-title-fade").trim(),
      control: getComputedStyle(button).opacity,
    };
  });

  expect(focusedTrash.fade).not.toBe("0px");
  expect(focusedTrash.control).toBe("1");
});

test("still follows the conversation link when the title is pressed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openConversationList(page);

  await page.locator("a").filter({ hasText: SHORT_TITLE }).first().click();

  await expect(page).toHaveURL(/\/chat\/c-visual$/);
});

test("keeps the delete control reachable without hover on touch widths", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openConversationList(page, true);

  const deleteButton = page
    .locator("a")
    .filter({ hasText: "Pydantic_Annotated" })
    .first()
    .locator("..")
    .locator("button")
    .first();

  await expect(deleteButton).toBeVisible();
  const measured = await deleteButton.evaluate((button) => {
    const box = button.getBoundingClientRect();
    const title = (button.parentElement as HTMLElement).querySelectorAll(
      "span",
    )[1] as HTMLElement;
    return {
      opacity: getComputedStyle(button).opacity,
      fade: getComputedStyle(title ?? button)
        .getPropertyValue("--km-title-fade")
        .trim(),
      width: Math.round(box.width),
      documentOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  });

  expect(measured.opacity).toBe("1");
  expect(measured.documentOverflow).toBe(0);
});

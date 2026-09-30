import { expect, type Page, test } from "@playwright/test";
import ko from "@/localization/ko.json";
import { expectNoHorizontalOverflow } from "./helpers/layout";
import { mockWorkspace } from "./helpers/mock-workspace";

const chat = ko.chat;
const account = ko.settings.account;

function reasoningTrigger(page: Page) {
  return page.getByRole("button", {
    name: new RegExp(chat.reasoningEffortLabel),
  });
}

async function openControls(page: Page) {
  await reasoningTrigger(page).click();
  await expect(page.getByRole("slider")).toBeVisible();
}

function modelRadio(page: Page, name: string | RegExp, exact = false) {
  return page.getByRole("radio", { name, exact });
}

function waitForModelPatch(page: Page) {
  return page.waitForRequest(
    (request) =>
      request.method() === "PATCH" &&
      request.url().endsWith("/api/my-agents/assistant/preferences"),
  );
}

test.describe("assistant model selection", () => {
  test("states the effective model on the composer trigger", async ({
    page,
  }) => {
    await mockWorkspace(page, { assistantModels: true });
    await page.goto("/chat");

    await expect(reasoningTrigger(page)).toContainText("GPT-6 Luna");
    await expect(reasoningTrigger(page)).toContainText(
      chat.reasoningEffortLabels.medium,
    );
  });

  test("saves a model and adopts that model's reasoning capabilities", async ({
    page,
  }) => {
    await mockWorkspace(page, { assistantModels: true });
    await page.goto("/chat");
    await openControls(page);

    // The mock's default model has no Pro; the other one does. The switch
    // following the model is what proves reasoning capabilities refetched.
    const pro = page.getByRole("switch", { name: chat.reasoningProLabel });
    await expect(pro).toBeDisabled();
    await expect(
      modelRadio(
        page,
        chat.assistantModelDefaultOption.replace("{name}", "GPT-6 Luna"),
      ),
    ).toBeChecked();

    const patch = waitForModelPatch(page);
    await modelRadio(page, "GPT-6.1 Sol").check();
    expect((await patch).postDataJSON()).toEqual({
      assistant_model: "gpt-6.1-sol",
    });

    await expect(modelRadio(page, "GPT-6.1 Sol")).toBeChecked();
    await expect(pro).toBeEnabled();
    // No stored effort, so the new model's served recommendation applies —
    // the frontend holds no default of its own.
    await expect(
      page.getByText(chat.reasoningEffortLabels.high).first(),
    ).toBeVisible();
    await expect(reasoningTrigger(page)).toContainText("GPT-6.1 Sol");
  });

  test("saves without dimming the list or swapping copy", async ({ page }) => {
    // A local save settles in tens of milliseconds. Disabling the list or
    // swapping the hint for that window read as a flicker on every choice.
    await mockWorkspace(page, { assistantModels: true });
    let patches = 0;
    await page.route(
      "**/api/my-agents/assistant/preferences",
      async (route) => {
        if (route.request().method() === "PATCH") {
          patches += 1;
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
        await route.fallback();
      },
    );
    await page.goto("/chat");
    await openControls(page);
    await page.evaluate(() => {
      const record: string[] = [];
      (window as unknown as { __modelFrames: string[] }).__modelFrames = record;
      const fieldset = document.querySelector(
        '[data-slot="assistant-model-options"]',
      ) as HTMLFieldSetElement;
      const snapshot = () => {
        const opacity = [...fieldset.querySelectorAll("label")].map(
          (label) => getComputedStyle(label).opacity,
        );
        const hint = fieldset.parentElement?.querySelector("p")?.textContent;
        record.push(`${fieldset.disabled}|${opacity.join(",")}|${hint}`);
      };
      new MutationObserver(snapshot).observe(fieldset.parentElement as Node, {
        subtree: true,
        attributes: true,
        childList: true,
        characterData: true,
      });
      snapshot();
    });

    await modelRadio(page, "GPT-6.1 Sol").click();
    // A second choice mid-save is ignored rather than racing the first.
    await modelRadio(page, "GPT-6 Luna", true).click({ force: true });
    await expect(modelRadio(page, "GPT-6.1 Sol")).toBeChecked();
    await expect(reasoningTrigger(page)).toContainText("GPT-6.1 Sol");
    await expect(pro(page)).toBeEnabled();

    const frames = await page.evaluate(
      () => (window as unknown as { __modelFrames: string[] }).__modelFrames,
    );
    expect(new Set(frames).size).toBe(1);
    expect(patches).toBe(1);
  });

  test("offers only the served catalog when the default is not advertised", async ({
    page,
  }) => {
    await mockWorkspace(page, {
      assistantModels: true,
      assistantModelCatalog: "exposed",
    });
    await page.goto("/chat");
    // The unadvertised default still answers, so the trigger names it, by ID.
    await expect(reasoningTrigger(page)).toContainText("gpt-5.6-sol");
    await openControls(page);

    const radios = page
      .locator('[data-slot="assistant-model-options"]')
      .getByRole("radio");
    // Reset-to-default plus exactly the three served models, in served order.
    await expect(radios).toHaveCount(4);
    await expect(
      modelRadio(
        page,
        chat.assistantModelDefaultOption.replace("{name}", "gpt-5.6-sol"),
      ),
    ).toBeChecked();
    await expect(modelRadio(page, "gpt-5.6-sol", true)).toHaveCount(0);
    await expect(
      page.locator('[data-slot="assistant-model-unlisted"]'),
    ).toHaveCount(0);

    const patch = waitForModelPatch(page);
    await modelRadio(page, "GPT-6 Astra").click();
    expect((await patch).postDataJSON()).toEqual({
      assistant_model: "gpt-6-astra",
    });
    await expect(reasoningTrigger(page)).toContainText("GPT-6 Astra");
  });

  test("keeps an unadvertised saved model without calling it the default", async ({
    page,
  }) => {
    await mockWorkspace(page, {
      assistantModels: true,
      assistantModelCatalog: "exposed",
      savedAssistantModel: "gpt-5.6-luna",
    });
    await page.goto("/chat");
    await expect(reasoningTrigger(page)).toContainText("gpt-5.6-luna");
    await openControls(page);

    const options = page.locator('[data-slot="assistant-model-options"]');
    // No radio is checked: the saved model is not an option, and checking
    // "default" would misstate the saved setting.
    await expect(options.locator("input:checked")).toHaveCount(0);
    await expect(modelRadio(page, "gpt-5.6-luna", true)).toHaveCount(0);
    await expect(
      page.locator('[data-slot="assistant-model-unlisted"]'),
    ).toHaveText(
      chat.assistantModelUnlistedSelection.replace("{name}", "gpt-5.6-luna"),
    );

    const patch = waitForModelPatch(page);
    await modelRadio(
      page,
      chat.assistantModelDefaultOption.replace("{name}", "gpt-5.6-sol"),
    ).click();
    expect((await patch).postDataJSON()).toEqual({ assistant_model: null });
    await expect(reasoningTrigger(page)).toContainText("gpt-5.6-sol");
    await expect(
      page.locator('[data-slot="assistant-model-unlisted"]'),
    ).toHaveCount(0);

    await page.goto("/settings/account");
    await expect(
      page
        .locator('[data-slot="assistant-model-settings"]')
        .getByText(account.modelEffective.replace("{name}", "gpt-5.6-sol")),
    ).toBeVisible();
  });

  test("shows the unadvertised saved model in settings", async ({ page }) => {
    await mockWorkspace(page, {
      assistantModels: true,
      assistantModelCatalog: "exposed",
      savedAssistantModel: "gpt-5.6-luna",
    });
    await page.goto("/settings/account");
    const card = page.locator('[data-slot="assistant-model-settings"]');
    await expect(
      card.locator('[data-slot="assistant-model-unlisted"]'),
    ).toHaveText(
      account.modelUnlistedSelection.replace("{name}", "gpt-5.6-luna"),
    );
    await expect(card.locator("input:checked")).toHaveCount(0);
    await expect(card.getByRole("radio")).toHaveCount(4);
  });

  test("keeps an explicit effort across a model switch", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "my-agents.reasoning-preference",
        JSON.stringify({ mode: "standard", effort: "none" }),
      );
    });
    await mockWorkspace(page, { assistantModels: true });
    await page.goto("/chat");
    await openControls(page);

    await modelRadio(page, "GPT-6.1 Sol").check();
    await expect(pro(page)).toBeEnabled();
    await expect(reasoningTrigger(page)).toContainText(
      chat.reasoningEffortLabels.none,
    );
  });

  test("resets to the deployment default with null", async ({ page }) => {
    await mockWorkspace(page, { assistantModels: true });
    await page.goto("/chat");
    await openControls(page);
    await modelRadio(page, "GPT-6.1 Sol").check();
    await expect(pro(page)).toBeEnabled();

    const patch = waitForModelPatch(page);
    await modelRadio(
      page,
      chat.assistantModelDefaultOption.replace("{name}", "GPT-6 Luna"),
    ).check();
    expect((await patch).postDataJSON()).toEqual({ assistant_model: null });
    await expect(reasoningTrigger(page)).toContainText("GPT-6 Luna");
  });

  test("locks the choice for a guest and sends nothing", async ({ page }) => {
    await mockWorkspace(page, { assistantModels: true, guest: true });
    let patched = false;
    page.on("request", (request) => {
      if (
        request.method() === "PATCH" &&
        request.url().includes("/assistant/preferences")
      ) {
        patched = true;
      }
    });
    await page.goto("/chat");
    await openControls(page);

    await expect(modelRadio(page, "GPT-6.1 Sol")).toBeDisabled();
    await expect(page.getByText(chat.assistantModelLockedGuest)).toBeVisible();
    expect(patched).toBe(false);
  });

  test("settings and composer share one saved value", async ({ page }) => {
    await mockWorkspace(page, { assistantModels: true });
    await page.goto("/settings/account");

    const card = page.locator('[data-slot="assistant-model-settings"]');
    await expect(
      card.getByRole("heading", { name: account.modelTitle }),
    ).toBeVisible();
    const patch = waitForModelPatch(page);
    await card.getByRole("radio", { name: "GPT-6.1 Sol" }).check();
    await patch;
    await expect(card.getByText(account.modelSaved)).toBeVisible();
    await expect(
      card.getByText(account.modelEffective.replace("{name}", "GPT-6.1 Sol")),
    ).toBeVisible();

    await page.goto("/chat");
    await expect(reasoningTrigger(page)).toContainText("GPT-6.1 Sol");
  });

  test("shows a locked settings card to a guest", async ({ page }) => {
    await mockWorkspace(page, { assistantModels: true, guest: true });
    await page.goto("/settings/account");
    const card = page.locator('[data-slot="assistant-model-settings"]');
    await expect(
      card.getByRole("radio", { name: "GPT-6.1 Sol" }),
    ).toBeDisabled();
    await expect(card.getByText(account.modelLockedGuest)).toBeVisible();
  });

  test("hides the model entirely on a backend without the feature", async ({
    page,
  }) => {
    await mockWorkspace(page);
    await page.goto("/chat");
    await expect(reasoningTrigger(page)).not.toContainText("GPT");
    await openControls(page);
    await expect(page.getByRole("radio")).toHaveCount(0);

    await page.goto("/settings/account");
    await expect(page.getByText(account.modelUnavailable)).toBeVisible();
  });

  test("keeps send inside the composer row with the longest model name", async ({
    page,
  }) => {
    // The trigger grows by the model name. Page-level overflow checks miss a
    // send button pushed past the form's rounded edge, so measure it directly.
    await mockWorkspace(page, { assistantModels: true });
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/chat");
      await openControls(page);
      await modelRadio(page, "GPT-6.1 Sol").click();
      await expect(reasoningTrigger(page)).toContainText("GPT-6.1 Sol");
      await page.keyboard.press("Escape");
      await page.getByRole("textbox").first().fill("hi");
      const form = await page.locator("form").last().boundingBox();
      const send = await page
        .getByRole("button", { name: chat.send, exact: true })
        .boundingBox();
      const trigger = await reasoningTrigger(page).boundingBox();
      expect(form && send && trigger).toBeTruthy();
      if (!form || !send || !trigger) return;
      expect(send.x + send.width).toBeLessThanOrEqual(form.x + form.width);
      // The trigger does not overlap the send button or clip its own text.
      expect(trigger.x + trigger.width).toBeLessThanOrEqual(send.x);
      await expect(
        page.locator('[data-slot="assistant-model-trigger-name"]'),
      ).toHaveText("GPT-6.1 Sol");
    }
  });

  test("fits the composer and open popover at phone width", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockWorkspace(page, { assistantModels: true });
    await page.goto("/chat");
    await expect(reasoningTrigger(page)).toContainText("GPT-6 Luna");
    await expectNoHorizontalOverflow(page, "chat composer with model");
    await openControls(page);
    await expectNoHorizontalOverflow(page, "model popover");
    await page.goto("/settings/account");
    await expectNoHorizontalOverflow(page, "account settings with model");
  });
});

function pro(page: Page) {
  return page.getByRole("switch", { name: chat.reasoningProLabel });
}

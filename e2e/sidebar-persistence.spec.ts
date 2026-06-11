import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";

const now = "2026-06-11T00:00:00.000Z";
const guestUser = {
  id: "guest-sidebar-user",
  email: null,
  email_verified_at: null,
  is_guest: true,
  guest_expires_at: "2026-06-12T00:00:00.000Z",
};
const conversation = {
  id: "sidebar-persistence-conversation",
  title: "Sidebar persistence",
  owner_user_id: guestUser.id,
};
const run = {
  run_id: "sidebar-persistence-run",
  conversation_id: conversation.id,
  status: "completed",
  route_label: "rag_agent",
  created_at: now,
};

async function mockSidebarWorkspace(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem(
      "my-agents:onboarding:guest:guest:v1",
      JSON.stringify({
        dismissed: true,
        updatedAt: "2026-06-11T00:00:00.000Z",
      }),
    );
  });

  await page.route("**/api/my-agents/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/my-agents", "");
    const method = request.method();
    const json = (value: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(value),
      });

    if (method === "GET" && path === "/auth/me") return json(guestUser);
    if (method === "GET" && path === "/groups") return json([]);
    if (method === "GET" && path === "/knowledge-bases") return json([]);
    if (method === "GET" && path === "/conversations") {
      return json([conversation]);
    }
    if (method === "GET" && path === `/conversations/${conversation.id}`) {
      return json(conversation);
    }
    if (
      method === "GET" &&
      path === `/conversations/${conversation.id}/messages`
    ) {
      return json([
        {
          id: "sidebar-message-user",
          conversation_id: conversation.id,
          role: "user",
          content: "Check sidebar persistence.",
        },
        {
          id: "sidebar-message-assistant",
          conversation_id: conversation.id,
          role: "assistant",
          content: "Sidebar state persists across reloads.",
        },
      ]);
    }
    if (method === "GET" && path === `/conversations/${conversation.id}/runs`) {
      return json([run]);
    }
    if (
      method === "GET" &&
      path === `/conversations/${conversation.id}/runs/${run.run_id}`
    ) {
      return json({
        ...run,
        reply: "Sidebar state persists across reloads.",
        handled_by: "rag_agent",
        citations: [],
      });
    }
    if (
      method === "GET" &&
      path === `/conversations/${conversation.id}/runs/${run.run_id}/events`
    ) {
      return json([]);
    }

    return json([]);
  });
}

test("service sidebar collapse preference persists across reloads", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockSidebarWorkspace(page);
  await page.goto("/chat");

  const sidebar = page.locator('[data-slot="sidebar"][data-state]').first();
  const toggle = page.getByRole("button", {
    name: ko.service.toggleSidebar,
  });

  await expect(sidebar).toHaveAttribute("data-state", "expanded");
  await expect(
    page.getByRole("link", { name: ko.service.nav.chat }),
  ).toBeVisible();

  await toggle.click();
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  await expect
    .poll(async () => {
      const collapsedButtonBoxes = await page
        .locator('[data-slot="sidebar-menu-button"]')
        .evaluateAll((elements) =>
          elements
            .filter(
              (element): element is HTMLElement =>
                element instanceof HTMLElement && element.offsetParent !== null,
            )
            .map((element) => {
              const rect = element.getBoundingClientRect();
              return {
                centerX: rect.x + rect.width / 2,
                height: rect.height,
                width: rect.width,
              };
            }),
        );
      if (collapsedButtonBoxes.length < 5) return false;
      const railCenterX = collapsedButtonBoxes[0]?.centerX ?? 0;
      return collapsedButtonBoxes.every(
        (box) =>
          Math.abs(box.centerX - railCenterX) <= 0.5 &&
          Math.abs(box.width - 32) <= 0.5 &&
          Math.abs(box.height - 32) <= 0.5,
      );
    })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => document.cookie))
    .toContain("sidebar_state=false");

  await page.reload();
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");

  await toggle.click();
  await expect(sidebar).toHaveAttribute("data-state", "expanded");
  await expect
    .poll(() => page.evaluate(() => document.cookie))
    .toContain("sidebar_state=true");
});

import { expect, test } from "@playwright/test";

const user = {
  id: "u-docs",
  email: "docs@example.com",
  email_verified_at: null,
  is_guest: false,
};

const personalKnowledgeBase = {
  id: "kb-personal",
  name: "Private Uploads",
  scope: "personal",
  owner_user_id: user.id,
  group_id: null,
  published_group_ids: [],
  created_at: "2026-05-25T00:00:00.000Z",
};

test("Documents upload drop zone adds dropped files to the queue", async ({
  page,
}) => {
  await page.route("**/api/my-agents/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/my-agents", "");
    const method = request.method();
    const json = (value: unknown) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(value),
      });

    if (method === "GET" && path === "/auth/me") return json(user);
    if (method === "GET" && path === "/knowledge-bases") {
      return json([personalKnowledgeBase]);
    }
    if (
      method === "GET" &&
      path === `/knowledge-bases/${personalKnowledgeBase.id}/documents`
    ) {
      return json([]);
    }
    if (method === "GET" && path === "/groups") return json([]);
    return route.fulfill({ status: 404, body: "{}" });
  });

  await page.goto("/documents");

  const dropZone = page.getByTestId("document-upload-dropzone");
  await expect(dropZone).toBeVisible();

  const dataTransfer = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(["hello from a dropped note"], "drop-note.txt", {
        type: "text/plain",
      }),
    );
    transfer.items.add(
      new File(["workbook"], "pipeline.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    transfer.items.add(
      new File(["deck"], "roadmap.pptx", {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      }),
    );
    return transfer;
  });

  await dropZone.dispatchEvent("dragenter", { dataTransfer });
  await expect(dropZone.getByText(/Drop files|파일을 놓으면/)).toBeVisible();
  await dropZone.dispatchEvent("drop", { dataTransfer });

  await expect(page.getByTestId("upload-queue")).toBeVisible();
  await expect(page.getByText("drop-note.txt")).toBeVisible();
  await expect(page.getByText("pipeline.xlsx")).toBeVisible();
  await expect(page.getByText("roadmap.pptx")).toBeVisible();
  await expect(page.getByText(/Spreadsheet|스프레드시트/)).toBeVisible();
  await expect(page.getByText(/Presentation|프레젠테이션/)).toBeVisible();
});

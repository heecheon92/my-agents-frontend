import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";

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

const teamGroup = {
  id: "g-research",
  name: "Research Team",
  role: "admin",
  created_at: "2026-05-25T00:00:00.000Z",
};

const teamKnowledgeBase = {
  id: "kb-team-research",
  name: "Team Research Library",
  scope: "group",
  owner_user_id: user.id,
  group_id: teamGroup.id,
  purpose: "standard",
  published_group_ids: [],
  created_at: "2026-05-25T00:00:00.000Z",
};

test("Sources upload drop zone adds dropped files to the queue", async ({
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

  await page.goto("/knowledge");
  await page
    .getByRole("button", { name: ko.admin.documents.uploadFilesAction })
    .click();

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

test("legacy Documents URL redirects to the Sources workflow", async ({
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
  await expect(page).toHaveURL(/\/knowledge$/);
  await expect(
    page.getByRole("heading", { name: ko.admin.documents.title, exact: true }),
  ).toBeVisible();
});

test("Knowledge subroutes preserve selected source spaces and groups", async ({
  page,
}) => {
  const knowledgeBases = [personalKnowledgeBase, teamKnowledgeBase];

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
      return json(knowledgeBases);
    }
    if (
      method === "GET" &&
      path === `/knowledge-bases/${personalKnowledgeBase.id}/documents`
    ) {
      return json([]);
    }
    if (
      method === "GET" &&
      path === `/knowledge-bases/${teamKnowledgeBase.id}/documents`
    ) {
      return json([]);
    }
    if (method === "GET" && path === "/groups") return json([teamGroup]);
    return route.fulfill({ status: 404, body: "{}" });
  });

  await page.goto(`/knowledge/${teamKnowledgeBase.id}`);
  await expect(
    page.getByRole("heading", { name: teamKnowledgeBase.name }),
  ).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(
    new RegExp(`/knowledge/${teamKnowledgeBase.id}$`),
  );
  await expect(
    page.getByRole("heading", { name: teamKnowledgeBase.name }),
  ).toBeVisible();

  await page.goto(`/knowledge/${teamGroup.id}`);
  await expect(page).toHaveURL(new RegExp(`/knowledge/${teamGroup.id}$`));
  await expect(
    page.getByRole("heading", { name: teamKnowledgeBase.name }),
  ).toBeVisible();

  await page.getByRole("link", { name: personalKnowledgeBase.name }).click();
  await expect(page).toHaveURL(
    new RegExp(`/knowledge/${personalKnowledgeBase.id}$`),
  );
  await expect(
    page.getByRole("heading", { name: personalKnowledgeBase.name }),
  ).toBeVisible();
});

test("Sources page creates the first source space from the dialog", async ({
  page,
}) => {
  let createdSourceSpace = false;
  const firstSourceSpace = {
    ...personalKnowledgeBase,
    id: "kb-first",
    name: "First research sources",
  };

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

    if (method === "GET" && path === "/auth/me") return json(user);
    if (method === "GET" && path === "/knowledge-bases") {
      return json(createdSourceSpace ? [firstSourceSpace] : []);
    }
    if (
      method === "GET" &&
      path === `/knowledge-bases/${firstSourceSpace.id}/documents`
    ) {
      return json([]);
    }
    if (method === "GET" && path === "/groups") return json([]);
    if (method === "POST" && path === "/knowledge-bases") {
      const payload = await request.postDataJSON();
      expect(payload).toMatchObject({
        name: "First research sources",
        scope: "personal",
      });
      createdSourceSpace = true;
      return json(firstSourceSpace, 201);
    }
    return route.fulfill({ status: 404, body: "{}" });
  });

  await page.goto("/knowledge");

  await page
    .getByRole("button", { name: ko.admin.documents.addSourceSpaceAction })
    .first()
    .click();
  await expect(
    page.getByRole("heading", {
      name: ko.admin.documents.createFirstSourceSpaceTitle,
    }),
  ).toBeVisible();
  await page
    .getByLabel(ko.admin.knowledge.nameLabel)
    .fill("First research sources");
  await page
    .getByRole("button", { name: ko.admin.knowledge.createPersonalButton })
    .click();

  await expect(
    page.getByRole("heading", { name: firstSourceSpace.name }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: ko.admin.documents.uploadFilesAction })
    .click();
  await expect(page.getByTestId("document-upload-dropzone")).toBeVisible();
});

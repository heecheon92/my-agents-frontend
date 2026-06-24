import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";

const user = {
  id: "u-docs",
  email: "docs@example.com",
  nickname: "Docs User",
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
  name: "Research Group",
  role: "admin",
  created_at: "2026-05-25T00:00:00.000Z",
};

const teamKnowledgeBase = {
  id: "kb-team-research",
  name: "Group Research Library",
  scope: "group",
  owner_user_id: user.id,
  group_id: teamGroup.id,
  purpose: "standard",
  published_group_ids: [],
  created_at: "2026-05-25T00:00:00.000Z",
};

const secondPersonalKnowledgeBase = {
  ...personalKnowledgeBase,
  id: "kb-personal-second",
  name: "Second Knowledge Base",
};

const firstDocument = {
  id: "doc-actions-1",
  title: "Quarterly planning note",
  owner_user_id: user.id,
  group_id: null,
  knowledge_base_id: personalKnowledgeBase.id,
  source_type: "text",
  source_filename: null,
  source_content_type: null,
  source_byte_size: null,
  source_sha256: null,
  source_page_count: null,
  parser_name: null,
};

const secondDocument = {
  ...firstDocument,
  id: "doc-actions-2",
  title: "Retained research note",
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
    transfer.items.add(
      new File(["doc"], "brief.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );
    return transfer;
  });

  await dropZone.dispatchEvent("dragenter", { dataTransfer });
  await expect(dropZone.getByText(/Drop files|파일을 놓으면/)).toBeVisible();
  await dropZone.dispatchEvent("drop", { dataTransfer });

  const uploadQueue = page.getByTestId("upload-queue");
  await expect(uploadQueue).toBeVisible();
  await expect(page.getByText("drop-note.txt")).toBeVisible();
  await expect(page.getByText("pipeline.xlsx")).toBeVisible();
  await expect(page.getByText("roadmap.pptx")).toBeVisible();
  await expect(page.getByText("brief.docx")).toBeVisible();
  await expect(page.getByText(/Spreadsheet|스프레드시트/)).toBeVisible();
  await expect(page.getByText(/Presentation|프레젠테이션/)).toBeVisible();
  await expect(uploadQueue.getByText("Word")).toBeVisible();
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

test("Knowledge selection does not flash the first source space after clicking another one", async ({
  page,
}) => {
  const knowledgeBases = [
    personalKnowledgeBase,
    secondPersonalKnowledgeBase,
    teamKnowledgeBase,
  ];

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
    for (const knowledgeBase of knowledgeBases) {
      if (
        method === "GET" &&
        path === `/knowledge-bases/${knowledgeBase.id}/documents`
      ) {
        return json([]);
      }
    }
    if (method === "GET" && path === "/groups") return json([teamGroup]);
    return route.fulfill({ status: 404, body: "{}" });
  });

  await page.goto(`/knowledge/${personalKnowledgeBase.id}`);
  await expect(
    page.getByRole("link", { name: personalKnowledgeBase.name }),
  ).toHaveAttribute("aria-current", "page");

  const transitionSamples = page.evaluate(
    async ({ firstName, secondName }) => {
      const normalize = (value: string | null | undefined) =>
        value?.replace(/\s+/g, " ").trim() ?? "";
      const activeSourceSpaces = () =>
        Array.from(document.querySelectorAll('a[aria-current="page"]'))
          .map((link) => normalize(link.textContent))
          .filter(
            (label) => label.includes(firstName) || label.includes(secondName),
          );
      const secondLink = Array.from(document.querySelectorAll("a")).find(
        (link) => normalize(link.textContent).includes(secondName),
      );
      if (!secondLink) throw new Error("Second source-space link not found.");

      return new Promise<string[][]>((resolve) => {
        secondLink.addEventListener(
          "click",
          () => {
            requestAnimationFrame(async () => {
              const samples: string[][] = [];
              for (let index = 0; index < 40; index += 1) {
                samples.push(activeSourceSpaces());
                await new Promise(requestAnimationFrame);
              }
              resolve(samples);
            });
          },
          { once: true },
        );
      });
    },
    {
      firstName: personalKnowledgeBase.name,
      secondName: secondPersonalKnowledgeBase.name,
    },
  );

  await page
    .getByRole("link", { name: secondPersonalKnowledgeBase.name })
    .click();

  const activeSamples = await transitionSamples;
  await expect(page).toHaveURL(
    new RegExp(`/knowledge/${secondPersonalKnowledgeBase.id}$`),
  );
  await expect(
    page.getByRole("link", { name: secondPersonalKnowledgeBase.name }),
  ).toHaveAttribute("aria-current", "page");
  expect(activeSamples).not.toContainEqual([personalKnowledgeBase.name]);
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

test("Sources table row actions prepare and delete one source", async ({
  page,
}) => {
  let documents = [firstDocument, secondDocument];
  let preparedDocumentId: string | undefined;

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
      return json([personalKnowledgeBase]);
    }
    if (
      method === "GET" &&
      path === `/knowledge-bases/${personalKnowledgeBase.id}/documents`
    ) {
      return json(documents);
    }
    if (
      method === "GET" &&
      path ===
        `/knowledge-bases/${personalKnowledgeBase.id}/documents/${firstDocument.id}/extraction-runs`
    ) {
      return json(
        preparedDocumentId
          ? [
              {
                id: "run-actions-1",
                document_id: firstDocument.id,
                status: "pending",
                stage: "queued",
                progress_percent: 0,
                chunk_count: 0,
                entity_count: 0,
                relationship_count: 0,
                error: null,
              },
            ]
          : [],
      );
    }
    if (method === "GET" && path === "/groups") return json([]);
    if (
      method === "POST" &&
      path ===
        `/knowledge-bases/${personalKnowledgeBase.id}/documents/${firstDocument.id}/ingest/async`
    ) {
      preparedDocumentId = firstDocument.id;
      return json({
        id: "run-actions-1",
        document_id: firstDocument.id,
        status: "pending",
        stage: "queued",
        progress_percent: 0,
        chunk_count: 0,
        entity_count: 0,
        relationship_count: 0,
        error: null,
      });
    }
    if (method === "DELETE" && path === `/documents/${firstDocument.id}`) {
      documents = documents.filter(
        (document) => document.id !== firstDocument.id,
      );
      return route.fulfill({ status: 204, body: "" });
    }
    return route.fulfill({ status: 404, body: "{}" });
  });

  await page.goto(`/knowledge/${personalKnowledgeBase.id}`);
  await expect(page.getByText(firstDocument.title)).toBeVisible();

  await page
    .getByRole("button", {
      name: ko.admin.documents.sourceRowActionsLabel.replace(
        "{title}",
        firstDocument.title,
      ),
    })
    .click();
  await expect(
    page.getByRole("menuitem", {
      name: ko.admin.documents.sourcePreviewAction,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", {
      name: ko.admin.documents.shareSourceMenuAction,
    }),
  ).toBeVisible();
  await page
    .getByRole("menuitem", { name: ko.admin.documents.reingestSourceAction })
    .click();
  await expect(
    page.getByRole("heading", {
      name: ko.admin.documents.prepareRecoveryTitle,
    }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: ko.admin.documents.runIngest })
    .click();
  await expect.poll(() => preparedDocumentId).toBe(firstDocument.id);
  await expect(page.getByText("직접 읽기 권한")).toHaveCount(0);
  await expect(page.getByText("고급 공유 제어")).toHaveCount(0);
  await page.getByRole("button", { name: ko.admin.common.close }).click();

  await page
    .getByRole("button", {
      name: ko.admin.documents.sourceRowActionsLabel.replace(
        "{title}",
        firstDocument.title,
      ),
    })
    .click();
  await page
    .getByRole("menuitem", { name: ko.admin.documents.deleteSourceMenuAction })
    .click();
  const deleteDialog = page.getByRole("dialog", {
    name: ko.admin.documents.deleteTitle,
  });
  await expect(
    deleteDialog.getByText(
      ko.admin.documents.deleteConfirm.replace("{title}", firstDocument.title),
    ),
  ).toBeVisible();
  await deleteDialog
    .getByRole("button", { name: ko.admin.documents.deleteButton })
    .click();
  await expect(page.getByText(firstDocument.title)).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: ko.admin.documents.openSourceDetails.replace(
        "{title}",
        secondDocument.title,
      ),
    }),
  ).toBeVisible();
});

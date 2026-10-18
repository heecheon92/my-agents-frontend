import { expect, type Page, type Route, test } from "@playwright/test";
import ko from "@/localization/ko.json";
import { dismissOnboarding, mockWorkspace } from "./helpers/mock-workspace";

/**
 * Private originals: direct upload to storage, the multipart route, original
 * download, preparing again from the original, the preparation record, and
 * the account's document preferences.
 *
 * Storage is a separate origin (`https://storage.test`), as it is in
 * production, so these cases can prove what crosses it: the signed PUT carries
 * no cookie and no CSRF header, and nothing about it goes through the BFF.
 */

const API = "**/api/my-agents";
const KB = "kb-personal";
const STORAGE = "https://storage.test";
const SHA256_HEX = /^[a-f0-9]{64}$/;

type DocumentsPolicy = {
  direct_uploads: boolean;
  ai_assisted_ingestion: boolean;
};

async function mockHealth(page: Page, policy: DocumentsPolicy) {
  await page.route(`${API}/health`, (route) =>
    route.fulfill({
      json: {
        status: "ok",
        service: "my-agents",
        version: "test",
        frontend_config: {
          documents: {
            upload_concurrency: 1,
            max_upload_bytes: 5_242_880,
            multipart_max_bytes: 4_000_000,
            allowed_extensions: [".pdf", ".md", ".txt"],
            ...policy,
          },
          durable_runs: { enabled: false, ready: false },
        },
      },
    }),
  );
}

async function mockPreferences(
  page: Page,
  initial: {
    document_retrieval_priority?: string;
    document_ingestion_mode?: string;
  } = {},
) {
  const state = {
    customizable: true,
    default_model: "gpt-6-luna",
    selected_model: null,
    effective_model: "gpt-6-luna",
    document_retrieval_priority: "automatic",
    document_ingestion_mode: "standard",
    ...initial,
  };
  const patches: unknown[] = [];
  await page.route(`${API}/assistant/preferences`, (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      patches.push(body);
      Object.assign(state, body);
    }
    return route.fulfill({ json: state });
  });
  return { patches };
}

const baseDocument = {
  owner_user_id: "u-1",
  group_id: null,
  knowledge_base_id: KB,
  source_type: "pdf_upload",
  source_content_type: "application/pdf",
  source_page_count: 3,
  parser_name: "pdf",
};

const retainedDocument = {
  ...baseDocument,
  id: "doc-retained",
  title: "보관된 원본 보고서",
  source_filename: "분기 보고서.pdf",
  source_byte_size: 120_000,
  source_sha256: "a".repeat(64),
  ingestion_mode: "ai_assisted",
  original_retained: true,
  processed_at: "2030-01-02T03:04:05Z",
  processing_provenance: {
    schema_version: 1,
    mode: "ai_assisted",
    provider: "openai",
    model: "gpt-6-luna",
    version: "fidelity-v1",
    input_sha256: "b".repeat(64),
    output_sha256: "c".repeat(64),
    section_count: 7,
    warnings: ["source_locations_are_section_level", "future_warning_code"],
  },
};

const legacyDocument = {
  ...baseDocument,
  id: "doc-legacy",
  title: "예전 문서",
  source_filename: "legacy.pdf",
  source_byte_size: 9_000,
  source_sha256: null,
};

function run(id: string, status: string, documentId: string) {
  return {
    id,
    document_id: documentId,
    status,
    stage: status === "completed" ? "completed" : "queued",
    progress_percent: status === "completed" ? 100 : 0,
    chunk_count: 3,
    entity_count: 0,
    relationship_count: 0,
    error: null,
    error_code: null,
  };
}

async function mockDocumentList(page: Page, documents: unknown[]) {
  await page.route(`${API}/knowledge-bases/${KB}/documents`, (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: documents })
      : route.fallback(),
  );
  await page.route(
    `${API}/knowledge-bases/${KB}/documents/*/extraction-runs`,
    (route) => route.fulfill({ json: [] }),
  );
  await page.route(`${API}/documents/*/extraction-runs`, (route) =>
    route.fulfill({ json: [] }),
  );
}

async function openUploadDialog(page: Page) {
  await page.goto(`/knowledge/${KB}`);
  await dismissOnboarding(page);
  await page
    .getByRole("button", { name: ko.admin.documents.uploadFilesAction })
    .click();
  await expect(page.getByTestId("document-upload-dropzone")).toBeVisible();
}

async function openSourceAction(page: Page, title: string, action: string) {
  await page
    .getByRole("button", {
      name: ko.admin.documents.sourceRowActionsLabel.replace("{title}", title),
    })
    .click();
  await page.getByRole("menuitem", { name: action }).click();
}

async function mockRecoverableUpload(
  page: Page,
  {
    lostCompletions = 0,
    completionFailure = "server",
    failedPolls = 0,
  }: {
    lostCompletions?: number;
    completionFailure?: "server" | "network" | "in_progress";
    failedPolls?: number;
  },
) {
  await mockWorkspace(page);
  await mockHealth(page, {
    direct_uploads: true,
    ai_assisted_ingestion: false,
  });
  await mockPreferences(page);
  const documents: unknown[] = [];
  await mockDocumentList(page, documents);
  const counts = { initiated: 0, puts: 0, completed: 0, aborted: 0, polls: 0 };
  const legacyCalls: string[] = [];
  const completed = {
    document: {
      ...baseDocument,
      id: "doc-recovered",
      title: "recoverable",
      source_filename: "recoverable.txt",
      original_retained: true,
    },
    extraction_run: run("run-recovered", "pending", "doc-recovered"),
  };
  await page.route(
    `${API}/knowledge-bases/${KB}/documents/uploads`,
    (route) => {
      counts.initiated += 1;
      return route.fulfill({
        status: 201,
        json: {
          upload_id: "up-recovered",
          method: "PUT",
          url: `${STORAGE}/objects/up-recovered?signature=secret`,
          headers: { "Content-Type": "text/plain" },
          expires_at: "2030-01-01T00:00:00Z",
          max_bytes: 5_242_880,
        },
      });
    },
  );
  await page.route(`${STORAGE}/objects/**`, (route) => {
    const headers = {
      "access-control-allow-origin": new URL(page.url()).origin,
      "access-control-allow-methods": "PUT",
      "access-control-allow-headers": "content-type",
    };
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers });
    }
    counts.puts += 1;
    return route.fulfill({ status: 200, headers, body: "" });
  });
  await page.route(
    `${API}/knowledge-bases/${KB}/documents/uploads/up-recovered`,
    (route) => {
      if (route.request().method() === "DELETE") counts.aborted += 1;
      return route.fulfill({ status: 204 });
    },
  );
  await page.route(
    `${API}/knowledge-bases/${KB}/documents/uploads/up-recovered/complete`,
    (route) => {
      counts.completed += 1;
      // The document commits before the browser receives a response. All
      // subsequent completion attempts refer to this one document and run.
      if (documents.length === 0) documents.push(completed.document);
      if (counts.completed <= lostCompletions) {
        if (completionFailure === "network")
          return route.abort("connectionreset");
        if (completionFailure === "in_progress") {
          return route.fulfill({
            status: 409,
            json: {
              code: "upload_in_progress",
              detail: "Private server detail",
            },
          });
        }
        return route.fulfill({ status: 500, body: "Internal Server Error" });
      }
      return route.fulfill({ status: 201, json: completed });
    },
  );
  await page.route(
    `${API}/knowledge-bases/${KB}/documents/doc-recovered/extraction-runs/run-recovered`,
    (route) => {
      counts.polls += 1;
      return counts.polls <= failedPolls
        ? route.fulfill({ status: 500, body: "Internal Server Error" })
        : route.fulfill({
            json: run("run-recovered", "completed", "doc-recovered"),
          });
    },
  );
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (/\/documents\/upload$|\/ingest\/async$/.test(path)) {
      legacyCalls.push(path);
    }
  });
  return { counts, documents, legacyCalls };
}

async function startRecoverableUpload(page: Page) {
  await openUploadDialog(page);
  await page
    .getByTestId("document-upload-dropzone")
    .locator('input[type="file"]')
    .setInputFiles({
      name: "recoverable.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("one original"),
    });
  await page
    .getByRole("button", { name: ko.admin.documents.uploadAndIngestButton })
    .click();
}

async function retryRecoverableUpload(page: Page) {
  await page
    .getByTestId("upload-queue")
    .getByRole("button", { name: ko.admin.documents.retryUpload })
    .click();
  await page
    .getByRole("button", { name: ko.admin.documents.uploadAndIngestButton })
    .click();
}

test.describe("document originals", () => {
  test("a lost completion response retries only completion and returns the committed document", async ({
    page,
  }) => {
    const { counts, documents, legacyCalls } = await mockRecoverableUpload(
      page,
      {
        lostCompletions: 1,
        completionFailure: "network",
      },
    );
    await startRecoverableUpload(page);
    const queue = page.getByTestId("upload-queue");
    await expect(
      queue.getByText(ko.admin.documents.uploadStatusLabels.completed, {
        exact: true,
      }),
    ).toBeVisible();
    expect(counts).toEqual({
      initiated: 1,
      puts: 1,
      completed: 2,
      aborted: 0,
      polls: 1,
    });
    expect(documents).toHaveLength(1);
    expect(legacyCalls).toEqual([]);
    await expect(queue.getByText("signature=secret")).toHaveCount(0);
  });

  test("manual retry after two failed completion responses keeps the same upload", async ({
    page,
  }) => {
    const { counts, documents, legacyCalls } = await mockRecoverableUpload(
      page,
      {
        lostCompletions: 2,
      },
    );
    await startRecoverableUpload(page);
    const queue = page.getByTestId("upload-queue");
    await expect(queue.getByText(ko.errors.byStatus.server)).toBeVisible();
    await expect(queue.getByText("Internal Server Error")).toHaveCount(0);
    await expect(
      queue.getByLabel(ko.admin.documents.fileTitleLabel),
    ).toBeDisabled();
    expect(counts.completed).toBe(2);

    await retryRecoverableUpload(page);
    await expect(
      queue.getByText(ko.admin.documents.uploadStatusLabels.completed, {
        exact: true,
      }),
    ).toBeVisible();
    expect(counts).toEqual({
      initiated: 1,
      puts: 1,
      completed: 3,
      aborted: 0,
      polls: 1,
    });
    expect(documents).toHaveLength(1);
    expect(legacyCalls).toEqual([]);
  });

  test("an in-progress completion can be retried without another upload", async ({
    page,
  }) => {
    const { counts, documents, legacyCalls } = await mockRecoverableUpload(
      page,
      {
        lostCompletions: 1,
        completionFailure: "in_progress",
      },
    );
    await startRecoverableUpload(page);
    const queue = page.getByTestId("upload-queue");
    await expect(
      queue.getByText(ko.errors.byCode.upload_in_progress),
    ).toBeVisible();
    await expect(queue.getByText("Private server detail")).toHaveCount(0);
    expect(counts.completed).toBe(1);

    await retryRecoverableUpload(page);
    await expect(
      queue.getByText(ko.admin.documents.uploadStatusLabels.completed, {
        exact: true,
      }),
    ).toBeVisible();
    expect(counts).toEqual({
      initiated: 1,
      puts: 1,
      completed: 2,
      aborted: 0,
      polls: 1,
    });
    expect(documents).toHaveLength(1);
    expect(legacyCalls).toEqual([]);
  });

  test("an uncoded polling error is localized and retry follows the existing run", async ({
    page,
  }) => {
    const { counts, documents, legacyCalls } = await mockRecoverableUpload(
      page,
      {
        failedPolls: 1,
      },
    );
    await startRecoverableUpload(page);
    const queue = page.getByTestId("upload-queue");
    await expect(queue.getByText(ko.errors.byStatus.server)).toBeVisible();
    await expect(queue.getByText("Internal Server Error")).toHaveCount(0);

    await retryRecoverableUpload(page);
    await expect(
      queue.getByText(ko.admin.documents.uploadStatusLabels.completed, {
        exact: true,
      }),
    ).toBeVisible();
    expect(counts).toEqual({
      initiated: 1,
      puts: 1,
      completed: 1,
      aborted: 0,
      polls: 2,
    });
    expect(documents).toHaveLength(1);
    expect(legacyCalls).toEqual([]);
  });

  test("a direct upload goes straight to storage, with no credentials", async ({
    page,
  }) => {
    await mockWorkspace(page);
    await mockHealth(page, {
      direct_uploads: true,
      ai_assisted_ingestion: true,
    });
    await mockPreferences(page);
    await mockDocumentList(page, []);
    const initiated: Array<Record<string, unknown>> = [];
    await page.route(
      `${API}/knowledge-bases/${KB}/documents/uploads`,
      (route) => {
        initiated.push(route.request().postDataJSON());
        return route.fulfill({
          status: 201,
          json: {
            upload_id: "up-1",
            method: "PUT",
            url: `${STORAGE}/objects/up-1?signature=secret`,
            headers: { "Content-Type": "text/plain" },
            expires_at: "2030-01-01T00:00:00Z",
            max_bytes: 5_242_880,
          },
        });
      },
    );
    const stored: Array<{ headers: Record<string, string>; body: string }> = [];
    await page.route(`${STORAGE}/**`, (route: Route) => {
      const request = route.request();
      const cors = {
        "access-control-allow-origin": new URL(page.url()).origin,
        "access-control-allow-methods": "PUT, GET, HEAD",
        "access-control-allow-headers": "content-type",
      };
      if (request.method() === "OPTIONS") {
        return route.fulfill({ status: 204, headers: cors });
      }
      stored.push({
        headers: request.headers(),
        body: request.postData() ?? "",
      });
      return route.fulfill({ status: 200, headers: cors, body: "" });
    });
    let completed = 0;
    await page.route(
      `${API}/knowledge-bases/${KB}/documents/uploads/up-1/complete`,
      (route) => {
        completed += 1;
        return route.fulfill({
          status: 201,
          json: {
            document: {
              ...baseDocument,
              id: "doc-new",
              title: "direct-note",
              source_filename: "direct-note.txt",
              original_retained: true,
              ingestion_mode: "ai_assisted",
            },
            extraction_run: run("run-new", "pending", "doc-new"),
          },
        });
      },
    );
    await page.route(
      `${API}/knowledge-bases/${KB}/documents/doc-new/extraction-runs/run-new`,
      (route) =>
        route.fulfill({ json: run("run-new", "completed", "doc-new") }),
    );
    const legacyCalls: string[] = [];
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (/\/documents\/upload$|\/ingest\/async$/.test(path)) {
        legacyCalls.push(path);
      }
    });

    await openUploadDialog(page);
    await page
      .locator('[data-slot="upload-ingestion-mode"]')
      .getByLabel(ko.admin.documents.ingestionModeLabels.ai_assisted)
      .check();
    await page
      .getByTestId("document-upload-dropzone")
      .locator('input[type="file"]')
      .setInputFiles({
        name: "direct-note.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("hello direct storage"),
      });
    await page
      .getByRole("button", { name: ko.admin.documents.uploadAndIngestButton })
      .click();

    await expect.poll(() => completed).toBe(1);
    await expect(
      page
        .getByTestId("upload-queue")
        .getByText(ko.admin.documents.uploadStatusLabels.completed)
        .first(),
    ).toBeVisible();
    expect(initiated).toHaveLength(1);
    expect(initiated[0]).toMatchObject({
      filename: "direct-note.txt",
      content_type: "text/plain",
      byte_size: 20,
      ingestion_mode: "ai_assisted",
    });
    expect(initiated[0]?.sha256).toMatch(SHA256_HEX);
    // The file went to storage once, with only the signed header.
    expect(stored).toHaveLength(1);
    expect(stored[0]?.body).toBe("hello direct storage");
    expect(stored[0]?.headers["content-type"]).toBe("text/plain");
    expect(stored[0]?.headers.cookie).toBeUndefined();
    expect(stored[0]?.headers["x-csrf-token"]).toBeUndefined();
    // Completion already started processing: nothing went the legacy way.
    expect(legacyCalls).toEqual([]);
    // The signed URL is never rendered.
    await expect(page.getByText("signature=secret")).toHaveCount(0);
  });

  test("without direct uploads, multipart carries a chosen mode and its own limit", async ({
    page,
  }) => {
    await mockWorkspace(page);
    await mockHealth(page, {
      direct_uploads: false,
      ai_assisted_ingestion: true,
    });
    await mockPreferences(page);
    await mockDocumentList(page, []);
    const multipartBodies: string[] = [];
    await page.route(
      `${API}/knowledge-bases/${KB}/documents/upload`,
      (route) => {
        multipartBodies.push(route.request().postData() ?? "");
        return route.fulfill({
          status: 201,
          json: { ...baseDocument, id: "doc-mp", title: "mp" },
        });
      },
    );
    await page.route(
      `${API}/knowledge-bases/${KB}/documents/doc-mp/ingest/async`,
      (route) =>
        route.fulfill({
          status: 202,
          json: run("run-mp", "completed", "doc-mp"),
        }),
    );
    let directCalls = 0;
    page.on("request", (request) => {
      if (/\/documents\/uploads/.test(request.url())) directCalls += 1;
    });

    await openUploadDialog(page);
    const input = page
      .getByTestId("document-upload-dropzone")
      .locator('input[type="file"]');
    // Over the multipart ceiling: refused before any request.
    await input.setInputFiles({
      name: "too-big.txt",
      mimeType: "text/plain",
      buffer: Buffer.alloc(4_200_000, 97),
    });
    await expect(page.getByText(/최대|크기|too large/i).first()).toBeVisible();
    await page
      .getByRole("button", { name: ko.admin.documents.removeUpload })
      .first()
      .click();

    await page
      .locator('[data-slot="upload-ingestion-mode"]')
      .getByLabel(ko.admin.documents.ingestionModeLabels.ai_assisted)
      .check();
    await input.setInputFiles({
      name: "small.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("small note"),
    });
    await page
      .getByRole("button", { name: ko.admin.documents.uploadAndIngestButton })
      .click();

    await expect.poll(() => multipartBodies.length).toBe(1);
    expect(multipartBodies[0]).toContain('name="ingestion_mode"');
    expect(multipartBodies[0]).toContain("ai_assisted");
    expect(directCalls).toBe(0);
  });

  test("the original downloads through a signed link, and prepares again with a mode", async ({
    page,
  }) => {
    await mockWorkspace(page);
    await mockHealth(page, {
      direct_uploads: true,
      ai_assisted_ingestion: true,
    });
    await mockPreferences(page);
    await mockDocumentList(page, [retainedDocument, legacyDocument]);
    await page.route(`${API}/documents/doc-retained/original`, (route) =>
      route.fulfill({
        json: {
          url: `${STORAGE}/originals/doc-retained?signature=secret`,
          expires_at: "2030-01-01T00:00:00Z",
          filename: "분기 보고서.pdf",
        },
      }),
    );
    await page.route(`${STORAGE}/originals/**`, (route) =>
      route.fulfill({
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition":
            "attachment; filename*=UTF-8''%EB%B6%84%EA%B8%B0%20%EB%B3%B4%EA%B3%A0%EC%84%9C.pdf",
        },
        body: "%PDF-1.7",
      }),
    );
    const reprocessBodies: unknown[] = [];
    await page.route(`${API}/documents/doc-retained/reprocess`, (route) => {
      reprocessBodies.push(route.request().postDataJSON());
      return route.fulfill({
        status: 202,
        json: run("run-again", "pending", "doc-retained"),
      });
    });

    await page.goto(`/knowledge/${KB}`);
    await dismissOnboarding(page);
    await openSourceAction(
      page,
      retainedDocument.title,
      ko.admin.documents.reingestSourceAction,
    );

    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: ko.admin.documents.downloadOriginalAction })
      .click();
    expect((await download).suggestedFilename()).toBe("분기 보고서.pdf");
    await expect(page.getByText("signature=secret")).toHaveCount(0);

    // Left at the saved default, nothing is sent: the backend applies it.
    await page
      .getByRole("button", { name: ko.admin.documents.reprocessAction })
      .click();
    await expect.poll(() => reprocessBodies).toEqual([{}]);
    // The choice is disabled while that request settles.
    await expect(
      page.getByRole("button", { name: ko.admin.documents.reprocessAction }),
    ).toBeEnabled();
    // Chosen here, the mode is sent explicitly.
    await page
      .locator('[data-slot="reprocess-ingestion-mode"]')
      .getByLabel(ko.admin.documents.ingestionModeLabels.ai_assisted)
      .check();
    await page
      .getByRole("button", { name: ko.admin.documents.reprocessAction })
      .click();
    await expect
      .poll(() => reprocessBodies)
      .toEqual([{}, { ingestion_mode: "ai_assisted" }]);
    await page.getByRole("button", { name: ko.admin.common.close }).click();

    // A legacy document has no original: both actions say why.
    await openSourceAction(
      page,
      legacyDocument.title,
      ko.admin.documents.reingestSourceAction,
    );
    await expect(
      page.getByRole("button", {
        name: ko.admin.documents.downloadOriginalAction,
      }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: ko.admin.documents.reprocessAction }),
    ).toBeDisabled();
    await expect(
      page.getByText(ko.admin.documents.reprocessUnavailable),
    ).toBeVisible();
  });

  test("the preparation record shows display-safe fields and localized notes", async ({
    page,
  }) => {
    await mockWorkspace(page);
    await mockHealth(page, {
      direct_uploads: true,
      ai_assisted_ingestion: true,
    });
    await mockPreferences(page);
    await mockDocumentList(page, [retainedDocument]);
    await page.route(
      `${API}/knowledge-bases/${KB}/documents/doc-retained/preview`,
      (route) =>
        route.fulfill({
          json: {
            id: "doc-retained",
            title: retainedDocument.title,
            content: "본문",
            created_at: "2030-01-01T00:00:00Z",
          },
        }),
    );

    await page.goto(`/knowledge/${KB}`);
    await dismissOnboarding(page);
    await openSourceAction(
      page,
      retainedDocument.title,
      ko.admin.documents.sourcePreviewAction,
    );
    await page
      .getByRole("tab", { name: ko.admin.documents.sourceAdvancedTab })
      .click();

    const record = page.locator('[data-slot="source-provenance"]');
    await expect(record).toBeVisible();
    await expect(
      record.getByText(ko.admin.documents.ingestionModeLabels.ai_assisted, {
        exact: true,
      }),
    ).toBeVisible();
    // AI cleanup sections are shown for an AI-prepared document.
    await expect(
      record.getByText(ko.admin.documents.provenanceSections, { exact: true }),
    ).toBeVisible();
    await expect(record.getByText("7", { exact: true })).toBeVisible();
    await expect(record.getByText("gpt-6-luna")).toBeVisible();
    await expect(
      record.getByText(
        ko.admin.documents.provenanceWarningLabels
          .source_locations_are_section_level,
      ),
    ).toBeVisible();
    // An unknown code gets generic copy, never the raw code.
    await expect(
      record.getByText(ko.admin.documents.provenanceWarningUnknown),
    ).toBeVisible();
    await expect(record.getByText("future_warning_code")).toHaveCount(0);
  });

  test("document preferences save only the changed field", async ({ page }) => {
    await mockWorkspace(page, { assistantModels: true });
    await mockHealth(page, {
      direct_uploads: true,
      ai_assisted_ingestion: true,
    });
    const { patches } = await mockPreferences(page);

    await page.goto("/settings/account");
    const card = page.locator('[data-slot="document-preferences"]');
    await expect(card).toBeVisible();
    await card.getByLabel(ko.settings.account.retrievalOnRequest).check();
    await expect
      .poll(() => patches)
      .toEqual([{ document_retrieval_priority: "on_request" }]);
    await card.getByLabel(ko.settings.account.ingestionAiAssisted).check();
    await expect
      .poll(() => patches)
      .toEqual([
        { document_retrieval_priority: "on_request" },
        { document_ingestion_mode: "ai_assisted" },
      ]);
    await expect(
      card.getByText(ko.settings.account.documentsSaved),
    ).toBeVisible();

    // Server-owned: a reload shows what was saved.
    await page.reload();
    await expect(
      card.getByLabel(ko.settings.account.retrievalOnRequest),
    ).toBeChecked();
    await expect(
      card.getByLabel(ko.settings.account.ingestionAiAssisted),
    ).toBeChecked();
  });

  test("AI cleanup cannot be chosen where the deployment has none", async ({
    page,
  }) => {
    await mockWorkspace(page, { assistantModels: true });
    await mockHealth(page, {
      direct_uploads: true,
      ai_assisted_ingestion: false,
    });
    await mockPreferences(page);

    await page.goto("/settings/account");
    const card = page.locator('[data-slot="document-preferences"]');
    await expect(
      card.getByLabel(ko.settings.account.ingestionAiAssisted),
    ).toBeDisabled();
    await expect(
      card.getByText(ko.settings.account.ingestionAiUnavailable),
    ).toBeVisible();
  });

  test("the composer says when documents are searched only on request", async ({
    page,
  }) => {
    await mockWorkspace(page, { assistantModels: true });
    await mockPreferences(page, { document_retrieval_priority: "on_request" });

    await page.goto("/chat/c-visual");
    await dismissOnboarding(page);
    await expect(
      page.locator('[data-slot="retrieval-on-request-hint"]'),
    ).toHaveText(ko.chat.retrievalOnRequestHint);
  });
});

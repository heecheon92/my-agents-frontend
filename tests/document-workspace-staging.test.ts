import { describe, expect, it } from "vitest";
import {
  combinedBytes,
  findFormatForFile,
  isDocumentWorkspaceUsable,
  producesCertifiedArtifact,
  resolveMaxFilesPerRun,
  type StagedFile,
  shouldAbortSendAfterUpload,
  usableAttachmentIds,
  validateStagedFile,
} from "@/components/chat/attachments/staging";
import type { DocumentWorkspaceCapability } from "@/model/my-agents";

function capability(
  overrides: Partial<DocumentWorkspaceCapability> = {},
): DocumentWorkspaceCapability {
  return {
    enabled: true,
    eligible: true,
    reason_code: null,
    provider: "openai",
    model: "served-model-id",
    registry_verified_at: "2026-08-09",
    limits: {
      max_files_per_run: 3,
      max_combined_bytes: 1_000,
      workspace_idle_ttl_seconds: 1_200,
    },
    formats: [
      {
        extension: ".xlsx",
        category: "spreadsheet",
        mime_types: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
        analysis_supported: true,
        artifact_status: "certified",
      },
      // Analysis-only, and deliberately not a document format: the certified
      // set is the backend's and widened on 2026-09-02 to include PDF, DOCX,
      // and PPTX. A fixture that still called PDF unavailable would encode a
      // claim the contract no longer makes.
      {
        extension: "txt",
        category: "text",
        mime_types: ["text/plain"],
        analysis_supported: true,
        artifact_status: "unavailable",
      },
    ],
    consent_required: true,
    retention: "ephemeral",
    ...overrides,
  };
}

function file(name: string, size: number, type = ""): File {
  const value = new File(["x"], name, { type });
  Object.defineProperty(value, "size", { value: size });
  return value;
}

function stagedOf(...files: File[]): StagedFile[] {
  return files.map((item, index) => ({ id: `staged-${index}`, file: item }));
}

describe("isDocumentWorkspaceUsable", () => {
  it("needs both the deployment flag and account eligibility", () => {
    expect(isDocumentWorkspaceUsable(capability())).toBe(true);
    expect(isDocumentWorkspaceUsable(capability({ enabled: false }))).toBe(
      false,
    );
    expect(isDocumentWorkspaceUsable(capability({ eligible: false }))).toBe(
      false,
    );
    // An absent capability is the 404 case: a backend without the feature.
    expect(isDocumentWorkspaceUsable(undefined)).toBe(false);
  });
});

describe("resolveMaxFilesPerRun", () => {
  it("uses the served limit", () => {
    expect(resolveMaxFilesPerRun(capability())).toBe(3);
  });

  it("clamps to the request schema ceiling a misconfigured backend could exceed", () => {
    // Settings enforce `<= 10`, so this cannot happen in a valid process. The
    // clamp exists so that if it ever does, the user is stopped locally rather
    // than by an unexplained 422 on send.
    const generous = capability({
      limits: {
        max_files_per_run: 25,
        max_combined_bytes: 1_000,
        workspace_idle_ttl_seconds: 1_200,
      },
    });
    expect(resolveMaxFilesPerRun(generous)).toBe(10);
  });
});

describe("findFormatForFile", () => {
  it("matches regardless of whether the served extension carries a dot", () => {
    // The registry is served data. `.xlsx` and `txt` are both present in the
    // fixture precisely because the frontend must not depend on which form the
    // backend chose.
    expect(findFormatForFile(capability(), file("q3.xlsx", 10))?.category).toBe(
      "spreadsheet",
    );
    expect(
      findFormatForFile(capability(), file("memo.txt", 10))?.category,
    ).toBe("text");
  });

  it("is case insensitive on the filename", () => {
    expect(findFormatForFile(capability(), file("Q3.XLSX", 10))).toBeDefined();
  });

  it("falls back to the browser-reported MIME type when the name has no extension", () => {
    expect(
      findFormatForFile(capability(), file("scan", 10, "text/plain"))?.category,
    ).toBe("text");
  });

  it("returns nothing for a format outside the served registry", () => {
    expect(
      findFormatForFile(capability(), file("clip.mp4", 10)),
    ).toBeUndefined();
  });
});

describe("producesCertifiedArtifact", () => {
  it("reads the served status rather than inferring from the extension", () => {
    // The distinction the UI must never blur. Which extensions are certified
    // is the backend's call and has already changed once, so the only safe
    // read is `artifact_status`.
    const formats = capability().formats;
    expect(producesCertifiedArtifact(formats[0])).toBe(true);
    expect(producesCertifiedArtifact(formats[1])).toBe(false);
    expect(producesCertifiedArtifact(undefined)).toBe(false);
  });
});

describe("validateStagedFile", () => {
  it("accepts a supported file within every limit", () => {
    expect(
      validateStagedFile({
        file: file("q3.xlsx", 100),
        capability: capability(),
        staged: [],
      }),
    ).toBeNull();
  });

  it("names an unsupported type before size", () => {
    // Both wrong at once. Telling the user it is too large would send them off
    // to shrink a file that would still be refused.
    expect(
      validateStagedFile({
        file: file("clip.mp4", 99_999),
        capability: capability(),
        staged: [],
      }),
    ).toBe("unsupported_attachment_type");
  });

  it("rejects a format the registry serves but does not analyze", () => {
    const noAnalysis = capability({
      formats: [
        {
          extension: ".xlsx",
          category: "spreadsheet",
          mime_types: [],
          analysis_supported: false,
          artifact_status: "unavailable",
        },
      ],
    });
    expect(
      validateStagedFile({
        file: file("q3.xlsx", 10),
        capability: noAnalysis,
        staged: [],
      }),
    ).toBe("unsupported_attachment_type");
  });

  it("rejects an empty file", () => {
    expect(
      validateStagedFile({
        file: file("q3.xlsx", 0),
        capability: capability(),
        staged: [],
      }),
    ).toBe("attachment_empty");
  });

  it("rejects one file over the combined ceiling", () => {
    expect(
      validateStagedFile({
        file: file("q3.xlsx", 1_001),
        capability: capability(),
        staged: [],
      }),
    ).toBe("attachment_too_large");
  });

  it("separates a file that only overflows once added to the others", () => {
    // A distinct message from `attachment_too_large`: this file is fine on its
    // own, so the user's move is to remove something else, not to shrink it.
    expect(
      validateStagedFile({
        file: file("b.xlsx", 600),
        capability: capability(),
        staged: stagedOf(file("a.xlsx", 600)),
      }),
    ).toBe("attachment_combined_too_large");
  });

  it("counts the file being added against the served file limit", () => {
    expect(
      validateStagedFile({
        file: file("d.xlsx", 1),
        capability: capability(),
        staged: stagedOf(
          file("a.xlsx", 1),
          file("b.xlsx", 1),
          file("c.xlsx", 1),
        ),
      }),
    ).toBe("attachment_limit_exceeded");
  });
});

describe("combinedBytes", () => {
  it("sums the staged selection", () => {
    expect(combinedBytes(stagedOf(file("a.xlsx", 40), file("b.xlsx", 2)))).toBe(
      42,
    );
    expect(combinedBytes([])).toBe(0);
  });
});

describe("shouldAbortSendAfterUpload", () => {
  it("abandons the send when nothing reached the provider", () => {
    // Starting anyway would answer a question about a file the assistant never
    // received, which reads as a wrong answer rather than a failed transfer.
    expect(
      shouldAbortSendAfterUpload({ stagedCount: 2, uploadedCount: 0 }),
    ).toBe(true);
  });

  it("sends on a partial success", () => {
    // The user gets an answer over the files that arrived; the rest stay
    // staged and retryable.
    expect(
      shouldAbortSendAfterUpload({ stagedCount: 2, uploadedCount: 1 }),
    ).toBe(false);
  });

  it("does not block an ordinary message with no files", () => {
    expect(
      shouldAbortSendAfterUpload({ stagedCount: 0, uploadedCount: 0 }),
    ).toBe(false);
  });
});

describe("usableAttachmentIds", () => {
  const attachments = [
    { id: "a-available", status: "available" },
    { id: "a-expired", status: "expired" },
    { id: "a-deleted", status: "deleted" },
  ];

  it("drops a selected file the server no longer reports as available", () => {
    // The refusal this prevents: a file can lapse while the composer sits
    // open, and sending its ID earns `attachment_expired` on a turn the user
    // believed was ready.
    expect(
      usableAttachmentIds(attachments, [
        "a-available",
        "a-expired",
        "a-deleted",
      ]),
    ).toEqual(["a-available"]);
  });

  it("drops an ID the conversation does not have at all", () => {
    expect(usableAttachmentIds(attachments, ["a-unknown"])).toEqual([]);
  });

  it("preserves selection order", () => {
    const many = [
      { id: "one", status: "available" },
      { id: "two", status: "available" },
    ];
    expect(usableAttachmentIds(many, ["two", "one"])).toEqual(["two", "one"]);
  });
});

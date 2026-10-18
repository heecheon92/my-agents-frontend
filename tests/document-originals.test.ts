import { afterEach, describe, expect, it, vi } from "vitest";
import { isSupportedUploadFile } from "@/components/admin-surfaces/sources/upload-config";
import { resolveUploadProgress } from "@/components/admin-surfaces/UploadQueueRow";
import ko from "@/localization/ko.json";
import {
  assistantPreferencesPatchRequestSchema,
  assistantPreferencesSchema,
  documentSchema,
  documentUploadPolicyFromHealth,
  extractionRunSchema,
  FALLBACK_MULTIPART_MAX_BYTES,
  healthResponseSchema,
} from "@/model/my-agents";
import { isAllowedBackendPath } from "@/server/my-agents/proxy-policy";
import {
  canComputeUploadDigest,
  completeDocumentUpload,
  DirectUploadCompletionError,
  type DirectUploadPort,
  DirectUploadPutError,
  putDirectUpload,
  sha256Hex,
  uploadDocumentDirect,
} from "@/services/my-agents/direct-upload";
import { MyAgentsAPIError } from "@/services/my-agents/MyAgentsAPIError";
import { errorCodeOf, extractionRunErrorMessage } from "@/utils/error-message";
import { defaultLocalization } from "@/utils/localization";

const KB = "kb-1";
const UPLOAD = "up-1";

function receipt(url = "https://storage.example/put?signature=one") {
  return {
    upload_id: UPLOAD,
    method: "PUT" as const,
    url,
    headers: { "Content-Type": "application/pdf" },
    expires_at: "2030-01-01T00:00:00Z",
    max_bytes: 5_242_880,
  };
}

const document = {
  id: "doc-1",
  title: "Report",
  owner_user_id: "u-1",
  group_id: null,
  knowledge_base_id: KB,
};

function fakePort(overrides: Partial<DirectUploadPort> = {}) {
  return {
    initiateUpload: vi.fn(async () => receipt()),
    refreshUpload: vi.fn(async () =>
      receipt("https://storage.example/put?signature=two"),
    ),
    completeUpload: vi.fn(async () => ({
      document: documentSchema.parse(document),
      extraction_run: null,
    })),
    abortUpload: vi.fn(async () => undefined),
    ...overrides,
  };
}

const file = new File(["%PDF-1.7 hello"], "report.pdf", {
  type: "application/pdf",
});

describe("direct upload orchestration", () => {
  it("initiates with the file's digest, PUTs, then completes", async () => {
    const api = fakePort();
    const put = vi.fn(async () => undefined);
    const phases: string[] = [];
    await uploadDocumentDirect({
      api,
      knowledgeBaseId: KB,
      file,
      title: "Report",
      put,
      digest: async () => "a".repeat(64),
      onPhase: (phase) => phases.push(phase),
    });
    expect(api.initiateUpload).toHaveBeenCalledWith(KB, {
      title: "Report",
      filename: "report.pdf",
      content_type: "application/pdf",
      byte_size: file.size,
      sha256: "a".repeat(64),
    });
    expect(put).toHaveBeenCalledTimes(1);
    expect(api.completeUpload).toHaveBeenCalledWith(KB, UPLOAD);
    expect(api.abortUpload).not.toHaveBeenCalled();
    expect(phases).toEqual(["hashing", "uploading", "completing"]);
  });

  it("sends a processing mode only when one was chosen", async () => {
    const api = fakePort();
    await uploadDocumentDirect({
      api,
      knowledgeBaseId: KB,
      file,
      title: "Report",
      ingestionMode: "ai_assisted",
      put: async () => undefined,
      digest: async () => "b".repeat(64),
    });
    expect(vi.mocked(api.initiateUpload).mock.calls[0]?.[1]).toMatchObject({
      ingestion_mode: "ai_assisted",
    });
  });

  it("refreshes the signed URL once when storage refuses it", async () => {
    const api = fakePort();
    const urls: string[] = [];
    const put = vi.fn(
      async ({ receipt: { url } }: { receipt: { url: string } }) => {
        urls.push(url);
        if (urls.length === 1) throw new DirectUploadPutError(403);
      },
    );
    await uploadDocumentDirect({
      api,
      knowledgeBaseId: KB,
      file,
      title: "Report",
      put,
      digest: async () => "c".repeat(64),
    });
    expect(api.refreshUpload).toHaveBeenCalledWith(KB, UPLOAD);
    expect(urls).toEqual([
      "https://storage.example/put?signature=one",
      "https://storage.example/put?signature=two",
    ]);
    expect(api.completeUpload).toHaveBeenCalledTimes(1);
  });

  it("aborts and reports a coded failure, with no other route tried", async () => {
    // A CORS refusal surfaces as status 0. It is reported, never retried
    // through the multipart route.
    const api = fakePort();
    const error = await uploadDocumentDirect({
      api,
      knowledgeBaseId: KB,
      file,
      title: "Report",
      put: async () => {
        throw new DirectUploadPutError(0);
      },
      digest: async () => "d".repeat(64),
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MyAgentsAPIError);
    expect(errorCodeOf(error as MyAgentsAPIError)).toBe("direct_upload_failed");
    expect(api.abortUpload).toHaveBeenCalledWith(KB, UPLOAD);
    expect(api.refreshUpload).not.toHaveBeenCalled();
    expect(api.completeUpload).not.toHaveBeenCalled();
    expect(ko.errors.byCode.direct_upload_failed).toBeTruthy();
  });

  it("does not refresh twice", async () => {
    const api = fakePort();
    const put = vi.fn(async () => {
      throw new DirectUploadPutError(403);
    });
    await expect(
      uploadDocumentDirect({
        api,
        knowledgeBaseId: KB,
        file,
        title: "Report",
        put,
        digest: async () => "e".repeat(64),
      }),
    ).rejects.toBeInstanceOf(MyAgentsAPIError);
    expect(put).toHaveBeenCalledTimes(2);
    expect(api.refreshUpload).toHaveBeenCalledTimes(1);
    expect(api.abortUpload).toHaveBeenCalledTimes(1);
  });

  it.each([
    new TypeError("Failed to fetch"),
    new MyAgentsAPIError({ message: "Internal Server Error", status: 503 }),
  ])(
    "retries only completion after a transient response failure (%s)",
    async (error) => {
      const api = fakePort();
      vi.mocked(api.completeUpload).mockRejectedValueOnce(error);
      const put = vi.fn(async () => undefined);

      const result = await uploadDocumentDirect({
        api,
        knowledgeBaseId: KB,
        file,
        title: "Report",
        put,
        digest: async () => "a".repeat(64),
      });

      expect(result.document.id).toBe(document.id);
      expect(api.initiateUpload).toHaveBeenCalledTimes(1);
      expect(put).toHaveBeenCalledTimes(1);
      expect(vi.mocked(api.completeUpload).mock.calls).toEqual([
        [KB, UPLOAD],
        [KB, UPLOAD],
      ]);
      expect(api.refreshUpload).not.toHaveBeenCalled();
      expect(api.abortUpload).not.toHaveBeenCalled();
    },
  );

  it("retains the upload identity for manual completion after both responses are lost", async () => {
    const api = fakePort();
    vi.mocked(api.completeUpload)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const put = vi.fn(async () => undefined);
    const error = await uploadDocumentDirect({
      api,
      knowledgeBaseId: KB,
      file,
      title: "Report",
      put,
      digest: async () => "a".repeat(64),
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DirectUploadCompletionError);
    if (!(error instanceof DirectUploadCompletionError)) throw error;
    expect(error).toMatchObject({ knowledgeBaseId: KB, uploadId: UPLOAD });
    expect(JSON.stringify(error)).not.toContain("signature=");
    const result = await completeDocumentUpload({
      api,
      knowledgeBaseId: error.knowledgeBaseId,
      uploadId: error.uploadId,
    });

    expect(result.document.id).toBe(document.id);
    expect(api.initiateUpload).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.completeUpload).mock.calls).toEqual([
      [KB, UPLOAD],
      [KB, UPLOAD],
      [KB, UPLOAD],
    ]);
    expect(api.abortUpload).not.toHaveBeenCalled();
  });

  it.each([
    [400, "upload_integrity_mismatch"],
    [403, "permission_denied"],
    [409, "upload_in_progress"],
    [422, "validation_error"],
  ])(
    "surfaces %i %s without automatic retries or aborting completion",
    async (status, code) => {
      const api = fakePort();
      vi.mocked(api.completeUpload).mockRejectedValueOnce(
        new MyAgentsAPIError({
          message: "Private server detail",
          status,
          body: { code },
        }),
      );
      const error = await uploadDocumentDirect({
        api,
        knowledgeBaseId: KB,
        file,
        title: "Report",
        put: async () => undefined,
        digest: async () => "a".repeat(64),
      }).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(DirectUploadCompletionError);
      expect(errorCodeOf(error as MyAgentsAPIError)).toBe(code);
      expect(api.completeUpload).toHaveBeenCalledTimes(1);
      expect(api.abortUpload).not.toHaveBeenCalled();
      expect(api.refreshUpload).not.toHaveBeenCalled();
    },
  );

  it("aborts a cancelled PUT without attempting completion", async () => {
    const api = fakePort();
    await expect(
      uploadDocumentDirect({
        api,
        knowledgeBaseId: KB,
        file,
        title: "Report",
        put: async () => {
          throw new DOMException("The upload was cancelled.", "AbortError");
        },
        digest: async () => "a".repeat(64),
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(api.abortUpload).toHaveBeenCalledWith(KB, UPLOAD);
    expect(api.completeUpload).not.toHaveBeenCalled();
  });

  it("computes a lower-case hex SHA-256", async () => {
    const hex = await sha256Hex(new Blob(["abc"]));
    expect(hex).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("the signed PUT", () => {
  type Sent = {
    method: string;
    url: string;
    headers: Record<string, string>;
    withCredentials: boolean;
  };
  let sent: Sent | null = null;
  let respond: (xhr: FakeXHR) => void = () => undefined;

  class FakeXHR {
    status = 0;
    withCredentials = false;
    upload: { onprogress: ((event: ProgressEvent) => void) | null } = {
      onprogress: null,
    };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    private method = "";
    private url = "";
    private headers: Record<string, string> = {};
    open(method: string, url: string) {
      this.method = method;
      this.url = url;
    }
    setRequestHeader(name: string, value: string) {
      this.headers[name] = value;
    }
    send() {
      sent = {
        method: this.method,
        url: this.url,
        headers: { ...this.headers },
        withCredentials: this.withCredentials,
      };
      respond(this);
    }
    abort() {
      this.onabort?.();
    }
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    sent = null;
  });

  it("sends only the signed headers, without credentials, and reports progress", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXHR);
    const progress: number[] = [];
    respond = (xhr) => {
      xhr.upload.onprogress?.({
        lengthComputable: true,
        loaded: 5,
        total: 10,
      } as ProgressEvent);
      xhr.status = 200;
      xhr.onload?.();
    };
    await putDirectUpload({
      receipt: receipt(),
      file,
      onProgress: (fraction) => progress.push(fraction),
    });
    expect(sent).toEqual({
      method: "PUT",
      url: "https://storage.example/put?signature=one",
      headers: { "Content-Type": "application/pdf" },
      withCredentials: false,
    });
    expect(progress).toEqual([0.5, 1]);
  });

  it("rejects a refused PUT with its status, and a dropped one with 0", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXHR);
    respond = (xhr) => {
      xhr.status = 403;
      xhr.onload?.();
    };
    await expect(
      putDirectUpload({ receipt: receipt(), file }),
    ).rejects.toMatchObject({ status: 403 });
    respond = (xhr) => xhr.onerror?.();
    await expect(
      putDirectUpload({ receipt: receipt(), file }),
    ).rejects.toMatchObject({ status: 0 });
  });

  it("cancels on abort", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXHR);
    const controller = new AbortController();
    respond = () => controller.abort();
    const error = await putDirectUpload({
      receipt: receipt(),
      file,
      signal: controller.signal,
    }).catch((caught: unknown) => caught);
    expect((error as DOMException).name).toBe("AbortError");
  });

  it("is unavailable without a secure-context digest", () => {
    vi.stubGlobal("crypto", {});
    expect(canComputeUploadDigest()).toBe(false);
  });
});

describe("document models", () => {
  it("reads a legacy document as standard, not retained, with no record", () => {
    const parsed = documentSchema.parse(document);
    expect(parsed.ingestion_mode).toBe("standard");
    expect(parsed.original_retained).toBe(false);
    expect(parsed.processing_provenance ?? null).toBeNull();
  });

  it("degrades a provenance shape it cannot read instead of failing", () => {
    const parsed = documentSchema.parse({
      ...document,
      original_retained: true,
      processing_provenance: { mode: "future_mode" },
    });
    expect(parsed.original_retained).toBe(true);
    expect(parsed.processing_provenance).toBeNull();
  });

  it("keeps preferences parseable on a backend without document fields", () => {
    const parsed = assistantPreferencesSchema.parse({
      customizable: true,
      default_model: "gpt-6-luna",
      selected_model: null,
      effective_model: "gpt-6-luna",
    });
    expect(parsed.document_retrieval_priority).toBe("automatic");
    expect(parsed.document_ingestion_mode).toBe("standard");
  });

  it("patches only what changed", () => {
    expect(
      assistantPreferencesPatchRequestSchema.parse({
        document_retrieval_priority: "on_request",
      }),
    ).toEqual({ document_retrieval_priority: "on_request" });
    // Explicit null is not a document preference the backend accepts.
    expect(
      assistantPreferencesPatchRequestSchema.safeParse({
        document_ingestion_mode: null,
      }).success,
    ).toBe(false);
  });
});

describe("upload policy from health", () => {
  const health = (documents: unknown) =>
    healthResponseSchema.parse({
      status: "ok",
      service: "my-agents",
      version: "0.1.0",
      frontend_config: { documents },
    });

  it("falls back to multipart and today's limit on an older backend", () => {
    expect(
      documentUploadPolicyFromHealth(health({ upload_concurrency: 3 })),
    ).toEqual({
      directUploads: false,
      directMaxBytes: FALLBACK_MULTIPART_MAX_BYTES,
      multipartMaxBytes: FALLBACK_MULTIPART_MAX_BYTES,
      allowedExtensions: null,
      aiAssistedIngestion: false,
    });
  });

  it("serves both limits and normalizes extensions", () => {
    expect(
      documentUploadPolicyFromHealth(
        health({
          upload_concurrency: 3,
          direct_uploads: true,
          max_upload_bytes: 5_242_880,
          multipart_max_bytes: 4_000_000,
          allowed_extensions: ["PDF", ".md"],
          ai_assisted_ingestion: true,
        }),
      ),
    ).toEqual({
      directUploads: true,
      directMaxBytes: 5_242_880,
      multipartMaxBytes: 4_000_000,
      allowedExtensions: [".pdf", ".md"],
      aiAssistedIngestion: true,
    });
  });

  it("lets the served extension list decide", () => {
    const docx = new File(["x"], "notes.docx");
    expect(isSupportedUploadFile(docx)).toBe(true);
    expect(isSupportedUploadFile(docx, [".pdf", ".md"])).toBe(false);
  });
});

describe("routing and copy", () => {
  it("allows the six new routes through the BFF, and nothing for storage", () => {
    const allowed = (method: string, path: string) =>
      isAllowedBackendPath(method as "GET", path).allowed;
    expect(allowed("POST", "/knowledge-bases/kb/documents/uploads")).toBe(true);
    expect(
      allowed("POST", "/knowledge-bases/kb/documents/uploads/up/refresh"),
    ).toBe(true);
    expect(
      allowed("POST", "/knowledge-bases/kb/documents/uploads/up/complete"),
    ).toBe(true);
    expect(allowed("DELETE", "/knowledge-bases/kb/documents/uploads/up")).toBe(
      true,
    );
    expect(allowed("GET", "/documents/d/original")).toBe(true);
    expect(allowed("POST", "/documents/d/reprocess")).toBe(true);
    // The file bytes never cross the BFF.
    expect(allowed("PUT", "/knowledge-bases/kb/documents/uploads/up")).toBe(
      false,
    );
  });

  it("localizes a run failure by its code, and keeps legacy text otherwise", () => {
    const run = (fields: object) =>
      extractionRunSchema.parse({
        id: "r",
        document_id: "d",
        status: "failed",
        chunk_count: 0,
        entity_count: 0,
        relationship_count: 0,
        ...fields,
      });
    expect(
      extractionRunErrorMessage(
        run({
          error: "document_processing_empty: no text",
          error_code: "document_processing_empty",
        }),
        defaultLocalization,
      ),
    ).toBe(defaultLocalization.errors.byCode.document_processing_empty);
    expect(
      extractionRunErrorMessage(
        run({ error: "Legacy failure" }),
        defaultLocalization,
      ),
    ).toBe("Legacy failure");
  });

  it("shows real byte progress while uploading directly", () => {
    const copy = ko.admin.documents;
    expect(
      resolveUploadProgress(
        { status: "uploading", progressPercent: 42, hasByteProgress: true },
        copy,
      ),
    ).toEqual({
      label: copy.progressUploadingLabel.replace("{percent}", "42"),
      percent: 42,
    });
    // Multipart has no byte progress: its placeholder is never shown as one.
    expect(
      resolveUploadProgress({ status: "uploading", progressPercent: 10 }, copy),
    ).toBeNull();
  });
});

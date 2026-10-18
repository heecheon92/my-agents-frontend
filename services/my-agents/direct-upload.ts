import type {
  DocumentIngestionMode,
  DocumentUploadCompleted,
  DocumentUploadInitiateRequest,
  DocumentUploadReceipt,
} from "@/model/my-agents";
import { MyAgentsAPIError } from "./MyAgentsAPIError";

/**
 * Direct upload: the browser sends the file straight to private storage with a
 * signed URL, then asks the backend to turn the stored object into a document.
 *
 * The signed URL is a credential. It is used for exactly one request, by
 * `putDirectUpload`, and is never logged, stored, rendered, or sent anywhere
 * else. That request carries only the headers the backend signed: no cookies,
 * no credentials, no CSRF header — it does not go through the BFF.
 */

/** Client-side codes, localized like the backend's. */
export const DIRECT_UPLOAD_ERROR_CODES = {
  /** The PUT was refused or never reached storage (including CORS). */
  storageRejected: "direct_upload_failed",
} as const;

/**
 * Whether this page can produce the SHA-256 the backend requires. `subtle`
 * exists only in secure contexts (https or localhost); a plain-http LAN origin
 * has none, and must use the multipart route instead — decided before any
 * upload is admitted, never as a fallback after one fails.
 */
export function canComputeUploadDigest() {
  return (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.subtle?.digest === "function" &&
    (typeof window === "undefined" || window.isSecureContext !== false)
  );
}

export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export class DirectUploadPutError extends Error {
  /** HTTP status from storage, or `0` when no response arrived. */
  readonly status: number;
  constructor(status: number) {
    super(`direct upload PUT failed (${status})`);
    this.name = "DirectUploadPutError";
    this.status = status;
  }
}

function abortError() {
  return new DOMException("The upload was cancelled.", "AbortError");
}

/**
 * Sends the file to the signed URL with real byte progress.
 *
 * `XMLHttpRequest`, not `fetch`: fetch has no upload progress. Only the signed
 * headers are set, and `withCredentials` stays false so no cookie reaches the
 * storage origin.
 */
export function putDirectUpload({
  receipt,
  file,
  onProgress,
  signal,
}: {
  receipt: Pick<DocumentUploadReceipt, "url" | "headers">;
  file: Blob;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const request = new XMLHttpRequest();
    request.open("PUT", receipt.url);
    request.withCredentials = false;
    for (const [name, value] of Object.entries(receipt.headers)) {
      request.setRequestHeader(name, value);
    }
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(event.loaded / event.total);
      }
    };
    const onAbort = () => request.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const settle = () => signal?.removeEventListener("abort", onAbort);
    request.onload = () => {
      settle();
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(1);
        resolve();
      } else {
        reject(new DirectUploadPutError(request.status));
      }
    };
    // A CORS refusal and a dropped connection look identical here: status 0.
    request.onerror = () => {
      settle();
      reject(new DirectUploadPutError(0));
    };
    request.onabort = () => {
      settle();
      reject(abortError());
    };
    request.send(file);
  });
}

export type DirectUploadPort = {
  initiateUpload: (
    knowledgeBaseId: string,
    payload: DocumentUploadInitiateRequest,
  ) => Promise<DocumentUploadReceipt>;
  refreshUpload: (
    knowledgeBaseId: string,
    uploadId: string,
  ) => Promise<DocumentUploadReceipt>;
  completeUpload: (
    knowledgeBaseId: string,
    uploadId: string,
  ) => Promise<DocumentUploadCompleted>;
  abortUpload: (knowledgeBaseId: string, uploadId: string) => Promise<void>;
};

/** A refused PUT worth one more try with a fresh URL: expiry or signature. */
function isRefreshable(error: unknown) {
  return (
    error instanceof DirectUploadPutError &&
    (error.status === 400 || error.status === 403)
  );
}

/**
 * Completion may have committed even when its response was lost. Retain only
 * its identity so a manual retry can complete the same upload, never admit a
 * replacement or retain the signed storage URL.
 */
export class DirectUploadCompletionError extends MyAgentsAPIError {
  readonly knowledgeBaseId: string;
  readonly uploadId: string;

  constructor(knowledgeBaseId: string, uploadId: string, error: unknown) {
    super({
      message: "Document upload completion could not be confirmed.",
      status:
        error instanceof MyAgentsAPIError
          ? error.status
          : error instanceof TypeError
            ? 0
            : 502,
      body: error instanceof MyAgentsAPIError ? error.body : undefined,
    });
    this.knowledgeBaseId = knowledgeBaseId;
    this.uploadId = uploadId;
  }
}

function isTransientCompletionError(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof MyAgentsAPIError &&
      (error.status === 0 || (error.status >= 500 && error.status < 600)))
  );
}

/**
 * Retry an ambiguous response once. Every attempt uses the same idempotent
 * completion route. Validation, permission and in-progress responses are
 * surfaced immediately; the queue can retry this identity explicitly later.
 */
export async function completeDocumentUpload({
  api,
  knowledgeBaseId,
  uploadId,
}: {
  api: Pick<DirectUploadPort, "completeUpload">;
  knowledgeBaseId: string;
  uploadId: string;
}): Promise<DocumentUploadCompleted> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await api.completeUpload(knowledgeBaseId, uploadId);
    } catch (error) {
      if (attempt === 0 && isTransientCompletionError(error)) continue;
      throw new DirectUploadCompletionError(knowledgeBaseId, uploadId, error);
    }
  }
}

/**
 * Initiate, PUT, complete — with one refresh of the signed URL when storage
 * refuses it as expired, and a best-effort abort when the upload cannot
 * finish the PUT, so the backend can release it before the URL would expire.
 * Once completion starts, failures retain the upload identity and never abort
 * an upload whose document may already have committed.
 *
 * There is no fallback to the multipart route: a failed PUT (including a
 * CORS refusal, which surfaces as status 0) is reported, never retried another
 * way.
 */
export async function uploadDocumentDirect({
  api,
  knowledgeBaseId,
  file,
  title,
  ingestionMode,
  onPhase,
  onProgress,
  signal,
  put = putDirectUpload,
  digest = sha256Hex,
}: {
  api: DirectUploadPort;
  knowledgeBaseId: string;
  file: File;
  title: string;
  /** Omitted means the user's saved default. */
  ingestionMode?: DocumentIngestionMode;
  onPhase?: (phase: "hashing" | "uploading" | "completing") => void;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  put?: typeof putDirectUpload;
  digest?: (file: Blob) => Promise<string>;
}): Promise<DocumentUploadCompleted> {
  onPhase?.("hashing");
  const sha256 = await digest(file);
  let receipt = await api.initiateUpload(knowledgeBaseId, {
    title,
    filename: file.name,
    content_type: file.type || "application/octet-stream",
    byte_size: file.size,
    sha256,
    ...(ingestionMode ? { ingestion_mode: ingestionMode } : {}),
  });
  const { upload_id: uploadId } = receipt;
  try {
    onPhase?.("uploading");
    try {
      await put({ receipt, file, onProgress, signal });
    } catch (error) {
      if (!isRefreshable(error)) throw error;
      receipt = await api.refreshUpload(knowledgeBaseId, uploadId);
      await put({ receipt, file, onProgress, signal });
    }
  } catch (error) {
    // Best effort: the backend also expires it with the URL.
    await api.abortUpload(knowledgeBaseId, uploadId).catch(() => undefined);
    if (error instanceof DirectUploadPutError) {
      throw new MyAgentsAPIError({
        message: "direct upload failed",
        status: error.status,
        body: { code: DIRECT_UPLOAD_ERROR_CODES.storageRejected },
      });
    }
    throw error;
  }
  onPhase?.("completing");
  return completeDocumentUpload({ api, knowledgeBaseId, uploadId });
}

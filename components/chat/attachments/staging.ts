import type {
  DocumentFormatCapability,
  DocumentWorkspaceCapability,
} from "@/model/my-agents";

/**
 * A file chosen in the composer but not yet transferred to the provider.
 *
 * Staging exists because the attachment endpoint needs a conversation ID and
 * bare `/chat` deliberately creates no conversation until the first message is
 * sent. Nothing leaves the browser while a file is staged.
 */
export type StagedFile = {
  /** Stable across re-renders; the `File` itself is not a usable React key. */
  id: string;
  file: File;
};

/**
 * Why a staged file cannot be uploaded.
 *
 * The first three mirror backend `APIErrorCode` values so one copy table
 * serves both local rejection and a server refusal. `attachment_empty` and
 * `attachment_combined_too_large` have no backend twin: the backend rejects an
 * empty file as an unsupported upload, and enforces the combined ceiling per
 * run rather than per file, so naming them locally keeps the message specific.
 */
export type StagedFileRejection =
  | "unsupported_attachment_type"
  | "attachment_too_large"
  | "attachment_limit_exceeded"
  | "attachment_empty"
  | "attachment_combined_too_large";

/**
 * `ConversationRunRequest.attachment_ids` is declared `maxItems: 10` in the
 * served OpenAPI document, independently of the capability's
 * `limits.max_files_per_run`.
 *
 * Backend Codex confirmed the served limit is authoritative and that settings
 * enforce `1 <= max_files_per_run <= 10`, so the two can never disagree in a
 * valid backend process. This clamp is therefore defense against a
 * misconfigured deployment only — it must never be the number shown to a user,
 * because the served limit is the one the backend will actually apply.
 */
const ATTACHMENT_IDS_SCHEMA_MAX = 10;

export function isDocumentWorkspaceUsable(
  capability: DocumentWorkspaceCapability | undefined,
): capability is DocumentWorkspaceCapability {
  return Boolean(capability?.enabled && capability.eligible);
}

export function resolveMaxFilesPerRun(
  capability: DocumentWorkspaceCapability,
): number {
  return Math.min(
    capability.limits.max_files_per_run,
    ATTACHMENT_IDS_SCHEMA_MAX,
  );
}

function normalizeExtension(value: string): string {
  return value.trim().toLowerCase().replace(/^\./, "");
}

function extensionOf(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === filename.length - 1) return "";
  return normalizeExtension(filename.slice(lastDot + 1));
}

/**
 * Matches on extension first, then on MIME type.
 *
 * Both sides are normalized because the registry is served data: whether its
 * extensions carry a leading dot is the backend's choice, and a frontend that
 * assumed one form would silently reject every file the day that changed.
 * The MIME fallback covers a file whose name lost its extension — the browser
 * still reports a type.
 */
export function findFormatForFile(
  capability: DocumentWorkspaceCapability,
  file: File,
): DocumentFormatCapability | undefined {
  const extension = extensionOf(file.name);
  const byExtension = capability.formats.find(
    (format) => normalizeExtension(format.extension) === extension,
  );
  if (byExtension) return byExtension;

  const contentType = file.type.trim().toLowerCase();
  if (!contentType) return undefined;
  return capability.formats.find((format) =>
    format.mime_types.some((mime) => mime.trim().toLowerCase() === contentType),
  );
}

/**
 * Whether the format produces a downloadable file, as opposed to analysis only.
 *
 * Read from `artifact_status`, never inferred from the extension. Analysis
 * support is broader than output certification, and which extensions are
 * certified is the backend's decision — the set widened twice on 2026-09-02
 * with no frontend change, which is the whole point of reading it from the
 * registry rather than keeping a list here.
 */
export function producesCertifiedArtifact(
  format: DocumentFormatCapability | undefined,
): boolean {
  return format?.artifact_status === "certified";
}

export function combinedBytes(staged: StagedFile[]): number {
  return staged.reduce((total, item) => total + item.file.size, 0);
}

/**
 * Local validation, run before consent is even offered.
 *
 * Backend validation stays authoritative — this exists so a user is not asked
 * to consent to a provider transfer that is going to be refused anyway, and so
 * an oversized file is never read off disk. Rejection order is deliberate:
 * a file that is both unsupported and oversized is named unsupported, because
 * shrinking it would not help.
 */
export function validateStagedFile({
  file,
  capability,
  staged,
}: {
  file: File;
  capability: DocumentWorkspaceCapability;
  /** Already staged, excluding `file`. */
  staged: StagedFile[];
}): StagedFileRejection | null {
  const format = findFormatForFile(capability, file);
  if (!format || !format.analysis_supported) {
    return "unsupported_attachment_type";
  }
  if (file.size <= 0) return "attachment_empty";
  if (staged.length + 1 > resolveMaxFilesPerRun(capability)) {
    return "attachment_limit_exceeded";
  }
  const { max_combined_bytes: maxCombined } = capability.limits;
  if (file.size > maxCombined) return "attachment_too_large";
  if (combinedBytes(staged) + file.size > maxCombined) {
    return "attachment_combined_too_large";
  }
  return null;
}

/**
 * Whether a send must be abandoned because nothing the user staged made it to
 * the provider.
 *
 * The handoff's rule, isolated so it can be tested without a network: if every
 * upload failed, the run must not start. Starting an attachment-free run would
 * silently answer a question about a file the assistant never received, which
 * reads as a wrong answer rather than as a failed upload.
 *
 * A partial success does start — the user gets an answer over the files that
 * did arrive, and the failed ones stay staged and retryable.
 */
export function shouldAbortSendAfterUpload({
  stagedCount,
  uploadedCount,
}: {
  stagedCount: number;
  uploadedCount: number;
}): boolean {
  return stagedCount > 0 && uploadedCount === 0;
}

/**
 * Narrows a selection to what the server currently says is usable.
 *
 * Applied at send time rather than only when a row is clicked: a file can
 * expire while the composer sits open, and sending a lapsed ID earns an
 * `attachment_expired` refusal for a turn the user thought was ready.
 */
export function usableAttachmentIds(
  attachments: { id: string; status: string }[],
  selectedIds: string[],
): string[] {
  const available = new Set(
    attachments
      .filter((attachment) => attachment.status === "available")
      .map((attachment) => attachment.id),
  );
  return selectedIds.filter((id) => available.has(id));
}

import { fileExtension } from "../shared";
import {
  DOCX_CONTENT_TYPE,
  PPTX_CONTENT_TYPE,
  XLSX_CONTENT_TYPE,
} from "../UploadQueueRow";

export const UPLOAD_ACCEPT = [
  "application/pdf",
  "text/markdown",
  "text/plain",
  XLSX_CONTENT_TYPE,
  PPTX_CONTENT_TYPE,
  DOCX_CONTENT_TYPE,
  ".pdf",
  ".md",
  ".markdown",
  ".txt",
  ".xlsx",
  ".pptx",
  ".docx",
].join(",");

export const EXTRACTION_POLL_INTERVAL_MS = 1000;
export const TERMINAL_EXTRACTION_STATUSES = new Set(["completed", "failed"]);

const SUPPORTED_UPLOAD_EXTENSIONS = new Set([
  ".pdf",
  ".md",
  ".markdown",
  ".txt",
  ".xlsx",
  ".pptx",
  ".docx",
]);
const SUPPORTED_UPLOAD_TYPES = new Set([
  "application/pdf",
  "text/markdown",
  "text/plain",
  XLSX_CONTENT_TYPE,
  PPTX_CONTENT_TYPE,
  DOCX_CONTENT_TYPE,
]);

export function buildLocalUploadId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`;
}

export function titleFromFileName(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  return baseName.trim() || fileName;
}

/**
 * Whether a file may be uploaded. `servedExtensions` is the backend's list
 * (lower-case, with the dot); when it is served, it is the only authority on
 * extensions, and the built-in content-type match still applies alongside it.
 */
export function isSupportedUploadFile(
  file: File,
  servedExtensions: string[] | null = null,
) {
  const extension = fileExtension(file.name);
  if (extension === ".doc") return false;
  const extensions = servedExtensions
    ? new Set(servedExtensions)
    : SUPPORTED_UPLOAD_EXTENSIONS;

  return extensions.has(extension) || SUPPORTED_UPLOAD_TYPES.has(file.type);
}

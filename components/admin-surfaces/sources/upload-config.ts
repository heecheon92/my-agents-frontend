import { fileExtension } from "../shared";
import { PPTX_CONTENT_TYPE, XLSX_CONTENT_TYPE } from "../UploadQueueRow";

export const UPLOAD_ACCEPT = [
  "application/pdf",
  "text/markdown",
  "text/plain",
  XLSX_CONTENT_TYPE,
  PPTX_CONTENT_TYPE,
  ".pdf",
  ".md",
  ".markdown",
  ".txt",
  ".xlsx",
  ".pptx",
].join(",");

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const EXTRACTION_POLL_INTERVAL_MS = 1000;
export const TERMINAL_EXTRACTION_STATUSES = new Set(["completed", "failed"]);

const SUPPORTED_UPLOAD_EXTENSIONS = new Set([
  ".pdf",
  ".md",
  ".markdown",
  ".txt",
  ".xlsx",
  ".pptx",
]);
const SUPPORTED_UPLOAD_TYPES = new Set([
  "application/pdf",
  "text/markdown",
  "text/plain",
  XLSX_CONTENT_TYPE,
  PPTX_CONTENT_TYPE,
]);

export function buildLocalUploadId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`;
}

export function titleFromFileName(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  return baseName.trim() || fileName;
}

export function isSupportedUploadFile(file: File) {
  return (
    SUPPORTED_UPLOAD_EXTENSIONS.has(fileExtension(file.name)) ||
    SUPPORTED_UPLOAD_TYPES.has(file.type)
  );
}

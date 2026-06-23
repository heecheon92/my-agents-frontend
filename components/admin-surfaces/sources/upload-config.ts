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

export function isSupportedUploadFile(file: File) {
  const extension = fileExtension(file.name);
  if (extension === ".doc") return false;

  return (
    SUPPORTED_UPLOAD_EXTENSIONS.has(extension) ||
    SUPPORTED_UPLOAD_TYPES.has(file.type)
  );
}

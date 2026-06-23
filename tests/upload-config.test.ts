import { describe, expect, it } from "vitest";
import {
  isSupportedUploadFile,
  UPLOAD_ACCEPT,
} from "@/components/admin-surfaces/sources/upload-config";
import {
  DOCX_CONTENT_TYPE,
  PPTX_CONTENT_TYPE,
  XLSX_CONTENT_TYPE,
} from "@/components/admin-surfaces/UploadQueueRow";

describe("source upload file support", () => {
  it("accepts modern Word .docx files without accepting legacy .doc files", () => {
    const docx = new File(["word"], "proposal.docx", {
      type: DOCX_CONTENT_TYPE,
    });
    const legacyDoc = new File(["legacy"], "legacy.doc", {
      type: "application/msword",
    });
    const mislabeledLegacyDoc = new File(["legacy"], "legacy.doc", {
      type: DOCX_CONTENT_TYPE,
    });

    expect(isSupportedUploadFile(docx)).toBe(true);
    expect(isSupportedUploadFile(legacyDoc)).toBe(false);
    expect(isSupportedUploadFile(mislabeledLegacyDoc)).toBe(false);
    expect(UPLOAD_ACCEPT.split(",")).toContain(".docx");
    expect(UPLOAD_ACCEPT.split(",")).toContain(DOCX_CONTENT_TYPE);
    expect(UPLOAD_ACCEPT.split(",")).not.toContain(".doc");
    expect(UPLOAD_ACCEPT.split(",")).not.toContain("application/msword");
  });

  it("keeps the existing PDF, text, spreadsheet, and presentation accept list", () => {
    expect(UPLOAD_ACCEPT.split(",")).toEqual(
      expect.arrayContaining([
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
      ]),
    );
  });
});

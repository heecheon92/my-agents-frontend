import { describe, expect, it } from "vitest";
import { documentSourceLabel } from "@/components/admin-surfaces/shared";
import en from "@/localization/en.json";

describe("document source labels", () => {
  it("renders backend DOCX source metadata as a Word document", () => {
    expect(
      documentSourceLabel(
        {
          source_type: "word_document",
          source_filename: "brief.docx",
        },
        en.admin.documents,
      ),
    ).toBe("Word document brief.docx");
  });

  it("uses the DOCX filename fallback without accepting uncontracted source aliases", () => {
    expect(
      documentSourceLabel(
        {
          source_type: "upload",
          source_filename: "brief.docx",
        },
        en.admin.documents,
      ),
    ).toBe("Word document brief.docx");

    expect(
      documentSourceLabel(
        {
          source_type: "docx",
        },
        en.admin.documents,
      ),
    ).toBe(en.admin.documents.textSource);
  });
});

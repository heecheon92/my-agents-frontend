import { describe, expect, it } from "vitest";
import {
  buildEvidenceSources,
  countSupported,
  groupSourcesByDocument,
} from "@/components/chat/evidence-panel/evidence-sources";
import type { Citation } from "@/model/my-agents";

function citation(id: string, overrides: Partial<Citation> = {}): Citation {
  return {
    id,
    document_id: `doc-${id}`,
    chunk_id: `chunk-${id}`,
    snippet: `snippet ${id}`,
    ...overrides,
  };
}

describe("buildEvidenceSources", () => {
  it("treats a null consulted list as legacy and badges nothing", () => {
    // The load-bearing case. A run from before attribution shipped has an
    // unverified flat citation list; badging it would claim a check that never
    // ran, putting a stronger claim on old answers than on new ones.
    const result = buildEvidenceSources({
      citations: [citation("a"), citation("b")],
      consultedSources: null,
    });

    expect(result.mode).toBe("legacy");
    expect(result.items).toHaveLength(2);
    expect(countSupported(result.items)).toBe(0);
  });

  it("treats an absent consulted list the same as an explicit null", () => {
    // A backend without the field, and a backend that sends null, are the same
    // situation: attribution did not run.
    expect(buildEvidenceSources({ citations: [citation("a")] }).mode).toBe(
      "legacy",
    );
  });

  it("distinguishes an empty consulted list from a null one", () => {
    // `[]` means attribution ran and found nothing. That is a real answer, and
    // it must not be reported as legacy.
    const result = buildEvidenceSources({
      citations: [],
      consultedSources: [],
    });

    expect(result.mode).toBe("attributed");
    expect(result.items).toEqual([]);
  });

  it("badges the cited subset of the consulted superset by id", () => {
    const result = buildEvidenceSources({
      citations: [citation("b")],
      consultedSources: [citation("a"), citation("b"), citation("c")],
    });

    expect(result.mode).toBe("attributed");
    expect(result.items.map((item) => item.citation.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(result.items.map((item) => item.isSupported)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it("renders every consulted source once when none are supported", () => {
    // The case the backend expects to be common: a paraphrased summary where
    // the conservative selector finds no direct match. The panel must still
    // show the consulted sources rather than collapsing to nothing.
    const result = buildEvidenceSources({
      citations: [],
      consultedSources: [citation("a"), citation("b")],
    });

    expect(result.items).toHaveLength(2);
    expect(countSupported(result.items)).toBe(0);
  });

  it("does not double-render a source that appears in both lists", () => {
    // The failure this join exists to prevent. Same row, same id, one output.
    const result = buildEvidenceSources({
      citations: [citation("a")],
      consultedSources: [citation("a")],
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].isSupported).toBe(true);
  });

  it("keeps a cited source the consulted list failed to include", () => {
    // Contract violation: consulted is documented as a superset. Dropping the
    // stray would hide the strongest evidence the answer has, so it is
    // appended instead — after the consulted rows, so the normal case is
    // byte-identical.
    const result = buildEvidenceSources({
      citations: [citation("z")],
      consultedSources: [citation("a")],
    });

    expect(result.items.map((item) => item.citation.id)).toEqual(["a", "z"]);
    expect(result.items.map((item) => item.isSupported)).toEqual([false, true]);
  });
});

describe("groupSourcesByDocument", () => {
  it("collapses several chunks of one document into a single row", () => {
    // The reason this exists: one document routinely produces several chunks,
    // and a row each made one source look like four.
    const rows = groupSourcesByDocument([
      {
        citation: citation("a", {
          document_id: "doc-1",
          source_filename: "contract.pdf",
          source_page: 4,
        }),
        isSupported: false,
      },
      {
        citation: citation("b", {
          document_id: "doc-1",
          source_filename: "contract.pdf",
          source_page: 9,
        }),
        isSupported: false,
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].displayName).toBe("contract.pdf");
    expect(rows[0].pages).toEqual([4, 9]);
  });

  it("marks a document supported when any one of its chunks is", () => {
    const rows = groupSourcesByDocument([
      { citation: citation("a", { document_id: "doc-1" }), isSupported: false },
      { citation: citation("b", { document_id: "doc-1" }), isSupported: true },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].isSupported).toBe(true);
  });

  it("deduplicates and sorts page numbers", () => {
    const rows = groupSourcesByDocument(
      [11, 4, 11, 4, 2].map((page, index) => ({
        citation: citation(`c${index}`, {
          document_id: "doc-1",
          source_page: page,
        }),
        isSupported: false,
      })),
    );

    expect(rows[0].pages).toEqual([2, 4, 11]);
  });

  it("prefers the filename over the title, and falls back to the title", () => {
    const rows = groupSourcesByDocument([
      {
        citation: citation("a", {
          document_id: "doc-1",
          source_filename: "contract.pdf",
          document_title: "2026 계약서",
        }),
        isSupported: false,
      },
      {
        citation: citation("b", {
          document_id: "doc-2",
          source_filename: null,
          document_title: "붙여넣은 메모",
        }),
        isSupported: false,
      },
    ]);

    expect(rows.map((row) => row.displayName)).toEqual([
      "contract.pdf",
      "붙여넣은 메모",
    ]);
  });

  it("recovers a name a later chunk carries when the first lacks one", () => {
    const rows = groupSourcesByDocument([
      { citation: citation("a", { document_id: "doc-1" }), isSupported: false },
      {
        citation: citation("b", {
          document_id: "doc-1",
          document_title: "보고서",
          knowledge_base_name: "개인 자료",
        }),
        isSupported: false,
      },
    ]);

    expect(rows[0].displayName).toBe("보고서");
    expect(rows[0].knowledgeBaseName).toBe("개인 자료");
  });

  it("leaves a nameless source null rather than inventing one", () => {
    const rows = groupSourcesByDocument([
      { citation: citation("a", { document_id: "doc-1" }), isSupported: false },
    ]);

    expect(rows[0].displayName).toBeNull();
    expect(rows[0].pages).toEqual([]);
  });

  it("preserves the backend's ordering", () => {
    // The backend returns sources in its own relevance order; re-sorting would
    // invent a ranking the frontend has no basis for.
    const rows = groupSourcesByDocument(
      ["doc-c", "doc-a", "doc-b"].map((documentId, index) => ({
        citation: citation(`c${index}`, { document_id: documentId }),
        isSupported: false,
      })),
    );

    expect(rows.map((row) => row.documentId)).toEqual([
      "doc-c",
      "doc-a",
      "doc-b",
    ]);
  });
});

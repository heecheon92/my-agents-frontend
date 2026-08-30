import { describe, expect, it } from "vitest";
import { formatDocumentCoverage } from "@/components/chat/evidence-panel/sections";
import type { ChatLocalization } from "@/components/chat/types";
import ko from "@/localization/ko.json";
import {
  conversationRunResponseSchema,
  documentCoverageSchema,
} from "@/model/my-agents";

const completeCoverage = {
  mode: "complete" as const,
  document_id: "doc-contract",
  title: "2026 파트너 계약서",
  source_filename: "partner-contract.pdf",
  start_offset: 0,
  end_offset: 8_400,
  total_chars: 8_400,
};

const partialCoverage = {
  ...completeCoverage,
  mode: "partial" as const,
  end_offset: 12_000,
  total_chars: 32_000,
};

function completedRun(documentCoverage: unknown) {
  return {
    run_id: "run-coverage",
    conversation_id: "conversation-coverage",
    reply: "Coverage answer",
    route: { label: "research_helper", explanation: "test" },
    handled_by: "personal_assistant_graph",
    citations: [],
    document_coverage: documentCoverage,
  };
}

describe("document coverage contract", () => {
  it("parses complete and partial fixtures from the served OpenAPI shape", () => {
    expect(documentCoverageSchema.parse(completeCoverage)).toEqual(
      completeCoverage,
    );
    expect(documentCoverageSchema.parse(partialCoverage)).toEqual(
      partialCoverage,
    );
  });

  it("preserves nullable coverage on completed run responses", () => {
    expect(
      conversationRunResponseSchema.parse(completedRun(completeCoverage))
        .document_coverage,
    ).toEqual(completeCoverage);
    expect(
      conversationRunResponseSchema.parse(completedRun(null)).document_coverage,
    ).toBeNull();
  });

  it("rejects unknown modes and non-integer or negative offsets", () => {
    expect(
      documentCoverageSchema.safeParse({
        ...completeCoverage,
        mode: "unknown",
      }).success,
    ).toBe(false);
    expect(
      documentCoverageSchema.safeParse({
        ...completeCoverage,
        end_offset: 2.5,
      }).success,
    ).toBe(false);
    expect(
      documentCoverageSchema.safeParse({
        ...completeCoverage,
        start_offset: -1,
      }).success,
    ).toBe(false);
  });

  it("formats from mode rather than inferring completion from equal offsets", () => {
    const localization = ko.chat as unknown as ChatLocalization;
    expect(formatDocumentCoverage(completeCoverage, localization)).toBe(
      "문서 전체를 읽고 답했습니다 · 2026 파트너 계약서",
    );
    expect(
      formatDocumentCoverage(
        { ...partialCoverage, end_offset: 32_000 },
        localization,
      ),
    ).toBe(
      "문서 일부만 읽고 답했습니다 · 2026 파트너 계약서 · 0–32000자 / 전체 32000자",
    );
    expect(
      formatDocumentCoverage(
        { ...completeCoverage, title: "{start} 계약서" },
        localization,
      ),
    ).toBe("문서 전체를 읽고 답했습니다 · {start} 계약서");
  });
});

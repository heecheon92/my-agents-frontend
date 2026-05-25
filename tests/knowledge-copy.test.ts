import { describe, expect, it } from "vitest";
import en from "@/localization/en.json";
import ko from "@/localization/ko.json";

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
}

describe("localized product copy guardrails", () => {
  it("keeps implementation terms out of visible English and Korean locale values", () => {
    const visibleCopy = [...collectStrings(en), ...collectStrings(ko)];

    for (const text of visibleCopy) {
      expect(text).not.toMatch(/Group Chat|그룹 채팅/);
      expect(text).not.toMatch(/\bKB\b/);
      expect(text).not.toMatch(/backend|OpenAPI|route|라우트|\.\.\/my-agents/i);
    }
  });
});

describe("knowledge-base creation copy", () => {
  it("states the private and group knowledge-base boundary in English", () => {
    const copy = en.admin.knowledge;

    expect(copy.description).toContain(
      "Private knowledge bases are only for you",
    );
    expect(copy.description).toContain("sharing is approved");
    expect(copy.scopeHint).toContain("Private knowledge bases stay private");
    expect(copy.scopeHint).toContain("owner/admin-approved share requests");
    expect(copy.scopeBoundaryNote).toContain(
      "Upload documents to private knowledge bases first",
    );
    expect(copy.scopeBoundaryNote).toContain("requires owner/admin approval");
    expect(copy.scopeBoundaryNote).toContain(
      "does not share member conversations",
    );
    expect(copy.scopeBoundaryNote).toContain("transcripts");
    expect(copy.listPersonalSubtitle).toContain("private to your account");
    expect(copy.listGroupSubtitle).toContain("selected group members");
  });

  it("states the same ownership boundary in Korean", () => {
    const copy = ko.admin.knowledge;

    expect(copy.description).toContain("비공개 지식 베이스는 나만");
    expect(copy.description).toContain("공유 승인");
    expect(copy.scopeHint).toContain("내 계정에만 비공개");
    expect(copy.scopeHint).toContain("승인 공유 요청");
    expect(copy.scopeBoundaryNote).toContain(
      "먼저 비공개 지식 베이스에 업로드",
    );
    expect(copy.scopeBoundaryNote).toContain("승인이 필요");
    expect(copy.scopeBoundaryNote).toContain("멤버 대화");
    expect(copy.scopeBoundaryNote).toContain("대화 기록");
    expect(copy.listPersonalSubtitle).toContain("내 계정 전용");
    expect(copy.listGroupSubtitle).toContain("선택한 그룹 멤버");
  });
});

describe("group publish copy", () => {
  it("frames Groups as shared knowledge spaces in English", () => {
    const copy = en.admin.groups;

    expect(copy.description).toContain("shared spaces for knowledge bases");
    expect(copy.membershipActions).toBe("People and roles");
    expect(copy.memberIdNote).toContain("add or update members by user ID");
    expect(copy.publishBoundaryTitle).toBe("Shared knowledge");
    expect(copy.publishBoundaryDescription).toContain(
      "share a private knowledge base",
    );
    expect(copy.publishSourceKnowledgeBaseHint).toContain(
      "whole private knowledge base",
    );
    expect(copy.publishTargetKnowledgeBaseHint).toContain(
      "document-copy requests",
    );
  });

  it("frames Groups as shared knowledge spaces in Korean", () => {
    const copy = ko.admin.groups;

    expect(copy.description).toContain("지식 베이스를 공유하는 공간");
    expect(copy.membershipActions).toBe("사람과 역할");
    expect(copy.memberIdNote).toContain("사용자 ID를 붙여넣어");
    expect(copy.publishBoundaryTitle).toBe("공유 지식");
    expect(copy.publishBoundaryDescription).toContain("비공개 지식 베이스");
    expect(copy.publishSourceKnowledgeBaseHint).toContain(
      "비공개 지식 베이스 전체",
    );
    expect(copy.publishTargetKnowledgeBaseHint).toContain("문서 복사 요청");
  });
});

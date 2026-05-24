import { describe, expect, it } from "vitest";
import en from "@/localization/en.json";
import ko from "@/localization/ko.json";

describe("knowledge-base creation copy", () => {
  it("states the personal and group KB ownership boundary in English", () => {
    const copy = en.admin.knowledge;

    expect(copy.description).toContain(
      "Every new group starts with one default Group KB",
    );
    expect(copy.scopeHint).toContain("Personal KBs stay private");
    expect(copy.scopeHint).toContain("owner/admin-approved publish requests");
    expect(copy.scopeBoundaryNote).toContain(
      "Upload documents to Personal KBs first",
    );
    expect(copy.scopeBoundaryNote).toContain("requires owner/admin approval");
    expect(copy.scopeBoundaryNote).toContain("does not publish member chat");
    expect(copy.scopeBoundaryNote).toContain("transcripts");
    expect(copy.listPersonalSubtitle).toContain("private to your account");
    expect(copy.listGroupSubtitle).toContain("selected group members");
  });

  it("states the same ownership boundary in Korean", () => {
    const copy = ko.admin.knowledge;

    expect(copy.description).toContain("기본 Group KB 하나");
    expect(copy.scopeHint).toContain("내 계정에만 비공개");
    expect(copy.scopeHint).toContain("승인 게시 요청");
    expect(copy.scopeBoundaryNote).toContain("먼저 Personal KB에 업로드");
    expect(copy.scopeBoundaryNote).toContain("승인 게시 요청");
    expect(copy.scopeBoundaryNote).toContain("멤버 채팅");
    expect(copy.scopeBoundaryNote).toContain("대화 기록");
    expect(copy.listPersonalSubtitle).toContain("내 계정 전용 비공개");
    expect(copy.listGroupSubtitle).toContain("선택한 그룹 멤버");
  });
});

describe("group publish copy", () => {
  it("states whole Personal KB publication and document-copy options in English", () => {
    const copy = en.admin.groups;

    expect(copy.publishBoundaryDescription).toContain("entire Personal KB");
    expect(copy.publishBoundaryDescription).toContain("document copy");
    expect(copy.publishSourceKnowledgeBaseHint).toContain("whole Personal KB");
    expect(copy.publishTargetKnowledgeBaseHint).toContain(
      "Only document-copy requests",
    );
  });

  it("states whole Personal KB publication and document-copy options in Korean", () => {
    const copy = ko.admin.groups;

    expect(copy.publishBoundaryDescription).toContain("전체 Personal KB");
    expect(copy.publishBoundaryDescription).toContain("단일 문서");
    expect(copy.publishSourceKnowledgeBaseHint).toContain("Personal KB 전체");
    expect(copy.publishTargetKnowledgeBaseHint).toContain("문서 복사 요청");
  });
});

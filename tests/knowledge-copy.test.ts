import { describe, expect, it } from "vitest";
import en from "@/localization/en.json";
import ko from "@/localization/ko.json";

describe("knowledge-base creation copy", () => {
  it("states the personal and group KB ownership boundary in English", () => {
    const copy = en.admin.knowledge;

    expect(copy.scopeHint).toContain("Personal KBs stay private");
    expect(copy.scopeHint).toContain("selected group only");
    expect(copy.scopeBoundaryNote).toContain("document retrieval");
    expect(copy.scopeBoundaryNote).toContain("does not publish member chat");
    expect(copy.scopeBoundaryNote).toContain("transcripts");
    expect(copy.listPersonalSubtitle).toContain("private to your account");
    expect(copy.listGroupSubtitle).toContain("selected group members");
  });

  it("states the same ownership boundary in Korean", () => {
    const copy = ko.admin.knowledge;

    expect(copy.scopeHint).toContain("내 계정에만 비공개");
    expect(copy.scopeHint).toContain("선택한 그룹만");
    expect(copy.scopeBoundaryNote).toContain("문서 검색만 공유");
    expect(copy.scopeBoundaryNote).toContain("멤버 채팅");
    expect(copy.scopeBoundaryNote).toContain("대화 기록");
    expect(copy.listPersonalSubtitle).toContain("내 계정 전용 비공개");
    expect(copy.listGroupSubtitle).toContain("선택한 그룹 멤버");
  });
});

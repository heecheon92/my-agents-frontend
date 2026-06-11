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

describe("document source empty-state copy", () => {
  it("offers an inline localized path to create a source space", () => {
    expect(en.admin.documents.createFirstSourceSpaceTitle).toContain(
      "Create your first source space",
    );
    expect(en.admin.documents.noKnowledgeBaseDescription).not.toContain(
      "Go to Knowledge",
    );
    expect(ko.admin.documents.createFirstSourceSpaceTitle).toContain(
      "첫 소스 공간 만들기",
    );
    expect(ko.admin.documents.noKnowledgeBaseDescription).not.toContain("지식");
  });
});

describe("document upload workflow copy", () => {
  it("frames file upload and preparation as one workflow", () => {
    const enDocuments = en.admin.documents;
    const koDocuments = ko.admin.documents;

    expect(enDocuments.fileUploadTitle).toBe("Upload and prepare files");
    expect(enDocuments.uploadAndIngestButton).toBe("Upload and prepare files");
    expect(enDocuments.dropDescription).toContain("one workflow");
    expect(enDocuments.uploadStatusLabels.ingesting).toBe("Preparing source");
    expect(enDocuments.runIngest).toBe("Prepare selected source");
    expect(enDocuments.prepareSelectedHint).toContain(
      "File uploads are prepared automatically",
    );

    expect(koDocuments.fileUploadTitle).toBe("파일 업로드 및 준비");
    expect(koDocuments.uploadStatusLabels.ingesting).not.toContain("수집");
    expect(koDocuments.runIngest).not.toContain("검색 가능");
    expect(koDocuments.prepareSelectedHint).toContain("자동으로 준비");
  });
});

describe("source-space creation copy", () => {
  it("states the private and group source-space boundary in English", () => {
    const copy = en.admin.knowledge;

    expect(copy.description).toContain("Create spaces");
    expect(copy.description).toContain("add sources");
    expect(copy.nameLabel).toBe("Source space name");
    expect(copy.scopeHint).toContain("Personal source spaces stay private");
    expect(copy.scopeHint).toContain("Team source spaces");
    expect(copy.scopeBoundaryNote).toContain(
      "Add sources to personal spaces first",
    );
    expect(copy.scopeBoundaryNote).toContain("requires owner/admin approval");
    expect(copy.scopeBoundaryNote).toContain(
      "does not share member conversations",
    );
    expect(copy.listPersonalSubtitle).toContain("private to your account");
    expect(copy.listGroupSubtitle).toContain("team members");
  });

  it("states the same ownership boundary in Korean", () => {
    const copy = ko.admin.knowledge;

    expect(copy.description).toContain("파일과 메모");
    expect(copy.description).toContain("Ask에서");
    expect(copy.nameLabel).toBe("소스 공간 이름");
    expect(copy.scopeHint).toContain("개인 소스 공간");
    expect(copy.scopeHint).toContain("팀 소스 공간");
    expect(copy.scopeBoundaryNote).toContain("먼저 개인 공간에 추가");
    expect(copy.scopeBoundaryNote).toContain("승인이 필요");
    expect(copy.scopeBoundaryNote).toContain("멤버 대화");
    expect(copy.listPersonalSubtitle).toContain("내 계정 전용");
    expect(copy.listGroupSubtitle).toContain("선택한 팀 멤버");
  });
});

describe("group publish copy", () => {
  it("frames Groups as shared source spaces in English", () => {
    const copy = en.admin.groups;

    expect(copy.description).toContain("invite-accepted spaces");
    expect(copy.membershipActions).toBe("Team access");
    expect(copy.memberIdNote).toContain("email invitation acceptance");
    expect(copy.inviteEmailHint).toContain("does not reveal");
    expect(copy.publishBoundaryTitle).toBe("Shared sources");
    expect(copy.publishBoundaryDescription).toContain("personal source space");
    expect(copy.publishSourceKnowledgeBaseHint).toContain(
      "whole personal source space",
    );
    expect(copy.publishTargetKnowledgeBaseHint).toContain(
      "document-copy requests",
    );
  });

  it("frames Groups as shared source spaces in Korean", () => {
    const copy = ko.admin.groups;

    expect(copy.description).toContain("초대를 수락한 뒤");
    expect(copy.membershipActions).toBe("팀 접근");
    expect(copy.memberIdNote).toContain("이메일 초대 수락");
    expect(copy.inviteEmailHint).toContain("계정 존재 여부");
    expect(copy.publishBoundaryTitle).toBe("공유 소스");
    expect(copy.publishBoundaryDescription).toContain("개인 소스 공간");
    expect(copy.publishSourceKnowledgeBaseHint).toContain(
      "개인 소스 공간 전체",
    );
    expect(copy.publishTargetKnowledgeBaseHint).toContain("문서 복사 요청");
  });
});

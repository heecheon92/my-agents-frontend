import { describe, expect, it } from "vitest";
import en from "@/localization/en.json";
import ko from "@/localization/ko.json";

/**
 * Copy guardrails, expressed as invariants rather than exact sentences.
 *
 * This file used to assert ~60 literal strings in both locales. That made every
 * wording change a two-file edit while catching almost nothing: a literal
 * assertion cannot distinguish a good rewrite from a bad one, it only notices
 * that *a* change happened. The rules below encode what actually must stay
 * true — interpolation survives, nothing is left untranslated, implementation
 * vocabulary never reaches a user, and the format list stays honest — so copy
 * can be improved freely and still be protected.
 *
 * Terminology bans (see docs/korean-copy-guide.md) are added by the
 * terminology pass; this file is the place they belong.
 */

type LocalizedEntry = { path: string; en: string; ko: string };

function collectEntries(
  english: unknown,
  korean: unknown,
  path: string,
  entries: LocalizedEntry[],
): void {
  if (typeof english === "string") {
    entries.push({ path, en: english, ko: String(korean ?? "") });
    return;
  }
  if (Array.isArray(english)) {
    english.forEach((value, index) => {
      collectEntries(
        value,
        Array.isArray(korean) ? korean[index] : undefined,
        `${path}[${index}]`,
        entries,
      );
    });
    return;
  }
  if (english && typeof english === "object") {
    for (const key of Object.keys(english)) {
      collectEntries(
        (english as Record<string, unknown>)[key],
        (korean as Record<string, unknown> | undefined)?.[key],
        path ? `${path}.${key}` : key,
        entries,
      );
    }
  }
}

const entries: LocalizedEntry[] = [];
collectEntries(en, ko, "", entries);

const placeholdersOf = (value: string) =>
  (value.match(/\{[a-zA-Z_]+\}/g) ?? []).sort();

/**
 * Values that are legitimately identical across locales: the product name,
 * file-format names, and the `Ask` surface name. Anything else being identical
 * means a Korean string was never translated.
 */
const UNTRANSLATED_BY_DESIGN = new Set([
  "metadata.title",
  "brand.name",
  "service.nav.chat",
  "chat.title",
  "chat.roles.assistant",
  "admin.documents.pdfSource",
  "admin.documents.pdfSourcePrefix",
  "admin.documents.markdownSource",
  "admin.documents.markdownSourcePrefix",
  "admin.documents.fileTypePdf",
  "admin.documents.fileTypeMarkdown",
  "admin.documents.fileTypeWord",
  // Pure format string — "{stage} · {percent}%" contains no words to translate.
  "admin.documents.progressStageLabel",
]);

describe("localized product copy guardrails", () => {
  it("collects every localized string pair", () => {
    expect(entries.length).toBeGreaterThan(500);
  });

  it("keeps implementation terms out of visible English and Korean values", () => {
    for (const entry of entries) {
      for (const text of [entry.en, entry.ko]) {
        expect(text, entry.path).not.toMatch(/Group Chat|그룹 채팅/);
        expect(text, entry.path).not.toMatch(/\bKB\b/);
        expect(text, entry.path).not.toMatch(
          /backend|OpenAPI|route|라우트|\.\.\/my-agents/i,
        );
      }
    }
  });

  it("preserves interpolation placeholders across locales", () => {
    for (const entry of entries) {
      expect(placeholdersOf(entry.ko), entry.path).toEqual(
        placeholdersOf(entry.en),
      );
    }
  });

  it("leaves no Korean string untranslated", () => {
    for (const entry of entries) {
      if (UNTRANSLATED_BY_DESIGN.has(entry.path)) continue;
      expect(entry.ko, entry.path).not.toBe(entry.en);
      expect(entry.ko.trim(), entry.path).not.toBe("");
    }
  });

  it("keeps every Korean string free of stray whitespace", () => {
    for (const entry of entries) {
      expect(entry.ko, entry.path).toBe(entry.ko.trim());
      expect(entry.ko, entry.path).not.toMatch(/ {2,}/);
    }
  });
});

/**
 * Every technical term the guide has ruled on.
 *
 * The point is the default. A plain banned-list only catches jargon someone
 * already noticed, so new vocabulary slips in unchallenged; this inverts it —
 * a watched term must be explicitly allowed or it fails. `스레드`, `토큰`, and
 * `콘솔` were all in shipped copy until this list was written, and `스레드`
 * directly contradicted the guide's own glossary.
 *
 * `paths` scopes an allowed term to the surfaces it belongs in. Domain
 * vocabulary is legible evidence in an inspection surface and noise in a
 * first-run empty state, so the scope is part of the ruling, not a detail.
 */
type JargonRuling =
  | { allowed: false; instead: string }
  | { allowed: true; paths: RegExp; why: string };

const JARGON_RULINGS: Record<string, JargonRuling> = {
  // Allowed: names the retrieval pipeline accurately where a reader has asked
  // for that detail. See the audience note in DESIGN.md.
  임베딩: {
    allowed: true,
    paths: /^admin\.documents\.stages\./,
    why: "ingestion stage in the processing history",
  },
  청크: {
    allowed: true,
    paths: /^admin\.common\.chunks$|^chat\.chunkLabel$/,
    why: "citation and extraction detail",
  },
  엔티티: {
    allowed: true,
    paths: /^admin\.common\.entities$/,
    why: "extraction counts",
  },
  색인: {
    allowed: true,
    paths: /^admin\.documents\.stages\./,
    why: "ingestion stage",
  },
  // Allowed: the composer's reasoning controls name the capability the product
  // is actually exposing. Confined to those keys so it cannot leak into
  // first-run copy or primary actions.
  추론: {
    allowed: true,
    paths: /^chat\.reasoning/,
    why: "the composer's reasoning controls",
  },
  // Banned: transliterating the English term when 추론 already exists.
  리즈닝: { allowed: false, instead: "추론" },
  씽킹: { allowed: false, instead: "추론" },
  메타데이터: {
    allowed: true,
    paths: /^admin\.documents\.stages\./,
    why: "ingestion stage",
  },
  에이전트: {
    allowed: true,
    paths: /^chat\.agentTrace\./,
    why: "the agent trace is the product's evidence surface",
  },

  // Banned: implementation vocabulary with no meaning for a reader.
  옵트인: { allowed: false, instead: "직접 켠 / 사용 설정한" },
  백엔드: { allowed: false, instead: "describe the user-visible behaviour" },
  스레드: { allowed: false, instead: "대화" },
  콘솔: { allowed: false, instead: "워크스페이스" },
  토큰: { allowed: false, instead: "링크 (a user never sees a token)" },
  엔드포인트: { allowed: false, instead: "describe the action, not the route" },
  파라미터: {
    allowed: false,
    instead: "describe the value, not the parameter",
  },
  프롬프트: { allowed: false, instead: "질문" },
  캐시: { allowed: false, instead: "describe the effect" },
  런타임: { allowed: false, instead: "describe the effect" },
  스키마: { allowed: false, instead: "describe the shape in plain terms" },
  디버그: { allowed: false, instead: "상세 정보" },
};

describe("technical vocabulary is ruled on, not left to chance", () => {
  const koreanEntries = entries.filter((entry) => /[가-힣]/.test(entry.ko));

  it("uses watched terms only where the guide allows them", () => {
    // Collected rather than thrown on the first hit: a copy pass should see
    // every violation at once instead of rediscovering them one run at a time.
    const violations: string[] = [];

    for (const entry of koreanEntries) {
      for (const [term, ruling] of Object.entries(JARGON_RULINGS)) {
        if (!entry.ko.includes(term)) continue;
        if (!ruling.allowed) {
          violations.push(
            `${entry.path}: "${term}" is banned — use ${ruling.instead}\n    ${entry.ko}`,
          );
          continue;
        }
        if (!ruling.paths.test(entry.path)) {
          violations.push(
            `${entry.path}: "${term}" is allowed only in ${ruling.why}, not here\n    ${entry.ko}`,
          );
        }
      }
    }

    expect(
      violations,
      `technical vocabulary used outside its ruling (docs/korean-copy-guide.md):\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("keeps the allowed domain terms actually present", () => {
    // Guards the other direction: a well-meaning "simplify the jargon" pass
    // would strip these, losing precision the product deliberately shows.
    const allKorean = koreanEntries.map((entry) => entry.ko).join("\n");
    for (const [term, ruling] of Object.entries(JARGON_RULINGS)) {
      if (!ruling.allowed) continue;
      expect(allKorean, `${term} should still appear somewhere`).toContain(
        term,
      );
    }
  });
});

describe("Korean terminology (docs/korean-copy-guide.md)", () => {
  const koreanEntries = entries.filter((entry) => /[가-힣]/.test(entry.ko));

  it("uses one approved term per concept", () => {
    // Banned alternatives from the glossary. Each was in the shipped copy.
    const banned: Array<[RegExp, string]> = [
      [/지식\s*공간/, "지식 공간 → 지식 베이스"],
      [/지식베이스/, "지식베이스 → 지식 베이스 (spacing)"],
      [/게시\s*요청/, "게시 요청 → 공유 요청"],
      [/고급\s*(처리\s*)?(내역|정보)/, "고급 … → 상세 정보"],
      [/처리\s*정보/, "처리 정보 → 상세 정보"],
      [/옵트인/, "옵트인 → 직접 켠 / 사용 설정한"],
      [/안전한\s*오류/, "안전한 오류 → 안내 메시지"],
      [/임의\s*값/, "임의 값 → describe the real behavior"],
      [/백엔드/, "백엔드 → do not expose implementation to users"],
      [
        /데모/,
        "데모 → the product is never framed as a demo; guest is a tier with limits",
      ],
    ];

    for (const entry of koreanEntries) {
      for (const [pattern, guidance] of banned) {
        expect(entry.ko, `${entry.path}: ${guidance}`).not.toMatch(pattern);
      }
    }
  });

  it("never counts or acts on 지식, which is a mass noun", () => {
    // `지식` stays valid as an uncountable concept ("내 지식에서 질문"), so this
    // targets only the countable and object uses that were ungrammatical.
    const countable =
      /지식\s*\{count\}|지식\s*[0-9]+\s*개|지식을\s*(삭제|추가|공유|미리)/;
    for (const entry of koreanEntries) {
      expect(
        entry.ko,
        `${entry.path}: count/act on 문서, not 지식`,
      ).not.toMatch(countable);
    }
  });

  it("keeps Korean particles agreeing with 베이스", () => {
    // `베이스` ends in a vowel. A find-and-replace from `공간` (consonant) broke
    // 40 of these in one pass, so it is worth locking down.
    for (const entry of koreanEntries) {
      expect(
        entry.ko,
        `${entry.path}: wrong particle after 베이스`,
      ).not.toMatch(/베이스(을|은|과|으로|이[ ,.]|이나)/);
    }
  });

  it("uses the correct ellipsis character", () => {
    for (const entry of koreanEntries) {
      expect(entry.ko, `${entry.path}: use … (U+2026), not ...`).not.toContain(
        "...",
      );
    }
  });

  it("does not slash-chain alternatives in Korean prose", () => {
    for (const entry of koreanEntries) {
      expect(
        entry.ko,
        `${entry.path}: write 소유자나 관리자, not 소유자/관리자`,
      ).not.toMatch(/[가-힣]\/[가-힣]/);
    }
  });

  it("does not hardcode environment-configured guest limits", () => {
    // `24시간`, `대화 1개`, `질문 5개`, `문서 3개` were written into copy from
    // `.env.example` — which is not production, and production config lives
    // outside this repo. Stating a limit the deployment does not enforce is
    // worse than saying a limit exists. Interpolate a served value or stay
    // general; a `{placeholder}` contains no digit and passes.
    for (const entry of koreanEntries) {
      if (!entry.ko.includes("게스트")) continue;
      expect(
        entry.ko,
        `${entry.path}: interpolate the real value instead of hardcoding it`,
      ).not.toMatch(/\d+\s*(시간|분|일|개)/);
    }
  });

  it("keeps action labels short enough to fit a button", () => {
    for (const entry of entries) {
      if (!/(Action|Submit|Button)$/.test(entry.path)) continue;
      if (!/[가-힣]/.test(entry.ko)) continue;
      expect(
        entry.ko.length,
        `${entry.path} is ${entry.ko.length} chars: "${entry.ko}"`,
      ).toBeLessThanOrEqual(16);
    }
  });
});

describe("supported upload format copy", () => {
  it("advertises exactly the formats the uploader accepts", () => {
    // Legacy Office binaries are not supported; advertising `.doc` would be a
    // false capability claim. This is a product contract, so it stays literal.
    const formatCopy = [
      en.admin.documents.fileUploadHint,
      en.admin.documents.multiFileUploadHint,
      en.admin.documents.unsupportedFileError,
      ko.admin.documents.fileUploadHint,
      ko.admin.documents.multiFileUploadHint,
      ko.admin.documents.unsupportedFileError,
    ];

    for (const text of formatCopy) {
      expect(text).toContain(".docx");
      expect(text).not.toMatch(/\.doc(?!x)/);
      expect(text).not.toMatch(/\.xls(?!x)/);
      expect(text).not.toMatch(/\.ppt(?!x)/);
    }
  });

  it("names every upload queue status in both locales", () => {
    const statusKeys = [
      "selected",
      "uploading",
      "uploaded",
      "queued",
      "ingesting",
      "completed",
      "failed",
      "publishing",
    ] as const;

    for (const key of statusKeys) {
      expect(en.admin.documents.uploadStatusLabels[key].trim()).not.toBe("");
      expect(ko.admin.documents.uploadStatusLabels[key]).toMatch(/[가-힣]/);
    }
  });

  it("does not resurrect the removed selectedActions key", () => {
    expect(en.admin.documents).not.toHaveProperty("selectedActions");
    expect(ko.admin.documents).not.toHaveProperty("selectedActions");
  });
});

describe("boundary copy that carries a security or permission promise", () => {
  it("states the personal, group, and system source-space boundary", () => {
    // These sentences explain who can read what. They may be reworded, but each
    // scope must remain explicitly described in both locales.
    for (const scopeHint of [
      en.admin.knowledge.scopeHint,
      ko.admin.knowledge.scopeHint,
    ]) {
      expect(scopeHint.length).toBeGreaterThan(40);
    }

    for (const note of [
      en.admin.knowledge.scopeBoundaryNote,
      ko.admin.knowledge.scopeBoundaryNote,
    ]) {
      expect(note.length).toBeGreaterThan(80);
    }

    // System project spaces are readable by any authenticated Ask user, so the
    // "do not upload secrets" warning is not optional.
    expect(en.admin.documents.systemSourcePublicWarning).toMatch(
      /secret|credential/i,
    );
    expect(ko.admin.documents.systemSourcePublicWarning).toMatch(/비밀|자격/);
  });

  it("never implies user search exists in membership copy", () => {
    for (const text of [
      en.admin.groups.memberIdNote,
      ko.admin.groups.memberIdNote,
      en.admin.groups.inviteEmailHint,
      ko.admin.groups.inviteEmailHint,
    ]) {
      expect(text).not.toMatch(/search for (a )?user|사용자 검색|회원 검색/i);
    }

    // The invite response must not reveal whether an account already exists.
    expect(en.admin.groups.inviteEmailHint).toMatch(/does not reveal/i);
    expect(ko.admin.groups.inviteEmailHint).toMatch(/드러내지|알 수 없/);
  });

  it("keeps ambient system knowledge honest in the chat source selector", () => {
    expect(en.chat.systemAmbientAvailableCopy).toContain("{count}");
    expect(ko.chat.systemAmbientAvailableCopy).toContain("{count}");
    // Selecting fewer personal/group spaces does not turn system knowledge off,
    // and the copy must say so rather than implying full user control.
    expect(en.chat.systemAmbientBoundaryCopy.length).toBeGreaterThan(40);
    expect(ko.chat.systemAmbientBoundaryCopy.length).toBeGreaterThan(20);
  });
});

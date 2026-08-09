# Korean Copy Guide

Status: Active
Last refreshed: 2026-08-09
Owner: product + frontend
Applies to: every user-facing string in `localization/ko.json`

---

## Why this file exists

Korean is this product's primary language: `i18n.config.ts` sets
`defaultLocale: "ko"`, `providers/localization.tsx` is hardcoded to `ko`, and
English is compiled in but never rendered. So `ko.json` is not a translation —
**it is the product's actual copy**, and `en.json` is the derived artifact.

Machine-assisted copy tends to be grammatical and still obviously non-native. It
calques English structure, coins nouns that no Korean product uses, mixes
politeness levels, and explains too much. Those are hard to spot one string at a
time and obvious across a whole screen.

This file exists so that anyone — human or agent — editing Korean copy makes the
same choices. **Read it before touching `ko.json`.** If you need to break a rule
here, change the rule in this file in the same commit and say why.

---

## 1. Glossary

One approved Korean term per concept. The "Never" column lists terms that
previously appeared in this codebase or that a translator would plausibly reach
for; they are wrong here, not merely dispreferred.

### Core nouns

| Concept | Korean | Never | Why |
|---|---|---|---|
| document / source (one item) | `문서` | `지식` | **`지식` is a mass noun.** `지식 3개`, `지식 삭제`, `이 지식 공유` are ungrammatical the way "three informations" is in English. This was the single most pervasive error in the original copy. |
| knowledge base / source space | `지식 베이스` | `지식 공간`, `자료함`, `KB` | `지식 공간` is a coined term that no Korean product uses, so it teaches nothing on first read. `지식 베이스` is the established term in Korean AI/RAG products. |
| knowledge (the mass concept) | `지식` | — | Still correct when uncountable: `내 지식에서 질문하기`, `그룹 지식`, `프로젝트 지식`. The rule is about counting and acting on individual items, not banning the word. |
| conversation / thread | `대화` | `채팅`, `스레드` | `채팅` implies casual messaging; this product is a work tool. |
| citation | `인용` | `출처 표기`, `레퍼런스` | |
| group | `그룹` | `팀`, `조직` | Matches the API's `group`. |
| member | `멤버` | `구성원`, `회원` | `회원` means "registered user of a service", which is a different concept here. |
| guest session | `게스트 세션` | `방문자 세션`, `데모 세션` | |
| guest access | `게스트 이용` | `데모`, `데모 모드`, `체험판` | **Never call the product a demo.** Guest is an account tier with limits, not a trial of something unfinished. State the limits plainly — 24 hours, one conversation, five questions, three documents — but do not frame the product itself as a sample. |
| run (one answer attempt) | `답변` in user-facing copy; `실행` only in advanced disclosures | — | Users think in answers, not runs. |
| ingestion / preparation | `준비` | `수집`, `인제스트`, `색인` | `준비` says what the user gets: the document becomes usable. |

### Domain vocabulary — keep it

There is a real distinction between **AI domain vocabulary**, which belongs in
this product, and **implementation leakage**, which does not. The anti-jargon
rules further down target the second kind only.

Keep these. Do not "simplify" them into vaguer Korean:

| Term | Korean | Where |
|---|---|---|
| embedding | `임베딩` | processing history, ingestion stages |
| chunk | `청크` | citation details, extraction counts |
| entity | `엔티티` | extraction counts |
| index | `색인` | ingestion stages |
| retrieval | `검색` | agent trace, activity events |
| citation | `인용` | everywhere; this one is user-facing |

**Why.** This is a portfolio product whose audience includes technical
reviewers assessing the author's AI engineering work. Naming the pipeline
accurately is part of what the product is demonstrating, so `임베딩 생성` is
better than a softened `의미 분석`, and `청크` is better than `문단`.

**The line.** Domain terms are allowed where the surface is already about
inspection — extraction history, citation details, the agent trace. They do not
belong in first-run copy, empty states, or primary actions, where the reader has
not asked for that level of detail. And they never license the genuinely
implementation-facing vocabulary banned below: `백엔드`, `라우트`, `옵트인`,
`임의 값`, raw enums, or bare identifiers in a primary reading path. Naming your
retrieval pipeline is showing craft; leaking your stack trace is not.

### Actions and states

| Concept | Korean | Never |
|---|---|---|
| share request (document → group) | `공유 요청` | `게시 요청`, `퍼블리시` |
| activity events | `작업 내역` | `처리 정보`, `고급 처리 내역`, `활동 로그` |
| advanced disclosure | `상세 정보` | `고급 정보`, `고급 그룹 정보`, `고급 상세` |
| display name | `표시 이름` | `닉네임`, `별명` |
| ready (a document is usable) | `준비됨` | `완료`, `성공` |
| needs attention (failed) | `확인 필요` | `실패`, `오류` — for per-item states where the user can retry |

**One concept, one term.** Before this guide, the same disclosure was labelled
four different ways on the same screen and share requests had two names. If you
need a new term, add it here first.

---

## 2. Register and mechanics

### Politeness

Use **합쇼체** (`-습니다` / `-ㅂ니다`) for statements and **`-하세요`** for
instructions. Do not mix in `해요체` (`-해요`), and do not drop to plain form.

- Statement: `지식 베이스를 만들었습니다.`
- Instruction: `문서를 추가한 뒤 질문하세요.`
- Never: `지식 베이스를 만들었어요.` / `문서를 추가해.`

`-해 주세요` is for asking the user to do something inconvenient on the
product's behalf (retry, wait, check email). `-하세요` is for normal
instructions. Do not use `-해 주세요` everywhere as a politeness hedge.

### Sentence length

One idea per sentence. If a description needs two clauses joined by `-며`,
`-고`, or `-뒤`, it usually wants to be two sentences. Aim for **60 characters
or fewer** per sentence in descriptions and hints.

> Before: `지식을 Ask 검색에서 제외되는 비공개 임시 공간에 저장한 뒤 그룹 승인 요청을 만듭니다. 그룹 소유자/관리자가 승인한 복사본만 사용할 수 있습니다.`
> After: `문서를 비공개 임시 보관함에 먼저 저장합니다. 그룹 소유자나 관리자가 승인하면 그룹에서 사용할 수 있습니다.`

### Button and action labels

- Prefer a bare noun or `동사 + 하기`: `파일 업로드`, `그룹 만들기`, `초대 보내기`.
- Keep them under **10 characters** where possible; never over 16.
- Do not end an action label with `-세요`. That is instruction copy, not a label.
- Be consistent within a screen: do not mix `추가` and `추가하기` side by side.

### Punctuation and characters

- Ellipsis is `…` (U+2026). Never `...`.
- No slash-chained alternatives in prose: `소유자/관리자` → `소유자나 관리자`.
  Slashes are acceptable only inside a genuine file-format list (`.md/.markdown`).
- No trailing spaces, no double spaces. Enforced by `tests/knowledge-copy.test.ts`.
- Keep file extensions, product names, and API terms in Latin script: `PDF`,
  `Markdown`, `.docx`, `Ask`.

### Particles after a renamed noun (조사 호응)

**Never rename a noun with a plain find-and-replace.** Korean particles agree
with whether the preceding syllable ends in a consonant, so changing the noun
changes the particle:

| After a consonant | After a vowel |
|---|---|
| `공간을` | `베이스를` |
| `공간은` | `베이스는` |
| `공간이` | `베이스가` |
| `공간으로` | `베이스로` |
| `공간과` | `베이스와` |
| `공간이나` | `베이스나` |

Renaming `지식 공간` → `지식 베이스` in this repo produced 40 broken particles
(`지식 베이스을`) in one pass. After any noun rename, grep for the new noun plus
the following character and check every form:

```bash
python3 -c "
import re, collections
s = open('localization/ko.json', encoding='utf-8').read()
print(collections.Counter(re.findall(r'베이스(.)', s)).most_common())
"
```

Avoid writing copy that needs `(으)로` or `을(를)` to stay correct. If a string
interpolates a name whose final consonant is unknown, rewrite the sentence so no
particle directly follows the placeholder.

### Spacing (띄어쓰기)

`지식 베이스`, `표시 이름`, `공유 요청`, `작업 내역` are spaced. Do not write
`지식베이스`. Compound verbs attach: `업로드하기`, not `업로드 하기`.

---

## 3. Anti-patterns

Each of these was in the shipped copy. They are the failure modes to watch for.

| Before | Why it is wrong | After |
|---|---|---|
| `안전한 오류가 여기에 표시됩니다` | Calque of "safe errors". `안전한 오류` is meaningless in Korean — an error is not safe or unsafe to a user. | `제한에 걸리면 안내 메시지가 표시됩니다` |
| `임의 값, TTL 제어는 노출하지 않습니다` | "arbitrary values" and "TTL" are implementation vocabulary the user has no referent for. | Describe the user-visible behavior, or delete the sentence. |
| `사용자의 옵트인 메모리 설정` | `옵트인` is untranslated jargon. | `직접 켠 메모리 설정` |
| `다시 오신 것을 환영합니다` | Word-for-word "Welcome back". Korean services do not greet this way. | `다시 만나 반가워요` — or just use the action, `로그인` |
| `수정/재전송/취소할 초대 ID` | Reads like a field spec. Slash-chaining plus a compound relative clause. | Move the actions to the row; label the field `초대 ID` |
| `사용 가능한 모든 지식을 참고할 수 있음` | `-음` nominal ending inside a screen that otherwise uses `-습니다`. | `사용 가능한 모든 문서를 참고합니다` |
| `그룹 접근` | Bare noun phrase with no clear referent — access to what, doing what? | `그룹 권한 관리` |
| `역할을 바꿀 활성 멤버 사용자 ID` | Long pre-nominal relative clause; English word order forced onto Korean. | `사용자 ID` with a separate hint sentence |
| `지식 2개 중 2개 준비됨` | Counting a mass noun. | `문서 2개 중 2개 준비됨` |
| `내부 처리 정보는 숨김` | `-ㅁ` nominal ending, telegraphic register. | `내부 처리 정보는 표시하지 않습니다` |

### General smells

- **Over-explanation.** If a hint restates what the label already says, cut it.
- **Hedging.** `~할 수 있습니다` everywhere weakens copy. If the action is
  available, say what it does.
- **Passive voice imported from English.** Korean prefers an explicit actor or a
  plain statement: `승인되면` over `승인이 이루어지면`.
- **Explaining the backend.** Users do not need to know something is "a copy" or
  "a staging space" unless it changes what they should do.

---

## 4. Canonical action labels

The same action had up to five entry points under three labels. Use exactly
these; if a screen needs a different one, add it here.

| Action | Korean label |
|---|---|
| Create a knowledge base | `지식 베이스 만들기` |
| Upload files | `파일 업로드` |
| Add a text document | `텍스트 추가` |
| Ask using these documents | `이 문서로 질문하기` |
| Share a document with a group | `공유 요청` |
| Review a share request | `요청 검토` |
| Approve / reject a share request | `승인` / `거절` |
| Create a group | `그룹 만들기` |
| Invite a member | `멤버 초대` |
| Change a member's role | `역할 변경` |
| Manage an invitation | `초대 관리` |
| Open the browser on compact screens | `목록 보기` |
| Regenerate an answer | `다시 생성` |
| New conversation | `새 대화` |
| Log out | `로그아웃` |

Destructive actions are always `삭제`, never `제거` or `지우기`. Cancel is
always `취소`. Close is always `닫기`.

---

## 5. Checklist before committing copy

1. Does every term match the glossary? Especially: is `지식` being counted or
   acted on? If so it should be `문서`.
2. Is the politeness level consistent with its neighbours on the same screen?
3. Is any sentence longer than ~60 characters, or joined by `-며` / `-뒤`?
4. Do action labels match the canonical table?
5. Any `...`, slash-chained alternatives, or double spaces?
6. Does `en.json` have the same keys with equivalent meaning?
7. Run `pnpm exec vitest run tests/knowledge-copy.test.ts`.

---

## 6. How this is enforced

`tests/knowledge-copy.test.ts` encodes the mechanical parts as invariants rather
than as exact sentences, so copy stays free to improve:

- banned glossary terms never appear in any Korean string;
- `{placeholder}` tokens match between `ko.json` and `en.json`;
- no Korean value is byte-identical to its English source, except a short
  allowlist of proper nouns and file formats;
- no leading, trailing, or doubled whitespace;
- action labels stay within the length budget.

What it cannot check is tone. That is what sections 2 and 3 are for, and why
this file is worth reading rather than skimming.

## Related

- `DESIGN.md` — content voice, terminology at the design level.
- `AGENTS.md` — the rule that no user-facing string may be hardcoded in a component.
- `docs/backend-requests.md` — error `code` request; until it lands, backend
  `detail` is not rendered, because it is English prose.

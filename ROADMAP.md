# Frontend roadmap — answer transparency surface

Recorded 2026-08-25. **Implemented and verified locally on 2026-08-26.** The provider-independent frontend surface is complete. The optional
backend operational-summary contract remains proposed and waits for hosted
OpenAPI.

Priority: **not urgent, but do it in the next available slot.** None of it is a
defect. It is a coherent rethink of how the product shows its work, and the
three items below are one idea, not three chores: *the answer should explain
itself while it is being produced, not behind a disclosure afterwards.*

---

## Where this starts from

The evidence surface was reworked earlier the same day. Read
`docs/implementation-log.md` (last three entries) before touching any of this —
it records why the current shape is what it is, and two of the decisions there
are load-bearing for what follows.

Current state of the assistant message footer, top to bottom:

| Surface | Korean label | What it holds | Fate |
|---|---|---|---|
| Sources disclosure | `참고한 출처` | One row per document: name, knowledge base, pages, `근거` badge | **Keep.** Confirmed good. |
| Evidence disclosure | `응답 근거` | Run rows + `작업 내역` + agent trace summary | **Removed** (item 1) |
| Agent process | `에이전트 흐름` | Reached phases, backend-authored dynamic steps, honest terminal state, quiet run-ID copy | **Implemented** (item 3) |

> The source-grouping, `consulted_sources` wiring, and new-chat fix are the
> pushed `ad9f7fb` baseline for this work. The roadmap implementation itself is
> intentionally uncommitted until user authorization.

> **Backend not deployed.** `consulted_sources`, `document_title` and
> `knowledge_base_name` exist on the locally served OpenAPI document only. The
> backend change carries an Alembic migration and has not been deployed. Item 3
> adds a second backend dependency on top of that one.

---

## Item 1 — Remove `응답 근거` — implemented

Delete the second disclosure. Its contents either move (item 3) or go.

**What it currently holds**, so nothing is lost by accident:

- Run rows — status pill, timestamp, and a `상세 정보` disclosure containing
  `run_id`. This is the operational audit surface.
- `작업 내역` — the activity event list. Moves to item 3.
- `AgentTraceSummary` — the staged trace. Moves to item 3.

**Resolved:** keep `run_id` behind a quiet copy affordance for support and
debugging. Do not render the raw value in the ordinary reading path. Reuse the
existing copy-control behavior and announce success separately; if clipboard
access fails, reveal the raw ID as the fallback so the only support handle does
not become unreachable.

**Blocking dependency: the onboarding tour.** `chat.response-evidence` is a
registered `OnboardingTarget` referenced twice in
`components/onboarding/onboarding-steps.ts` (lines 59 and 107). Removing the
panel without removing or repointing those steps leaves the tour pointing at a
target that never registers. Repointing them at the item 3 surface is probably
right, which is an argument for doing items 1 and 3 together rather than
shipping 1 alone.

Each of those two steps also owns copy — `guestEvidenceTitle`/`guestEvidenceBody`
and `newReviewEvidenceTitle`/`newReviewEvidenceBody`. Both currently describe
citations *and* work history appearing together for review, which is a promise
the new surface has to keep or the copy has to stop making.

Touches: `components/chat/EvidencePanel.tsx`,
`components/chat/evidence-panel/sections.tsx`,
`components/onboarding/onboarding-steps.ts`, plus the `responseEvidence` /
`viewResponseEvidence` copy keys in both locales.

---

## Item 2 — Document identity decision — resolved without code

In `참고한 출처`, put the document id next to the name.

### Flagging a tension before it becomes a surprise

This partly reverses a decision from hours earlier. The instruction that shipped
was to remove `document_id`, `knowledge_base_id` and `chunk_id` from the panel
*and* from `상세 정보` — and `e2e/chat-citations.spec.ts` now asserts
`toHaveCount(0)` for exactly those values, specifically so they cannot come back
without someone noticing. That assertion will fail on this change, which is the
test doing its job, not a bug.

The reason it was removed: `document_id` is an internal handle. Rendering it
beside a filename reads as noise to a user who has no use for it, and it was the
bulk of what made the old disclosure feel like a debug panel.

The reason it might belong now: with `응답 근거` gone, there is no remaining
place to identify a document unambiguously — and two documents can legitimately
share a filename.

**Resolved product decision:** this is a human-disambiguation problem, not a
server-lookup or developer-debugging affordance. Keep raw document IDs out of
the product UI and close this item without code because the current row already
shows document name, knowledge-base name, and deduplicated pages. The existing
`toHaveCount(0)` identifier assertions remain correct and protect that decision.

The alternatives remain recorded because they explain why the raw ID was not
reintroduced:

- *"I need to tell two same-named documents apart"* → a disambiguator is the
  fix, not an id. Show the knowledge base, the page range, or a short hash — and
  only when there is an actual collision in the list.
- *"I need to look this up server-side"* → an id is right, but it belongs in a
  copy-to-clipboard affordance or a staff-only view, not in the reading line.
- *"I want to see it while building"* → a dev-only display, not product copy.

Known limitation: two documents with the same filename in the same knowledge
base and identical or absent page metadata still render identically. Record it
as a future disambiguation case rather than leaking an internal identifier now.

Touches: `components/chat/evidence-panel/sections.tsx` (`DocumentSourceRow`),
`components/chat/evidence-panel/evidence-sources.ts` (`EvidenceDocument`
currently discards everything except `documentId`, which it keeps only as a
grouping key), and `e2e/chat-citations.spec.ts`.

---

## Item 3 — Live agent process UI — frontend implemented; backend summary pending

The largest of the three, and the reason the other two exist.

Today the agent's work is **retrospective and buried**: `작업 내역` and the
agent trace sit inside a closed disclosure, readable only after the answer has
already arrived. The intent is the opposite — an **immediate, animated** surface
showing what the agent is doing *as it happens*, so a slow answer reads as
visible progress rather than as a hang.

### There is already a foundation — do not start from scratch

`components/chat/evidence-panel/trace.tsx` (297 lines) already contains most of
the machinery:

- `getAgentTraceStageKeys` derives an ordered stage list from live events.
- `getCurrentAgentTraceStep` returns the current stage.
- `CurrentAgentTraceStepPanel` already renders it **live, during a run** — it is
  wired into `ChatTranscript` at two call sites and is not behind a disclosure.

So the live path exists; it is just extremely thin — one line of text, current
stage only, no history, no motion, no reasoning. Item 3 is largely *growing that
component*, not building a new one. Reuse the stage vocabulary in
`localization.agentTrace.stages` rather than inventing a second one.

### Settled design

- Render only stages the backend has actually reported. Do not show a total,
  percentage, future pending stages, or “N of M”; skipped stages and the final
  `answerReady` versus `needsEvidence` branch are unknowable until observed.
- Reached stages accumulate live and persist as a compact static record for the
  latest completed answer only. Older answers keep explicit unavailable copy.
- Completed stages are static. The current stage receives restrained progress
  emphasis, and `prefers-reduced-motion` removes pulse and transition.
- Failed and cancelled runs retain reached stages and end in truthful static
  terminals. Suspended runs freeze immediately at `확인 요청 대기`; the durable
  interaction card remains the action surface. Insufficient/zero-result runs
  reuse the existing `근거 필요` stage.
- Empty/no-event state renders no process timeline. The existing generating and
  stale-run states remain responsible for those cases.

### Backend dependency — reasoning summary

The reasoning summary does not exist in any contract today and cannot be
invented client-side. It needs a real backend contract before any UI work:

- What is it — a per-stage sentence, or one rolling summary?
- When is it emitted — a new SSE event type, or a field on existing activity
  events?
- **Redaction.** `AGENTS.md` is explicit that activity events are *redacted
  operational steps, not hidden chain-of-thought*. A "reasoning summary" is
  exactly the field where that line gets crossed by accident. The backend must
  own the redaction; the frontend must not be the thing deciding what is safe to
  show.

File the contract in `docs/backend-requests.md` and hand it to the backend
before building against it — same flow as `consulted_sources`, which worked
well. Do not derive models from a description; wait for the served OpenAPI
document.

---

## Suggested order

1. **Item 3 backend contract** — file it first. It has the longest lead time and
   everything else can proceed while it is being built.
2. **Item 2** — small and self-contained, once the question above is answered.
3. **Item 3 frontend** — grow `CurrentAgentTraceStepPanel`.
4. **Item 1** — last, deliberately. Removing `응답 근거` before item 3 can hold
   `작업 내역` and the trace would be a straight loss of information. Doing it
   after means the onboarding steps can be repointed at the new surface in the
   same change rather than deleted and re-added.

## Open questions

- Operational summary delivery remains open: the provider-independent semantic
  contract is filed in `docs/backend-requests.md`, but frontend model work waits
  for hosted OpenAPI.

## Housekeeping this touches

`chat.documentLabel`, `chat.knowledgeBaseLabel` and `chat.chunkLabel` are
already unused by any component and were left in place deliberately. Items 1 and
2 will add more orphans (`responseEvidence`, `viewResponseEvidence`, possibly
`advancedDetails` in the chat namespace). Clean them up in one pass at the end
rather than piecemeal — and check `tests/knowledge-copy.test.ts`, which
references `chat.chunkLabel` in a rule.

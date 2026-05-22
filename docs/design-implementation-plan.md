# Design Implementation Plan

This is a concise handoff for the frontend engineer. `DESIGN.md` is the source of truth; this plan only sequences the first safe implementation passes. It incorporates frontend engineering feedback from 2026-05-22 and remains documentation-first.

## Aesthetic direction

Build `my-agents` as a professional AI workspace: transcript-first chat, restrained semantic status colors, progressive disclosure for inspector panels, reusable panel/list/message primitives, and product artifacts tied to real backend concepts. Remove the old Cal.com/calendar analysis from design rationale; calendar-grid motifs should not guide future UI polish.

## Priority 1 — Tokens and small primitives

- Keep Tailwind v4 and existing helper classes; do not add dependencies.
- Remap existing `app/globals.css` custom properties toward the `DESIGN.md` ink/parchment/signal palette.
- Preserve existing fluid type/spacing tokens and responsive helpers.
- If renaming `cal-*` helpers, do it as a compatibility migration: add semantic aliases first, update call sites in small batches, then remove old names only after verification.
- Add only small local primitives when they remove repeated class strings: `WorkspacePanel`, `ResourceList`/`ResourceRow`, `MessageBubble`, `EvidenceCard`, `TimelineStep`.
- Acceptance: landing, auth, service shell, chat, and admin surfaces still render with no missing classes and no contrast regressions.

## Priority 2 — Shell and entry/auth clarity

- Update the `/` preview module away from calendar cells and toward transcript + activity + citation/document-source cards.
- Keep the service shell professional and calm; avoid untested dark mode and avoid fixed-height mobile overflow traps.
- Keep copy in localization dictionaries.
- Auth panel feature cards should emphasize session safety, runs, citations, guest limits, and backend-owned workflows.
- Acceptance: entry/auth screens explain the actual product within 5 seconds and remain readable at 390px, 768px, and 1280px.

## Priority 3 — Transcript-first chat

- Reduce `ChatWorkspace` density without changing data flow: transcript and composer first, conversation list secondary, inspectors progressively disclosed.
- Extract only if useful: `MessageBubble`, `ComposerBar`, `EvidenceCard`, and `TimelineStep` from repeated chat patterns.
- Activity events should be more readable than raw JSON-first cards: show sequence/event type as the row title, then a contained safe payload preview.
- Citations should visually connect filename/page/snippet/document ID and use the evidence accent sparingly.
- Preserve the safe assistant Markdown boundary and plain-text user message behavior.
- Acceptance: chat inspector is scannable on desktop and stacked/collapsible without overflow on mobile.

## Priority 4 — Admin surfaces

- Keep ID-based workflows honest; improve helper text, grouping, progressive disclosure, and disabled reasons before adding new controls.
- Make upload queue states, extraction progress, and retry/remove actions visually consistent with `Status.Pill` tone rules.
- Later wart to verify in this slice: frontend feedback flagged a duplicate `event.currentTarget.value` reset in `AdminSurfaces.handleFileSelection`; current source inspection shows one reset, so re-check during the admin edit and remove any duplicate if present.
- Acceptance: document upload/ingest and group permission flows are understandable without backend search features.

## Required verification for UI implementation

- `pnpm lint`
- `pnpm exec tsc --noEmit`
- `pnpm exec vitest run` for affected behavior/rendering boundaries
- `pnpm build`
- Browser/responsive smoke for changed routes at 390px, 768px, 1280px, and desktop chat width
- Specific overflow check for fixed-height/scroll regions in `ChatWorkspace` and `AdminSurfaces`
- `git diff --check`

## Do not do in the first pass

- Do not edit backend files or invent backend fields.
- Do not add a UI/component/animation/chart dependency.
- Do not broadly rewrite data flow, query hooks, BFF behavior, auth, guest limits, upload limits, or backend contracts.
- Do not redesign routing or BFF behavior.
- Do not hide activity events, citations, guest limits, or backend constraint copy for visual cleanliness.
- Do not add dark mode until it has an explicit design and verification pass.

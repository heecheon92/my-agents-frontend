## 2026-06-24 — Knowledge management lifecycle UX

- Moved publish-request creation to Knowledge-owned source-space and document actions so users share selected entities through group/source-space selectors instead of typing document or knowledge-base IDs.
- Added source-space rename/delete/share controls on the Knowledge page, while Groups now stays review/status oriented for publish requests.
- Expanded the per-document Manage interaction into a richer sheet-style surface with lazy KB-scoped Markdown preview, preparation history, delete, reprocess, and share actions.
- Updated typed API services, query keys, TanStack hooks, BFF proxy allowlist, localization, and route tests for KB preview/update/delete/share flows; duplicate preview allowlist policy was removed during cleanup.
- Backend companion branch supplies the lifecycle contract: blank KB names reject, hidden staging KBs stay internal, pending requests withdraw on source deletion, and whole-KB approvals create group-owned copies with a legacy backfill script.

Verification passed for this log entry: backend `uv run ruff check . --no-cache`, `uv run ruff format --check .`, and `uv run pytest -q` (452 passed / 1 skipped); frontend `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run` (148 passed), `pnpm build`, `pnpm exec playwright test` (26 passed / 2 skipped), and `git diff --check` in both repositories. Independent final code review returned APPROVE with zero issues, and final architecture review returned CLEAR.

## 2026-06-23 — DOCX-only upload affordance

- Extended the Sources upload allowlist and bilingual upload copy to include modern Word documents (`.docx`) alongside PDF, Markdown, text, `.xlsx`, and `.pptx`.
- Kept legacy binary Word files rejected by local validation and out of visible product copy.
- Added focused upload-config coverage for `.docx` acceptance plus legacy Word rejection, and copy guardrails for the new localized Word labels.

Verification for this slice is recorded in the worker-2 Task 2 completion evidence.

## 2026-06-15 — Admin surfaces cleanup and agent guidance

- Split the former 4,486-line `components/AdminSurfaces.tsx` into a compatibility barrel plus focused `components/admin-surfaces/` modules for Sources, Groups, shared helper UI, upload queue rows, group chrome, source-space forms/tree/table/dialog pieces, group rows, and publish-review panels.
- Preserved the existing public import path (`@/components/AdminSurfaces`) so route files and tests do not need behavior changes.
- Kept data fetching, mutation orchestration, and backend contracts in `SourcesSurface` / `GroupsSurface` while extracting only leaf/presentational helpers; no new dependencies or API/model changes were introduced.
- Added repo-local agent guidance for Server Component preference, server fetch freshness/caching, and mobile responsiveness, then linked those docs from `AGENTS.md` and `docs/frontend-architecture.md`.

Verification planned/passed for this log entry: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run`, `pnpm build`, `pnpm exec playwright test e2e/group-knowledge-v1.spec.ts`, and `git diff --check`.

## 2026-06-14 — Groups workspace action redesign

- Re-laid out `/groups` around the same organization-shell pattern as `/knowledge`: a persistent group browser on desktop, compact-screen group browser sheet, selected-group header, overview cards, and focused action dialogs.
- Moved group creation, member invitations, member role changes, share request creation, and publish approval/rejection out of the first-look page and into dialogs or row-owned actions.
- Kept the invite-only privacy boundary visible: email invitation remains the primary path, nicknames are the member-facing labels, and raw user IDs/invitation IDs/publish IDs stay in Advanced details or focused dialogs.

Verification planned/passed for this entry: `pnpm lint`, `pnpm exec tsc --noEmit`, targeted `pnpm exec vitest run tests/knowledge-copy.test.ts tests/group-api.test.ts`, targeted `pnpm exec playwright test e2e/group-knowledge-v1.spec.ts --reporter=line`, `pnpm build`, and `git diff --check`.

## 2026-06-11 — Row-owned Knowledge actions

- Removed the separate “selected knowledge/source” action panel from the Knowledge workspace so the main pane stays focused on the table.
- Added per-row Manage dialogs for source deletion, source metadata, and advanced processing history; direct user access grants were later removed from the product UI.
- Kept upload/preparation as the primary path, while adding a row-level async prepare/retry action in the Manage dialog for recovery when upload-time preparation fails.

Verification passed for this entry: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run` (18 files / 105 tests), `pnpm build`, targeted `pnpm exec playwright test e2e/document-upload-dropzone.spec.ts --reporter=line` (5 passed), full `pnpm exec playwright test --reporter=line` (16 passed / 2 skipped), browser navigation smoke of `/knowledge/kb-personal` (expected unauthenticated 401 only), and `git diff --check`.

## 2026-06-11 — Addressable Knowledge workspace polish

- Added `/knowledge/[sourceId]` so a selected personal knowledge space, group knowledge space, or group group can be opened directly and survives refresh.
- Kept the organization-tree behavior: tree rows navigate with links, group rows select the group context, and child knowledge-space rows select that exact space.
- Widened and left-aligned the Knowledge workspace so the table/inspector use the available service-shell width instead of sitting in a centered narrow column.
- Updated Korean copy to prefer “지식” / “지식 공간” over the less intuitive “소스” wording while keeping the English “Sources” mental model unchanged.

Verification passed for this entry: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run` (18 files / 105 tests), `pnpm build`, targeted `pnpm exec playwright test e2e/document-upload-dropzone.spec.ts --reporter=line` (4 passed), full `pnpm exec playwright test --reporter=line` (15 passed / 2 skipped), browser navigation smoke of `/knowledge/kb-personal` (expected unauthenticated 401 only), and `git diff --check`.

## 2026-06-11 — Merged Sources workflow

- Merged the former Knowledge/Add sources mental model into one visible Sources entry: `/knowledge` now hosts source-space selection, source readiness, and selected-source advanced controls; `/documents` redirects to the merged page for compatibility.
- Re-laid out Sources around an organization shell: a persistent source-space tree on desktop, a mobile source-space sheet, and a table-style source list with a selected-source inspector.
- Moved source-space creation, text-source creation, and file upload/preparation into shadcn/Base UI dialogs so the default page reads as “choose a space, review its sources, add when needed” instead of stacked setup forms.
- Updated onboarding, localized copy, route tests, and active docs to minimize cross-page depth while keeping group sharing, raw IDs, and processing history behind secondary/Advanced controls.

Verification passed for this entry: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run` (18 files / 105 tests), `pnpm build`, full `pnpm exec playwright test --reporter=line` (14 passed / 2 skipped), mocked desktop browser smoke of `/knowledge` with zero console errors and readable source-space tree/table layout, and `git diff --check`.

## 2026-06-11 — Unified document upload preparation UX

- Reframed the Documents file flow so upload and preparation read as one user workflow: primary titles/buttons, queue states, announcements, and Korean copy now say files are uploaded and prepared together instead of exposing ingestion jargon.
- Kept the backend extraction-run mechanics available as advanced processing history, while adding helper copy that file uploads are prepared automatically and the manual selected-source action is only for existing text sources or refreshes.
- Updated the design contract and copy guardrail tests so future upload UI work preserves the unified workflow language.

Verification passed for this entry: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run` (18 files / 105 tests), `pnpm build`, full `pnpm exec playwright test --reporter=line` (12 passed / 2 skipped), and `git diff --check`.

## 2026-06-11 — Backend-configured document upload fan-out

- Replaced the Documents queue's hardcoded multi-file upload concurrency with a backend-owned `/health` runtime hint: `frontend_config.documents.upload_concurrency`.
- Kept the historical fallback at 3 so older or mocked backends do not break the Documents page before the backend contract is deployed.
- Added frontend model coverage for the new health response shape and fallback behavior.

Verification passed for this entry: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run` (18 files / 104 tests), `pnpm build`, full `pnpm exec playwright test --reporter=line` (12 passed / 2 skipped), and `git diff --check`.

## 2026-06-11 — Persisted shadcn service sidebar

- Replaced the protected service shell's custom desktop aside/mobile scroll nav with the shadcn/Base UI `Sidebar` stack while preserving the existing Ask, Add sources, Knowledge, and Groups routes.
- Added the missing shadcn sidebar support primitives (`Sidebar`, `Sheet`, `Tooltip`, `Input`, `Separator`, `Skeleton`, and mobile breakpoint hook) without overwriting the repo's customized `Button`.
- Persisted the desktop icon-collapsed state through the non-sensitive `sidebar_state` cookie: the client sidebar writes the preference and the service layout reads it as `defaultOpen` on reload.
- Kept session restore copy visible in the expanded sidebar for existing smoke checks, exposed a mobile header trigger/logout path, and added localized accessible toggle labels.

Verification passed for this entry: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run` (17 files / 102 tests), `pnpm build`, targeted `pnpm exec playwright test e2e/sidebar-persistence.spec.ts --reporter=line` (1 passed), full `pnpm exec playwright test --reporter=line` (12 passed / 2 skipped), and `git diff --check`.

## 2026-06-10 — Invite-only group membership docs sync

- Aligned frontend README/backend-request copy with the approved invite-only group boundary: no user search, no account-existence leak, and no direct `user_id` member activation.
- Recorded the expected invitation lifecycle contract for hosted OpenAPI follow-up before runtime model/client changes.
- Preserved the existing shared-knowledge mental model: group KBs and publish requests are shared after acceptance, while conversations and opt-in memory stay private to the authenticated user.

Verification for this docs-only entry is part of the current worker-4 backend/frontend documentation pass.

## 2026-06-09 — Office file upload frontend wiring

- Extended the Documents/Add sources upload queue from PDF/Markdown/plain-text to also accept modern Office files: Excel workbooks (`.xlsx`) and PowerPoint decks (`.pptx`). Legacy `.xls`/`.ppt` remain unsupported.
- Kept the existing KB-nested multipart upload path and backend boundary intact; the frontend only updates local accept/validation, per-file type labels, and source metadata labels for backend `spreadsheet` / `presentation` documents.
- Updated English/Korean UI copy plus README/runbook contract notes so supported upload claims include `.xlsx`/`.pptx` without implying arbitrary file support.

Verification passed for this slice: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run` (17 files / 99 tests), `pnpm build`, and full Playwright on an isolated temporary port because port 3000 was already occupied by an unrelated Next server: `pnpm exec playwright test --config /tmp/my-agents-frontend-playwright-3107.config.ts --reporter=line` (11 passed / 2 skipped).

## 2026-06-07 — Guest demo guided onboarding slice

- Added a lightweight product-specific onboarding runtime under the protected service shell. G001 currently enables only the guest demo flow; authenticated new-user prompting remains disabled until the later new-user slice is implemented.
- Added Zustand for small client-only onboarding state after the user explicitly allowed Zustand/framer-motion/proven libraries in the onboarding planning brief; active runtime state and HTMLElement target registry stay in memory, guest decisions are session-scoped, and authenticated decisions use salted opaque localStorage buckets without raw email/user IDs.
- Registered visible tour targets around guest limits, the chat composer, knowledge selector, Add sources nav, and answer evidence; mobile-specific shell targets are selected at the `lg` breakpoint instead of measuring hidden desktop elements.
- Added Korean/English onboarding copy and regression tests for localization coverage, guest flow shape, opaque identity buckets, and persistence partialization.

Verification passed for this slice: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run` (17 files / 97 tests), `pnpm build`, targeted `pnpm exec playwright test e2e/guest-onboarding.spec.ts --reporter=line` (1 passed), and full `pnpm exec playwright test --reporter=line` (10 passed / 2 skipped).

## 2026-06-07 — Authenticated new-user onboarding slice

- Extended the onboarding runtime from the guest-only slice to authenticated users with no prior completion/dismissal record. Because the frontend user contract has no account-created timestamp, “new user” currently means “this opaque authenticated identity bucket has not seen the tour yet.”
- Added real-surface tour steps for the normal workflow: create a knowledge space, choose a source destination, upload/drop sources, create an Ask thread, choose answer knowledge, ask from the composer, and review answer evidence.
- Registered additional target wrappers around Knowledge creation, Add sources destination/upload, and the New conversation button; adjusted the non-modal prompt to desktop top-right after Playwright caught it intercepting the Send button.
- Added browser coverage for authenticated tour completion and localStorage privacy, alongside updated flow/localization unit coverage.

Verification passed for this slice: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run` (17 files / 98 tests), `pnpm build`, targeted `pnpm exec playwright test e2e/group-knowledge-v1.spec.ts e2e/new-user-onboarding.spec.ts --reporter=line` (4 passed), and full `pnpm exec playwright test --reporter=line` (11 passed / 2 skipped).

## 2026-06-07 — Onboarding accessibility and route-awareness hardening

- Kept the tour thin and dismissible while tightening accessibility details: the active overlay now has `aria-describedby`, traps Tab focus inside the modal-like card, restores focus on close, supports Escape dismissal, and respects reduced-motion preferences for target scrolling.
- Moved the non-modal prompt to the safe-area-aware top-right so it no longer covers the Ask composer/send action; the prompt is a semantic labelled section rather than a modal.
- Preserved route-aware behavior through the shared step hook: steps navigate to their real route, wait briefly for target registration, and fall back to a non-highlighted explanation when an optional target is missing.

Verification passed for this slice: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run` (17 files / 98 tests), `pnpm build`, and full `pnpm exec playwright test --reporter=line` (11 passed / 2 skipped).

## 2026-06-07 — Onboarding final quality gate

- Ran the cleanup/review pass for the guided onboarding plan and kept the slice product-specific: no generic onboarding framework, no backend changes, and no invented surfaces beyond the existing ServiceShell, Ask, Knowledge, and Documents UI.
- Addressed independent review findings by routing the guest Add sources step to the real upload dropzone, waiting for route/target readiness before showing the overlay, keeping mobile nav targets shrink-safe, making the modal background inert, throttling overlay measurement with `requestAnimationFrame`, and documenting the user-approved Zustand dependency.
- Final independent review artifacts are stored under `.omx/ultragoal/final-code-reviewer-rerun.md` and `.omx/ultragoal/final-architect-review-rerun2.md`.

Verification passed for the final gate: `git diff --check`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run` (17 files / 98 tests), `pnpm build`, and full `pnpm exec playwright test --reporter=line` (11 passed / 2 skipped).

## 2026-06-07 — Unified chat source selection cleanup

- Removed the deprecated frontend separate shared-source/private-source split from Ask. The composer now keeps every conversation private and sends only one `knowledge_base_selection` payload for personal, shared, and group knowledge spaces.
- Deleted stale chat source variables and UI copy such as include-group toggle, implicit group sources, separate private attachments, and group-mode placeholders.
- Updated the source selector copy so users see one authorized knowledge-source model instead of separate personal/group chat modes.

Verification for this entry is part of the current cleanup pass.

## 2026-06-07 — Live RAG Agent current-step display

- Reused the backend's redacted `agent_trace` payload during streamed conversation runs so the active assistant bubble can show the current RAG Agent step instead of only generic "AI is drafting" copy.
- Replaced the visible generic composing sentence with a motion-safe animated sparkle icon while preserving the composing status as an accessible `aria-label`.
- Added a compact localized current-step card from `agent_trace.title`, `agent_trace.description`, and safe status only; raw event payloads, prompts, snippets, and hidden reasoning remain hidden behind the existing redacted evidence boundary.
- Wired regeneration to `POST /conversations/{conversation_id}/messages/{message_id}/replay/stream`, and updated the Next BFF to pass that replay SSE response through as a `ReadableStream` instead of buffering it with `response.text()`.
- Made regeneration render in place at the refreshed assistant message and temporarily hide the later transcript suffix while preserving backend rollback safety; failed replay restores the old transcript and shows the safe error notice.
- Kept the collapsed evidence/work-history panel intact while making the in-flight state more specific for users, compacted noisy `answer_delta` rows into one `answer_streamed` work-history summary, and replaced raw backend IDs in answer context with user-facing knowledge/source/privacy summaries.
- Sorted conversations newest-first from the backend contract and optimistically placed newly created conversations at the top of the sidebar cache.
- Added a Group destination to Add sources: files/text are staged in a private knowledge space, then copied into the selected group knowledge space through publish approval; owners/admins auto-approve from the same flow.

Verification passed for this log entry: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run` (16 files / 93 tests), `pnpm build`, and targeted replay-stream/conversation-order contract tests passed during implementation.

## 2026-06-01 — User-facing AI workspace UI polish

- Reframed the protected shell around Ask, Add sources, Knowledge, and Groups; the sidebar session card now stays concise instead of listing internal proof bullets.
- Split the Ask workspace into focused chat UI components under `components/chat/`: conversation sidebar, transcript, message bubble, response evidence panel, knowledge-source selector, and composer bar.
- Kept citations attached to assistant answers as a compact count/label disclosure, with full source cards, answer history, and activity details opt-in; raw run/source IDs are only shown from advanced details.
- Reframed Documents/Knowledge as one journey: knowledge spaces contain sources, Add sources prepares files/text for Ask, and permission/processing internals are behind Advanced sections.
- Updated Korean/English product copy, README, architecture/onboarding/runbook notes, and the design contract to match the user-facing workspace direction.

Verification passed for this log entry: `pnpm lint`, `pnpm typecheck`, `pnpm test` (15 files / 80 tests), `pnpm build`, `pnpm exec playwright test --reporter=line` (9 passed / 2 skipped, including compact citation disclosure coverage), browser smoke of `/chat` unauthenticated gate and `/login` at `http://localhost:3000` with no horizontal overflow (`/login` zero browser console errors; `/chat` only the expected unauthenticated `/auth/me` 401), backend boundary check, and `git diff --check`.

## 2026-05-24 — Group Knowledge V1 frontend contract wiring

## 2026-05-25 — Group knowledge copy and chat source reframe

- Reframed service copy so Groups are shared knowledge-base spaces, Knowledge/Documents avoid visible abbreviations, and normal locale values no longer use implementation terms such as backend, OpenAPI, or shared-knowledge chat.
- Reworked the chat source selector into one private assistant conversation with a compact "Include group knowledge" checkbox; group knowledge is sent as explicit selected sources for the answer instead of exposing a separate chat mode.
- Updated copy regression tests and group-knowledge e2e wording to assert the new shared-knowledge mental model, including Korean 개인 지식 베이스 terminology.

Verification passed for this log entry: locale guard script found 0 banned visible terms in English/Korean values; `pnpm lint`, `pnpm typecheck`, `pnpm test` (14 files / 77 tests), `pnpm build`, `pnpm exec playwright test e2e/group-knowledge-v1.spec.ts --config=playwright.worker-1.config.ts` (temporary port 3100 config; 3 Chromium tests), and `git diff --check` passed.

- Superseded on 2026-06-07: the later cleanup removed the temporary split between shared-knowledge chat fixed sources and private attachments. Publish request controls remain, but chat now uses the single `knowledge_base_selection` contract.

## 2026-05-25 — Queue prompts when backend reports active run

- Treated backend `409 conversation run already active` as a queue handoff instead of a visible run failure. The draft is preserved as the conversation's queued next message when another run is already active.
- Added server-active run awareness to the chat composer: running/cancelling runs show the assistant composing placeholder, switch the primary action to queue-next behavior, poll only run status while active, refresh messages once the run clears, and send the queued prompt once for that cleared run.
- Added unit coverage for active-run status/error detection.

## 2026-05-25 — Accept metadata extraction stage

- Updated the frontend extraction-run schema to accept the backend's new `metadata` stage emitted while document metadata profiles are generated for retrieval.
- Added document API regression coverage so Zod parsing no longer fails during markdown/PDF/text ingestion polling.

## 2026-05-25 — drag-and-drop document upload queue

- Added a drop zone around the existing `/documents` file upload picker so users can drag PDF, Markdown, or plain-text files into the selected Personal KB workflow.
- Reused the existing multi-file queue, local validation, title derivation, async upload, ingestion polling, retry, and remove behavior; no backend route or API contract changed.
- Added localized English/Korean drop-zone copy and a disabled drop state when no writable Personal KB is selected.

Verification passed for this log entry: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run` (14 files / 75 tests), `pnpm build`, `pnpm exec playwright test --reporter=line` (5 passed / 2 skipped), and `git diff --check`.

## 2026-05-24 — Group Knowledge V1 frontend OpenAPI gate

- Repaired worker-4 group allocation through the supported OMX `create-task`, `write-worker-identity`, and `claim-task` APIs after original task-4 was pre-assigned to worker-1 and claim attempts returned `claim_conflict`.
- Per frontend repo rules and the Group Knowledge V1 test spec, checked the backend contract before API/client edits. Generated OpenAPI from `main.app.openapi()` in the backend with deterministic mode because no hosted OpenAPI evidence was available in the worker handoff.
- Confirmed the then-current backend OpenAPI was not ready for Group Knowledge V1; this note is historical and was superseded by the later unified source-selection contract.
- Logged the exact backend contract gap in `docs/backend-requests.md`; frontend model/client/hook/shared-knowledge request-body changes remain blocked until the backend OpenAPI exposes the required contract.

Verification for this log entry: read-only backend OpenAPI generation; `git -C /Users/heecheonpark/Git/my-agents status --short` returned clean before inspection. Frontend verification pending because this pass intentionally made documentation-only blocker notes and did not change runtime code.

## 2026-05-20 — document delete frontend wiring

- Wired backend commit `c3a6785` document deletion into the frontend-only surface: BFF allowlist accepts `DELETE /documents/{document_id}`, `MyAgentsDocumentAPI.remove()` sends the bodyless DELETE request, and `useDeleteDocument()` refreshes/removes document-related query state.
- Added a safe selected-document delete action to the Documents UI using the existing destructive button variant plus browser confirmation, then advances selection to another available document after deletion.
- Updated bilingual README and architecture endpoint coverage so future demo/readiness checks include document delete support for corrupted uploads.

Verification passed for this log entry: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run` (8 files / 35 tests), `pnpm build`, and `git diff --check`.

## 2026-05-20 — Strict V1 Phase 1 auth/session frontend gate

- Verified the frontend BFF/browser auth assumptions against backend Phase 1 auth/session evidence without adding backend fields or changing frontend API models.
- Added targeted Vitest regressions for backend-standard unverified-login and rate-limit `{ detail }` surfacing, public-demo origin acceptance, and `localhost`/`127.0.0.1` mismatch rejection.
- Added `docs/strict-v1-phase-1-auth-session-gate.md` as the frontend Phase 1 gate report, including backend-owned remaining risks and the next live V1 browser-smoke gate.

Verification passed for this log entry: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run` (7 files / 30 tests), `pnpm build`, `V1_DEMO_EMAIL=test@test.com V1_DEMO_PASSWORD=... pnpm exec playwright test e2e/v1-demo.spec.ts` (1 Chromium test), and `git diff --check`. Backend boundary check was read-only but not clean because the sibling backend repo had concurrent task edits in `my_agents/settings.py`, `tests/test_auth_api.py`, `tests/test_cors_api.py`, and `tests/test_settings.py`.

# Frontend Implementation Log


## 2026-05-20 — dependency/provider evaluation closure

- Added an explicit task-5 provider/dependency evaluation summary to the public demo release runbook.
- Recorded that no new frontend dependency is needed for the current public visitor proof; email/account verification remains backend-owned through provider-neutral SMTP or another backend-approved provider path.
- Preserved the no-secret, no-spend, no-destructive-production-action, and no-final-live-deploy gates.

Verification for this log entry: pending current worker-3 task-5 verification run.

## 2026-05-20 — backend v1 readiness frontend lane audit

- Audited frontend integration against the backend product endpoint family: auth, groups, documents, knowledge bases, ingest/extraction runs, conversations, conversation runs, streamed runs, and run events. Product code does not call legacy `/assistant/chat`; the BFF allowlist continues to block `/assistant/*`.
- Hardened streamed run negotiation by sending `Accept: text/event-stream` from the frontend service and using `text/event-stream` as the BFF fallback content type for successful stream pass-through responses.
- Made latest-run activity selection independent of backend list ordering by sorting run summaries by `created_at` descending before selecting the latest run.
- Added backend handoff requests for hosted OpenAPI/response shapes, cookie/CSRF semantics, SSE event framing, persisted citation/run ordering behavior, and deterministic seed/demo flow in `docs/backend-requests.md`.

Verification passed for this log entry: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run` (7 files / 24 tests), `pnpm build`, and `pnpm exec playwright test` (1 Chromium test).


This log keeps frontend work followable for future manual maintenance and future Codex sessions.

## 2026-05-20 — backend 24b3ff8 demo contract verification

- Pulled/read backend commit `24b3ff8` demo runbook updates: hostname-consistent localhost CORS, `MY_AGENTS_AUTH_DEV_OUTBOX_ENABLED=true`, `GET /auth/dev/outbox`, and completed run detail via `GET /conversations/{conversation_id}/runs/{run_id}`.
- Reconciled the new run-detail endpoint against hosted OpenAPI from `http://localhost:8000/openapi.json`, then added frontend BFF allowlist, API path/query key, service method, hook, and chat citation fallback to persisted completed run detail.
- Kept `/auth/dev/outbox` out of the frontend BFF product allowlist; it is used only by local smoke automation directly against the backend when explicitly enabled.
- Relaxed verified-user timestamp parsing to accept backend-local datetime strings as well as RFC3339 offset/Z datetime strings, matching the current hosted OpenAPI response observed during smoke.
- Confirmed the transient 415 on document ingest was from a custom smoke helper missing `Content-Type`; the product fetch client already sends JSON content type for no-body mutations, and test coverage now explicitly includes `/documents/{id}/ingest`.

Verification passed for this log entry: backend commit `24b3ff8` was running with deterministic mode, `MY_AGENTS_AUTH_DEV_OUTBOX_ENABLED=true`, and `MY_AGENTS_CORS_ALLOWED_ORIGINS=http://localhost:3000`; hosted OpenAPI confirmed `/auth/dev/outbox` and completed run detail; custom browser smoke passed signup -> dev outbox verification -> direct credentialed CORS login/me -> BFF login/me -> knowledge base/document/ingest -> conversation -> SSE run -> completed run detail -> run events -> `/chat` UI refresh-safe citation check; `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run` (7 files / 26 tests), `pnpm build`, and `pnpm exec playwright test` (1 Chromium test) passed.

## 2026-05-19 — hosted OpenAPI endpoint reconciliation

- Confirmed the backend dev server is running by fetching `http://127.0.0.1:8000/openapi.json` and `http://127.0.0.1:8000/health`; the hosted OpenAPI document reports `my-agents` version `0.1.0` with 31 operations across 25 paths.
- Reconciled frontend endpoint wiring from the hosted OpenAPI document only, without inspecting backend source code.
- Added auth lifecycle wiring for `POST /auth/verify-email`, `POST /auth/password-reset/request`, and `POST /auth/password-reset/confirm`, including Zod schemas, service methods, TanStack Query mutations, BFF allowlist entries, and unauthenticated CSRF-cookie exemptions while preserving same-origin JSON checks.
- Updated auth contracts for the current hosted schema: `UserResponse` now includes `email_verified_at`, and `SignupResponse` is `{ user, verification_email_sent }`.
- Added streamed conversation run wiring for `POST /conversations/{conversation_id}/runs/stream`, including path constants, a raw-response fetch path, BFF streaming pass-through, service method, and hook.
- Updated docs and tests so future agents use hosted OpenAPI as the frontend contract source of truth and do not silently fall back to backend source inspection.

Verification passed for this log entry: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run` (7 files / 23 tests), `pnpm exec playwright test` (1 Chromium test), `pnpm build`, `git diff --check`, and `git -C ../my-agents status --short` returned no output.

## 2026-05-19 — assistant delta streaming UI

- Verified the updated backend stream endpoint from the hosted dev server: `POST /conversations/{conversation_id}/runs/stream` now emits incremental `answer_delta` SSE events before the final `run_completed` event.
- Switched the chat composer flow to consume the streamed endpoint, append assistant deltas into a live assistant bubble, show live activity events while the run is in flight, then invalidate persisted messages/runs after `run_completed`.
- Added pinned-to-bottom chat scrolling: when the transcript is already near the bottom, streamed answer deltas keep it scrolled down; if the user scrolls up, the UI does not fight their position.
- Added a small SSE parser and stream-event parser coverage so chunked `answer_delta` and final `run_completed` events are protected by unit tests.

Verification passed for this log entry: hosted backend SSE probe confirmed `answer_delta` events before `run_completed`; `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run` (7 files / 24 tests), `pnpm build`, `pnpm exec playwright test`, and a browser smoke of signup/login/create conversation/send message confirmed visible `answer_delta`, `run_completed`, assistant text, pinned chat scroll distance `0`, and zero browser console errors.

## Current strategy

Use one visible quality queue delivered as staged vertical slices:

- [x] Foundation / project-local frontend spine
- [x] Auth + protected app shell
- [x] Polished chat vertical slice
- [x] Knowledge/document management
- [x] Groups/permissions
- [x] Quality, docs, and verification pass

## Active milestone

Planning complete. `$ralplan` produced approved Ralph-ready artifacts:

- `.omx/plans/prd-frontend-wiring.md`
- `.omx/plans/test-spec-frontend-wiring.md`

Implementation is in progress under `$ralph`. Completed implementation slices so far:

- Project-local constants/models/services/query provider.
- Next BFF route handler with explicit product endpoint allowlist, CSRF auxiliary cookie strategy, same-origin checks, and `/assistant/chat` exclusion.
- Auth pages and protected service shell.
- Chat surface for conversations, messages, runs, events, and citations.
- Knowledge/document/group/permission management surfaces.
- Unit tests for API paths/query keys and BFF proxy policy.

Remaining: completion audit and optional commit/push.

## Decisions

- Keep the frontend structure internally consistent and easy to maintain.
- Prefer stable top-level folders for this repo.
- Agent owns visual design, tone, and style.
- Chat is the anchor journey and should receive the highest first-pass polish.
- Backend may be inspected but not edited from frontend work without explicit user approval.
- Backend gaps belong in `docs/backend-requests.md` first.

## 2026-05-20 — strict V1 Phase 2 PDF upload frontend gate

- Reconciled backend commit `ef88553` by generating backend OpenAPI from `my_agents.api.create_app().openapi()` because the running local server still exposed the pre-Phase-2 OpenAPI.
- Added frontend support for the additive PDF contract: `POST /documents/upload`, multipart `FormData`, document source metadata, and citation filename/page provenance.
- Preserved the existing JSON text document create path and bodyless `/documents/{document_id}/ingest` path.
- Updated the BFF same-origin policy to allow `multipart/form-data` for authenticated upload mutations without allowing simple form posts.
- Added the PDF upload form to the Documents UI and kept the seeded text V1 flow available. Later refreshed the same form for the expanded PDF/Markdown/plain-text upload contract while keeping CSV/JSON unadvertised until backend structural support exists.

Verification passed for this log entry: `pnpm exec vitest run tests/api-path.test.ts tests/proxy-policy.test.ts tests/fetch-client.test.ts tests/document-api.test.ts tests/conversation-api.test.ts`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run` (8 files / 34 tests), `pnpm build`, `pnpm exec playwright test e2e/home.spec.ts`, and `git diff --check`. Final PDF browser upload smoke is deferred until the backend server is restarted on commit `ef88553` or later.


## 2026-05-20 — public demo release runbook

- Added a preview/production release runbook with provider/dependency decision records, deployment topology and auth/session matrices, no-secret/no-spend gates, visitor privacy copy, cleanup guidance, and an evidence bundle template.
- Linked the runbook from verification, security boundary, and bilingual README handoff docs.
- Logged the backend contract gap for a hosted public visitor email/provider verification path so final e2e proof does not fall back to seeded credentials or the dev outbox.

Verification for this log entry: docs-only change; `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run`, `pnpm build`, backend boundary check, and `git diff --check` were run after the edit.


## 2026-05-20 — worker-3 verification/evidence coverage probe

- Reviewed the production orchestration test spec against backend `/Users/heecheonpark/Git/my-agents` and frontend `/Users/heecheonpark/Git/my-agents-frontend` test surfaces.
- Confirmed backend coverage commands and smoke helper: `uv run pytest -q`, `uv run ruff check . --no-cache`, `uv run ruff format --check .`, and `uv run python -m scripts.local_demo_smoke --base-url http://localhost:8000 --timeout 120`.
- Confirmed frontend coverage commands and smoke specs: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run`, `pnpm build`, `e2e/home.spec.ts`, and `e2e/v1-demo.spec.ts`.
- Added release-runbook checklist items for public visitor proof gaps: provider activation evidence, hosted Playwright topology, text-document vs PDF branch declaration, `/assistant/chat` exclusion evidence, and event/log redaction proof.

Verification for this log entry: docs-only update; `git diff --check -- docs/public-demo-release-runbook.md docs/verification-runbook.md docs/implementation-log.md` passed.

## Verification log

- 2026-05-17 — `$ralplan` consensus completed. Architect initially requested a concrete BFF/CSRF strategy; Critic requested auth/security alternatives, allowlist, negative tests, pre-mortem, expanded test plan, and exact backend-request logging. Artifacts were revised and final Critic verdict was APPROVE.
- `pnpm exec tsc --noEmit` — passed after initial implementation.
- `pnpm exec vitest run` — passed: 2 files / 11 tests.
- `pnpm lint` — passed after formatting and import organization.
- Browser smoke with backend deterministic mode — passed: signup redirected to `/chat`, browser storage contained no session/CSRF secrets, conversation creation worked, `/conversations/{id}/runs` produced user/assistant transcript, run history, and event timeline with zero browser console errors after the flow.
- Logout blocker fix smoke — passed functionally: logout sends JSON content type for no-body mutation, redirects to `/login`, and clears session; browser then sees expected unauthenticated `/auth/me` 401 during login-page state checks.
- Reviewer blocker fixes — applied: no-body POST mutations now send JSON content type, login response redacts `csrf_token`, and tests cover browser-safe auth schema plus no-body mutation headers.
- Final chained gate after blocker fixes — passed: `pnpm lint && pnpm exec tsc --noEmit && pnpm exec vitest run && pnpm build` (4 test files / 13 tests).
- Code review — first pass rejected no-body POST content-type and CSRF response leak; fixes applied; final code-review verdict APPROVE with no blockers.
- Deslop/cleanup pass on changed files — completed via Biome formatting/import organization and local simplification review; post-cleanup regression gate passed: `pnpm lint && pnpm exec tsc --noEmit && pnpm exec vitest run && pnpm build`.
- Backend boundary check — passed after removing browser-tool scratch directory: `git -C ../my-agents status --short` returned clean.
- Final backend boundary re-check — passed: `git -C ../my-agents status --short` returned clean.

## Open risks

- Browser verification still depends on running the backend locally.
- Some admin UX remains ID-based because the backend does not expose user search/member listing. This is documented honestly in UI copy; no backend request is required unless richer UX becomes a goal.
- Equal polish across all domains is intentionally deferred in favor of understandable staged quality, with chat as the visual anchor.

## 2026-05-18 — chat inspector layout widening

- Replaced the narrow third-column chat inspector with a two-column desktop shell: conversation list on the left and a wider main workspace on the right.
- Moved run history, activity events, and citations into a full-width inspector band beneath the chat transcript. Activity events now receive the widest share on large screens, with run history and citations alongside it on 2xl screens and stacked/mobile-safe layouts below that.
- Kept the responsive-design workflow constraints: mobile-first stacking, `min-w-0` containment, scrollable cards in fixed-height desktop shells, and no horizontal overflow.

Verification passed for this log entry: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run`, `pnpm build`, `pnpm exec playwright test`, browser auth/chat smoke at 1440px confirmed inspector widths of run history 368px, activity events 752px, citations 368px, and viewport overflow checks passed at 390px, 768px, and 1280px.

## 2026-05-18 — signup contract alignment

- Corrected the frontend auth contract for `POST /auth/signup`: the backend returns a bare safe user payload (`{ id, email }`), not a temporary envelope.
- Updated signup UI to show an account-created handoff and stop the previous immediate login attempt, matching the backend signup/login flow.
- Added contract regression coverage for signup schema parsing and `MyAgentsAuthAPI.signup`.
- Updated bilingual README copy, architecture notes, and the verification runbook so future smoke tests do not expect email verification or auto-login after signup.

Verification passed for this log entry: backend OpenAPI from `http://localhost:8000/openapi.json` confirms `POST /auth/signup` responds with `UserResponse`, `POST /auth/login` responds with `LoginResponse`, `GET /auth/me` responds with `UserResponse`, and `POST /auth/logout` returns 204; `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run`, `pnpm build`, `pnpm exec playwright test`, and a live backend/browser auth smoke against `../my-agents` deterministic mode confirmed `/auth/signup` returns `{ id, email }`, `/auth/login` returns browser-safe `{ user }` without `csrf_token`, and login redirects to `/chat`.

## 2026-05-17 — README language split and localization workflow

- Converted the primary `README.md` to Korean and added `README.en.md` as the English counterpart; both files link to each other.
- Added a project-local localization surface with `i18n.config.ts`, `localization/ko.json`, `localization/en.json`, `utils/localization.ts`, `providers/localization.tsx`, and `hooks/useLocalization.ts`.
- Moved user-facing app copy from landing, auth, service shell, chat, admin surfaces, status fallback, BFF errors, and fetch fallback into localization dictionaries.
- Added `tests/localization.test.ts` to keep Korean and English dictionary shapes aligned.

Verification passed in this log entry: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run`, `pnpm build`, and `pnpm exec playwright test`.


## 2026-05-17 — DESIGN.md workflow activation

- Confirmed `DESIGN.md` existed but was not referenced by code or docs as an active workflow contract.
- Refreshed `DESIGN.md` with source-of-truth metadata, product-specific design workflow guidance, implementation constraints, and open questions while preserving the existing theme token analysis.
- Added `DESIGN.md` to onboarding, architecture, README, and AGENTS guidance so future UI/theme/layout changes read it before implementation.

Verification passed in this log entry: `pnpm lint`, `pnpm exec tsc --noEmit`, and `git diff --check`.

## 2026-05-17 — DESIGN.md visual theme applied

- Re-applied the active `DESIGN.md` contract after it changed to the Cal.com-inspired direction: white canvas, black primary CTAs, light-gray product cards, 8px button/input radii, 12px card radii, and scarce accent color.
- Updated app-level tokens in `app/globals.css` to expose Cal-style color, semantic, badge, surface, radius, and helper classes (`cal-card`, `cal-product-card`, `cal-heading`, `cal-label`, `cal-subcopy`).
- Updated landing, auth, service shell, chat, document, knowledge, group, field, status, and button surfaces to remove the previous atmospheric pastel theme and use product-UI fragments, monochrome CTAs, light cards, and tighter SaaS geometry instead.
- Used the existing Geist sans face as the Cal Sans substitute per `DESIGN.md` fallback guidance: display copy is weight 600 with negative tracking; body/UI copy stays sans.
- Kept UI copy on the existing localization path; this pass changed styling/layout only and did not introduce new user-facing hardcoded copy.

Verification passed in this log entry: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run`, `pnpm build`, `pnpm exec playwright test`, plus browser screenshots of `/` and `/login` reviewed against the `DESIGN.md` Cal-style direction.

## 2026-05-17 — responsive-design workflow applied

- Applied the repo-local `responsive-design` skill as a first-class UI workflow rule in `AGENTS.md`, `DESIGN.md`, README, onboarding, architecture, and the verification runbook.
- Added shared responsive CSS primitives in `app/globals.css`: fluid type/spacing tokens, reusable responsive containers/sections/card grids, horizontal-scroll protection, and a container-query-backed `responsive-panel-grid` for form/action layouts.
- Updated landing and auth surfaces to use fluid display/subtitle sizing, mobile-first spacing, wrapped CTA clusters, responsive card grids, and comfortable touch-target minimums.
- Updated the protected service shell with a mobile horizontal primary nav so service routes remain reachable below the desktop sidebar breakpoint.
- Updated chat and admin surfaces to reduce narrow-width overflow risk: mobile-first stacked chat panes, wrapped composer/actions, wider mobile message bubbles, break-word IDs/content, and container-query-driven admin form/action splits.

Verification passed in this log entry: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run`, `pnpm build`, `pnpm exec playwright test`, and a Playwright viewport overflow check for `/` and `/login` at 390px, 768px, and 1280px (all `scrollWidth === innerWidth`).

## 2026-05-20 — Public visitor smoke e2e readiness

- Added an opt-in `V1_PUBLIC_VISITOR_SMOKE=1` Playwright path in `e2e/v1-demo.spec.ts` that creates a unique account from `V1_PUBLIC_VISITOR_EMAIL_TEMPLATE`, supports provider activation through `V1_PUBLIC_VISITOR_VERIFICATION_COMMAND`, and fails explicitly when required final-proof provider variables are missing.
- Kept the seeded V1 smoke as a separate describe block so missing seeded credentials no longer skip the public visitor final-proof path.
- Added browser storage assertions that reject session, CSRF, provider token, password, API-key, and OpenAI-style key material in `localStorage`/`sessionStorage`.
- Documented preview/public smoke usage and the no-dev-outbox/no-secret command boundary in `docs/verification-runbook.md`.
- Verification passed in this worker pass: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run`, `pnpm build`, and `pnpm exec playwright test` (public visitor final-proof path intentionally skipped unless `V1_PUBLIC_VISITOR_SMOKE=1` provider env is supplied). Hosted smoke remains user/provider-gated and must not run before preview configuration and final confirmation.

## 2026-05-21 — assistant markdown rendering boundary

- Added an assistant-only rendering boundary for chat output so General Assistant replies can render safe Markdown such as Korean checklist headings, `**bold**`, and bullet lists while user messages remain literal plain text.
- Added `react-markdown` as the Markdown leaf renderer without raw HTML plugins, `dangerouslySetInnerHTML`, or executable chart/diagram specs.
- Added a future artifact boundary type for chart, graph, diagram, table, and tool-result cards; current behavior renders only inert placeholders when artifacts are provided.
- Wired persisted assistant messages and streaming assistant replies through the same renderer boundary.

Verification passed for this log entry: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run tests/agent-markdown.test.ts tests/conversation-api.test.ts`, `pnpm build`, and `git diff --check`.

## 2026-05-22 — design-guided UI refactor integration

- Introduced product-specific `km-*` theme tokens while preserving existing `cal-*` compatibility aliases for low-risk incremental adoption.
- Updated button, field, empty/error, and pill primitives to use the warmer evidence-console palette, clearer focus states, and semantic status tones.
- Replaced the landing-page calendar motif with transcript, activity, citation, and document-source artifacts in localized English/Korean copy.
- Tightened the service shell session evidence, made chat transcript/composer the dominant workspace, and moved run history, activity events, and citations into compact disclosure cards.
- Integrated the admin document clarity pass below as the admin-surface slice of the same design rollout.

Verification passed for this log entry: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run`, `pnpm build`, `git diff --cached --check`, and production-server responsive smoke for `/` at 390px/768px/1280px plus `/login` at 390px.

## 2026-05-22 — admin document workflow clarity pass

- Tightened the `/documents` admin surface so the selected document panel shows the active document title, source metadata, and explicit wrapped document ID before ID-based ingest, permission, and delete actions.
- Grouped upload queue status counts with the same semantic pill tones used by row-level states, and exposed document/run IDs on queued rows once backend operations return them.
- Aligned extraction-run rows with the same status/progress treatment and explicit run IDs, while preserving backend-owned upload limits and existing ID-only permission/member contracts.
- Re-checked `AdminSurfaces.handleFileSelection` and found only one `event.currentTarget.value = ""` reset, so no duplicate reset was removed.

Verification passed for this log entry: `pnpm install --frozen-lockfile`, `pnpm exec biome check --write components/AdminSurfaces.tsx`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm exec vitest run tests/document-api.test.ts tests/api-path.test.ts tests/proxy-policy.test.ts`, `pnpm exec vitest run`, `pnpm build`, and `git diff --check`. Browser smoke reached `/documents` at 390px through the auth gate; unauthenticated local backend returned the expected `401 /api/my-agents/auth/me`, so authenticated responsive screenshots remain deferred to an environment with a valid session/backend.

## 2026-05-22 — multi-file async upload queue

- Replaced the single-file document upload interaction with an in-card queue that accepts multiple PDF, Markdown, and plain-text files, keeps per-file editable titles before processing, and shows selected/uploading/queued/ingesting/completed/failed states with progress bars.
- Added frontend client, BFF allowlist, query key, and schema support for `POST /documents/{document_id}/ingest/async` plus `GET /documents/{document_id}/extraction-runs/{run_id}` while preserving the existing synchronous ingest action.
- Kept guest upload limits backend-owned in UI copy: each accepted file can count toward the 3-document guest cap, and backend errors remain per-file retry/remove states.

Verification passed for this log entry: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run`, `pnpm build` (retried outside sandbox after a Turbopack internal worker bind permission error), and `git diff --check`.

## 2026-05-22 — KB-first document and chat source path

- Replaced the primary document create/upload/ingest UI path with a knowledge-base-first flow: users select a knowledge base before adding text documents, queued PDF/Markdown/plain-text uploads, or running ingestion.
- Added KB-nested frontend API paths, BFF allowlist entries, service methods, query keys, and TanStack hooks for `GET/POST /knowledge-bases/{knowledge_base_id}/documents`, nested upload, nested ingest/async ingest, and nested extraction-run polling.
- Extended conversation run request/response parsing for `knowledge_base_selection` and `resolved_knowledge_base_count`, then added an `All knowledge bases` / `Selected only` chat source selector that sends the selected KB IDs as a hard retrieval boundary.
- Kept legacy document detail/delete/permission methods available for compatibility while making KB-nested create/upload/ingest the product path.
- Updated bilingual copy, README/architecture/runbook notes, and tests so future work sees the knowledge base as the user-facing source library abstraction.

Verification passed for this log entry: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run tests/api-path.test.ts tests/document-api.test.ts tests/proxy-policy.test.ts tests/conversation-api.test.ts` (30 tests), `pnpm exec vitest run` (9 files / 50 tests), `pnpm build`, and `pnpm exec playwright test` (1 passed / 2 skipped by configured smoke gates).

### G005 review follow-up

- Resolved the final architect WATCH items before completion: visible upload copy now describes uploads into the selected knowledge base instead of `/documents/upload`; public-demo/evidence docs now point to KB-nested upload/ingest proof; the document upload queue locks KB switching while processable items are queued; and `/documents` now uses a KB-scoped delete hook for KB document cache invalidation.

## 2026-05-24 — Group Knowledge V1 source-boundary UX preview

- Added a shared-knowledge chat preview mode in `components/ChatWorkspace.tsx` that distinguishes personal conversations from shared-source conversations, labels transcripts as private, shows implicit group KBs as fixed sources, and presents separate private KB attachments without sending them.
- Kept backend-first constraints: no API model/client changes were made, and shared-knowledge create/send is disabled until a hosted backend OpenAPI proves the V1 source contract.
- Added disabled publish request and owner/admin review controls in `components/AdminSurfaces.tsx` so the intended workflow is visible without inventing backend routes.
- Recorded the missing backend OpenAPI contract in `docs/backend-requests.md`.

## 2026-05-24 — group KB creation and publish-only group document boundary

- Added scoped KB creation in the Knowledge surface: users can create private Personal KBs or extra Group KBs only for groups where they are owner/admin. The backend already creates a default Group KB when a group is created, so extra Group KB creation is an admin expansion path rather than a prerequisite.
- Tightened the Documents surface to list only the current user's own Personal KBs for direct text/file create and ingestion. Group KBs and other members' approved published Personal KBs are intentionally excluded from direct upload/create UI because personal material should enter group retrieval through publish requests and owner/admin approval.
- Extended publish request UI to support both whole-Personal-KB publication and one-document copy publication. Whole Personal KB approval makes that KB a fixed group source; document approval still copies one document into a selected Group KB.
- Updated shared-knowledge chat source display so approved member Personal KBs appear alongside Group KBs as implicit group sources, while separate private attachments remain limited to the current user's unpublished Personal KBs.
- Kept the Group creation form compact by placing the group name field and submit action inline on desktop, and fixed Knowledge creation selector alignment with equal-width scope/group controls plus shorter group option labels.
- Updated bilingual copy and focused tests to make the boundary explicit: Personal KBs stay private and may be attached privately in shared-knowledge chat; publishing into Group KB retrieval is an approval workflow, not direct document wiring.

Verification passed for this log entry: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm exec playwright test e2e/group-knowledge-v1.spec.ts` including desktop layout assertions for compact Group creation and aligned Knowledge selectors.

## 2026-05-26 — email-based guest access request flow

- Split the frontend guest flow into email request and code redemption steps. The auth panel now sends `{ email }` to `POST /auth/guest/request`, shows a generic accepted/check-email message, and leaves `POST /auth/guest/login` as the only code redemption path.
- Updated guest auth schemas, client methods, TanStack mutations, bilingual copy, and public-demo docs to stop expecting a returned guest code from the request endpoint.
- Added focused API/model coverage plus an auth-page browser check that verifies the email request body, generic accepted message, and absence of automatic guest-code redemption.

Verification passed for this log entry: `pnpm lint`, `pnpm exec vitest run tests/auth-model.test.ts tests/auth-api.test.ts`, `pnpm exec vitest run`, `pnpm exec playwright test e2e/auth-panel.spec.ts`, `pnpm exec tsc --noEmit`, `pnpm build`, and `git diff --check`.

## 2026-06-07 — Hidden group-upload staging integration

- Switched group document upload/create from a user-selected personal staging KB to the backend-owned `POST /knowledge-bases/team-upload-staging` contract.
- The UI no longer asks users to pick a private staging space for group uploads; it explains that sources are privately staged outside Ask retrieval and become retrievable only after approval copies them into the target group KB.
- Added frontend API path, proxy allowlist, schema support for `knowledgeBase.purpose`, and `ensureTeamUploadStaging()` client method.
- Document KB helpers exclude non-standard/staging KBs from visible writable/group selectors so hidden staging does not appear in normal Knowledge UI lists.
- Group uploads now show the target group KB document list after auto-approval, while staged private source IDs remain backend-only plumbing.

Verification pending for this change: frontend lint/typecheck/unit/build after backend staging contract lands.


## 2026-06-14 — no-account group invitation signup

- Updated the signed-out invitation flow so `/group-invitations/accept?token=...` routes no-account recipients to `/signup?invite_token=...` instead of trying authenticated token acceptance.
- Added frontend schema/service/hook/BFF support for `POST /group-invitations/signup`, which submits token + nickname + password only and treats the response as a session-creating login envelope with browser-visible `csrf_token` redacted.
- Adjusted auth copy so invitees understand the link proves email identity, nickname is display-only, and future login uses invited email + password rather than nickname.
- Added Playwright coverage for redirecting signed-out invitees, hiding the email field, suppressing guest access on invite signup, and posting the trimmed nickname/password payload.

Verification passed for this log entry: `pnpm exec vitest run tests/api-path.test.ts tests/group-api.test.ts tests/proxy-policy.test.ts` and `pnpm exec playwright test e2e/auth-panel.spec.ts`. Browser plugin was listed but the in-app `iab` browser was unavailable, so rendered verification used the repo Playwright workflow.

## 2026-06-14 — route-addressable Group management pages

- Replaced the full-list Group management drawer with dedicated section routes under `/groups/[groupId]/[section]` for members, invitations, source spaces, and publish requests.
- Kept the Group overview as a capped preview surface and moved growing lists into shareable pages with filters/search preserved.
- Preserved the per-item publish-review drawer because document preview/review remains a focused item-level flow rather than a list-management surface.

Verification passed for this log entry: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run tests/localization.test.ts`, and `pnpm exec playwright test e2e/group-knowledge-v1.spec.ts`.

## 2026-06-14 — System project knowledge frontend lane

- Added frontend parsing for `can_manage_system_knowledge` and optional read-only `user_type`, keeping role mutation out of request schemas and gating system source management only on the capability field.
- Extended source-space schemas and creation helpers for `scope: "system"`, with manager-only payload construction and source-tree visibility.
- Added a privileged System project source section in the Documents/Sources surface. Normal users and guests do not see system source spaces; managers see public-content warnings before adding text/files.
- Updated Ask source-selector copy and filtering so system project knowledge is described as ambient/automatic and is not presented as a user-toggleable personal/group source.
- Recorded backend contract assumptions in `docs/backend-requests.md` pending authoritative hosted OpenAPI/runtime confirmation.

Verification pending for this log entry: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run`, `pnpm build`, and browser/UI smoke after the current edit set is complete.

## 2026-08-09 — UI/UX renewal

Full design pass across the frontend. API wiring, query hooks, services, and the
BFF proxy were not touched.

Sequence, one commit each:

1. **Test contracts.** Replaced literal class-name and exact-sentence assertions
   with intent assertions, landed green against unchanged source so the
   generalization was provable rather than retrofitted. Added
   `e2e/helpers/layout.ts` and a visual-evidence harness with a horizontal
   overflow gate at 390px, which nothing checked before.
2. **ErrorState.** Stopped rendering `error.message`; status-driven localized
   copy via `utils/error-message.ts`. Backend `detail` deliberately dropped
   (English prose in a Korean UI) — see `docs/backend-requests.md`.
3. **Tokens + typography.** Elevation, motion, and semantic radius scales. Full
   `km-*` dark palette. Pretendard self-hosted as 92 unicode-range subsets,
   `word-break: keep-all`, negative tracking removed.
4. **Dark mode.** Cookie-read preference, pre-paint script for `system`, no
   `next-themes`. A contrast audit caught 20 components hardcoding `bg-white`
   (body text at 1.11:1 against an AA floor of 4.5).
5. **Theme toggler.** Animate UI's effect primitive adapted; its button wrapper
   needs `next-themes`, the effect does not. Fixed upstream persisting after
   the animation (lost on reload mid-transition) and added a reduced-motion path.
6. **Korean copy.** ~200 strings rewritten; `docs/korean-copy-guide.md` written
   as the durable policy. Terminology invariants enforced in
   `tests/knowledge-copy.test.ts`.
7. **Chat layout.** Shell owns scrolling (`h-dvh` + per-route fill/scroll);
   removed `calc(100dvh-8rem)`, which was arithmetically wrong at mobile widths.
   Conversation list moves into a Sheet below `xl`.
8. **Composer.** Autosizing textarea, Enter/Shift+Enter with an IME guard,
   safe-area padding.
9. **Evidence panel.** Localized event types with a graceful fallback; fixed
   `<fieldset>` misuse.
10. **Knowledge.** Raw UUIDs out of the reading path, real search replacing a
    decorative chip, responsive table.
11. **Groups.** Formatted timestamps, de-duplicated drawer actions, action
    hierarchy on review rows, "N more" is now a link.
12. **Shell/auth.** Password reset made reachable (route, service, and hook all
    existed; no UI called them). Skeleton auth-restore. Duplicate logout removed.

Verification: `pnpm lint`, `tsc --noEmit`, 165 vitest, 70 Playwright (2 skipped,
env-gated), `pnpm build`. Visual evidence captured at 390/768/1280 in both
themes.

Known follow-ups: 76 unreferenced localization leaf keys need a per-key check
before deletion (some may be reached by dynamic index); three backend contract
requests are open with codex.

## 2026-08-12 — chat shell restructure and the onboarding dismiss bug

One bug and three UX corrections that turned out to be one change.

### The bug: `나중에` did not dismiss the tour

Reported as "the dismiss button doesn't work". It only failed for **guest**
sessions, and the cause was not a missing write — `dismissDecision` did write
sessionStorage. It was reactivity:

- Authenticated dismissals go through `markDismissed`, which mutates
  `authDecisions`, which `OnboardingRuntime` subscribes to. The gate
  re-evaluates. Fine.
- Guest dismissals wrote sessionStorage only, and the gate read that value once
  inside a `useMemo` keyed on `[user]` — a structurally-shared React Query
  object that does not change on dismiss. So `shouldPrompt` stayed `true`
  forever: `skip()` set `status: "idle"`, the gate recomputed to `true`, and the
  effect re-opened the card within a frame.

Fixed by mirroring guest decisions into runtime store state (`guestDecisions`,
seeded from sessionStorage in `onRehydrateStorage`, excluded from `partialize`)
so both identities flow through one reactive lookup. This also removed an impure
storage read during render, which was a live hydration-mismatch hazard.

Guest `완료` had the identical latent defect, masked because the existing e2e
only asserted the step heading disappeared, not the card.

**Verified by reverting.** `e2e/guest-onboarding.spec.ts` now clicks the real
`나중에`; against the pre-fix source it fails with the card still present
(`toHaveCount` expected 0, received 1). The other guest specs seeded
sessionStorage in `addInitScript`, which is precisely what hid this — seeding
makes the one-shot read return a decision on first render.

### The three UX fixes were one change

1. **Dead composer on first run.** The input rendered `disabled` until a
   conversation existed, with no CTA. Now the composer is always live and
   sending the first message creates the conversation
   (`ensureConversationId`), so bare `/chat` is the new-chat state and `새 대화`
   is a link rather than a POST — an accidental click can no longer leave an
   empty conversation behind.
2. **Source selector ate the transcript.** An always-expanded `<details>` in the
   panel header with zero responsive classes: the same ~100px at 390px as at
   1920px. Now a compact trigger in the composer (`KnowledgeScopePicker`)
   opening a Dialog on desktop and a Drawer on mobile, labelled with the current
   summary so scope stays readable without opening it.
3. **Two competing left rails.** The conversation list moved from a route-local
   grid column into the shell sidebar (`ConversationHistorySidebarGroup`),
   deleting `ConversationSidebar`, `ConversationBrowserSheet`, and the duplicate
   mobile panel-left trigger.

They interlock: the history can only leave the route if selection is
URL-addressable, so `app/(service)/chat/[conversationId]` came first, mirroring
`/knowledge/[sourceId]`.

### Decisions worth keeping

- **Query cache over context.** The history takes no props; it reads the same
  `conversations.list()` key. A context would have to wrap `ServiceShell`,
  leaking chat state onto every service route and re-rendering the streaming
  subtree. Recorded in DESIGN.md along with the one exception,
  `chat-activity-store` (`busyConversationId` only).
- **`hidden`, not `opacity-0`,** on the history group.
  `e2e/sidebar-persistence.spec.ts` filters by `offsetParent !== null`, which
  only goes null under `display: none`. That spec passed **unedited**, which was
  the acceptance test for the whole sidebar move.
- **Onboarding path matching was a blocker.** `useOnboardingRouteStep` compared
  routes with exact equality, so on `/chat/<id>` a step would navigate away from
  the open conversation or cancel the tour. `matchesStepPath` fixes that, and
  the same latent bug on `/knowledge/[sourceId]`.
- **The blocker copy stays outside the overlay.** With the picker collapsed,
  `knowledgeSourceRequired` would have been hidden behind a closed dialog while
  Send sat greyed out with no stated reason.

### A test that was not testing anything

The first double-submit e2e passed with the guard removed: `setDraft("")` runs
synchronously and React re-renders before a second keypress, so the second
submit early-returns on the empty draft. Rewritten to call `requestSubmit()`
twice in one tick, which keeps the original closure — the actual race
`creatingConversationRef` exists for. It now fails with 2 creates when the guard
is removed, and passes with 1.

### Verification

`pnpm lint`, `tsc --noEmit`, 202 vitest, 92 Playwright (2 skipped, env-gated),
`pnpm build`. Visual evidence re-captured at 390/768/1280 — note the visual spec
now deep-links `/chat/c-visual`, since bare `/chat` would otherwise photograph
an empty greeting.

Test churn: `chat-citations` and `group-knowledge-v1` deep-link; the latter also
drives the new picker. `onboarding-route-step` and `onboarding-store` gained
cases. `chatworkspace-footer`, `component-public-exports`, and
`sidebar-persistence` passed unedited by design — `getConversationCardClassName`
was extracted to a pure module in a no-op first commit specifically so deleting
`ConversationSidebar` would not touch them.

Known follow-ups: guest onboarding decisions still live in sessionStorage, so a
dismissal does not survive a new tab — promoting them to localStorage is a
privacy call, not a bug fix. `e2e/v1-demo.spec.ts` is env-gated and was updated
blind for the `newButton` link change.

## 2026-08-17 — Durable document-source choice

A run can now suspend mid-answer to ask which document was meant, and resume
when told. Backend contract from the hosted OpenAPI of
`my-agents@feature/langgraph-checkpointer`; both backend flags default off, so
this is invisible in production until the checkpointer is enabled.

### The shape of the problem

A suspended run is neither in flight nor finished, and the existing code had no
third option. `isActiveAgentRunStatus` knew only `running` and `cancelling`, so
a run moving to `waiting_for_input` looked exactly like completion: the composer
went idle while the backend refused every send with the same
`conversation_run_already_active` 409 it uses for a busy conversation, and the
queue drained one message into that refusal before its own guard stopped it.

Three decisions had been one boolean. They are now derived from one phase in
`components/chat/run-state.ts`: `blocksNewRun` (a suspended run holds the
conversation), `showsStopControl` (it produces nothing, so no stop button), and
`canDrainQueue` (the queue pauses rather than drains). The module stores nothing
— the phase is derived per render from streaming, the pending interaction, and
the server run list.

### Things that were wrong on the first pass

**A thin SSE payload that does not exist.** The OpenAPI component
`RunInterruptedEventPayload` describes the *persisted activity event*. The live
stream sends `ConversationRunInterruptedResponse.model_dump()` — the full body,
nested interaction and first options page included. Having read the component
schema first, the known interaction parser was loosened (`reason_code` and
`message_key` made optional) to fit a payload that is never sent. Reverted; both
contracts now have their own schema.

**A version-permissive union.** `schema_version: z.number().int()` on the known
branch let a v2 `document_selection` match as v1, since that branch is tried
first — so a future payload would have rendered in the v1 card and been answered
over the v1 resume contract, silently bypassing the unsupported fallback. Now
`z.literal` on all three known schemas. The type guard needed the same fix twice
over: `type` alone passes for a v2 body, and Zod strips unknown keys, so a body
that fell through to the unsupported branch keeps its type while losing
everything the card renders. `isDocumentSelection` checks type, version, and a
structural field, and the submit handler uses that same guard.

**An optimistic cancel that could strand the run.** Clearing the card before the
cancel succeeded would leave the backend run blocked with nothing on screen: the
recovery effect keys on the waiting run id and its detail, neither of which
changes when the request fails. Cancel now disables the card, clears on success,
and shows localized copy on failure.

**Expiry that was only text.** The countdown changed wording but left Choose
live past `expires_at`, where the server answers `run_interaction_expired`. The
card now disables Choose and pagination locally and keeps Cancel enabled.

**A registry that resolved `"constructor"`.** `registry[type] ?? fallback`
returns an inherited function for `"constructor"` and `"toString"`, and the type
string is backend-controlled. `Object.hasOwn` now.

### Verification

`pnpm lint`, `tsc --noEmit`, 237 vitest, 106 Playwright (2 skipped, env-gated),
`pnpm build`.

Guards were checked by reverting the fix, not by watching them pass. The three
BFF tests fail without the allowlist and `isStreamPath` entries. Of the eight
cases in `e2e/durable-source-choice.spec.ts` — seven interaction-dependent, one
flags-off parity — disabling the cold-load recovery effect fails six. The two
survivors are informative rather than weak: the parity case must keep passing,
and the queue-paused case reads the waiting run from the run list rather than
from the rebuilt card, so it is guarding the drain rule, not the recovery.

Contract evidence, and its limit. The two contract risks are now closed from
both ends. Backend commit `my-agents@328d5ca` extends
`test_checkpointed_document_selection_interrupts_and_resumes_same_run` to call
the options route with the colon percent-encoded as `%3A`, asserting 200 and
`schema_version: 1`; the same test submits the exact v1 resume body and
completes the run. `tests/proxy-policy.test.ts` pins the string the BFF emits,
and it is the same string the backend test accepts — so the encoding the proxy
produces is the encoding the service resolves.

Live smoke, 2026-08-17. Driven in a browser against persistence-enabled
Postgres — backend in deterministic mode, `MY_AGENTS_CHECKPOINTER_ENABLED=true`,
HITL wait shortened to 300s. Signup and login through the Next BFF, a selected
knowledge base with two ingested documents, then an ambiguous prompt: the real
interaction card appeared, a hard reload rebuilt it from run detail, choosing
Alpha sent the typed resume through the BFF and completed the *same* run with
one citation rendered, and a second waiting run cancelled cleanly and released
the composer.

That closes the joined browser → BFF → backend path for run creation, run
detail, resume, and cancel — including cold-load recovery, which was previously
only proven against mocks.

One route inside that path was still not exercised, and it is worth naming
rather than filing under "smoke passed": the options endpoint is the only one
carrying the percent-encoded `interaction_id` in its path, and with two options
delivered inline and `next_cursor: null`, neither the seed fetch nor `loadMore`
fires. So the encoded segment remains verified at each end separately — backend
`328d5ca` and `tests/proxy-policy.test.ts` — rather than in one live request.
Reaching it needs an interaction with more options than fit a page, which is the
same gap as the paged-options case below.

Still unexercised: a second interrupt within one run, a second page of options
(and with it the live encoded path above), and guest-specific behaviour.

### Ambient system sources stay out of the choice

Backend `b8ceb91` and `2172757` settle what a clarification may offer. Default
chat continues to search all personal and group knowledge bases; an ambiguous
document reference enters retrieval in that default mode rather than forcing a
narrower scope; and the count that decides whether to ask at all includes only
user-selectable personal and group documents. System knowledge is ambient: it
never appears as an option, and a single selectable document resolves
automatically even when ambient system documents are in scope. Resume rejects a
forged `document_id`.

No frontend change was needed, and that was checked rather than assumed. Nothing
under `components/chat/interactions/` reads a local document or knowledge-base
list — every option is rendered from the response — so there is no client path
that could reintroduce a system source. `ChatWorkspace.tsx:242` also already
limits the scope picker to `purpose === "standard"`, which keeps system bases out
of the user's own selection. Adding a client-side filter would duplicate the
server check and imply the boundary is enforced here, which it is not.

Rechecked live in the browser on default all-sources mode: exactly Alpha and
Beta offered, two documents, no system sources present, and cancel succeeded.

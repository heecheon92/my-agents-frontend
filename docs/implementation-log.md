## 2026-05-20 — Strict V1 Phase 1 auth/session frontend gate

- Verified the frontend BFF/browser auth assumptions against backend Phase 1 auth/session evidence without adding backend fields or changing frontend API models.
- Added targeted Vitest regressions for backend-standard unverified-login and rate-limit `{ detail }` surfacing, public-demo origin acceptance, and `localhost`/`127.0.0.1` mismatch rejection.
- Added `docs/strict-v1-phase-1-auth-session-gate.md` as the frontend Phase 1 gate report, including backend-owned remaining risks and the next live V1 browser-smoke gate.

Verification passed for this log entry: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run` (7 files / 30 tests), `pnpm build`, `V1_DEMO_EMAIL=test@test.com V1_DEMO_PASSWORD=... pnpm exec playwright test e2e/v1-demo.spec.ts` (1 Chromium test), and `git diff --check`. Backend boundary check was read-only but not clean because the sibling backend repo had concurrent task edits in `my_agents/settings.py`, `tests/test_auth_api.py`, `tests/test_cors_api.py`, and `tests/test_settings.py`.

# Frontend Implementation Log

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

- [x] Foundation / Greet-style spine
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

- Greet-style constants/models/services/query provider.
- Next BFF route handler with explicit product endpoint allowlist, CSRF auxiliary cookie strategy, same-origin checks, and `/assistant/chat` exclusion.
- Auth pages and protected service shell.
- Chat surface for conversations, messages, runs, events, and citations.
- Knowledge/document/group/permission management surfaces.
- Unit tests for API paths/query keys and BFF proxy policy.

Remaining: completion audit and optional commit/push.

## Decisions

- Mirror common GreetAcademy/GreetSchool structure as much as practical.
- Prefer GreetSchool-style top-level folders for this repo.
- Agent owns visual design, tone, and style.
- Chat is the anchor journey and should receive the highest first-pass polish.
- Backend may be inspected but not edited from frontend work without explicit user approval.
- Backend gaps belong in `docs/backend-requests.md` first.

## 2026-05-20 — strict V1 Phase 2 PDF upload frontend gate

- Reconciled backend commit `ef88553` by generating backend OpenAPI from `my_agents.api.create_app().openapi()` because the running local server still exposed the pre-Phase-2 OpenAPI.
- Added frontend support for the additive PDF contract: `POST /documents/upload`, multipart `FormData`, document source metadata, and citation filename/page provenance.
- Preserved the existing JSON text document create path and bodyless `/documents/{document_id}/ingest` path.
- Updated the BFF same-origin policy to allow `multipart/form-data` for authenticated upload mutations without allowing simple form posts.
- Added the PDF upload form to the Documents UI and kept the seeded text V1 flow available.

Verification passed for this log entry: `pnpm exec vitest run tests/api-path.test.ts tests/proxy-policy.test.ts tests/fetch-client.test.ts tests/document-api.test.ts tests/conversation-api.test.ts`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run` (8 files / 34 tests), `pnpm build`, `pnpm exec playwright test e2e/home.spec.ts`, and `git diff --check`. Final PDF browser upload smoke is deferred until the backend server is restarted on commit `ef88553` or later.


## 2026-05-20 — public demo release runbook

- Added a preview/production release runbook with provider/dependency decision records, deployment topology and auth/session matrices, no-secret/no-spend gates, visitor privacy copy, cleanup guidance, and an evidence bundle template.
- Linked the runbook from verification, security boundary, and bilingual README handoff docs.
- Logged the backend contract gap for a hosted public visitor email/provider verification path so final e2e proof does not fall back to seeded credentials or the dev outbox.

Verification for this log entry: docs-only change; `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run`, `pnpm build`, backend boundary check, and `git diff --check` were run after the edit.


## 2026-05-20 — worker-3 verification/evidence coverage probe

- Reviewed the production orchestration test spec against backend `/Users/heecheonpark/Git/Portfolio/my-agents` and frontend `/Users/heecheonpark/Git/Portfolio/my-agents-frontend` test surfaces.
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
- Added a GreetSchool/GreetAcademy-style localization surface with `i18n.config.ts`, `localization/ko.json`, `localization/en.json`, `utils/localization.ts`, `providers/localization.tsx`, and `hooks/useLocalization.ts`.
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

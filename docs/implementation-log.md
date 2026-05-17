# Frontend Implementation Log

This log keeps frontend work followable for future manual maintenance and future Codex sessions.

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

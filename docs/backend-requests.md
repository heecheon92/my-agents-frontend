# Backend Requests

This file tracks backend gaps found while building the frontend.

Frontend sessions may inspect `../my-agents` for contracts, but must not modify backend code unless the user explicitly approves backend work.

## Request template

```md
## YYYY-MM-DD — Short title

Status: proposed | approved | implemented | blocked
Frontend need:
Current backend behavior:
Requested backend contract:
Why it matters:
Frontend workaround, if any:
```

## Current requests

## 2026-06-14 — nickname signup and member roster display contract

Status: implemented / hosted OpenAPI refresh required before production verification
Frontend need: Signup must collect a duplicate-allowed display name, the manager-only active-member roster needs a human-readable label without introducing public user search or member emails, and no-account invitees need a token-proved signup path that asks for nickname/password only.
Current backend behavior: Backend implementation now requires `nickname` on signup, returns `user.nickname`, and includes display-only `nickname` in manager-only member rows; hosted OpenAPI should be refreshed from that accepted contract before deployment handoff.
Requested backend contract: Require `nickname` on `POST /auth/signup`; return `user.nickname` consistently from signup/login/verify/me responses; backfill existing users and guests with non-empty nicknames; expose `POST /group-invitations/signup` for no-account invitees with `{ token, nickname, password }` only; return a session envelope with user/member while the BFF redacts `csrf_token`; return `nickname` from manager-only `GET /groups/{group_id}/members`; keep duplicate nicknames allowed; keep invitation flows email-based and non-enumerating; keep role updates keyed by `user_id`; do not add nickname lookup, public user discovery, direct member creation, member emails, account-existence flags, or profile data.
Why it matters: Nickname improves manager recognition in active rosters, but it is display-only. Email remains the invitation/login identifier and user ID remains the exact advanced role-maintenance identifier. Invitation-token signup lets a recipient without an account finish onboarding without typing or changing the proven email identity.
Frontend workaround, if any: Frontend schemas/UI now match the accepted nickname and invitation-token signup contract. If a deployed backend still lacks the new OpenAPI shape, treat that as backend/frontend drift and do not add fallback user search, nickname lookup, member-email display, email-entry invite signup, or direct member creation.

## 2026-06-10 — invite-only group membership contract

Status: approved / backend implementation in progress
Frontend need: Groups UI and copy need a hosted OpenAPI contract for privacy-preserving invitations before adding or changing runtime API models.
Current backend behavior: The approved backend product boundary makes group membership invitation-only. Direct product activation by known `user_id` is being removed from public API/OpenAPI. Group KB and publish workflows remain shared after acceptance; conversations and opt-in memory remain private.
Requested backend contract: Expose `POST /groups/{group_id}/invitations`, `GET /groups/{group_id}/invitations`, `PATCH /groups/{group_id}/invitations/{invitation_id}`, `DELETE /groups/{group_id}/invitations/{invitation_id}` for cancel, `POST /groups/{group_id}/invitations/{invitation_id}/resend`, `GET /groups/{group_id}/members` for owner/admin role maintenance, non-creating `PATCH /groups/{group_id}/members/{user_id}`, and `POST /group-invitations/accept` with response shapes that never include `account_exists`, matched `user_id`, profile data, raw tokens, or discoverability status. Keep active-member role updates non-creating and manager-only.
Why it matters: The frontend must not ship user search, account-existence branching, or direct `user_id` member activation. Pending invitations must not look like active members or grant group KB access.
Frontend workaround, if any: Documentation, product copy, and runtime invitation/member role-maintenance models are aligned to the backend-owned OpenAPI shape; keep using hosted OpenAPI as the source of truth for future contract expansion.

## 2026-05-20 — v1 product endpoint contract freeze

Status: proposed
Frontend need: A hosted OpenAPI URL, or equivalent backend-owned contract document, for the v1 public demo endpoints used by the frontend.
Current backend behavior: The frontend currently targets the product endpoint family only: auth, groups, documents, knowledge bases, ingest/extraction runs, conversations, conversation runs, streamed runs, and run events. It does not call legacy `/assistant/chat` from product code.
Requested backend contract: Confirm exact request/response shapes for `POST /auth/signup`, `POST /auth/verify-email`, `POST /auth/login`, `POST /auth/password-reset/request`, `POST /auth/password-reset/confirm`, `POST /auth/logout`, `GET /auth/me`, `POST /groups`, `GET /groups`, `GET /groups/{group_id}`, group invitation create/list/update/resend/cancel/accept, `GET /groups/{group_id}/members`, `PATCH /groups/{group_id}/members/{user_id}`, `POST /knowledge-bases`, `GET /knowledge-bases`, `GET /knowledge-bases/{knowledge_base_id}`, `POST/GET /knowledge-bases/{knowledge_base_id}/documents`, `POST /knowledge-bases/{knowledge_base_id}/documents/upload`, KB-scoped ingest/extraction-run routes, legacy document compatibility routes including delete/permission`, `POST /conversations`, `GET /conversations`, `GET /conversations/{conversation_id}`, `GET /conversations/{conversation_id}/messages`, `POST /conversations/{conversation_id}/runs`, `GET /conversations/{conversation_id}/runs`, `POST /conversations/{conversation_id}/runs/stream`, `GET /conversations/{conversation_id}/runs/{run_id}`, and `GET /conversations/{conversation_id}/runs/{run_id}/events`.
Why it matters: Repo rules require hosted OpenAPI as the source of truth before changing frontend API models. The frontend schemas currently assume signup returns `{ user, verification_email_sent }`, login returns `{ user, csrf_token }` before BFF redaction, users include `email_verified_at`, and run completion includes `reply`, `route`, `handled_by`, and `citations`.
Frontend workaround, if any: No model changes made in this audit without a fresh backend-owned OpenAPI/contract.

## 2026-05-20 — cookie and CSRF demo contract

Status: proposed
Frontend need: Stable session and CSRF semantics for browser demo and deployment.
Current backend behavior: The frontend BFF copies the backend session cookie into a same-origin HttpOnly cookie named `MY_AGENTS_SESSION_COOKIE_NAME` (default `my_agents_session`), stores login `csrf_token` in an HttpOnly auxiliary cookie named `MY_AGENTS_CSRF_COOKIE_NAME`, redacts `csrf_token` from browser-visible JSON, and sends `X-CSRF-Token` on authenticated mutations.
Requested backend contract: Confirm login sets the expected session cookie, login JSON includes `csrf_token`, authenticated mutations accept `X-CSRF-Token`, logout invalidates the backend session, and production CORS/trusted-origin docs include the deployed frontend origin even though browser code normally calls the same-origin BFF.
Why it matters: Auth, ingest, document permissions, groups, and conversation runs are CSRF-sensitive public-demo flows.
Frontend workaround, if any: Same-origin JSON/fetch-metadata checks remain enforced in the BFF; unauthenticated auth lifecycle endpoints are CSRF-cookie exempt.

## 2026-05-20 — streamed run event contract

Status: proposed
Frontend need: Stable SSE framing for streamed assistant responses.
Current backend behavior: The frontend calls `POST /conversations/{conversation_id}/runs/stream` with `Accept: text/event-stream` and parses Server-Sent Events.
Requested backend contract: Confirm response content type is `text/event-stream`; `answer_delta` events use JSON data like `{ "delta": string, "sequence"?: number, "run_id"?: string }`; terminal success emits `run_completed` with the same shape as `POST /conversations/{conversation_id}/runs`; terminal failure emits `run_failed` or a non-2xx JSON error; and event blocks are separated by a blank line.
Why it matters: The chat UI shows incremental answer deltas, live redacted activity events, then invalidates persisted messages/runs after `run_completed`.
Frontend workaround, if any: The BFF now falls back to `text/event-stream` for successful stream responses if the backend omits the header.

## 2026-05-20 — persisted citations and run ordering

Status: implemented
Frontend need: Refresh-safe citation display and deterministic latest-run activity selection.
Current backend behavior: The frontend can show citations from the just-completed streamed run, but the current run list schema only preserves summary fields. The frontend now sorts run summaries by `created_at` descending before choosing the latest run for events.
Requested backend contract: Confirm `GET /conversations/{conversation_id}/runs` ordering, or document that clients must sort by `created_at`; provide a run detail endpoint or include persisted citations/reply on run history if citations must survive page refresh/old-run selection.
Why it matters: Public demo reviewers may refresh or switch conversations and expect citations to remain tied to answers.
Frontend workaround, if any: Backend commit `24b3ff8` documents newest-first summaries and adds `GET /conversations/{conversation_id}/runs/{run_id}`. The frontend BFF/service now allowlists and reads completed run detail for refresh-safe citations while still sorting defensively by `created_at`.

## 2026-05-20 — deterministic seed/demo flow

Status: implemented
Frontend need: A reproducible local demo path for v1 product review.
Current backend behavior: README suggests deterministic response mode but frontend does not own backend seed data.
Requested backend contract: Provide demo commands, seed user credentials or signup/login expectations, sample group/document/knowledge-base data if available, and a known prompt/document combination that produces citations and visible redacted events.
Why it matters: Frontend browser smoke tests and reviewer walkthroughs need predictable setup without backend source edits from the frontend lane.
Frontend workaround, if any: Backend commit `24b3ff8` adds `MY_AGENTS_AUTH_DEV_OUTBOX_ENABLED=true`, `GET /auth/dev/outbox`, hostname-consistency guidance, and deterministic sample document/prompt docs. Frontend smoke now uses the dev outbox instead of direct database edits.

## 2026-05-20 — strict V1 PDF upload contract

Status: implemented
Frontend need: A realistic uploaded-file contract for the strict V1 document flow, preferably PDF-first as defined in the backend V1 PRD.
Current backend behavior: The KB-first backend contract adds multipart `POST /knowledge-bases/{knowledge_base_id}/documents/upload` with `title`, `file`, and optional `group_id`; accepted PDF/Markdown/plain-text/`.xlsx`/`.pptx`/`.docx` behavior remains backend-owned. Legacy `/documents/upload` compatibility can remain for developer clients that supply a KB, but public-demo evidence should use the KB-nested route.
Requested backend contract: Provide the upload route, accepted content types, request encoding, max-size/error behavior, returned document/file metadata, and how upload links to ingestion lifecycle and provenance.
Why it matters: The frontend can now render the file upload UI, but public-demo evidence cannot honestly claim uploaded-file ingestion unless the active hosted backend exposes this contract and the browser smoke proves it. If not, the release must document the text-document fallback.
Frontend workaround, if any: Implemented direct PDF/Markdown/plain-text upload UI/API/BFF support from the backend-owned OpenAPI generated at commit `ef88553`; the 2026-06-09 frontend wiring extends the same KB-nested multipart path to `.xlsx`/`.pptx`, subject to active backend OpenAPI/browser smoke evidence. Final public-demo evidence still needs browser uploaded-file smoke against the active hosted/local backend. If the launch gate uses a text-document fallback, record the reason explicitly in the release evidence bundle.

## 2026-05-20 — strict V1 citation provenance contract

Status: implemented
Frontend need: Citation fields rich enough for display, debugging, and refresh-safe run detail UX.
Current backend behavior: Backend commit `ef88553` extends `CitationResponse` with optional `source_page` and `source_filename` while preserving `id`, `document_id`, `chunk_id`, and `snippet`.
Requested backend contract: Add or document stable provenance fields such as source title/filename, page number, section/heading, chunk index or offsets, ingestion/source version, and any display-safe labels the frontend should render.
Why it matters: Strict V1 requires citations with enough provenance for display/debugging; the current frontend can show only generic document/chunk/snippet data.
Frontend workaround, if any: Citation UI now renders backend-provided filename/page when present and falls back to document id for older/simple citations.

## 2026-05-20 — strict V1 safe event display contract

Status: proposed
Frontend need: Stable, redacted event fields suitable for an activity timeline in a public demo.
Current backend behavior: Hosted OpenAPI `AgentEventResponse` exposes `id`, `run_id`, `sequence`, `event_type`, and arbitrary `payload`.
Requested backend contract: Freeze allowed event types, public payload fields per event type, redaction guarantees, and how clients should display unknown or future event payloads.
Why it matters: Strict V1 requires useful and safe events; rendering arbitrary payload objects risks leaking backend-internal or unsafe fields if the contract is not constrained.
Frontend workaround, if any: Keep the generic activity timeline conservative and report unknown/unsafe payload needs to backend/orchestrator rather than adding richer display logic.

## 2026-05-20 — public visitor email/provider verification path

Status: proposed
Frontend need: A hosted preview-safe way for a real public visitor account to complete signup, email verification, login, and session restore without using the local dev outbox or a seeded account.
Current backend behavior: Local demo flows can use deterministic mode, seeded credentials, and `/auth/dev/outbox` when enabled for development. Production readiness requires `MY_AGENTS_AUTH_DEV_OUTBOX_ENABLED=false`, exact CORS origins, secure cookies, and a real or explicitly documented provider verification path.
Requested backend contract: Document the email/provider adapter, required environment variables, verification/reset URL origin behavior, production assertion that the dev outbox is disabled, and an operator-safe preview verification mechanism if direct email provider APIs need manual action.
Why it matters: The public visitor e2e proof must fail loudly when hosted/provider variables are missing and must not silently fall back to dev-only account verification.
Frontend workaround, if any: Keep seeded `e2e/v1-demo.spec.ts` for local proof, and use `docs/public-demo-release-runbook.md` as the provider/evidence gate until the backend-owned provider contract is available.

## 2026-05-21 — public-demo signup disable switch

Status: proposed
Frontend need: A backend-owned way to disable public signup after or during the reviewer-facing public demo without changing frontend code or exposing internals.
Current backend behavior: The frontend currently posts signup attempts to `POST /auth/signup` and renders standard backend `{ detail }` errors through `ErrorState`. A 403 response with a safe string detail would already display as a user-facing auth error.
Requested backend contract: Add or document an environment/config switch that disables signup, returns a non-2xx response such as HTTP 403 with a safe `{ detail: string }` body, leaves login/session restore available for existing approved accounts, and avoids exposing stack traces, provider configuration, or operational secrets.
Why it matters: The public demo is reviewer-facing, not an open SaaS. Signup disable is the preferred abuse-control and rollback path once evidence collection is complete or if preview traffic becomes risky.
Frontend workaround, if any: No UI change needed if the backend returns a safe `{ detail }`; `services/my-agents/fetch-client.ts` preserves string details and `components/AuthPanel.tsx` renders mutation errors through `ErrorState`.


## 2026-05-24 — Group Knowledge V1 OpenAPI gate

Status: superseded by unified source selection on 2026-06-07
Frontend need: Backend-owned OpenAPI for shared/group knowledge before changing frontend API models, clients, or hooks.
Current backend behavior: Chat source selection now uses a single `knowledge_base_selection` payload. Personal, shared, and group knowledge spaces are selected by ID through the same contract; deprecated shared-knowledge mandatory-source and optional-private attachment fields are removed.
Requested backend contract: Keep publish request create/list/approve/reject routes with request/response schemas for owner/admin-approved copy semantics, and keep run source-audit fields focused on resolved knowledge-base IDs/counts.
Why it matters: The UI should not expose separate personal-chat/shared-knowledge behavior. Pending/rejected publish requests must have zero retrieval effect, and approved requests must appear only after backend group-owned copy creation.
Frontend workaround, if any: Frontend models/services/hooks use the unified backend-owned contract; no shared-knowledge fallback remains.
## 2026-05-21 — public-demo guest access contract

Status: proposed
Frontend need: A reviewer-safe guest entrypoint that avoids provider setup for basic product review while preserving the normal session cookie and CSRF flow.
Current backend behavior: Frontend target contract now treats `POST /auth/guest/request` as an email-based request acknowledgement that accepts `{ email }` and does not return a guest code to the browser. `POST /auth/guest/login` remains code redemption: it accepts `{ code }`, returns the normal login body `{ user, csrf_token }`, and sets the app session cookie. Guest users may have `email: null`, `is_guest: true`, and `guest_expires_at`.
Requested backend contract: Keep the guest endpoints same-origin/BFF friendly, return safe `{ detail }` errors for disabled/invalid/expired/limit cases, and own enforcement for 24h access, one chat, 5 prompts, and 3 document creates/uploads.
Why it matters: Public demo reviewers need low-friction access without exposing provider secrets or making signup permanently open.
Frontend workaround, if any: Frontend BFF allowlists the guest endpoints, requests guest access by email, displays a generic accepted/check-email message, treats guest code redemption like normal login for cookie/CSRF redaction, displays guest limits in auth/chat UI, and relies on backend safe errors for limit/expiry enforcement.

## 2026-06-14 — system knowledge base and user type contract

Status: approved / backend implementation in progress
Frontend need: The frontend needs a read-only system-knowledge management gate and system source-space contract without exposing role mutation or making ambient project knowledge look user-disableable.
Current backend behavior: RALPLAN defines `can_manage_system_knowledge` as the canonical frontend gate, optional read-only `user_type`, first-class `scope: "system"` knowledge bases, privileged system source CRUD, and ambient system retrieval for all authenticated chat users. Backend recovery lanes are still responsible for the authoritative OpenAPI/runtime implementation.
Requested backend contract: Return `can_manage_system_knowledge: true` from `/auth/me` and related auth envelopes only for root/system managers; optionally return read-only `user_type: "root" | "system"` only with that positive capability signal; omit both fields for normal users and guests; accept privileged `POST /knowledge-bases { scope: "system" }`; return system KBs from `GET /knowledge-bases` only to managers; keep normal/guest list/get/manage paths non-enumerating; support system document create/upload/ingest through the planned nested KB document routes or publish an explicit replacement route set; keep ambient system retrieval separate from user-selected personal/group source IDs.
Why it matters: Normal users and guests should benefit from project knowledge in Ask without seeing or managing system sources. Root/system managers need honest UI warnings that system source content is public to authenticated chat users, including guests.
Frontend workaround, if any: Frontend schemas and UI now accept the planned system contract, gate management strictly on `can_manage_system_knowledge === true`, filter system KBs out of explicit chat source toggles, and document that backend/OpenAPI remains authoritative.

## 2026-08-09 — machine-readable error codes for localized error copy

Status: implemented backend-side (uncommitted at time of writing); frontend wired defensively
Frontend need: Render specific, actionable error copy in Korean without printing English backend prose into a Korean UI.
Current backend behavior: Errors return `{ detail: string }` written in English. `services/my-agents/fetch-client.ts` preserves it on `MyAgentsAPIError.detail`, and the UI previously rendered it verbatim through `ErrorState`.
Requested backend contract: Alongside the existing `detail`, return a stable machine-readable `code` (for example `guest_prompt_limit_reached`, `invalid_credentials`, `upload_too_large`, `publish_request_already_reviewed`). Codes should be additive, enumerable, and stable across releases; `detail` may stay English and human-readable for logs and API consumers.
Why it matters: The product renders in Korean. Status codes alone cannot distinguish "you hit the guest prompt limit" from "you lack permission", so today both read as generic 403 copy. `DESIGN.md` requires guest limits and backend-owned constraints to be surfaced honestly, which needs a code the frontend can map to Korean.
Frontend workaround, if any: `utils/error-message.ts` maps HTTP status to fully localized copy and deliberately drops `detail` so no English reaches the UI. Once `code` exists, the same module gains a code-to-copy map and regains specificity with no other frontend change.

## 2026-08-09 — typed, pre-redacted activity event display contract

Status: implemented backend-side (uncommitted at time of writing); frontend labels aligned
Frontend need: Render the agent activity timeline as readable operational steps instead of a raw JSON dump.
Current backend behavior: `GET /conversations/{id}/runs/{run_id}/events` returns `{ event_type, sequence, payload }` where `payload` is a free-form object. `components/chat/evidence-panel/sections.tsx` renders `JSON.stringify(payload, null, 2)` inside a `<pre>` because no key is documented as safe or stable, and `event_type` is shown as a raw backend enum with no localization.
Requested backend contract: Publish a closed, documented `event_type` enum the frontend can map to localized labels, plus an explicitly safe-for-display subset of payload fields per event type (counts, durations, document/citation counts) that is guaranteed free of prompts, provider traces, chain-of-thought, and credentials. The existing `agent_trace` array is the right shape and should be documented as stable.
Why it matters: This is `DESIGN.md` open question #5. Activity events are a core trust signal — they are the evidence that the answer came from the user's documents — but a JSON blob under a raw enum reads as a debug console rather than a product surface.
Frontend workaround, if any: The evidence panel promotes the derived `AgentTraceSummary` stages to the default view and keeps raw payloads behind a disclosure, with `sanitizeActivityEventPayload` stripping known-internal routing keys. That improves the reading path but cannot localize event names or guarantee payload safety.

## 2026-08-09 — ingestion progress for the upload queue

Status: **withdrawn — the premise was wrong.** No backend change was ever needed.
Frontend need: Distinguish a document still processing from one that has stalled. Still valid.
Current backend behavior: The backend emits monotonic milestone progress and always did — `queued 0`, `claimed 1`, `chunking 15`, `embedding 45`, `indexing 70`, `entities 85`, `metadata 95`, `completed 100`.
Requested backend contract: None. This entry originally claimed async ingestion "appears to leave `progress_percent` at its default until completion". That was an inference from the UI showing no progress, and it was wrong: the value arrives fine, and `useSourceUploadQueue` discards it by writing `progressPercent: 0` on every poll. A frontend decision was misdiagnosed as a backend gap.
Why it matters: Recorded rather than deleted because it is the second time in this pass that inferring a contract from observed behaviour produced a false request — the first being the activity event-type set. `AGENTS.md` already says to treat the hosted OpenAPI document as the source of truth; these are what that rule is protecting against.
Resolution: Whether to render the value, and how, is a frontend design decision tracked in `DESIGN.md`.

## 2026-08-09 — backend responses to the three requests above

The backend implemented all three. Recorded here because the frontend now
depends on the shape, and because two of my assumptions were wrong.

**Activity events.** Now an OpenAPI discriminated union keyed by `event_type`,
with unknown stored fields — including nested prompt text, credentials, and
provider traces — stripped before serialization. `agent_trace` is a stable typed
contract with closed stage IDs and display-safe evidence fields.

The persisted set is: `run_started`, `user_message_stored`,
`retrieval_completed`, `graph_invoked`, `answer_composed`,
`run_cancel_requested`, `run_cancelled`, `run_failed`.

Two corrections to the set the frontend had guessed by grepping backend source:

- `user_message_stored` and `run_cancel_requested` exist and were missed.
- `run_completed`, `run_error`, and `answer_delta` are **streaming-only SSE
  events, not persisted activity events**. `run_completed` still keeps a label
  because `shouldRecordLiveActivityEvent` records it into live activity, so it
  does reach the UI during a run — just never from the events endpoint.

This is exactly why `AGENTS.md` says not to derive contracts from source
inspection.

**Error codes.** Responses now carry a stable `code` beside `detail`.
`utils/error-message.ts` prefers `code`, falls back to HTTP status, and still
never renders `detail`. Reading it is defensive: an absent or unrecognized code
behaves exactly as before, so the frontend is safe against a backend that has
not deployed this yet.

**Ingestion progress.** The backend already emits monotonic progress
(queued 0 → claimed 1 → chunking 15 → embedding 45 → indexing 70 → entities 85
→ metadata 95 → completed 100), now covered by a polling test.

Correction to my earlier note: the frontend has not merely "not built this yet".
It shipped percentage bars in `956cc6c` and deliberately removed them in
`a081ef6`, because external-worker jobs could sit at 0% while queued correctly.
`progressPercent` survives as a synthetic field — written as 0 (and once 10) and
never rendered. Whether to restore it or delete it is tracked in `DESIGN.md`;
note that the backend scale still starts `queued 0%`, so the original objection
applies to a bare percentage even now, and `stage` is the signal that
disambiguates it.

**Outstanding verification.** These were read from the backend agent's report,
not from a running server. Per `AGENTS.md`, the hosted OpenAPI document is the
source of truth for frontend API models — nothing here changed a model, but the
`code` and `event_type` values should be confirmed against a live
`/openapi.json` before anyone treats them as guaranteed.

## 2026-08-09 — a specific code for "guest access disabled"

Status: withdrawn
Frontend need: Tell a visitor that guest access is switched off, rather than implying they lack permission.
Current backend behavior: With the guest feature disabled by environment flag, `POST /auth/guest/request` returns `403 { "detail": "guest access disabled", "code": "permission_denied" }`. `permission_denied` is a category-level code shared with genuine authorization failures, so the frontend cannot distinguish "this feature is off" from "you may not do this".
Requested backend contract: none. **Withdrawn on product direction:** the product does not tell users it is running in a demo or degraded mode, so the UI will not announce that guest access is switched off — neither up front nor after a failed submit. A specific code would only enable a message we have decided not to show.
Why it mattered: the visitor did nothing wrong and cannot act on a permissions message. That part is solved frontend-side without any backend change.
Resolution: `/guest` passes contextual fallback copy to `ErrorState`, so an uncoded 403 reads "지금은 게스트 이용 요청을 받을 수 없습니다" instead of the generic permission line. Deliberately vague about the cause, which is now the intended behaviour rather than a limitation.

## 2026-08-09 — serve the guest limits instead of hardcoding them in copy

Status: sent to the backend agent 2026-08-09, alongside two related items — whether the current limit values are too restrictive now that guest is the main entry path, and whether hosted email delivery actually works before `GUEST_CODE_AUTO_APPROVAL` is enabled.
Frontend need: State guest limits accurately without the frontend guessing them.
Current backend behavior: Guest limits are environment-configured — `MY_AGENTS_GUEST_ACCESS_TTL_SECONDS`, `MY_AGENTS_GUEST_MAX_CONVERSATIONS`, `MY_AGENTS_GUEST_CODE_TTL_SECONDS`, and the prompt/document caps. `/auth/me` already exposes `guest_expires_at`, but no counts.
Requested backend contract: Return the active guest limits — session TTL or expiry, max conversations, max prompts, max documents, and the code TTL — on a payload the UI can read. `/auth/me` covers the in-session cases; the pre-login figures on `/guest` would need an unauthenticated config endpoint, or the copy there stays non-specific.
Why it matters: Five user-facing strings currently hardcode `24시간`, `대화 1개`, `질문 5개`, `문서 3개`. Those numbers came from `.env.example`, which is **not** production — production configuration lives outside this repo. If the deployed values differ, the product is stating limits that are simply wrong, in exactly the copy `AGENTS.md` requires to be honest.
Frontend workaround: every hardcoded number is removed — the copy now says a limit exists without naming it, which is general but never wrong. `tests/knowledge-copy.test.ts` fails if a digit-plus-unit reappears in any string mentioning 게스트, so the only way back to specifics is interpolating a served value. That is a small change once the data exists.

## 2026-08-09 — backend response: guest policy endpoint

Status: **published** on backend `origin/develop` at `d81f849`; frontend wired and allowlisted. Deployment still pending.

`GET /auth/guest/policy`, unauthenticated, returns the active configuration:

```json
{
  "enabled": true,
  "code_delivery_mode": "automatic_email" | "manual_approval",
  "code_ttl_seconds": 900,
  "session_ttl_seconds": 86400,
  "max_conversations": 3,
  "max_prompts": 20,
  "max_document_uploads": 5
}
```

Repo defaults were raised from 1/5/3 to 3 conversations, 20 prompts, 5
documents, on the argument that the old values were too narrow to evaluate
retrieval and follow-up behaviour. **Production overrides these**, so the
externally managed configuration has to be updated separately for the new
defaults to apply.

**The operational finding matters more than the endpoint.** Hosted automatic
delivery is *not* active: production has `MY_AGENTS_GUEST_CODE_AUTO_APPROVAL=false`,
and a live request through the deployed BFF returned 200 while producing no
email event. The Resend credential and sender are verified and work — the flag
is simply off. Until it is on, the frontend must not say a code was sent.

That is why the panel keys its copy on `code_delivery_mode` rather than assuming
delivery. It also renders nothing about how the code arrives until the policy
loads, so a slow or failed policy fetch cannot produce a false promise.

The BFF allowlist needed `/auth/guest/policy` added; without it the deployed
proxy rejects the path.

To enable automatic delivery, the hosted service needs `GUEST_ACCESS_ENABLED=true`,
`GUEST_CODE_AUTO_APPROVAL=true`, and the three limit variables, then a redeploy
and a repeat of the hosted probe.

## 2026-08-09 — release state after the backend handoff

Backend contracts are committed and pushed (`d81f849` on `origin/develop`), and a
migration check confirmed there is nothing to apply: `origin/main` is an ancestor
of `origin/develop`, the `alembic/versions` tree hash is identical on both, and
the production database already sits at head `20260624_0029`. Every change was
response-layer or configuration, not schema.

Two things still gate the guest path, both outside this repository:

1. **Deploy the frontend.** `GET /auth/guest/policy` is allowlisted in
   `server/my-agents/proxy-policy.ts` as of `1fcf329`, and covered by
   `tests/proxy-policy.test.ts`. The deployed BFF still runs the older build that
   rejects the path.
2. **Set the hosted environment**, then restart or redeploy the backend:
   `MY_AGENTS_GUEST_ACCESS_ENABLED=true`, `MY_AGENTS_GUEST_CODE_AUTO_APPROVAL=true`,
   `MY_AGENTS_GUEST_MAX_CONVERSATIONS=3`, `MY_AGENTS_GUEST_MAX_PROMPTS=20`,
   `MY_AGENTS_GUEST_MAX_DOCUMENT_UPLOADS=5`. Raised repository defaults do **not**
   override explicitly configured hosted values.

Until both land, `/guest` degrades safely rather than lying: with no policy it
says nothing about how a code arrives, and with `manual_approval` it says an
operator will send one.

Delivery is verified only as far as the provider. Resend accepted the send and
reported `last_event=delivered` for its own `delivered@resend.dev` test recipient
— provider acceptance and simulated delivery, not proof that a real inbox
receives anything. Worth one end-to-end send to a real address after deploying.

## 2026-08-17 — compound interaction id must survive path encoding

Status: resolved — verified backend-side in `my-agents@328d5ca`
Frontend need: Fetch paged options for a pending interaction via `GET /conversations/{conversation_id}/runs/{run_id}/interactions/{interaction_id}/options`, where `interaction_id` is the compound `<run_id>:document_selection`.
Current backend behavior: Resolves the encoded form correctly. The BFF re-encodes every path segment (`buildBackendPath`), so the colon reaches the backend percent-encoded as `%3A`. At filing this was unexercised — the allowlist rule passing proves only that the proxy forwards the request, not that the backend resolves the ID. See Resolution below.
Requested backend contract: Confirm `GET …/interactions/run-1%3Adocument_selection/options` resolves the same interaction as the unencoded form. If it does not, move the interaction ID out of the path — a query parameter on the options endpoint, and the body field that `POST …/resume` already carries.
Why it matters: A path-encoding mismatch fails as a 404 from the backend, which is indistinguishable in the UI from "this interaction expired". The user would be told their question timed out when it is actually unreachable.
Resolution: backend commit `328d5ca` extends `test_checkpointed_document_selection_interrupts_and_resumes_same_run` to request the options route with the colon replaced by `%3A`, asserting a 200 and `schema_version: 1`. Starlette therefore resolves the encoded form to the stored colon value. The same test submits the exact v1 resume body and completes the same run.

Evidence pairing: `tests/proxy-policy.test.ts` pins the form the BFF emits (`run-1%3Adocument_selection`) and the backend test pins the form the backend accepts. They are the same string, so the two ends are verified against one another.

Live smoke, 2026-08-17: a browser session against persistence-enabled Postgres drove run creation, cold-load recovery from run detail, resume, and cancel through the Next BFF end to end. That closes the joined path for every route except this one. The options endpoint is the only route carrying the encoded `interaction_id` in its path, and it is called only when the inline first page is short of `option_count`; the smoke used a two-document knowledge base with `next_cursor: null`, so it never fired.

Still open: the encoded segment is verified at each end separately — backend `328d5ca` accepts it, `tests/proxy-policy.test.ts` pins that the BFF emits exactly it — but no single live request has carried it through the proxy. Closing this needs an interaction with more options than fit one page. The frontend keeps the raw ID and encodes only at the proxy boundary, so moving the ID to a query parameter or body field would remain a small change if that ever became necessary.

## 2026-08-25 — citations must distinguish "used for the answer" from "provided to the model"

Status: open — filed from a frontend observation, backend fix not yet started
Frontend need: Render the evidence panel as two distinct groups — the sources the answer actually drew on, and the sources that were merely consulted — instead of one flat list that implies every entry was cited.
Current backend behavior: They are the same set by construction. `run_lifecycle.py:596` creates one `CitationModel` per chunk in the list it receives, and that list is `used_chunks` from `chunks_used_for_answer` → `is_relevant_retrieval_result` (`knowledge/routing.py:270`), which reduces to `score > 0` plus one rule excluding `document_fallback` outside `retrieval_required`. Nothing in that chain consults the generated answer, so "cited" currently means "retrieved with a positive score". `agents/rag_agent/verifier.py:80` then *enforces* the identity (`citation count must match cited chunk count`), so this is a guarded invariant rather than an oversight — changing it is not a small patch.

Requested backend contract, in two separable parts:

1. **Expose both sets.** Keep `citations` as what the answer used, and add a separate consulted/provided list to `ConversationRunResponse`. Additive and optional, so a frontend built against the current contract keeps parsing. This part alone unblocks the UI and preserves the provenance the flat list gives today.
2. **Populate "used" from the answer, not from a retrieval score.** Either have the answering model emit the chunk ids it drew on (accurate; needs structured output and a rewrite of the verifier invariant above), or match post hoc — `agent_runtime/evals.py:19` already has `evaluate_grounded_citations` doing snippet overlap, which could be promoted from eval to pipeline. Cheaper and approximate.

Why it matters: the citation panel is the product's honesty surface. Presenting every retrieved chunk as a citation overstates grounding — a user checking the answer against a listed source may find it was never used, which reads as the assistant fabricating provenance. It also buries the sources that did matter among ones that did not.

Frontend position: no frontend change is possible before part 1. `useChatRunLoop.ts:187` passes `data.citations` through verbatim and `citationSchema` (`model/my-agents/knowledge.ts:127`) carries no field that could separate the two. Filtering client-side would be wrong for the same reason it is wrong for interaction options: the frontend has no basis for the distinction and would be inventing one. Once the field exists the UI change is small — an optional schema field, two groups in the evidence panel, and Korean copy per `docs/korean-copy-guide.md`.

Not verified: this is read from backend source, not reproduced against a running backend. It matches a user report that citations listed documents the answer had not used.

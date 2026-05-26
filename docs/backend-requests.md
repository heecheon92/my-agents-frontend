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

## 2026-05-20 — v1 product endpoint contract freeze

Status: proposed
Frontend need: A hosted OpenAPI URL, or equivalent backend-owned contract document, for the v1 public demo endpoints used by the frontend.
Current backend behavior: The frontend currently targets the product endpoint family only: auth, groups, documents, knowledge bases, ingest/extraction runs, conversations, conversation runs, streamed runs, and run events. It does not call legacy `/assistant/chat` from product code.
Requested backend contract: Confirm exact request/response shapes for `POST /auth/signup`, `POST /auth/verify-email`, `POST /auth/login`, `POST /auth/password-reset/request`, `POST /auth/password-reset/confirm`, `POST /auth/logout`, `GET /auth/me`, `POST /groups`, `GET /groups`, `GET /groups/{group_id}`, group member upsert/patch, `POST /knowledge-bases`, `GET /knowledge-bases`, `GET /knowledge-bases/{knowledge_base_id}`, `POST/GET /knowledge-bases/{knowledge_base_id}/documents`, `POST /knowledge-bases/{knowledge_base_id}/documents/upload`, KB-scoped ingest/extraction-run routes, legacy document compatibility routes including delete/permission`, `POST /conversations`, `GET /conversations`, `GET /conversations/{conversation_id}`, `GET /conversations/{conversation_id}/messages`, `POST /conversations/{conversation_id}/runs`, `GET /conversations/{conversation_id}/runs`, `POST /conversations/{conversation_id}/runs/stream`, `GET /conversations/{conversation_id}/runs/{run_id}`, and `GET /conversations/{conversation_id}/runs/{run_id}/events`.
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
Current backend behavior: The KB-first backend contract adds multipart `POST /knowledge-bases/{knowledge_base_id}/documents/upload` with `title`, `file`, and optional `group_id`; accepted PDF/Markdown/plain-text behavior remains backend-owned. Legacy `/documents/upload` compatibility can remain for developer clients that supply a KB, but public-demo evidence should use the KB-nested route.
Requested backend contract: Provide the upload route, accepted content types, request encoding, max-size/error behavior, returned document/file metadata, and how upload links to ingestion lifecycle and provenance.
Why it matters: The frontend can now render the PDF upload UI, but public-demo evidence cannot honestly claim uploaded-file ingestion unless the active hosted backend exposes this contract and the browser smoke proves it. If not, the release must document the text-document fallback.
Frontend workaround, if any: Implemented direct PDF/Markdown/plain-text upload UI/API/BFF support from the backend-owned OpenAPI generated at commit `ef88553`; final public-demo evidence still needs browser uploaded-file smoke against the active hosted/local backend. If the launch gate uses a text-document fallback, record the reason explicitly in the release evidence bundle.

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
Frontend workaround, if any: No UI change needed if the backend returns a safe `{ detail }`; `services/my-agents/fetch-client.ts` preserves string details and `components/keymesh/AuthPanel.tsx` renders mutation errors through `ErrorState`.


## 2026-05-24 — Group Knowledge V1 OpenAPI gate

Status: implemented
Frontend need: Backend-owned OpenAPI for Group Knowledge V1 before changing frontend API models, clients, hooks, or group-chat request bodies.
Current backend behavior: Read-only OpenAPI generation from `/Users/heecheonpark/Git/my-agents` with `MY_AGENTS_RESPONSE_MODE=deterministic uv run python - <<'PY' ... main.app.openapi() ... PY` now shows `ConversationRunRequest.optional_personal_knowledge_base_ids` and `/groups/{group_id}/publish-requests` create/list plus approve/reject routes.
Requested backend contract: Expose `ConversationRunRequest.optional_personal_knowledge_base_ids`; source-audit fields/counts on run start/completion/history/detail/events; and publish request create/list/approve/reject routes with request/response schemas for owner/admin-approved copy semantics.
Why it matters: Group Chat UI must send mandatory group KB selection plus explicit private personal attachments and must not invent publish workflow shapes from backend source inspection. Pending/rejected publish requests must have zero retrieval effect, and approved requests must appear only after backend group-owned copy creation.
Frontend workaround, if any: Frontend models/services/hooks now use the backend-owned contract; no fallback or invented publish shape remains.
## 2026-05-21 — public-demo guest access contract

Status: proposed
Frontend need: A reviewer-safe guest entrypoint that avoids provider setup for basic product review while preserving the normal session cookie and CSRF flow.
Current backend behavior: Backend pane `%10` reported the target contract: `POST /auth/guest/request` returns `{ code, expires_at }`; `POST /auth/guest/login` accepts `{ code }`, returns the normal login body `{ user, csrf_token }`, and sets the app session cookie. Guest users may have `email: null`, `is_guest: true`, and `guest_expires_at`.
Requested backend contract: Keep the guest endpoints same-origin/BFF friendly, return safe `{ detail }` errors for disabled/invalid/expired/limit cases, and own enforcement for 24h access, one chat, 5 prompts, and 3 document creates/uploads.
Why it matters: Public demo reviewers need low-friction access without exposing provider secrets or making signup permanently open.
Frontend workaround, if any: Frontend BFF allowlists the guest endpoints, treats guest login like normal login for cookie/CSRF redaction, displays guest limits in auth/chat UI, and relies on backend safe errors for limit/expiry enforcement.

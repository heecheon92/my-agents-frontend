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
Frontend need: A hosted OpenAPI URL, or equivalent backend-owned contract document, for the v1 portfolio demo endpoints used by the frontend.
Current backend behavior: The frontend currently targets the product endpoint family only: auth, groups, documents, knowledge bases, ingest/extraction runs, conversations, conversation runs, streamed runs, and run events. It does not call legacy `/assistant/chat` from product code.
Requested backend contract: Confirm exact request/response shapes for `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`, `POST /groups`, `GET /groups`, group member upsert/patch, `POST /knowledge-bases`, `GET /knowledge-bases`, `POST /documents`, `GET /documents`, `GET /documents/{document_id}`, `PATCH /documents/{document_id}/permissions`, `POST /documents/{document_id}/ingest`, `GET /documents/{document_id}/extraction-runs`, `POST /conversations`, `GET /conversations`, `GET /conversations/{conversation_id}`, `GET /conversations/{conversation_id}/messages`, `POST /conversations/{conversation_id}/runs`, `GET /conversations/{conversation_id}/runs`, `POST /conversations/{conversation_id}/runs/stream`, and `GET /conversations/{conversation_id}/runs/{run_id}/events`.
Why it matters: Repo rules require hosted OpenAPI as the source of truth before changing frontend API models. The frontend schemas currently assume signup returns `{ user, verification_email_sent }`, login returns `{ user, csrf_token }` before BFF redaction, users include `email_verified_at`, and run completion includes `reply`, `route`, `handled_by`, and `citations`.
Frontend workaround, if any: No model changes made in this audit without a fresh backend-owned OpenAPI/contract.

## 2026-05-20 — cookie and CSRF demo contract

Status: proposed
Frontend need: Stable session and CSRF semantics for browser demo and deployment.
Current backend behavior: The frontend BFF copies the backend session cookie into a same-origin HttpOnly cookie named `MY_AGENTS_SESSION_COOKIE_NAME` (default `my_agents_session`), stores login `csrf_token` in an HttpOnly auxiliary cookie named `MY_AGENTS_CSRF_COOKIE_NAME`, redacts `csrf_token` from browser-visible JSON, and sends `X-CSRF-Token` on authenticated mutations.
Requested backend contract: Confirm login sets the expected session cookie, login JSON includes `csrf_token`, authenticated mutations accept `X-CSRF-Token`, logout invalidates the backend session, and production CORS/trusted-origin docs include the deployed frontend origin even though browser code normally calls the same-origin BFF.
Why it matters: Auth, ingest, document permissions, groups, and conversation runs are CSRF-sensitive portfolio-demo flows.
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
Why it matters: Portfolio demo reviewers may refresh or switch conversations and expect citations to remain tied to answers.
Frontend workaround, if any: Backend commit `24b3ff8` documents newest-first summaries and adds `GET /conversations/{conversation_id}/runs/{run_id}`. The frontend BFF/service now allowlists and reads completed run detail for refresh-safe citations while still sorting defensively by `created_at`.

## 2026-05-20 — deterministic seed/demo flow

Status: implemented
Frontend need: A reproducible local demo path for v1 portfolio review.
Current backend behavior: README suggests deterministic response mode but frontend does not own backend seed data.
Requested backend contract: Provide demo commands, seed user credentials or signup/login expectations, sample group/document/knowledge-base data if available, and a known prompt/document combination that produces citations and visible redacted events.
Why it matters: Frontend browser smoke tests and reviewer walkthroughs need predictable setup without backend source edits from the frontend lane.
Frontend workaround, if any: Backend commit `24b3ff8` adds `MY_AGENTS_AUTH_DEV_OUTBOX_ENABLED=true`, `GET /auth/dev/outbox`, hostname-consistency guidance, and deterministic sample document/prompt docs. Frontend smoke now uses the dev outbox instead of direct database edits.

# Strict V1 Phase 0 frontend evidence map

Date: 2026-05-20; refreshed 2026-05-21
Task: Phase 0 contract freeze and frontend evidence/gap map for strict backend V1, narrowed for public portfolio demo P0 readiness.
Frontend repo: `/Users/heecheonpark/Git/my-agents-frontend`
Backend contract source checked: hosted OpenAPI from `http://127.0.0.1:8000/openapi.json`, title `my-agents`, version `0.1.0`; later PDF upload support was reconciled in `docs/strict-v1-phase-2-pdf-upload-gate.md` from backend-owned generated OpenAPI at commit `ef88553`.
Planning sources checked: `/Users/heecheonpark/.omx/plans/prd-backend-v1-completion.md` and `/Users/heecheonpark/.omx/plans/test-spec-backend-v1-completion.md`.

## Phase 0 decision

Frontend Phase 0 is **frontend-ready for a public portfolio demo P0 once evidence gates pass**, not a full SaaS launch claim. The current UI and BFF consume the product endpoint family instead of legacy `/assistant/chat`; the frontend now includes KB-scoped PDF/Markdown/plain-text upload support through `POST /knowledge-bases/{knowledge_base_id}/documents/upload`; and there is a seeded V1 browser smoke for login, ingest, streamed answer, citations, events, and reload persistence. Remaining P0 risk is mostly backend/infrastructure evidence: hosted OpenAPI/deployed backend must expose the same upload/session/SSE contracts, public preview must avoid the dev outbox, and the public visitor smoke must produce a redacted evidence bundle.

## Frontend-relevant product route inventory

The frontend targets these product routes across the hosted OpenAPI checked during Phase 0 plus the later backend-owned Phase 2 upload reconciliation. Hosted preview evidence must confirm the active backend exposes the same routes used for the demo gate:

| Area | Hosted OpenAPI routes | Frontend status |
| --- | --- | --- |
| Auth/session | `POST /auth/signup`, `POST /auth/verify-email`, `POST /auth/login`, `POST /auth/guest/request`, `POST /auth/guest/login`, `POST /auth/logout`, `GET /auth/me`, password reset routes, `GET /auth/dev/outbox` | Wired through BFF for product auth and guest demo access; dev outbox intentionally excluded from product BFF. |
| Documents/KB | `POST/GET /knowledge-bases`, `GET /knowledge-bases/{knowledge_base_id}`, `POST/GET /knowledge-bases/{knowledge_base_id}/documents`, `POST /knowledge-bases/{knowledge_base_id}/documents/upload`, KB-scoped ingest/extraction-run routes, plus legacy document detail/delete/permission compatibility routes | Wired for JSON document create/list/detail/delete, PDF/Markdown/plain-text upload, source metadata display, permissions, bodyless ingest, extraction runs, and KB create/list. |
| Conversation/run | `POST/GET /conversations`, `GET /conversations/{conversation_id}`, `POST/GET /conversations/{conversation_id}/messages`, `POST/GET /conversations/{conversation_id}/runs`, `POST /conversations/{conversation_id}/runs/stream`, `GET /conversations/{conversation_id}/runs/{run_id}`, `GET /conversations/{conversation_id}/runs/{run_id}/events` | Wired for conversation list/detail/messages, streamed run, run summaries, run detail, events, and refresh-safe citations. |
| Legacy dev chat | `POST /assistant/chat` | Hosted backend still exposes it, but frontend product BFF blocks `/assistant/*`. |

## Evidence/gap matrix against strict backend V1 DoD

| DoD area | Frontend evidence in this repo | Current gap / backend handoff | Phase 0 frontend gate |
| --- | --- | --- | --- |
| Auth/session | `app/api/my-agents/[...path]/route.ts` copies backend session cookies, stores CSRF in an HttpOnly auxiliary cookie, redacts `csrf_token`, and injects `X-CSRF-Token` for authenticated mutations. `hooks/use-auth.ts` and `components/keymesh/AuthPanel.tsx` drive signup/login/logout/session restore. `tests/auth-model.test.ts`, `tests/auth-api.test.ts`, `tests/proxy-policy.test.ts`, and `e2e/v1-demo.spec.ts` cover browser-safe auth behavior. | Strict V1 still needs backend-owned confirmation of production cookie attributes, trusted origins/CORS, CSRF semantics, logout invalidation, abuse/rate-limit boundary, and whether `/auth/dev/outbox` remains dev-only. | Pass for current frontend wiring; backend/orchestrator must close public-demo hardening evidence before Phase 1 gate. |
| Document/KB | `components/keymesh/AdminSurfaces.tsx`, `hooks/use-knowledge.ts`, `services/my-agents/MyAgentsDocumentAPI.ts`, `model/my-agents/knowledge.ts`, `constants/api-path.ts`, and `tests/document-api.test.ts` support KB create/list, KB-scoped JSON document create/list, KB-scoped PDF/Markdown/plain-text upload via `FormData`, source metadata display, permission patch, ingest, and extraction run display. | Hosted/deployed backend still must expose the KB-scoped `POST /knowledge-bases/{knowledge_base_id}/documents/upload` contract and accepted PDF/Markdown/plain-text behavior in its public OpenAPI/environment. The frontend must not claim arbitrary file support beyond backend-approved PDF/text behavior. | Pass for frontend wiring; P0 requires either a live uploaded-file smoke or a documented JSON text-document fallback if the hosted backend does not expose upload for the demo gate. |
| Ingest/upload | `e2e/v1-demo.spec.ts` proves the seeded text-document path; `components/keymesh/AdminSurfaces.tsx` adds a PDF/Markdown/plain-text upload form; `services/my-agents/MyAgentsDocumentAPI.ts` posts multipart `FormData` to `API_PATH.knowledgeBases.uploadDocument(...)`; `services/my-agents/fetch-client.ts` avoids forcing JSON content type for `FormData`; `tests/proxy-policy.test.ts` covers same-origin multipart allowance. | The seeded local smoke still exercises text ingest by default. Final public-demo P0 evidence must either upload a supported PDF, Markdown, or plain-text file against the hosted backend or explicitly record why the JSON text-document fallback was selected for that gate. | Pass for frontend upload support; remaining gate is live backend/browser evidence. |
| Streaming answer | `services/my-agents/MyAgentsConversationAPI.ts` calls `POST /conversations/{conversation_id}/runs/stream`, parses SSE `answer_delta`, `run_completed`, and unknown event payloads, while `ChatWorkspace` displays streamed assistant deltas and live activity events. `tests/conversation-api.test.ts` covers stream parsing. | OpenAPI lists both `application/json` and `text/event-stream` for the stream response, but SSE event names/payloads are not fully schema-described in OpenAPI. Terminal failure contract should be frozen. | Pass for current deterministic browser smoke; needs backend-owned SSE framing contract for strict V1. |
| Run detail citations | `constants/api-path.ts`, `server/my-agents/proxy-policy.ts`, `hooks/use-conversations.ts`, `services/my-agents/MyAgentsConversationAPI.ts`, `model/my-agents/knowledge.ts`, and `ChatWorkspace` consume `GET /conversations/{conversation_id}/runs/{run_id}` for refresh-safe citations and render optional `source_filename` / `source_page` when present. | Any provenance beyond filename/page, such as section, offsets, ingestion version, or stable display labels, remains backend-owned future polish. | Pass for public portfolio demo P0 when the smoke shows at least one display-safe citation before and after refresh. |
| Events | `GET /conversations/{conversation_id}/runs/{run_id}/events` is allowlisted and displayed in `ChatWorkspace` as a redacted activity timeline. `e2e/v1-demo.spec.ts` expects `retrieval_completed`. | Current `AgentEventResponse.payload` is an arbitrary object. Strict V1 needs a safe event display contract: allowed event types, redaction guarantees, stable public fields, and guidance for unknown/unsafe payload keys. | Partial pass: current UI displays events, but safe event schema/redaction contract is not frozen. |
| Reload persistence | `ChatWorkspace` sorts run summaries by `created_at`, fetches latest run detail, uses persisted citations when no live streamed citations exist, and the V1 Playwright smoke reloads then re-selects the conversation and expects citations/events. | Run summaries still omit reply/citation fields, so old-run selection beyond latest run depends on detail fetch by selected/latest run. Backend should confirm run ordering and run detail availability for all completed runs. | Pass for latest-run reload smoke; broader history UX remains a future gate. |
| No legacy `/assistant/chat` | `server/my-agents/proxy-policy.ts` rejects `/assistant/chat` and `/assistant/*` with `legacy_chat_blocked`; `tests/proxy-policy.test.ts` protects this. Product services call conversations/runs, not assistant chat. | Backend OpenAPI still exposes `/assistant/chat` as a dev route, so reviewers must distinguish backend legacy availability from frontend product usage. | Pass for frontend Phase 0: no product dependency on `/assistant/chat`. |
| Postgres-backed backend readiness | Frontend runbook now treats backend smoke readiness as a prerequisite for V1 browser smoke and points to backend `scripts.local_demo_smoke`. | Frontend cannot prove migration/pgvector/Postgres readiness from this repo. Need backend evidence bundle after each schema phase before frontend final smoke is meaningful. | Gap: backend-owned; frontend waits for backend readiness evidence before final strict V1 gate. |

## Missing backend contract items to arbitrate

1. **Hosted upload contract evidence**: frontend uploaded-file support exists, but the hosted preview backend/OpenAPI used for the reviewer demo must expose `POST /knowledge-bases/{knowledge_base_id}/documents/upload` and its PDF/Markdown/plain-text limits/error behavior.
2. **Safe event display**: current event `payload` is arbitrary; public demo evidence must confirm displayed events are redacted, and a fuller event taxonomy remains backend-owned future hardening.
3. **Auth/session hardening**: backend must freeze cookie/CSRF/origin/rate-limit behavior for public demo. Frontend BFF is ready to preserve the contract once confirmed.
4. **Public visitor access**: preview/public proof should use guest demo access or a real provider path, not seeded credentials or `/auth/dev/outbox`.
5. **Backend readiness evidence**: database migrations, pgvector/runtime readiness, and local/live backend smoke evidence must be backend-owned before frontend claims reviewer-facing product proof.

## Current frontend verification surface

Default frontend checks from the test spec after code changes:

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm exec vitest run
pnpm build
pnpm exec playwright test
```

Phase 0 was docs/report-only, so the required validation is lint/diff review plus backend boundary check. The existing opt-in V1 browser smoke remains:

```bash
V1_DEMO_EMAIL=test@test.com \
V1_DEMO_PASSWORD='correct horse battery staple' \
pnpm exec playwright test e2e/v1-demo.spec.ts
```

## Public portfolio demo P0 recommendation

Treat Phase 0 frontend as **ready to enter public-demo P0 evidence collection**, with no further frontend feature work required unless smoke evidence fails. Before a hosted reviewer-facing launch, prove:

1. Full local frontend checks: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run`, and `pnpm build`.
2. Local seeded V1 smoke with backend deterministic/demo support.
3. Hosted preview visitor smoke using HTTPS frontend/backend origins, guest access or real provider verification, no `/auth/dev/outbox`, no seeded account, and no browser storage secrets.
4. Document proof: uploaded supported PDF/Markdown/plain-text preferred; if using JSON text-document fallback, record the backend/infrastructure reason and limitation in the evidence bundle.
5. Reviewer-facing evidence is redacted and records known limitations: portfolio demo only, no full SaaS guarantees, no account deletion/export self-service, no production deploy/secrets/spend without owner approval.

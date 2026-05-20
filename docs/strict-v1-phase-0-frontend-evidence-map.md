# Strict V1 Phase 0 frontend evidence map

Date: 2026-05-20
Task: Phase 0 contract freeze and frontend evidence/gap map for strict backend V1.
Frontend repo: `/Users/heecheonpark/Git/my-agents-frontend`
Backend contract source checked: hosted OpenAPI from `http://127.0.0.1:8000/openapi.json`, title `my-agents`, version `0.1.0`.
Planning sources checked: `/Users/heecheonpark/.omx/plans/prd-backend-v1-completion.md` and `/Users/heecheonpark/.omx/plans/test-spec-backend-v1-completion.md`.

## Phase 0 decision

Frontend Phase 0 is **partially ready** for the strict V1 gate: the current UI and BFF consume the product endpoint family instead of legacy `/assistant/chat`, and there is already a seeded V1 browser smoke that exercises login, document ingest, streamed answer, citations, events, and reload persistence. The frontend should not start new feature implementation until backend/orchestrator accepts the gaps below, because the strict V1 PRD says backend OpenAPI is the contract source and the frontend must report missing fields/endpoints before workarounds.

## Current backend OpenAPI inventory

The hosted OpenAPI currently exposes these frontend-relevant product routes:

| Area | Hosted OpenAPI routes | Frontend status |
| --- | --- | --- |
| Auth/session | `POST /auth/signup`, `POST /auth/verify-email`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, password reset routes, `GET /auth/dev/outbox` | Wired through BFF for product auth; dev outbox intentionally excluded from product BFF. |
| Documents/KB | `POST /documents`, `GET /documents`, `GET /documents/{document_id}`, `PATCH /documents/{document_id}/permissions`, `POST /documents/{document_id}/ingest`, `GET /documents/{document_id}/extraction-runs`, `POST/GET /knowledge-bases` | Wired for JSON document create/list/detail, permissions, bodyless ingest, extraction runs, and KB create/list. |
| Conversation/run | `POST/GET /conversations`, `GET /conversations/{conversation_id}`, `POST/GET /conversations/{conversation_id}/messages`, `POST/GET /conversations/{conversation_id}/runs`, `POST /conversations/{conversation_id}/runs/stream`, `GET /conversations/{conversation_id}/runs/{run_id}`, `GET /conversations/{conversation_id}/runs/{run_id}/events` | Wired for conversation list/detail/messages, streamed run, run summaries, run detail, events, and refresh-safe citations. |
| Legacy dev chat | `POST /assistant/chat` | Hosted backend still exposes it, but frontend product BFF blocks `/assistant/*`. |

## Evidence/gap matrix against strict backend V1 DoD

| DoD area | Frontend evidence in this repo | Current gap / backend handoff | Phase 0 frontend gate |
| --- | --- | --- | --- |
| Auth/session | `app/api/my-agents/[...path]/route.ts` copies backend session cookies, stores CSRF in an HttpOnly auxiliary cookie, redacts `csrf_token`, and injects `X-CSRF-Token` for authenticated mutations. `hooks/use-auth.ts` and `components/keymesh/AuthPanel.tsx` drive signup/login/logout/session restore. `tests/auth-model.test.ts`, `tests/auth-api.test.ts`, `tests/proxy-policy.test.ts`, and `e2e/v1-demo.spec.ts` cover browser-safe auth behavior. | Strict V1 still needs backend-owned confirmation of production cookie attributes, trusted origins/CORS, CSRF semantics, logout invalidation, abuse/rate-limit boundary, and whether `/auth/dev/outbox` remains dev-only. | Pass for current frontend wiring; backend/orchestrator must close public-demo hardening evidence before Phase 1 gate. |
| Document/KB | `components/keymesh/AdminSurfaces.tsx`, `hooks/use-knowledge.ts`, `services/my-agents/MyAgentsDocumentAPI.ts`, `services/my-agents/MyAgentsKnowledgeBaseAPI.ts`, and `model/my-agents/knowledge.ts` support KB create/list, JSON document create/list/detail, permission patch, ingest, and extraction run display. | Hosted OpenAPI `DocumentCreateRequest` is JSON-only with `title`, `content`, `group_id`, and `knowledge_base_id`; it has no multipart/file upload endpoint, filename/content-type/size metadata, page/section provenance, or ingestion lifecycle beyond extraction summary counts. | Pass for seeded text-document V1 smoke; strict PDF-first upload cannot be claimed yet. |
| Ingest/upload | `e2e/v1-demo.spec.ts` selects the seeded `V1 Portfolio Chat Service Demo`, runs bodyless ingest through the product UI, and expects chunk count evidence in extraction runs. `services/my-agents/fetch-client.ts` sends JSON content type for no-body mutations. | No realistic PDF upload contract is available in current OpenAPI. Frontend cannot implement a file input or PDF progress UI without backend-owned endpoint and response shape. | Gap: report to backend/orchestrator before upload UI work. |
| Streaming answer | `services/my-agents/MyAgentsConversationAPI.ts` calls `POST /conversations/{conversation_id}/runs/stream`, parses SSE `answer_delta`, `run_completed`, and unknown event payloads, while `ChatWorkspace` displays streamed assistant deltas and live activity events. `tests/conversation-api.test.ts` covers stream parsing. | OpenAPI lists both `application/json` and `text/event-stream` for the stream response, but SSE event names/payloads are not fully schema-described in OpenAPI. Terminal failure contract should be frozen. | Pass for current deterministic browser smoke; needs backend-owned SSE framing contract for strict V1. |
| Run detail citations | `constants/api-path.ts`, `server/my-agents/proxy-policy.ts`, `hooks/use-conversations.ts`, `services/my-agents/MyAgentsConversationAPI.ts`, and `ChatWorkspace` now consume `GET /conversations/{conversation_id}/runs/{run_id}` for refresh-safe citations. | Current `CitationResponse` only exposes `id`, `document_id`, `chunk_id`, and `snippet`; strict V1 asks for richer provenance for display/debugging such as source filename/title, page number, section, offsets, ingestion run/source version, or stable display labels. | Gap: current UI can render simple citations, but richer citation UX waits on backend schema. |
| Events | `GET /conversations/{conversation_id}/runs/{run_id}/events` is allowlisted and displayed in `ChatWorkspace` as a redacted activity timeline. `e2e/v1-demo.spec.ts` expects `retrieval_completed`. | Current `AgentEventResponse.payload` is an arbitrary object. Strict V1 needs a safe event display contract: allowed event types, redaction guarantees, stable public fields, and guidance for unknown/unsafe payload keys. | Partial pass: current UI displays events, but safe event schema/redaction contract is not frozen. |
| Reload persistence | `ChatWorkspace` sorts run summaries by `created_at`, fetches latest run detail, uses persisted citations when no live streamed citations exist, and the V1 Playwright smoke reloads then re-selects the conversation and expects citations/events. | Run summaries still omit reply/citation fields, so old-run selection beyond latest run depends on detail fetch by selected/latest run. Backend should confirm run ordering and run detail availability for all completed runs. | Pass for latest-run reload smoke; broader history UX remains a future gate. |
| No legacy `/assistant/chat` | `server/my-agents/proxy-policy.ts` rejects `/assistant/chat` and `/assistant/*` with `legacy_chat_blocked`; `tests/proxy-policy.test.ts` protects this. Product services call conversations/runs, not assistant chat. | Backend OpenAPI still exposes `/assistant/chat` as a dev route, so reviewers must distinguish backend legacy availability from frontend product usage. | Pass for frontend Phase 0: no product dependency on `/assistant/chat`. |
| Postgres-backed backend readiness | Frontend runbook now treats backend smoke readiness as a prerequisite for V1 browser smoke and points to backend `scripts.local_demo_smoke`. | Frontend cannot prove migration/pgvector/Postgres readiness from this repo. Need backend evidence bundle after each schema phase before frontend final smoke is meaningful. | Gap: backend-owned; frontend waits for backend readiness evidence before final strict V1 gate. |

## Missing backend contract items to arbitrate

1. **Realistic PDF upload**: current OpenAPI has JSON `POST /documents`; strict V1 needs a backend-owned file upload route or documented upload request shape, accepted content types, file metadata response fields, and parser error contract.
2. **Richer citation provenance**: current citations are `id`, `document_id`, `chunk_id`, `snippet`; strict V1 display/debugging needs page/section/source labels and stable provenance identifiers.
3. **Safe event display**: current event `payload` is arbitrary; strict V1 needs event type taxonomy, public payload schema, redaction guarantees, and display rules for unknown payloads.
4. **Auth/session hardening**: backend must freeze cookie/CSRF/origin/rate-limit behavior for public demo. Frontend BFF is ready to preserve the contract once confirmed.
5. **Backend readiness evidence**: Postgres/pgvector migration and local/live smoke evidence must be backend-owned before frontend claims final V1 product proof.

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

## Next frontend gate recommendation

Treat Phase 0 frontend as **evidence mapped with open backend contract gaps**. Recommended next gate is **backend contract arbitration before frontend implementation**:

1. Backend owner freezes Phase 0 DoD matrix and OpenAPI inventory.
2. Orchestrator accepts or prioritizes the five missing backend contract items above.
3. Frontend runs `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run`, and the V1 browser smoke only after backend Phase 0/1 readiness is available.
4. Do not add PDF upload UI, richer citation UI, or event payload rendering beyond the current safe generic display until backend OpenAPI/schema is updated.

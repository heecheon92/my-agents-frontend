# Strict V1 Phase 1 frontend auth/session gate

Date: 2026-05-20
Task: Frontend verification for backend Phase 1 auth/session hardening.
Frontend repo: `/Users/heecheonpark/Git/my-agents-frontend`
Backend repo inspected read-only: `/Users/heecheonpark/Git/my-agents`
Backend contract rule: do not invent backend fields; only verify existing BFF/browser behavior and record gaps.

## Gate decision

Frontend Phase 1 is **ready as a contract-preserving gate** for the current backend auth/session behavior. No frontend API model fields were added. The existing BFF/browser flow already preserves the backend-owned session cookie and CSRF contract, and this pass adds targeted regressions for the remaining Phase 1 frontend assumptions: public-demo origin configuration, localhost host consistency, unverified-login errors, and rate-limit error surfacing.

## Backend behavior verified by inspection

Read-only backend evidence checked from `../my-agents`:

- `tests/test_auth_api.py` covers signup, unverified login rejection, verified login, `/auth/me`, logout without CSRF rejection, logout with `X-CSRF-Token`, duplicate signup, invalid login, password reset, and auth attempt rate limiting.
- `tests/test_cors_api.py` covers credentialed CORS for explicit frontend origins and absence of CORS headers when no origins are configured.
- `my_agents/api/auth.py` currently returns the existing backend error details `email verification required`, `too many auth attempts`, `invalid CSRF token`, and `authentication required` through standard FastAPI `{ detail }` error bodies.
- `docs/portfolio-chat-service/10-frontend-demo-runbook.md` documents host consistency for `localhost` versus `127.0.0.1`, explicit `MY_AGENTS_CORS_ALLOWED_ORIGINS`, and local-only `MY_AGENTS_AUTH_DEV_OUTBOX_ENABLED=true`.

These are consumed as existing contracts/evidence only; this frontend pass does not add or assume new backend response fields.

## Frontend Phase 1 verification matrix

| Phase 1 area | Frontend evidence | Result / next gate |
| --- | --- | --- |
| Login cookie handoff | `app/api/my-agents/[...path]/route.ts` copies only the configured backend session cookie into a same-origin HttpOnly cookie and stores the backend `csrf_token` in a separate HttpOnly CSRF cookie. | Pass; depends on backend continuing to set the configured session cookie on `POST /auth/login`. |
| Browser-safe login response | `model/my-agents/auth.ts` keeps backend login parsing (`{ user, csrf_token }`) separate from browser-visible login parsing (`{ user }`), and `tests/auth-model.test.ts` rejects leaked `csrf_token`. | Pass; no browser-visible CSRF/session secrets. |
| CSRF mutations | `server/my-agents/proxy-policy.ts` exempts only unauthenticated auth lifecycle mutations; logout, conversations, documents, groups, and knowledge mutations require the CSRF cookie and receive `X-CSRF-Token` server-side. | Pass; `tests/proxy-policy.test.ts` and route handler behavior protect this. |
| Logout/session restore | `services/my-agents/fetch-client.ts` sends JSON content type and `credentials: "include"`; `MyAgentsAuthAPI.logout()` uses the BFF no-body POST path and `/auth/me` remains the restore check. | Pass for frontend contract; full browser smoke still requires a running backend. |
| Unverified account handling | Backend currently returns `{ detail: "email verification required" }` with HTTP 403. The frontend fetch client now has a targeted regression that surfaces that standard detail without adding custom fields. | Pass; user-facing copy is the backend-safe detail rendered through `ErrorState`. |
| Rate-limit surfacing | Backend currently returns `{ detail: "too many auth attempts" }` with HTTP 429. The frontend fetch client now has a targeted regression that preserves status/detail in `MyAgentsAPIError`. | Pass; no special backend fields invented. |
| Localhost/public-demo origins | Existing BFF policy validates same-origin JSON mutations against `MY_AGENTS_FRONTEND_ORIGIN`/request origin. New regressions cover explicit public-demo origin acceptance and `localhost` vs `127.0.0.1` mismatch rejection. | Pass; deployment must configure one exact public frontend origin and backend `MY_AGENTS_CORS_ALLOWED_ORIGINS`. |
| Dev outbox | Frontend product BFF still does not allowlist `/auth/dev/outbox`; V1 demo smoke may rely on backend seed/outbox outside product UI only. | Pass; no production UI exposure. |

## Remaining backend-owned risks

- Backend documentation still needs final Phase 1 wording if shared/distributed rate limiting remains bounded to local/in-process behavior.
- Public-demo deployment must use HTTPS with secure cookies enabled and exact configured frontend/backend origins.
- Browser end-to-end evidence requires a running backend seeded for the V1 demo; in this run, `http://localhost:8000/health` was reachable and the seeded V1 Playwright smoke passed after the unit/contract updates.

## Recommended next frontend gate

Before final strict V1 signoff or after any further backend auth/session changes, rerun the V1 local demo smoke with the backend configured exactly as documented in `../my-agents/docs/portfolio-chat-service/10-frontend-demo-runbook.md`:

```bash
MY_AGENTS_BACKEND_URL=http://localhost:8000 pnpm dev
V1_DEMO_EMAIL=test@test.com \
V1_DEMO_PASSWORD='correct horse battery staple' \
pnpm exec playwright test e2e/v1-demo.spec.ts
```

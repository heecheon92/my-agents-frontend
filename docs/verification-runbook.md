# Verification Runbook

Use this runbook before claiming frontend work is complete.

## Install and run locally

Backend terminal:

```bash
cd ../my-agents
MY_AGENTS_RESPONSE_MODE=deterministic \
MY_AGENTS_SESSION_COOKIE_SECURE=false \
uv run uvicorn main:app --host 127.0.0.1 --port 8000
```

Frontend terminal:

```bash
cd ../my-agents-frontend
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`.

## Standard verification commands

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm exec vitest run
pnpm build
```

For convenience, the equivalent scripts are also available:

```bash
pnpm typecheck
pnpm test
```

## Responsive layout verification

Use this after UI/layout changes and whenever the `responsive-design` skill applies.

1. Confirm the changed surface starts from a mobile-first single-column layout and only adds columns at content-driven breakpoints.
2. Check narrow widths around 360px and 390px for horizontal overflow, clipped IDs, pre/code blocks, and button rows that should wrap.
3. Check tablet width around 768px for readable typography, fluid spacing, and card grids that wrap without shrinking text below comfortable body size.
4. Check desktop width around 1280px for intended multi-column shell/chat/admin layouts and bounded content width.
5. Confirm primary touch targets are comfortable on mobile; avoid adding tiny-only controls unless the component has a clear dense-UI reason.
6. Prefer browser screenshots or Playwright viewport checks for substantial visual changes; record any manual viewport checks in `docs/implementation-log.md`.


## Public demo release gates

Use [`docs/public-demo-release-runbook.md`](./public-demo-release-runbook.md) for preview and production readiness. The short version is:

1. Local deterministic smoke must pass first.
2. Hosted preview smoke must pass before any public production smoke.
3. Final live deploy, provider activation, production migrations, secrets, and spend remain owner-gated actions.
4. Evidence bundles must redact emails, cookies, tokens, API keys, document contents, and host secrets.
5. Public visitor proof must use a real visitor account path and must not rely on seeded demo credentials or `/auth/dev/outbox`.

## Browser smoke for auth/chat

Use this after auth, BFF, chat, route, provider, or visual shell changes.

1. Start backend in deterministic mode.
2. Start frontend with `pnpm dev`.
3. Open `http://localhost:3000/signup`.
4. Create a new account with a unique email and password of at least 8 characters. After the nickname contract lands, also enter a required display name and confirm duplicate display names are allowed in separate accounts.
5. Confirm the signup screen shows an account-created handoff from the `{ user, verification_email_sent }` response instead of a Zod/parser error or automatic chat redirect. After the nickname contract lands, confirm `user.nickname` parses from the response.
6. If the local backend mode requires email verification, use the hosted API/dev mail flow available for that environment; otherwise log in with the newly created credentials and confirm redirect to `/chat`.
7. Confirm browser `localStorage` and `sessionStorage` do not contain session or CSRF values.
8. Create a question thread.
9. Send a message such as `Summarize the renewal risks in my notes`.
10. Confirm the Ask transcript shows user and assistant messages.
11. Confirm citations appear near the assistant answer when knowledge was used.
12. Open the response evidence/work-history disclosure and confirm it shows a completed run plus redacted operational events.
13. Confirm browser console has no unexpected errors. A 401 from `/auth/me` after logout is expected unauthenticated behavior.
14. Click logout and confirm redirect to `/login`.

## V1 local demo smoke

Use this opt-in smoke after backend local-demo seed/reset support is available and the
demo account is verified. It drives only product UI/BFF routes and does not expose the
dev outbox or seed helper in production UX.

As a backend-only companion preflight, backend commit `89dccec` provides an API
smoke that proves the public V1 path before running the browser flow:

```bash
uv run python -m scripts.local_demo_smoke --base-url http://localhost:8000 --timeout 120
```

```bash
MY_AGENTS_BACKEND_URL=http://localhost:8000 pnpm dev
V1_DEMO_EMAIL=test@test.com \
V1_DEMO_PASSWORD='your-demo-password' \
pnpm exec playwright test e2e/v1-demo.spec.ts
```

The backend local demo seed helper currently provides the verified account
`test@test.com`, password `correct horse battery staple`, and seeded text document
`V1 Product Chat Service Demo`.

Expected seeded text flow: login -> create or choose a knowledge/source space on
Knowledge/Sources -> confirm the URL may use `/knowledge/{knowledge-base-id}` or
`/knowledge/{group-id}` for the selected context -> add a text source under that
space -> prepare it through the upload/preparation flow or a seeded backend fixture ->
streamed Ask answer with `All` or selected source scope -> citations beside the
answer -> response evidence disclosure with completed run/work history -> persisted
run-detail citations after reload.

Upload smoke should use an active backend with the KB-nested upload contract: login -> Sources -> create or select a source space -> upload a supported PDF, Markdown (`.md`/`.markdown`), plain text (`.txt`), Excel workbook (`.xlsx`), or PowerPoint deck (`.pptx`) through `POST /knowledge-bases/{knowledge_base_id}/documents/upload` -> verify document source metadata -> refresh the selected `/knowledge/{id}` route -> confirm the uploaded file is prepared by the unified upload flow -> confirm citations can render backend-provided filename/page/space provenance.


## V1 public visitor smoke (preview/public final proof)

Use this only after preview backend/frontend URLs, cookie/CORS settings, persistent DB migrations, and the account/email provider are configured. This smoke intentionally creates a unique visitor account through the public UI, does not use the seeded demo account, and does not call the backend dev outbox.

Required final-proof behavior:

1. Missing provider variables fail the Playwright test explicitly when `V1_PUBLIC_VISITOR_SMOKE=1`; they must not silently skip.
2. The generated account email must be unique via `{nonce}`.
3. Email/account activation must use the configured public provider path, or a documented preview-safe provider command.
4. Browser `localStorage` and `sessionStorage` must not contain session, CSRF, provider tokens, raw passwords, API keys, or OpenAI-style keys.
5. The flow creates or uploads a document, verifies it is prepared for Ask, streams a chat run, verifies citations/events, reloads, and verifies persisted evidence.
6. If hosted proof uses the default local Playwright config, record the local-to-hosted topology explicitly; otherwise record the alternate hosted command/config used for the run.
7. If `login-after-signup` mode is used, record why immediate login is valid for that preview/provider setup; otherwise use `provider-command` and keep command output limited to the activation URL.
8. Record whether `/assistant/chat` exclusion was proven by `tests/proxy-policy.test.ts` only or by an additional browser assertion.

Example for a preview environment that allows login immediately after signup:

```bash
MY_AGENTS_BACKEND_URL=https://preview-api.example.invalid \
V1_PUBLIC_VISITOR_SMOKE=1 \
V1_PUBLIC_VISITOR_EMAIL_TEMPLATE='demo-smoke+{nonce}@example.invalid' \
V1_PUBLIC_VISITOR_PASSWORD='use-a-preview-only-password' \
pnpm exec playwright test e2e/v1-demo.spec.ts -g 'public visitor'
```

Example when the provider requires an activation link fetched by an operator-owned command:

```bash
MY_AGENTS_BACKEND_URL=https://preview-api.example.invalid \
V1_PUBLIC_VISITOR_SMOKE=1 \
V1_PUBLIC_VISITOR_EMAIL_TEMPLATE='demo-smoke+{nonce}@example.invalid' \
V1_PUBLIC_VISITOR_PASSWORD='use-a-preview-only-password' \
V1_PUBLIC_VISITOR_VERIFICATION_MODE=provider-command \
V1_PUBLIC_VISITOR_VERIFICATION_COMMAND='./scripts/print-preview-verification-link.sh' \
pnpm exec playwright test e2e/v1-demo.spec.ts -g 'public visitor'
```

`V1_PUBLIC_VISITOR_VERIFICATION_COMMAND` receives `V1_PUBLIC_VISITOR_EMAIL` in its environment and must print only the verification URL to stdout. Do not use this hook to print secrets, mailbox contents, cookies, or provider tokens. Production public smoke still requires explicit user confirmation before live deploy, live secrets, spend, or public activation.


## Backend boundary check

Always run this before final reporting if the task touched backend contracts, BFF, auth, or docs that mention backend behavior:

```bash
git -C ../my-agents status --short
```

Expected result: no output, unless the user already had unrelated backend changes.

## Common failures

| Symptom | Likely cause | Where to look |
| --- | --- | --- |
| Logout or ingest returns 415 | No-body mutation missing JSON content type | `services/my-agents/fetch-client.ts`, `server/my-agents/proxy-policy.ts` |
| Login response contains `csrf_token` | BFF redaction regression | `app/api/my-agents/[...path]/route.ts`, `model/my-agents/auth.ts` |
| Product chat calls `/assistant/chat` | Wrong endpoint family | `services/my-agents/`, `components/ChatWorkspace.tsx` |
| Cross-site mutation is forwarded | BFF policy regression | `server/my-agents/proxy-policy.ts`, `tests/proxy-policy.test.ts` |
| UI claims unavailable backend features | Fake data or stale docs | Hosted OpenAPI document, `docs/backend-requests.md`, relevant component copy |

## Final report checklist

A good final report includes:

- Changed files or changed areas.
- Verification commands and pass/fail evidence.
- Browser smoke result if UI behavior changed.
- Backend boundary check result.
- Backend requests created, if any.
- Remaining risks or follow-ups.

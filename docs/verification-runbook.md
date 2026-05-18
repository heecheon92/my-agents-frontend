# Verification Runbook

Use this runbook before claiming frontend work is complete.

## Install and run locally

Backend terminal:

```bash
cd /Users/heecheonpark/Git/Portfolio/my-agents
MY_AGENTS_RESPONSE_MODE=deterministic \
MY_AGENTS_SESSION_COOKIE_SECURE=false \
uv run uvicorn main:app --host 127.0.0.1 --port 8000
```

Frontend terminal:

```bash
cd /Users/heecheonpark/Git/Portfolio/my-agents-frontend
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

## Browser smoke for auth/chat

Use this after auth, BFF, chat, route, provider, or visual shell changes.

1. Start backend in deterministic mode.
2. Start frontend with `pnpm dev`.
3. Open `http://localhost:3000/signup`.
4. Create a new account with a unique email and password of at least 8 characters.
5. Confirm the signup screen shows the email-verification handoff instead of a Zod/parser error or automatic chat redirect.
6. Verify the account with the backend local/dev email-verification token, then log in and confirm redirect to `/chat`.
7. Confirm browser `localStorage` and `sessionStorage` do not contain session or CSRF values.
8. Create a conversation.
9. Send a message such as `Plan my next backend milestone`.
10. Confirm transcript shows user and assistant messages.
11. Confirm run history shows a completed run and route label.
12. Confirm event timeline shows redacted operational events.
13. Confirm browser console has no unexpected errors. A 401 from `/auth/me` after logout is expected unauthenticated behavior.
14. Click logout and confirm redirect to `/login`.

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
| Product chat calls `/assistant/chat` | Wrong endpoint family | `services/my-agents/`, `components/keymesh/ChatWorkspace.tsx` |
| Cross-site mutation is forwarded | BFF policy regression | `server/my-agents/proxy-policy.ts`, `tests/proxy-policy.test.ts` |
| UI claims unavailable backend features | Fake data or stale docs | `docs/backend-requests.md`, relevant component copy |

## Final report checklist

A good final report includes:

- Changed files or changed areas.
- Verification commands and pass/fail evidence.
- Browser smoke result if UI behavior changed.
- Backend boundary check result.
- Backend requests created, if any.
- Remaining risks or follow-ups.

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

## Browser smoke for auth/chat

Use this after auth, BFF, chat, route, provider, or visual shell changes.

1. Start backend in deterministic mode.
2. Start frontend with `pnpm dev`.
3. Open `http://localhost:3000/signup`.
4. Create a new account with a unique email and password of at least 8 characters.
5. Confirm redirect to `/chat`.
6. Confirm browser `localStorage` and `sessionStorage` do not contain session or CSRF values.
7. Create a conversation.
8. Send a message such as `Plan my next backend milestone`.
9. Confirm transcript shows user and assistant messages.
10. Confirm run history shows a completed run and route label.
11. Confirm event timeline shows redacted operational events.
12. Confirm browser console has no unexpected errors. A 401 from `/auth/me` after logout is expected unauthenticated behavior.
13. Click logout and confirm redirect to `/login`.

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

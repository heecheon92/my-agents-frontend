# Reasoning controls — frontend handoff

Written 2026-08-09. Read this before running the app: **this feature is dark in
production right now, on purpose.**

## The one thing that matters

The backend work is **uncommitted and undeployed**, and needs Alembic migration
`20260809_0031`. `GET /capabilities/reasoning` does not exist in production.

The frontend is built so that is a supported state, not a bug:

- The capabilities query uses `retry: false`. A 404 is an expected answer.
- When it fails, `resolveReasoning()` returns `available: false`, the composer
  renders **exactly** as it did before, and the run request omits both fields —
  the body is byte-identical to what shipped previously.
- So this is safe on `develop` and safe to deploy, but the controls stay
  invisible until the backend ships.

**Do not release frontend `main` expecting to see the controls.** They appear
only once the backend is deployed with the migration at head.

## Running it end to end

```bash
# backend, with the migration applied
cd ../my-agents
uv run alembic upgrade head          # expect 20260809_0031
MY_AGENTS_RESPONSE_MODE=openai uv run fastapi dev main.py

# frontend
cd ../my-agents-frontend
pnpm dev
```

Then confirm the endpoint is reachable through the BFF, which is the piece that
broke last time a new endpoint was added:

```bash
curl -s http://localhost:3000/api/my-agents/capabilities/reasoning | jq
```

A 200 with `supported_efforts` means the allowlist entry works. A 403 means the
proxy rejected it — check `server/my-agents/proxy-policy.ts`.

## What to verify manually

The mocked suite cannot prove the contract. These need a real backend:

1. Send at `보통`. Confirm the request body carries `reasoning_mode` and
   `reasoning_effort`, and that `run_started` echoes them back.
2. Raise to `최대`, send, reload. The selection should stick, and the run detail
   should report the effective pair.
3. Toggle Pro against a pre-GPT-5.6 model. The backend answers 400
   `reasoning_mode_not_supported`; confirm it renders as localized copy rather
   than a raw error. **This path is not covered by any test.**
4. As a guest: controls visible but disabled, with the reason shown, and a run
   still succeeds using the server's clamped values.
5. Queue a message mid-stream, then press 지금 보내기. The active run should
   cancel, the queued message should send, and the partial answer should stay on
   screen.
6. Stop the backend and reload. Controls disappear; sending still works.

## Findings worth keeping

**`partial_reply_persisted` already existed.** `runCancelledEventDataSchema`
carried it before this change and nothing read it. `useChatRunLoop` cleared
`streamedReply` on the cancelled path as well as the completed one, so stopping
a run discarded the partial answer from the screen regardless of whether the
backend had stored it. It now clears only when the backend reports it persisted
the partial; otherwise the text stays visible until the next run starts.

**Steering was mutually exclusive with queueing.** `handleSendNow` operated on
the *draft*, and `isSendNowDisabled` included `Boolean(visibleQueuedMessage)` —
so a queued message could never be pushed through. You could queue, or steer,
never steer what you queued. Both now act on one pending item.

**Chat guest detection was reading a URL query param.** `useChatWorkspaceEffects`
derived guest status from `?guest=1`, set once at login by `GuestAccessPanel`.
Any navigation dropped it, so the guest notice and prompt-limit helper vanished
mid-session. It now reads `is_guest` from `/auth/me`, like
`AccountSettingsPanel` already did. `GuestAccessPanel` still appends `?guest=1`
on redirect; that param is now inert and could be removed.

## Deliberate design choices

**Effort levels are a closed enum** (`model/my-agents/capabilities.ts`). Every
level must render as a Korean label and a slider stop, so a level this build has
no word for cannot be displayed. If the backend adds one, parsing fails, the
query errors, and the controls hide — the composer keeps working. That is the
safe direction to fail in, and it is louder than rendering an unlabeled stop.

**Slider stops come from `supported_efforts` as served**, never from a constant
in the component, so a deployment offering fewer levels cannot desync the slider
from what the API accepts. `resolveReasoning` drops a stored effort that is no
longer offered, and downgrades a stored `pro` when the model cannot serve it —
both covered in `tests/reasoning-selection.test.ts`.

**Guests see locked controls rather than none.** They are clamped server-side
anyway; hiding the controls would imply the product lacks the feature rather
than that this session cannot use it.

**Effort is framed as deliberation time, not capability.** A seven-stop slider
named 끄기 → 최대 reads as a quality scale, which is the wrong mental model: the
same frontier model answers at every level, and `낮음` is still a very capable
answer. `chat.reasoningEffortNote` states this once, always visible under the
control, and the per-level hints describe *what kind of question each level
suits* rather than how hard the model is trying. An e2e assertion pins the note
in place, because it is the sort of line a later edit would quietly drop as
redundant. Keep that framing if you rewrite this copy.

## Still open

- Reasoning tokens count against the existing output ceilings, and codex
  deliberately did not raise them. `높음` and above can therefore hit the
  incomplete-response fallback. The UI does not warn about this yet — worth
  deciding whether the top two stops should say so.
- Replay inherits the original run's pair and has no UI. The backend accepts an
  override on replay if that is wanted later.
- `document_workspace.pro_supported` is served separately from `chat`. Only
  `chat` is consumed; attachment turns were out of scope.

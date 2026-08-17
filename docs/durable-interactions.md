# Durable interactions — frontend boundary

A *durable interaction* is a run that stops mid-answer to ask the user
something, persists that question server-side, and resumes when answered. The
first one is a document-source choice: the backend cannot tell which document an
ambiguous reference meant, so it asks instead of guessing.

This document is the frontend half of that boundary. Read it before touching
anything under `components/chat/interactions/`.

## Status

Implemented on `feature/durable-document-source-choice`, against the live
OpenAPI document from backend `feature/langgraph-checkpointer`. Dark in
production: both backend flags default off, and the composer is byte-identical
to before until `MY_AGENTS_CHECKPOINTER_ENABLED` is turned on.

Verified end to end in a browser on 2026-08-17 against persistence-enabled
Postgres: an ambiguous prompt raised the card, a hard reload rebuilt it from run
detail, choosing a document resumed and completed the same run with a citation,
and a second waiting run cancelled cleanly. Not yet exercised live: a second
interrupt within one run, a second page of options, and guest behaviour. See
`docs/implementation-log.md` for what that leaves open — notably the encoded
`interaction_id`, which only the paged options route carries.

## Hard rule: no Zod models from backend source

`AGENTS.md` already says frontend API models come from the backend's hosted
OpenAPI document, never from reading `../my-agents`. That rule is load-bearing
here specifically, so it is repeated:

> **Do not write or change a Zod model for interactions until a live backend
> OpenAPI URL has been provided for a branch that contains the interaction
> layer.**

The interaction envelope is a *versioned discriminated union*. The discriminator
values, the version field's name and shape, and the optionality of each member
are exactly the details a prose handoff rounds off — and a schema guessed from
prose parses the mocked happy path while rejecting the real payload. The
handoff at `/tmp/agent-handoff/langgraph-persistence-handoff-2026-08-17.md` is
adequate for *planning*. It is not a source for schemas.

The schemas here were written against the live document and the fixtures in
`tests/interaction-model.test.ts` mirror real payloads. If the contract moves,
refetch the OpenAPI document and update both together — do not patch a schema
from a failing response alone.

## What is here now

| Module | Role |
|---|---|
| `model/my-agents/interactions.ts` | The open union, derived from OpenAPI |
| `components/chat/run-state.ts` | Derived run phase and the three decisions over it |
| `components/chat/interactions/registry.ts` | `type` → renderer, with a fallback |
| `components/chat/interactions/*Card.tsx` | The document choice and the fallback |
| `components/chat/interactions/useInteractionOptions.ts` | Page accumulation |
| BFF allowlist + `isStreamPath` | Paths, including `resume/stream` |

`run-state.ts` holds **no state**. The phase is derived on every render from
streaming, the pending interaction, and the server run list — the existing
sources of truth. It exists so that "is the composer busy", "show a stop
button", and "may the queue drain" stop being three hand-rolled boolean
combinations that disagree about a suspended run. Do not add a reducer here; a
stored phase would be a second source of truth that can drift from the server.

## Two `run_interrupted` contracts, deliberately

This is the easiest thing to get wrong.

- The **SSE stream** emits `ConversationRunInterruptedResponse.model_dump()` —
  the same full body as the HTTP 202, with the nested `interaction` and its
  first page of options. `conversationRunInterruptedResponseSchema` parses it,
  strictly, with every contract-required field required.
- The **persisted activity event** (`GET .../runs/{run_id}/events`) carries a
  separate, simplified, redaction-safe payload:
  `runInterruptedActivityPayloadSchema`.

Keeping both means neither has to be loosened for the other. An earlier draft
made `reason_code` and `message_key` optional on the known schema to fit an
imagined thin SSE payload; that was wrong and was reverted. If you find yourself
relaxing the known v1 parser, check which of the two contracts you are actually
looking at first.

## Design rules to keep

**The union is open, unlike reasoning capabilities.** `model/my-agents/capabilities.ts`
uses closed enums because an unrenderable reasoning level should hide the
control — safe, because the composer still works. The opposite is true here: a
closed union means an unknown interaction type makes the *conversation*
unusable, because the run stays suspended and there is no card to cancel it
from. Parse unknown types into a fallback that still renders and still offers
dismissal.

**The fallback must never resolve to nothing.** `resolveInteractionRenderer`
uses `Object.hasOwn` rather than `registry[type] ?? fallback`: the type string
is backend-controlled, and a plain object answers `"constructor"` with an
inherited function that is not a component.

**Version support is enforced at three levels, and all three are needed.**
`schema_version` is an integer, not a semver string, and the supported value is
`INTERACTION_SCHEMA_VERSION`.

1. The known schemas (`documentSelectionInteractionSchema`,
   `documentSelectionOptionsPageSchema`, `conversationRunResumeRequestSchema`)
   use `z.literal`, not `z.number().int()`. The known branch is tried first in
   the union, so a permissive version field would let a v2 body parse as v1.
2. `isDocumentSelection` checks type **and** version **and** a structural field.
   Type alone is not enough: a v2 body parses through the unsupported branch and
   still calls itself `document_selection`, and Zod strips unknown keys, so such
   a body keeps its type while losing everything the card renders.
3. `handleChooseInteractionOption` gates on the same `isDocumentSelection`, so
   the card, the registry, and the submit handler share one support decision.
   Checking type alone there would answer a v2 question over the v1 contract.

`unsupportedInteractionSchema` stays version-permissive on purpose — it is the
branch that must accept anything, including the future, so the card can say so
and still cancel.

**`blocksNewRun` and `showsStopControl` are different sets.** A suspended run
blocks new runs but produces nothing, so it must not show a stop button. Folding
`waiting_for_input` into the existing single `isActiveAgentRunStatus` predicate
gets this wrong.

**The queue pauses; it does not drain.** The backend answers a new run in a
conversation holding an unanswered interaction with the *existing*
`conversation_run_already_active` 409 — there is no distinct code (confirmed
with the backend author, 2026-08-17). The client therefore cannot tell "busy"
from "waiting" from the error and must decide from run state.

**Cold load must reconstruct the pending interaction.** `GET /runs/{run_id}`
returns the waiting shape, so a refresh during a pending question rebuilds the
card from the run list rather than from stream events. `e2e/durable-source-choice.spec.ts`
has eight cases: seven depend on a pending interaction and one is flags-off
parity. Disabling the recovery effect fails **six of the seven** — the survivor
is the queue-paused case, which reads the waiting run from the run list rather
than from the rebuilt card, and the parity case must keep passing either way.

**Cancel must not clear the card before it succeeds.** The card is the only way
out of a suspended run. Clearing optimistically and then failing would leave the
backend run blocked with nothing on screen: the recovery effect keys on the
waiting run id and its detail, neither of which changes when a cancel request
fails, so it would never restore the card. Cancel therefore disables the card,
clears only on success, and surfaces localized copy on failure.

**Options are the backend's list; the frontend assembles nothing.** Backend
`b8ceb91` and `2172757` fix the source boundary: default chat still searches all
personal and group knowledge bases, an ambiguous document reference enters
retrieval in that default mode, and clarification counts *only* user-selectable
personal and group documents. System knowledge stays ambient — it never appears
as an option — and if exactly one selectable document exists the run resolves
automatically rather than asking, even when ambient system documents are also in
scope. A forged `document_id` on resume is rejected server-side.

Nothing in `components/chat/interactions/` reads a local document or knowledge
base list; every option comes from the response. Keep it that way. Filtering the
list client-side would duplicate a check that already exists where it counts and
would give a false sense that the boundary is enforced here — it is not, and it
should not be. Separately, `ChatWorkspace.tsx` already restricts the scope picker
to `purpose === "standard"` knowledge bases, so system sources are absent from
the user's own selection too.

**Expiry changes behaviour, not just copy.** Past `expires_at` the server
answers a resume with `run_interaction_expired`, so the card disables Choose and
pagination locally and keeps Cancel live. Nothing pushes an expiry event, and
the default window is 24 hours, so a local clock is the only way the UI learns.

## Rollout

Both backend flags (`MY_AGENTS_CHECKPOINTER_ENABLED`, `MY_AGENTS_MEMORY_STORE_ENABLED`)
default off, and the checkpointer flag is the one that produces interactions.
The frontend must render identically to today while it is off; that parity is
what makes the two pull requests independently mergeable.

Do not enable the checkpointer flag in any shared environment until the waiting
state is handled here. Agreed with the backend author on 2026-08-17 and recorded
in backend draft PR #4.

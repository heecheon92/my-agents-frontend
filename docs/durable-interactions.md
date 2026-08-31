# Durable interactions — frontend boundary

A *durable interaction* is a run that stops mid-answer to ask the user
something, persists that question server-side, and resumes when answered. The
first one is a document-source choice: the backend cannot tell which document an
ambiguous reference meant, so it asks instead of guessing.

This document is the frontend half of that boundary. Read it before touching
anything under `components/chat/interactions/`.

## Status

V1 and V2 are implemented on the current document-coverage PR. The V2 schemas
were refreshed from the live backend OpenAPI at `http://127.0.0.1:8017/openapi.json`
on 2026-08-31. V1 remains supported for already-waiting checkpoints.

The V1 flow was verified live in a browser on 2026-08-17. The V2 flow has mocked
browser coverage for cold recovery, select/refine request bodies, repeated
interrupts, stale-cache replacement, IME-safe Enter, focus restoration, broad
fallback, cancellation, and mobile geometry. The owner is performing the final
manual cross-repository E2E check.

## V2 resolution ladder

1. A unique exact title or filename continues automatically.
2. Otherwise the card renders the backend-ranked shortlist, never more than five.
3. Human input is the last choice: one line, at most 120 characters, resumed as
   `{kind: "refine"}` on the same run rather than sent as chat.
4. Two unresolved refinements unlock the broad authorized list and its opaque
   cursor. The frontend never constructs or filters that source universe.

Every refinement attempt has a fresh UUID, so a response from an earlier attempt
cannot append stale options. The run, selected KB scope, transcript, and original
expiry do not change. A repeated `run_interrupted` response is also written into
the run-detail query cache before invalidation; otherwise cold recovery can replace
the new card with the previous cached attempt.

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
  inline V1 options or V2 shortlist. `conversationRunInterruptedResponseSchema` parses it,
  strictly, with every contract-required field required.
- The **persisted activity event** (`GET .../runs/{run_id}/events`) carries a
  separate, simplified, redaction-safe payload:
  `runInterruptedActivityPayloadSchema`.

Keeping both means neither has to be loosened for the other. An earlier draft
made `reason_code` and `message_key` optional on the known schema to fit an
imagined thin SSE payload; that was wrong and was reverted. If you find yourself
relaxing a known parser, check which of the two contracts you are actually
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
`schema_version` is an integer, not a semver string. New interactions use V2;
the V1 literal stays supported only for already-waiting runs.

1. The known schemas (`documentSelectionInteractionSchema`,
   `documentSelectionOptionsPageSchema`, `conversationRunResumeRequestSchema`)
   use `z.literal`, not `z.number().int()`. Known branches are tried before the
   fallback, so a permissive version field would let a future body masquerade as V2.
2. `isDocumentSelection` checks type **and** version **and** a structural field.
   Type alone is not enough: a future body parses through the unsupported branch and
   still calls itself `document_selection`, and Zod strips unknown keys, so such
   a body keeps its type while losing everything the card renders.
3. `handleChooseInteractionOption` gates on the same `isDocumentSelection`, so
   the card, the registry, and the submit handler share one support decision.
   Checking type alone there would answer a future question over a supported contract.

`unsupportedInteractionSchema` stays version-permissive on purpose — it is the
branch that must accept anything, including the future, so the card can say so
and still cancel.

**`blocksNewRun` and `showsStopControl` are different sets.** A suspended run
blocks new runs but produces nothing, so it must not show a stop button. Folding
`waiting_for_input` into the existing single `isActiveAgentRunStatus` predicate
gets this wrong.

**Selection and refinement have different transitions.** Choosing a final
document clears the card immediately and lets the answer surface resume.
Refinement keeps the card mounted and disabled, with its Cancel action as the
release valve; the composer queue stays paused until a new interaction or an
answer arrives. A repeated `run_interrupted` response replaces the card and its
run-detail cache entry together. If resume fails and server truth still says
waiting, cold-load recovery restores the same attempt.

The backend resume stream begins with `run_resumed`, followed by actual
retrieval/graph progress and answer deltas. A transport that executes sync
resume to completion and replays the finished answer as fake deltas violates
this transition even if its final transcript is correct.

**The queue pauses; it does not drain.** The backend answers a new run in a
conversation holding an unanswered interaction with the *existing*
`conversation_run_already_active` 409 — there is no distinct code (confirmed
with the backend author, 2026-08-17). The client therefore cannot tell "busy"
from "waiting" from the error and must decide from run state.

**Cold load must reconstruct the pending interaction.** `GET /runs/{run_id}`
returns the waiting shape, so a refresh during a pending question rebuilds the
card from the run list rather than from stream events. `e2e/durable-source-choice.spec.ts`
covers cold recovery, both protocol versions, refinement, broad browsing,
failure recovery, layout, cancellation, and flags-off parity. Keep the recovery
and parity cases together when this surface changes.

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

**A resumed run continues one activity timeline.** `resumeInteraction` appends
to the live event list that the interrupted stream already filled rather than
starting a new one, so live event ids and their displayed ordinals must be
derived from that list — `appendLiveActivityEvent` numbers from `current`, and
no stream function owns a counter. The first version gave each stream its own
`liveSequence` starting at 0, so answering a question re-issued `live-1` and
React reported duplicate keys on the activity panel, free to drop or duplicate a
row. This is invisible until a run actually suspends, which is why it survived
the flags-off suite.

**A waiting run is not an active run for the events query.** An active run is
excluded from `latestRunEventId` because its stream is already filling the live
list. A waiting run is the opposite case and must not be folded into the same
exclusion: it is the one state that outlives its stream, so after a reload the
stored events are the only source the activity panel has. Excluding it left the
panel blank behind an open question. On resume, `seedLiveActivityEvents` carries
those stored events into the live list before the resume appends, because
`visibleActivityEvents` prefers a non-empty live list and would otherwise show
the resumed tail alone — permanently, since the completed run's full list lands
in the cache but never wins the ternary.

**Expiry changes behaviour, not just copy.** Past `expires_at` the server
answers a resume with `run_interaction_expired`, so the card disables Choose and
pagination locally and keeps Cancel live. Nothing pushes an expiry event, and
the default window is 24 hours, so a local clock is the only way the UI learns.

**The option list is bounded, and the list is what scrolls.** The card renders
inside the composer, which is absolutely positioned against the panel at
`bottom-0`, and the panel is `overflow-hidden`. An uncapped list therefore grows
the composer *upward* until it covers the transcript and then spills past the
panel's top edge, where it is clipped with nothing to scroll it back — measured
at 1049px of lost card on desktop and 1801px on a 390px phone with one full
backend page of up to 50 options. That is an ordinary ambiguous reference, not an edge
case, so the cap is not defensive polish.

The cap belongs on the `<ul>` (`data-slot="interaction-options"`), never on the
card: the title, the expiry notice and above all **Cancel** must stay pinned,
because a suspended run blocks the whole conversation and cancel is the release
valve. Bounding the card instead would scroll the one control that must never
become unreachable. `e2e/durable-source-choice.spec.ts` asserts both halves — the
card starting at or below the panel top at two viewports, and the list being the
element that overflows.

## Rollout

Both backend flags (`MY_AGENTS_CHECKPOINTER_ENABLED`, `MY_AGENTS_MEMORY_STORE_ENABLED`)
default off, and the checkpointer flag is the one that produces interactions.
The frontend must render identically to today while it is off; that parity is
what makes the two pull requests independently mergeable.

Do not enable the checkpointer flag in any shared environment until the waiting
state is handled here. Agreed with the backend author on 2026-08-17 and recorded
in backend draft PR #4.

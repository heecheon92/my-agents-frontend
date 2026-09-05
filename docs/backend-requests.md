# Backend requests

This file is the current, frontend-owned ledger of backend contract gaps. It
contains only actionable backend work and external verification gates. Full
historical rationale is preserved in
[`backend-requests-archive.md`](./backend-requests-archive.md).

Frontend work may inspect `../my-agents`, but must not edit backend code unless
the user explicitly authorizes backend scope. Frontend API models continue to
come from a running backend's served OpenAPI document, never from backend source
inspection or this ledger.

## Status legend

- **Proposed:** required contract or behavior is not implemented.
- **Active:** explicitly authorized implementation or evidence collection is underway.
- **Deferred:** waiting on a named environment, deployment, or dependency.
- **Shipped:** repository evidence confirms product behavior.
- **Completed:** non-product verification or documentation milestone is complete.
- **Canceled:** no longer requested; rationale remains in the archive.
- **Superseded:** replaced by another contract or design.

## Maintenance policy

- Keep each open backend gap in exactly one section below.
- Separate product implementation from deployment or live-evidence gates.
- When a request ships, update current frontend behavior documentation, move
  substantive rationale to the archive, and leave one concise resolved-index row.
- Dated deployment observations belong in release evidence or the archive, not
  in the active request description.
- Unknown or future backend fields must remain safely ignorable; a cosmetic
  metadata failure must never make an answer, interaction, or transcript unusable.

New requests use this compact shape:

```md
### Proposed: concise contract title

Priority: Immediate | Next | Later
Frontend need:
Current backend behavior:
Requested backend contract:
Why it matters:
Frontend workaround:
```

## Current requests

### Proposed: a way to continue without choosing a document

Priority: Later — the priority is a frontend assessment, not an owner decision.
See the open question at the end.

Frontend need: cancelling a pending clarification ends the turn with no
assistant reply. The frontend now labels that in the transcript, but a label is
a smaller thing than an answer.

Current backend behavior: cancelling a `waiting_for_input` run persists the
cancelled status and a `run_cancelled` event, and clears the interaction and
checkpoint. What it does not store is an assistant message, so the conversation
ends on the user's unanswered question. (Corrected 2026-09-05 — an earlier
draft of this entry said "stores nothing", which was wrong.)

Requested backend contract: **not** a change to what Cancel does. Backend Codex
is right that resuming the graph on Cancel would redefine stop as continue and
spend tokens the user just declined to spend; Cancel must stay terminal.

The gap is that the card offers only "pick one of these" or "stop", when a third
intent exists: *answer anyway, without a document*. That is a distinct choice
and belongs in the semantic interaction contract as an explicit decline or
continue-without-selection response, rendered as its own control beside Cancel.

Why it matters: the product's premise is that an answer explains itself. A turn
that simply stops is the one place that premise breaks. But the fix is a clearer
choice, not a quieter Cancel.

Frontend behavior, and it is not a workaround to retire:
`showsCancelledRunNotice` renders a transcript line derived from the run list,
so a cancelled turn is labelled rather than silent. It stays even if
continue-without-selection ships. Cancel remains terminal, so genuinely
cancelled turns keep happening and keep needing an explanation; only a turn that
produced a real assistant reply should suppress the notice, which the predicate
already does by requiring the last message to be the user's. (An earlier draft
of this entry said the notice should be "removed rather than stacked" when this
ships. That reads as deleting it globally on delivery, which would be wrong —
corrected 2026-09-05 after Backend Codex flagged it.)

**Open question for the owner, not for the backend.** Heecheon raised this as
one of two options — "notify the user, or forward the cancellation so the
assistant can generate a message" — and the notify half is implemented. He did
not ask for this half to be built, and the Later priority is a frontend
assessment rather than his instruction.

One thing worth settling before any work starts: a *deterministic* stored
acknowledgement would add nothing over what already ships, because the frontend
notice is already a deterministic acknowledgement, rendered without a round trip
or a token. This is only worth building if the reply engages with the question —
answering from general knowledge, or naming what it would have needed. If the
answer is "deterministic is enough", the correct outcome is to close this
request unbuilt.

## Deferred deployment and live-evidence gates

These do not require new backend product behavior. Refresh them against the
actual hosted environment before making a production-readiness claim.

- **Nickname and invitation signup OpenAPI:** confirm the deployed contract
  requires signup nicknames and serves invitation-token signup plus manager-only
  nickname roster fields.
- **Public visitor email lifecycle:** prove signup or guest request through real
  hosted delivery, verification, login, and session restore without dev outbox
  or seeded credentials.
- **Guest policy and limits:** confirm the deployed BFF allowlists
  `GET /auth/guest/policy`, hosted flags match intended delivery mode, and served
  limits rather than repository defaults drive visible copy.
- **Uploaded-file browser proof:** run the final hosted PDF/Markdown/Office
  upload and ingestion flow against the deployed nested knowledge-base routes.
- **Encoded interaction pagination:** carry an encoded compound interaction ID
  through the live BFF options route with enough candidates to require paging.
- **Citation attribution deployment:** confirm hosted run completion, resume,
  replay, and run detail expose `consulted_sources` with legacy `null` versus
  verified-empty `[]` semantics.

## Resolved, canceled, and superseded index

The archive preserves the original request, decisions, evidence, and dated
deployment observations.

### Shipped

- Nickname signup, invitation-token signup, and manager roster display.
- Invite-only group membership and non-creating role maintenance.
- V1 product endpoint and served OpenAPI baseline.
- Session-cookie, CSRF-header, logout, and credentialed-CORS contract.
- Base conversation SSE framing, answer deltas, completion, resume, failure,
  and cancellation behavior.
- Persisted run detail, newest-run ordering, citations, and provenance fields.
- Deterministic seed and backend-only local demo smoke.
- KB-scoped PDF, Markdown, text, and Office upload contracts.
- Typed, pre-redacted activity-event discriminated union.
- Public-signup disable switch.
- Guest request/login enforcement and unauthenticated guest-policy endpoint.
- System knowledge management capability, system KBs, and ambient retrieval.
- Machine-readable API error codes and localized frontend mapping.
- Guest-policy limits served from backend configuration.
- Answer-supported `citations` plus the `consulted_sources` superset and
  attribution-version semantics.
- Model-authored reasoning summaries, persisted recovery, and optional SSE
  deltas.
- Semantic trace display copy with the active reranker retained only in
  structured evidence.
- `reasoning_summary_delta` published as an `x-sse-events` OpenAPI extension on
  the run, resume, and replay stream operations. The frontend parser now matches
  that contract exactly and still drops a malformed delta rather than aborting
  the answer stream.
- Backend-owned per-stage operational summaries on `AgentTraceStep`: a
  `message_key` discriminated union at `schema_version` 1 with closed scalar
  parameters. The frontend words the sentence from those facts, so free-form
  backend prose is no longer the display path for a verified stage.

### Completed

- Percent-encoded compound interaction IDs are accepted by the backend and
  emitted correctly by the BFF; only the live paginated-through-proxy evidence
  gate remains deferred above.

### Canceled

- A dedicated `guest_access_disabled` error code: product copy intentionally
  avoids exposing the operational reason.
- New ingestion-progress backend work: the backend already supplied progress;
  the frontend had discarded it.

### Superseded

- Separate Group Knowledge V1 source-selection contract: replaced by unified
  `knowledge_base_selection` across personal and group knowledge bases.

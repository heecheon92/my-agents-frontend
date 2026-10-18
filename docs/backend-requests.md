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

### Active: private document originals, preparation modes, retrieval priority

Status: implemented on both sides and verified against an isolated local
backend and the real development bucket; not deployed. Agreed with Backend
Codex on 2026-10-18; frontend models were checked against the served OpenAPI.

Contract the frontend consumes:

- `GET/PATCH /assistant/preferences` gains `document_retrieval_priority`
  (`always` | `automatic` | `on_request`) and `document_ingestion_mode`
  (`standard` | `ai_assisted`). PATCH fields are optional with no schema
  default; omitted fields are preserved; explicit `null` is `422`. Guests read
  `automatic` and `standard` and cannot change them.
- `on_request` searches documents when the send is scoped to chosen sources
  or the question explicitly asks for documents; an explicit "no documents"
  instruction wins.
- Health `frontend_config.documents` serves `direct_uploads`,
  `max_upload_bytes`, `multipart_max_bytes`, `allowed_extensions`,
  `ai_assisted_ingestion`. Direct uploads are off for previews and guests.
- `POST /knowledge-bases/{kb}/documents/uploads` (initiate, `201` receipt with
  a signed PUT), `.../refresh`, `.../complete` (`201`, idempotent,
  `{document, extraction_run | null}`), `DELETE .../uploads/{id}` (`204`).
  Multipart routes accept an optional `ingestion_mode`.
- `GET /documents/{id}/original` returns `{url, expires_at, filename}`; the
  signed GET sets a UTF-8 `filename*`.
- `POST /documents/{id}/reprocess {ingestion_mode?}` returns `202` with a run.
  It is never retried automatically.
- Documents gain `ingestion_mode`, `original_retained` (false for every legacy
  document), `processing_provenance` (warnings are stable codes), and
  `processed_at`. Runs gain `error_code`.
- Codes with copy: `storage_unavailable`, `storage_quota_exceeded`,
  `upload_expired`, `upload_in_progress`, `upload_integrity_mismatch`,
  `upload_not_ready`, `upload_too_large`, `original_unavailable`,
  `reprocess_in_progress`, `document_processing_*`,
  `document_changed_during_processing`, and the client-side
  `direct_upload_failed`.

Remaining: hosted bucket CORS for the exact deployed frontend origins, and a
hosted verification pass.

### Active: recoverable server-owned answer generation

Status: **implemented on both sides, verified against a local backend; not
deployed.** The contract below was frozen on 2026-10-17. Both sides then
implemented it. The frontend was verified against the backend's locally
served OpenAPI and its running worker; see `docs/implementation-log.md`.
Hosted verification and enablement are still open. The original freeze note
follows.

Original status: **agreed contract, in contract freeze; not implemented, not served.**
Frontend Claude and Backend Codex agreed this on 2026-10-17, at the owner's
request to work on the feature together. Implementation follows this contract
once it is frozen. Commits, pushes, merges, and deployments each need separate
owner authorization.

Frontend API models are generated from the backend's served OpenAPI. During
development, a local backend server serving it is enough (see `AGENTS.md`), and
mocked frontend work can start against the frozen contract before then.
Enabling the feature in production waits for the deployed OpenAPI plus the
capability and readiness gates. This entry is
never a source for generated models.

The matching backend plan is `../my-agents/docs/plan/durable-answer-generation.md`
(backend-owned, read-only from this repo).

Priority: Next. The owner asked for the feature.

Frontend need: an answer keeps generating after the browser disconnects. A
refresh or restart shows the saved partial answer and keeps receiving the rest.

Current backend behavior: the normal, resume, and replay stream handlers run
the generation inside the request. When the BFF loses the browser, it closes
the upstream connection, and those paths treat that as cancellation. Run detail
covers only completed and waiting runs.

Current frontend behavior:
- The BFF allowlists only the three POST streams in `isStreamPath`. It drops
  query strings and does not forward `Last-Event-ID`.
- `useChatRunLoop` reconciles a drop before admission by `client_request_id`
  and never resends.
- After admission, a drop only refreshes data and shows an error. Nothing
  reattaches to the running answer.

Requested backend contract (additive; the existing sync and stream APIs stay
backward compatible):

- **Opt-in flag (final, owner decision 2026-10-17).** `GET /health` serves
  `frontend_config.durable_runs` as `{enabled, ready}`, both required.
  `enabled` is the operator flag `MY_AGENTS_DURABLE_RUNS_ENABLED`, default
  `false`. `ready` is `enabled` plus a fresh worker heartbeat. With `enabled`
  true, new answers and regenerations are durable. With no worker ready,
  admission returns `503 durable_runs_unavailable`, and there is never a
  silent legacy fallback. With `enabled` false or absent, they use the exact
  legacy routes. Existing runs are recovered and resumed by `execution_mode`,
  independent of the flag. (The flag was briefly removed earlier the same day
  and then restored.) Intended use: off on the Render deployment, which runs
  no separate worker service; on for local testing.
- **Admission:** `POST /conversations/{cid}/runs/async`.
  - Takes the existing run request body; `client_request_id` is required.
  - Atomically queues durable work and returns `202 {run_id, conversation_id,
    status, client_request_id}`.
  - The idempotency key is scoped per authenticated user and operation kind.
    The same key with the same normalized payload and scope returns `202` with
    the same ids and the run's CURRENT status (not the original `queued`),
    whatever the run's state.
  - The same key with a different payload, scope, or conversation returns `409
    run_request_id_conflict`. The database decides between concurrent retries.
  - A new request while another run is active keeps the existing `409
    conversation_run_already_active`.
- **Snapshot:** `GET /conversations/{cid}/runs/{rid}/output` returns an atomic
  recovery snapshot with these fields:
  - `schema_version`: `1`.
  - `run_id`, `conversation_id`, `client_request_id`, `status`, `cursor`.
  - `partial_reply`: the aggregate of committed `answer_delta` text for the
    same logical run across all phases. Interaction prompts stay in
    `interaction` and are never concatenated into it. A replayed provider
    prefix is never appended twice. The final canonical `result` replaces it.
  - `reasoning_summaries`.
  - `activity_events`: replayable, display-safe envelopes `{id, event, data}`,
    where `id` is the delivery cursor. They never contain hidden reasoning or
    raw provider errors.
  - `interaction`: the same open union as the run list.
  - `result`: the existing completion payload when the run is complete.
  - `error`: `null` or `{code: string, detail: string}`, where `detail` is
    safe, allowlisted text.

  The backend persists the output projection and the cursor together, and keeps
  a separate, bounded delivery ledger. It does not expand the audit-event enum.
- **Listener:** `GET /conversations/{cid}/runs/{rid}/stream`.
  - An authorized SSE subscription only; it never starts or cancels work.
  - Emits the existing event names with their own route-specific
    `x-sse-events` schemas, plus an SSE `id` that is a monotonically increasing
    delivery cursor, independent of `answer_delta.sequence`.
  - `run_failed` on this route is a new payload, `{run_id, conversation_id,
    status: "failed", code, detail}`, and `worker_lost` is one of its stable
    codes. These fields are not added to the existing `AgentEventModel` audit
    payloads or the legacy stream schemas, so the frontend parses this route
    with its own event schemas.
  - `run_completed` carries the full existing `ConversationRunResponse`
    (reply, citations, `consulted_sources`, coverage, summaries, artifacts).
    It is identical to `snapshot.result` and is sent only after the commit. No
    refetch is required.
  - `run_cancelled` is `{run_id, conversation_id, status: "cancelled",
    partial_reply_persisted: false}`. The flag means no completed assistant
    message was written to the transcript. A bounded partial projection may
    remain in `/output`, but it is never a completion.
  - `run_interrupted` carries the full existing
    `ConversationRunInterruptedResponse` (`run_id`, `conversation_id`, the
    waiting status, `assistant_model`, and the semantic interaction), not the
    smaller audit-event payload.
  - Every delivery cursor is the SSE `id` line. None of them appears inside the
    JSON data.
  - The cursor arrives as `?after=N` or as `Last-Event-ID`. Both are
    non-negative integers; absent means `0`. If both are sent and disagree, the
    response is `400 invalid_stream_cursor`.
  - A malformed cursor, or one ahead of the run's output, also returns `400
    invalid_stream_cursor`. An expired cursor returns `410
    run_output_cursor_expired`; the client refetches the snapshot and
    reconnects.
  - A subscription to a run that has already ended replays the events after the
    cursor, emits the terminal event, and closes. If the client has already
    seen the terminal event, the server may send it again as an idempotent
    close signal; it never repeats transcript text.
  - Heartbeat comments are sent about every 15 seconds.
  - Several subscribers may watch one run.
  - Only `POST .../cancel` stops a run, including a queued one.
- **Status:** the run list includes durable runs in every status, with their
  `client_request_id`. The statuses are `queued`, `running`,
  `waiting_for_input`, `cancelling`, `completed`, `failed`, and `cancelled`. A
  lost worker ends the run as a failure with the stable code `worker_lost`. It
  never stalls silently or pretends the model call continued. The existing
  detail contract for completed and waiting runs is unchanged; the run list
  plus `/output` cover every status.
- **Resume and replay:**
  - Resume: `POST /conversations/{cid}/runs/{rid}/resume/async`, with body
    `{client_request_id: UUID, answer: <existing semantic resume request>}`. It
    continues the same run. Delivery ids stay globally monotonic and the cursor
    never resets. A retry with the same key returns the original receipt with
    the current status, even after completion. A different key against a stale
    interaction stays `409` under the existing contract.
  - Replay: `POST /conversations/{cid}/messages/{mid}/replay/async`, with body
    `{client_request_id: UUID, request: <existing ConversationReplayRequest>}`.
    It creates a new run and is the explicit "regenerate" action.
  - Both return the same receipt as admission and use the same `/output` and
    `/stream` listeners. Operation keys are scoped per user and operation kind,
    and the same key with a different payload is rejected. The legacy paths
    that cancel on disconnect are never used for a durable run.
- **`run_interrupted`:** ends the subscription phase, not the run. A
  subscription to a `waiting_for_input` run emits or repeats the durable
  `run_interrupted` control event and closes. Only an explicit successful resume
  starts a new subscription. Terminal and control states are idempotent even
  when their delivery id was already acknowledged, and they never add duplicate
  text.
- **Commit ordering:** the final message and citations are committed before the
  terminal event is delivered.
- **Terminology:**
  - "Reconnect" (이어 보기) means reattaching to the same run's output.
  - "Regenerate" (다시 생성) means a new run.
  - "Stop" (중지) means cancel.

Frontend rules once the contract is served:

- The snapshot replaces client state. The stream then appends only ids greater
  than `cursor`; a repeated id is dropped. When the run is complete, the
  canonical `result` wins over the streamed text.
- A terminal event still ends the subscription when its id is at or below the
  cursor. Its content is not re-applied, but it is honored as the close signal.
  Dropping it as a duplicate would turn the server's idempotent close into a
  reconnect loop. A snapshot whose status is already terminal needs no
  subscription at all.
- A `waiting_for_input` snapshot, or a `run_interrupted` event, stops automatic
  reconnect and renders the interaction. Only a successful resume subscribes
  again.
- `run_completed` is applied directly as the canonical result, with no refetch.
- On `run_cancelled`, the partial text the user already read stays on screen.
  It is labelled as stopped, never presented as a completed answer, and the
  existing cancelled-run notice still applies. After a reload, a partial
  projection in `/output` gets the same treatment when present; when it is
  absent, only the notice shows.
- A stream that closes without a terminal or phase-ending event triggers a
  reconnect with the last id. This is the normal path, because Vercel function
  limits will cut long streams.
- The BFF adds the GET listener to the allowlist and `isStreamPath`, forwards
  only an integer `after` query parameter, and forwards `Last-Event-ID`.
  `POST .../runs/async`, `.../resume/async`, and `.../replay/async` are
  allowlisted as CSRF-protected mutations. They return JSON receipts, so they
  are not stream paths.
- `worker_lost`, `run_request_id_conflict`, `run_output_cursor_expired`,
  `invalid_stream_cursor`, and unknown codes map to safe Korean copy. Raw errors
  are never shown.
- The interaction invariants in `docs/durable-interactions.md` still hold. The
  `snapshot.interaction` field rebuilds a pending question on a cold load, and
  an unknown type or version still renders a card that can cancel.

Frontend acceptance cases:

- Unit tests:
  - The BFF allows the GET listener, forwards only a non-negative integer
    `after`, drops other query parameters, forwards `Last-Event-ID`, and never
    buffers the stream.
  - The parser tracks the cursor, and ids at or below it are dropped.
  - The snapshot merged with the remaining stream equals one continuous stream.
  - A subscription after the run ended yields the terminal event and stops.
  - `410` refetches the snapshot and reconnects. `400` and `409` surface safe
    copy without a retry loop.
  - A repeated admission with the same `client_request_id` resolves to the same
    run.
  - With the flag on and no worker ready, a send shows
    `durable_runs_unavailable` copy, is not retried, and never reaches a
    legacy route. With the flag off or absent, a send and a regeneration use
    the legacy routes and never touch `runs/async` or `replay/async`.
  - A repeated terminal event at or below the cursor closes the subscription
    without a reconnect and without duplicate text.
  - A `waiting_for_input` snapshot and a `run_interrupted` event both stop
    reconnect. Resume re-subscribes after the same cursor.
  - The durable `run_failed` payload parses with its route schema, and
    `worker_lost` maps to safe copy.
- End-to-end tests (mocked backend):
  - A reload mid-answer shows the partial answer and keeps streaming.
  - A dropped connection reattaches with no duplicate text.
  - Stop stays stopped after a reload.
  - Reopening after completion shows the final answer and its citations.
  - A suspended interaction is rebuilt on a cold load, and resume continues the
    same cursor.
  - Two tabs on one run both receive the full output.
  - A `worker_lost` run shows its failure state instead of spinning.
- Joint tests (real BFF against a local backend, before any hosted release):
  - Closing the browser subscription mid-generation still produces exactly one
    saved answer.
  - Killing the worker produces a safe `worker_lost` failure, never a duplicate
    provider call.
  - New failures are reported separately from the existing
    `conversation-list.spec.ts:188` failure and the intermittent
    `transcript-autoscroll.spec.ts:43` failure.

Resolved during contract review (2026-10-17):

1. `run_interrupted` ends the subscription phase: see the `run_interrupted`
   bullet above.
2. `partial_reply` accumulates across phases: see the snapshot fields.
3. `error` and the durable `run_failed` shapes are fixed above. The exact
   schemas freeze with the OpenAPI publication.
4. A repeated admission returns the current status with `202`.
5. The async resume and replay routes, bodies, and receipts are fixed above.
6. The durable `run_completed`, `run_cancelled`, and `run_interrupted` payloads
   are fixed above. With that, the coordination contract is aligned.

Remaining backend decisions, none of which block the frontend contract:

1. **Retention bounds:** the frame retention period, byte limits, and terminal
   replay retention. The frontend's only dependency is that `410` always
   leaves a recoverable snapshot.
2. **Worker readiness:** resolved. `durable_runs.ready` reports availability,
   and admission refuses with `503 durable_runs_unavailable` when the flag is
   on and no worker is ready.

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
- Optional `client_request_id` on the run request, run summary, and
  `run_started`, used to reconcile a send whose connection dropped before
  acknowledgement by exact ID rather than message text. The conversation
  continuity contracts landed with it: summarization-model preferences and
  catalog, `MessageResponse.attachments`, workspace retention fields, context
  compaction events, `run_model_resolved`, and the V2 `attachment_selection`
  interaction with `access`.

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

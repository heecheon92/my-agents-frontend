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

None. Both contracts previously listed here — the published
`reasoning_summary_delta` SSE schema and backend-owned per-stage operational
summaries — shipped on 2026-09-02 and are recorded below. The archive keeps
their original rationale.

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

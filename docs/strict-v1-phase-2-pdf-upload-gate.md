# Strict V1 Phase 2 frontend file upload gate

Date: 2026-05-20; refreshed 2026-05-21
Frontend repo: `/Users/heecheonpark/Git/my-agents-frontend`
Backend contract source: backend commit `ef88553` plus generated OpenAPI from `my_agents.api.create_app().openapi()` because the already-running local server still served the pre-Phase-2 contract.

## Gate decision

Frontend Phase 2 is **implemented for the additive upload contract** while preserving the existing seeded JSON text-document V1 flow.

The backend-owned contract now exposes:

- `POST /documents/upload`
- multipart form fields: `title`, `file`, optional `group_id`, optional `knowledge_base_id`
- V1 file support: PDF, text-based parser behavior owned by backend
- `DocumentResponse` source metadata: `source_type`, `source_filename`, `source_content_type`, `source_byte_size`, `source_sha256`, `source_page_count`, `parser_name`
- `CitationResponse` provenance: optional `source_page`, optional `source_filename`

## Frontend changes verified

- BFF allowlist accepts `POST /documents/upload`.
- Same-origin mutation policy accepts `multipart/form-data` while still rejecting simple form content types such as `application/x-www-form-urlencoded`.
- Next route handler forwards mutation bodies as bytes so multipart upload boundaries and file bytes are not stringified.
- Document API adds `upload()` using `FormData` without setting a manual JSON content type.
- Document UI adds a PDF/Markdown/plain-text upload form alongside the existing JSON text-document form.
- Document list displays backend source metadata for PDF/text documents.
- Citation panel shows backend-provided source filename and page when present, while keeping document id fallback for old citations.

## Remaining gates for public portfolio demo P0

- The hosted or local backend used for final evidence must expose the Phase 2 upload contract in its active OpenAPI/runtime. This frontend doc does not claim that any currently running backend instance has been restarted or deployed.
- Final browser evidence should upload a supported PDF, Markdown, or plain-text file through the product UI, ingest it, and show source metadata/citations. If the launch gate intentionally uses the JSON text-document fallback instead, record that fallback and reason in `docs/public-demo-release-runbook.md` evidence bundle fields.
- Keep accepted content types, file-size limits, parser failure behavior, and provider/runtime failures backend-owned; the frontend should surface safe errors rather than inventing unsupported behavior.

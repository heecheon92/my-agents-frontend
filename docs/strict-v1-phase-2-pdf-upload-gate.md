# Strict V1 Phase 2 frontend PDF upload gate

Date: 2026-05-20
Frontend repo: `/Users/heecheonpark/Git/my-agents-frontend`
Backend contract source: backend commit `ef88553` plus generated OpenAPI from `my_agents.api.create_app().openapi()` because the already-running local server still served the pre-Phase-2 contract.

## Gate decision

Frontend Phase 2 is **implemented for the additive PDF upload contract** while preserving the existing seeded text-document V1 flow.

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
- Document UI adds a PDF upload form alongside the existing JSON text-document form.
- Document list displays backend source metadata for PDF/text documents.
- Citation panel shows backend-provided source filename and page when present, while keeping document id fallback for old citations.

## Remaining gate

The live backend server at `http://127.0.0.1:8000/openapi.json` still served the old contract during this frontend pass. Final browser PDF-upload smoke should be rerun after restarting/deploying the backend at commit `ef88553` or later.

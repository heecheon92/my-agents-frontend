# Frontend Architecture

This document explains how the frontend is organized so future agents can work without rediscovering the design.

## High-level flow

```mermaid
flowchart LR
    Browser[Browser UI] --> Hooks[TanStack Query hooks]
    Hooks --> Services[services/my-agents]
    Services --> BFF[Next route handler BFF]
    BFF --> Backend[FastAPI backend ../my-agents]
    Backend --> DB[(Backend database)]
```

Browser components do not call the FastAPI backend directly. They call same-origin frontend BFF routes through typed services. The BFF centralizes cookie forwarding, CSRF injection, allowlisting, and safe error behavior.

## Folder map

| Path | Purpose |
| --- | --- |
| `app/` | Next.js App Router pages, layouts, providers, and route handlers. |
| `app/api/my-agents/[...path]/route.ts` | Same-origin BFF for approved backend routes. |
| `components/ui/` | Generic shadcn/Base UI-style primitives. |
| `components/` | App-specific product components and surfaces. |
| `components/chat/` | Ask workspace subcomponents: conversation list, transcript, message bubble, evidence panel, knowledge selector, and composer. |
| `constants/` | API paths, query keys, HTTP/header constants. |
| `model/my-agents/` | Zod schemas and inferred TypeScript types for backend contracts. |
| `services/my-agents/` | Typed service classes that call the BFF. |
| `server/my-agents/` | Server-only BFF config, cookies, and proxy policy. |
| `providers/` | Cross-app providers, currently TanStack Query. |
| `hooks/` | TanStack Query hooks for each product domain. |
| `tests/` | Vitest regression tests for contracts and BFF policy. |
| `docs/` | Handoff, architecture, runbook, backend requests, and implementation log. |
| `DESIGN.md` | Active design/theme contract for UI, layout, component states, and visual decisions. |
| `.agents/skills/responsive-design/SKILL.md` | Required responsive workflow for UI/layout changes. |
| `localization/` | Korean and English UI copy dictionaries; no user-visible component strings should be hardcoded. |

## Route groups and UI surfaces

| Route | Component | Notes |
| --- | --- | --- |
| `/` | `app/page.tsx` | Marketing/landing entry point. |
| `/login` | `components/AuthPanel.tsx` | Login through BFF `/auth/login`. |
| `/signup` | `components/AuthPanel.tsx` | Signup parses the backend `SignupResponse` envelope and shows an account-created handoff before login. |
| `/chat` | `components/ChatWorkspace.tsx` + `components/chat/*` | Anchor Ask journey. Uses conversations, messages, streamed answers, citations near assistant replies, a compact top-of-chat source selector, and collapsed response evidence/work history. |
| `/knowledge` | `components/AdminSurfaces.tsx` | Knowledge journey root. Uses a source-space tree + source table shell, shadcn/Base UI dialogs for add flows, and keeps row-level permission/deletion controls in per-source Manage dialogs. |
| `/knowledge/[sourceId]` | `components/AdminSurfaces.tsx` | Addressable selected knowledge route. The segment may be a knowledge-base ID or group ID; refresh preserves the selected space/group instead of resetting to the first available item. |
| `/documents` | `next/navigation` redirect | Legacy compatibility path that redirects to `/knowledge` so old links land on the merged Sources workflow. |
| `/groups` | `components/AdminSurfaces.tsx` | “Teams” journey. Manages shared knowledge requests and keeps raw ID-based member controls in Advanced disclosure. |

All service routes live under `app/(service)/layout.tsx`, which renders `ServiceShell` and restores auth through `/auth/me`.

## Data and typing layers

```mermaid
flowchart TD
    Model[model/my-agents Zod schemas] --> Services[services/my-agents classes]
    Constants[constants/api-path + query-keys] --> Services
    Services --> Hooks[hooks/use-*]
    Hooks --> Components[components]
    Components --> Pages[app route pages]
```

When adding or changing a backend-backed feature:

1. Add or update the Zod schema in `model/my-agents/`.
2. Add or update `constants/api-path.ts` and `constants/query-keys.ts`.
3. Add a method to the matching service class in `services/my-agents/`.
4. Add or update a TanStack Query hook in `hooks/`.
5. Build the UI in `components/` and route page in `app/`.
6. Add tests for path/query/parser/security behavior when relevant.

## Endpoint coverage

The BFF allowlist currently covers:

- `GET /health`
- `POST /auth/signup`
- `POST /auth/verify-email`
- `POST /auth/login`
- `POST /auth/password-reset/request`
- `POST /auth/password-reset/confirm`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /conversations`
- `GET /conversations`
- `GET /conversations/{conversation_id}`
- `POST /conversations/{conversation_id}/messages`
- `GET /conversations/{conversation_id}/messages`
- `POST /conversations/{conversation_id}/runs`
- `GET /conversations/{conversation_id}/runs`
- `POST /conversations/{conversation_id}/runs/stream`
- `GET /conversations/{conversation_id}/runs/{run_id}`
- `GET /conversations/{conversation_id}/runs/{run_id}/events`
- `POST /groups`
- `GET /groups`
- `GET /groups/{group_id}`
- `POST /groups/{group_id}/invitations`
- `GET /groups/{group_id}/invitations`
- `PATCH /groups/{group_id}/invitations/{invitation_id}`
- `POST /groups/{group_id}/invitations/{invitation_id}/resend`
- `DELETE /groups/{group_id}/invitations/{invitation_id}`
- `POST /group-invitations/accept`
- `GET /groups/{group_id}/members` for owner/admin member role maintenance only
- `PATCH /groups/{group_id}/members/{user_id}` for already-active member role updates only
- `POST /knowledge-bases`
- `GET /knowledge-bases`
- `GET /knowledge-bases/{knowledge_base_id}`
- `POST /knowledge-bases/{knowledge_base_id}/documents`
- `GET /knowledge-bases/{knowledge_base_id}/documents`
- `POST /knowledge-bases/{knowledge_base_id}/documents/upload`
- `POST /knowledge-bases/{knowledge_base_id}/documents/{document_id}/ingest`
- `POST /knowledge-bases/{knowledge_base_id}/documents/{document_id}/ingest/async`
- `GET /knowledge-bases/{knowledge_base_id}/documents/{document_id}/extraction-runs`
- `GET /knowledge-bases/{knowledge_base_id}/documents/{document_id}/extraction-runs/{run_id}`
- `POST /documents`
- `POST /documents/upload`
- `GET /documents`
- `GET /documents/{document_id}`
- `DELETE /documents/{document_id}`
- `POST /documents/{document_id}/ingest`
- `GET /documents/{document_id}/extraction-runs`

`POST /assistant/chat` is intentionally excluded from product BFF use. The current product UI prefers the KB-nested document routes above; legacy document routes remain allowlisted for existing detail/delete compatibility and older clients, not as the primary upload/create/ingest journey.

## Design approach

`DESIGN.md` is the active design/theme contract. UI work should treat it as the source of truth for brand personality, color, typography, spacing, radius, component states, accessibility, responsive behavior, and content voice.

Before changing UI/theme/layout code:

1. Read the relevant `DESIGN.md` sections.
2. Reuse existing `components/` and `components/ui/` primitives first.
3. Apply `.agents/skills/responsive-design/SKILL.md`: mobile-first defaults, fluid type/spacing, container-query-ready reusable panels, overflow protection, and touch-target checks.
4. Map new visual values back to `DESIGN.md` tokens or add/update an explicit design note.
5. Keep user-visible strings in `localization/ko.json` and `localization/en.json`.
6. Record substantial visual workflow changes in `docs/implementation-log.md`.

The UI should stay polished but not noisy:

- Use readable spacing, generous body text, and clear empty/error/loading states.
- Keep Ask/chat as the primary product anchor surface.
- Treat source setup as one mental model: sources live inside source spaces and then power cited answers; avoid sending users across pages for first-run source creation.
- On `/knowledge`, keep the default layout review-first: source spaces are chosen from the tree/sheet, source rows are scanned in the table, creation/upload forms open in dialogs, and per-source grant/delete/retry-preparation operations live in each row's Manage dialog instead of a persistent selected-item panel.
- Keep admin surfaces honest and usable even when backend contracts are ID-based, but hide raw IDs in Advanced disclosure by default.
- Prefer `components/` extraction over large route-page component trees.

## Assistant output rendering

Assistant-authored chat content is rendered through `components/AgentMessageRenderer.tsx`, which currently delegates Markdown strings to `components/AgentMarkdown.tsx`. User-authored messages stay plain text by default.

Supported Markdown is intentionally compact for chat bubbles: paragraphs, headings, strong text, unordered/ordered lists, inline code, code blocks, and safe external links. Raw HTML is not enabled; do not add `rehype-raw`, `dangerouslySetInnerHTML`, executable diagram specs, or arbitrary chart JavaScript. Future chart/graph/diagram/table/tool-result cards should enter through the `AgentArtifact` boundary with backend-validated JSON contracts before any rich renderer is added.

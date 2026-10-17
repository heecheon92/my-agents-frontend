---
name: react-ui-ux
description: "Use when designing, implementing, or reviewing React/Next.js interfaces using personal UI/UX principles, including responsive initial paint, stable async boundaries, size-matched skeletons, authoritative query hydration, accessible mutations, and optional Next.js behavior."
---

# React UI/UX Workflow

Use these personal principles for React UI work in the target project. Apply the core rules on every task, then read only the references relevant to the change.

## Applicability

Follow the target repository's instructions and actual design, data, and component contracts. Examples illustrate these personal principles; component names, service APIs, query keys, copy, and cache durations are not project defaults. TanStack Query examples use v5-style APIs (`isPending`, `gcTime`, `fetchStatus`, `dataUpdatedAt`); confirm the installed version and reuse tested project helpers. Apply Server/Client Component and `loading.tsx` guidance only to a compatible Next.js router. Adapt checks to the task's permitted scope and report anything not exercised.

## Goal

Make the interface react immediately to user intent while remaining honest about unresolved server state.

The default experience is:

1. stable chrome paints immediately,
2. the user's selection or open action is reflected synchronously,
3. unresolved values use shape-matched Skeletons,
4. server-dependent mutations remain fail-closed,
5. failures stay in context with Retry,
6. fresh authoritative success hydrates an editor exactly once,
7. background refresh never destroys context or overwrites active edits.

Fast does **not** mean optimistic fabrication. Preserve useful structure while the authoritative value is unknown.

## Inspect Before Editing

Read, in order:

1. the nearest repository instructions, route PRD, and design/source map,
2. the component tree from layout or provider to leaf,
3. query ownership and query keys,
4. list DTO versus detail DTO,
5. mutation payload and invalidation behavior,
6. localization and shared class/Skeleton primitives,
7. existing focused tests.

Identify:

- what is static and known immediately,
- what comes from list or summary data,
- what requires authoritative detail,
- which fields feed mutations,
- which component owns loading and error states,
- what unmounts during a selection or query transition.

Never infer that summary data is complete detail data. Reuse existing project patterns and never invent product behavior.

## Core Rules

- Keep stable page shells, navigation, lists, tabs, selection, scroll position, and local state mounted during reads.
- Put pending and error states at the smallest visible region owned by the query.
- Render known labels, headings, controls, and layout immediately. Replace only unresolved values or rows with size-matched Skeletons.
- Keep loading, empty, error, retained background refresh, and fresh success as distinct states.
- Open sheets and drawers synchronously. Load authoritative detail inside the already-open overlay.
- Never authorize Save, Delete, Replace All, credential, permission, or relationship mutations from cached, partial, fetching, paused, or summary data.
- Gate every mutation in both the UI control and the mutation function. Fail closed.
- Hydrate an editable draft once from fresh authoritative data for the current identity. Never overwrite active edits during background refresh.
- Keep errors in the failed region with Retry and preserve surrounding context.
- Use native forms, associated labels, keyboard submission, accessible errors, and disabled pending controls.
- Localize user-facing copy and follow the target route's established dimensions, classes, and design evidence.
- Avoid speculative memoization. Prevent repeated quadratic lookup, unbounded retained collections, and avoidable work in nested render loops.
- Validate meaningful behavior in the rendered route, including pending, error, Retry, and success.

## Reference Routing

Read only the references whose trigger matches the task:

- Read [Async UI Boundaries](references/async-ui-boundaries.md) when changing loading, Skeletons, lists, tables, cards, master-detail layouts, retained results, or performance-sensitive rendering.
- Read [Authoritative Detail and Mutations](references/authoritative-detail.md) when changing overlays, editable detail, draft hydration, permissions, credentials, destructive actions, or complete-replacement mutations.
- Read [Client Query Policy](references/query-policy.md) when changing TanStack Query defaults, freshness, retention, invalidation, cached data, paused requests, or authenticated cache boundaries.
- Read [Forms, Accessibility, and Next.js](references/forms-accessibility-nextjs.md) when changing forms, accessibility, localization, Server or Client Components, route loading, hydration, or URL-backed selection. The Next.js section applies only when the project uses Next.js.
- Read [Browser Validation](references/browser-validation.md) before completing meaningful UI behavior changes or reviews.

A task may require several references. Do not read `references/forms-accessibility-nextjs.md` merely because the project uses React; read its Next.js guidance only when Next.js is present or the task changes framework boundaries.

## Completion Gate

Before declaring done:

- user intent is reflected synchronously,
- stable shell and list DOM remain mounted,
- Skeletons match final geometry,
- loading, empty, error, and success are distinct,
- initial errors are retryable in context,
- cached or paused success cannot authorize mutations,
- fresh detail hydrates once per selection,
- background refresh cannot overwrite edits,
- mutation functions fail closed,
- keyboard submission, localization, and accessibility work,
- focused checks, production build, and browser QA cover the changed behavior.

Report any live-data or visual case that could not be exercised.

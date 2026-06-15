# Next Component Boundaries

This document defines the default Server Component / Client Component boundary rule for Next.js App Router work in this repo.

## Default Rule

Prefer Server Components by default.

Add `"use client"` only at the deepest component that actually needs client-only behavior, such as:

- browser event handlers (`onClick`, `onChange`, keyboard handlers);
- React state/effects/hooks that require the browser;
- `usePathname`, `useRouter`, `useParams`, or other client navigation hooks;
- TanStack Query hooks, `useLocalization()`, auth hooks, onboarding state, or shared client context providers;
- shadcn/Base UI primitives, dialogs, drawers, sheets, or overlays that require client interaction.

Do not mark a route page, route layout, or broad screen wrapper as a Client Component only because one child needs interactivity. Extract the interactive child instead.

## Why This Matters

A broad `"use client"` boundary can push too much of a route into the client bundle and delay stable server-rendered output. In this app, that can make auth-aware pages, mostly-static shells, source-space navigation, or route wrappers flicker just because one button, sheet trigger, tab switch, search box, or dialog needs client behavior.

## Route Guidance

For App Router UI:

- Keep `page.tsx`, simple route wrappers, redirects, and non-interactive layout sections as Server Components whenever possible.
- Keep route composition, static headings, empty states, and link-only navigation on the server when they do not need event handlers.
- Prefer server-rendered `Link` navigation and URL/route state over React state when a tab or selection represents navigable content.
- Move interactive controls into small client components, such as:
  - auth forms and submit handlers;
  - chat composer controls and client-side streaming state;
  - source upload drop zones and progress rows;
  - add/edit/delete dialog triggers;
  - row-click detail sheets;
  - local search inputs and filters;
  - client-only onboarding overlays.
- Keep TanStack Query providers and other client providers as narrow as practical around the subtree that needs them.

## Client State Guidance

Use client-global or route-global state management only when the benefit clearly outweighs the performance and hydration cost.

Good reasons include:

- multiple distant interactive components must coordinate transient state;
- a dialog/sheet must be controlled from several sibling components;
- local optimistic UI state would otherwise be duplicated or inconsistent;
- browser-only onboarding or tour state needs target registration.

Avoid client-global state when:

- server route params or URL segments can represent the state;
- a small leaf component can own the state locally;
- the state only exists to render static labels, links, or layout;
- the interaction can be handled by a small extracted client component.

## Refactor Pattern

When a page or broad wrapper currently has a `"use client"` directive:

1. Identify the exact hooks, event handlers, contexts, or Base UI primitives that require client execution.
2. Extract those parts into leaf client components.
3. Leave the route page/shell as a Server Component when possible.
4. Pass server-resolved labels and data down as serializable props.
5. Keep context providers as narrow as practical around the subtree that needs them.
6. Re-run typecheck and the relevant browser/unit tests because boundary moves can expose non-serializable props or server-only imports.

## Review Checklist

Before adding `"use client"`, verify:

- Could this component remain server-rendered if I move one control into a child?
- Are navigable tabs or selected resources represented by real links/route params instead of local client state?
- Is client context limited to the smallest subtree that needs it?
- Does the component import a client hook only for convenience rather than necessity?
- Will this boundary increase initial load, hydration work, or flicker for mostly static content?

If the answer suggests a narrower boundary, refactor before implementing new behavior.

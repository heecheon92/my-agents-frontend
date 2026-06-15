# Server Fetch Policy

This document expands the repo policy for server-side fetch and freshness decisions.

## Decision Boundary

Treat authorization-sensitive reads separately from stable shared reads.

Session, current user, CSRF/cookie, group membership, document/source permissions, and other authorization-critical values should stay fresh per request unless temporary staleness is explicitly acceptable for the task.

## Preferred Pattern For Auth-Sensitive Reads

- Prefer fresh per-request reads plus request-local dedupe where needed.
- Do not add persistent fetch caching such as `next: { revalidate: ... }` or `cache: "force-cache"` to authorization-critical reads by default.
- If a helper only needs to avoid duplicate work within a single request, use a request-local helper instead of broader caching.
- Keep cookie forwarding, CSRF handling, backend URL policy, and allowlisting centralized in the existing BFF/server helpers.
- Do not cache browser-visible responses that can contain session state, redacted backend errors, user identity, group membership, document access, or source permissions.

## Preferred Pattern For Stable Shared Reads

Use persistent fetch caching only for stable shared data where short staleness is acceptable and invalidation is clear.

Possible candidates include public marketing/config copy, public health/runtime hints, or other non-sensitive shared metadata. Before adding persistent caching, define:

- why the data is safe to share across users;
- how stale it may be;
- which mutation, deploy, or backend signal invalidates it;
- which tests or smoke checks prove the cached path is safe.

## Layout Reuse

Shared layouts can be reused by the client router across navigation. That means a shared layout can show older server-derived data while a freshly loaded child page shows newer data.

If layout data must refresh immediately after a mutation, use `router.refresh()` on the client and/or `revalidatePath()` in the server action or route handler that changed the data.

## Practical Guidance

- Do not treat `router.refresh()` or `revalidatePath()` as direct revalidators of request-local helpers; they trigger a fresh render/request, which is what refreshes request-local state.
- Prefer the conservative freshness model first. Add broader caching only when the data is clearly non-critical and the invalidation story is concrete.
- Browser components should continue to use typed services and TanStack Query for client-visible server state rather than scattering raw `fetch` calls.
- Route handlers and server helpers should preserve safe error handling and never leak backend stack traces, tokens, cookies, CSRF values, or raw provider errors.

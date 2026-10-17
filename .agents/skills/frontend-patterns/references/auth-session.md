# Authentication Sessions and Actions

## When to use

Use this pattern after the product has selected a real authentication backend and
defined its login, challenge, rotation, revocation, and resource-authorization
contracts. Read [authentication and localized routing](auth-routing.md) first for
route inventory, return-target policy, and Proxy boundaries. Use
[forms](forms.md) for accessible native-form behavior and the immediate
outer-submit duplicate guard; this guide concentrates on the server boundary.

The modules below are concrete examples of a two-credential password flow. That
is an illustrative integration contract, not a project default and not a
provider implementation. The consuming project must implement
`@/server/auth/backend` against its real backend and validate provider responses
before returning these discriminated results. Do not add a fake endpoint, a
successful stub, or a browser-visible token adapter to make the examples run.

These examples target Next.js App Router with async `cookies()`, Server Actions,
`server-only`, Zod, and TanStack Query v5 client APIs. Verify installed versions,
runtime/deployment support, aliases, and the existing session architecture before
adoption. Adapt to the selected provider and project stack; do not introduce a
second auth system or assume the illustrated modules already exist.

## Decisions required before adoption

- Decide whether the provider uses one credential, an access/refresh pair, or a
  different session set. Replace the complete set as one validated
  application-level operation; multiple browser `Set-Cookie` headers are not a
  transactional write. Do not generalize this example's pair.
- Record whether each provider lifetime is an epoch timestamp or duration, and
  in which unit. This example accepts absolute Unix epoch **milliseconds** and
  writes those exact expirations; it never invents a longer cookie lifetime.
- Define challenge/MFA completion, state/nonce storage, expiry, retry, and
  callback rules. A challenge is not an authenticated session. Short-lived
  HttpOnly challenge/state/nonce cookies may be appropriate, but are
  integration-specific and are deliberately absent below.
- Define invalid/revoked/reused credential behavior separately from timeout,
  provider outage, and indeterminate transport failure. A timeout is not proof
  of revocation.
- Define logout scope: local browser sign-out, current refresh-lineage
  revocation, provider session termination, or all-device revocation. The
  example claims only local cleanup plus the reported current-lineage outcome.
- Reconcile the illustrative record read and scope with the real domain. The
  backend must authorize the requested resource independently of Proxy, page,
  layout, and client visibility.

## Required backend boundary

The following contract contains no transport implementation. Its methods must
return validated results and must map expected HTTP, timeout, and provider
errors into the documented union instead of throwing. Unexpected programming
errors may still throw. The required runtime module
`@/server/auth/backend` must export `authBackend: AuthBackend`; it is supplied by
the consuming project and is intentionally not shown as a fake implementation.

### `server/auth/backend-contract.ts`

```ts
import "server-only";

export type SessionCredentials = {
  accessToken: string;
  refreshToken: string;
};

export type IssuedCredentialPair = SessionCredentials & {
  accessExpiresAtEpochMs: number;
  refreshExpiresAtEpochMs: number;
};

export type VerifiedPrincipal = {
  subject: string;
  sessionId: string;
};

export type PasswordLoginResult =
  | { kind: "authenticated"; credentials: IssuedCredentialPair }
  | { kind: "challenge"; challenge: "mfa" | "password_change" }
  | {
      kind: "invalid";
      reason: "invalid_credentials" | "locked" | "rate_limited";
    }
  | { kind: "transient" };

export type VerifySessionResult =
  | { kind: "valid"; principal: VerifiedPrincipal }
  | { kind: "invalid"; reason: "expired" | "revoked" | "malformed" }
  | { kind: "transient" };

export type RefreshSessionResult =
  | { kind: "rotated"; credentials: IssuedCredentialPair }
  | {
      kind: "invalid";
      reason: "expired" | "revoked" | "reused" | "malformed";
    }
  | { kind: "transient" };

export type RevokeSessionResult =
  | { kind: "revoked" }
  | { kind: "already_invalid" }
  | { kind: "transient" };

export type AuthorizedRecord = {
  id: string;
  title: string;
  revision: number;
};

export type ReadAuthorizedRecordResult =
  | { kind: "granted"; record: AuthorizedRecord }
  | {
      kind: "unauthenticated";
      reason: "expired" | "revoked" | "malformed";
    }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "transient" };

export interface AuthBackend {
  passwordLogin(input: {
    username: string;
    password: string;
  }): Promise<PasswordLoginResult>;
  verifySession(
    credentials: SessionCredentials,
  ): Promise<VerifySessionResult>;
  refreshSession(refreshToken: string): Promise<RefreshSessionResult>;
  revokeSession(refreshToken: string): Promise<RevokeSessionResult>;
  readAuthorizedRecord(input: {
    credentials: SessionCredentials;
    recordId: string;
    requiredScope: "record:read";
  }): Promise<ReadAuthorizedRecordResult>;
}
```

The backend adapter must verify signatures or opaque sessions, issuer/audience,
expiry, revocation, session generation, and resource scope as applicable.
Decoding a JWT without verification is never authority. It must not log
passwords, credentials, provider response bodies, or credential-bearing errors.

## Cookie transport

These cookie names and attributes are example integration choices, not project
settings. The cookies are host-only because `Domain` is deliberately omitted.
`Secure` is enabled for production; production must actually be served over
HTTPS, and cross-site provider/callback requirements may require a different
reviewed `SameSite` policy. Deletion uses the same root path, host-only scope,
`SameSite`, `HttpOnly`, and `Secure` choice as creation.

A patch is data, not an already-sent header. A Server Action applies it to the
writable store returned by `await cookies()`. A Route Handler or `proxy.ts` may
apply the same patch to the `cookies` property of the exact `NextResponse` it
returns. A response cookie is visible to the browser's next request; it does not
rewrite the cookies on the incoming `NextRequest`. Do not create a patched
response and then return a different response.

### `server/auth/cookies.ts`

```ts
import "server-only";

import { z } from "zod";

import type {
  IssuedCredentialPair,
  SessionCredentials,
} from "@/server/auth/backend-contract";

export const SESSION_COOKIE_NAMES = {
  access: "auth_access",
  refresh: "auth_refresh",
} as const;

const MAX_DATE_EPOCH_MS = 8_640_000_000_000_000;

const issuedCredentialPairSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  accessExpiresAtEpochMs: z.number().int().positive().max(MAX_DATE_EPOCH_MS),
  refreshExpiresAtEpochMs: z.number().int().positive().max(MAX_DATE_EPOCH_MS),
});

export type SessionCookieReader = {
  get(name: string): { value: string } | undefined;
};

export type SessionCookieWriter = {
  set(
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: "lax";
      path: "/";
      expires: Date;
    },
  ): void;
};

export type ReadSessionCookies =
  | { kind: "absent" }
  | { kind: "access_only"; accessToken: string }
  | { kind: "refresh_only"; refreshToken: string }
  | { kind: "complete"; credentials: SessionCredentials };

export type SessionCookiePatch =
  | { kind: "none" }
  | { kind: "clear" }
  | { kind: "replace"; credentials: IssuedCredentialPair };

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/" as const,
    expires,
  };
}

export function readSessionCookies(
  cookieStore: SessionCookieReader,
): ReadSessionCookies {
  const accessToken = cookieStore.get(SESSION_COOKIE_NAMES.access)?.value;
  const refreshToken = cookieStore.get(SESSION_COOKIE_NAMES.refresh)?.value;

  if (!accessToken) {
    return refreshToken
      ? { kind: "refresh_only", refreshToken }
      : { kind: "absent" };
  }
  if (!refreshToken) {
    return { kind: "access_only", accessToken };
  }

  return {
    kind: "complete",
    credentials: { accessToken, refreshToken },
  };
}

export function replacementCookiePatch(
  input: IssuedCredentialPair,
  nowEpochMs = Date.now(),
): SessionCookiePatch {
  const credentials = issuedCredentialPairSchema.parse(input);
  if (
    credentials.accessExpiresAtEpochMs <= nowEpochMs ||
    credentials.refreshExpiresAtEpochMs <= nowEpochMs
  ) {
    throw new RangeError("Backend returned an expired credential lifetime");
  }

  return { kind: "replace", credentials };
}

export function applySessionCookiePatch(
  cookieStore: SessionCookieWriter,
  patch: SessionCookiePatch,
): void {
  if (patch.kind === "none") return;

  if (patch.kind === "clear") {
    const expired = new Date(0);
    cookieStore.set(
      SESSION_COOKIE_NAMES.access,
      "",
      cookieOptions(expired),
    );
    cookieStore.set(
      SESSION_COOKIE_NAMES.refresh,
      "",
      cookieOptions(expired),
    );
    return;
  }

  cookieStore.set(
    SESSION_COOKIE_NAMES.access,
    patch.credentials.accessToken,
    cookieOptions(new Date(patch.credentials.accessExpiresAtEpochMs)),
  );
  cookieStore.set(
    SESSION_COOKIE_NAMES.refresh,
    patch.credentials.refreshToken,
    cookieOptions(new Date(patch.credentials.refreshExpiresAtEpochMs)),
  );
}
```

## Session verification and refresh core

Verification is read-only. It may recommend clearing a definitively invalid
credential set, but `readSessionForRender()` never rotates or writes cookies
during rendering. A naturally expired access cookie with a still-valid refresh
cookie is `refresh_required`, not invalid. A transient backend failure preserves
the browser cookies while protected work fails closed and offers retry; it does
not announce logout. Refresh is a separate mutation invoked by the explicit
refresh Action below.

### `server/auth/session.ts`

```ts
import "server-only";

import { cookies } from "next/headers";

import { authBackend } from "@/server/auth/backend";
import type {
  SessionCredentials,
  VerifiedPrincipal,
} from "@/server/auth/backend-contract";
import {
  type ReadSessionCookies,
  type SessionCookiePatch,
  readSessionCookies,
  replacementCookiePatch,
} from "@/server/auth/cookies";

export type VerifiedSessionState =
  | { kind: "absent"; patch: SessionCookiePatch }
  | { kind: "refresh_required"; patch: SessionCookiePatch }
  | { kind: "invalid"; patch: SessionCookiePatch }
  | { kind: "transient"; patch: SessionCookiePatch }
  | {
      kind: "authenticated";
      principal: VerifiedPrincipal;
      credentials: SessionCredentials;
      patch: SessionCookiePatch;
    };

export type RefreshState =
  | { kind: "absent"; patch: SessionCookiePatch }
  | { kind: "invalid"; patch: SessionCookiePatch }
  | { kind: "transient"; patch: SessionCookiePatch }
  | { kind: "rotated"; patch: SessionCookiePatch };

const noCookiePatch: SessionCookiePatch = { kind: "none" };
const clearCookiePatch: SessionCookiePatch = { kind: "clear" };

export async function verifySessionCore(
  sessionCookies: ReadSessionCookies,
): Promise<VerifiedSessionState> {
  if (sessionCookies.kind === "absent") {
    return { kind: "absent", patch: noCookiePatch };
  }
  if (sessionCookies.kind === "refresh_only") {
    return { kind: "refresh_required", patch: noCookiePatch };
  }
  if (sessionCookies.kind === "access_only") {
    return { kind: "invalid", patch: clearCookiePatch };
  }

  const result = await authBackend.verifySession(sessionCookies.credentials);
  if (result.kind === "transient") {
    return { kind: "transient", patch: noCookiePatch };
  }
  if (result.kind === "invalid") {
    return result.reason === "expired"
      ? { kind: "refresh_required", patch: noCookiePatch }
      : { kind: "invalid", patch: clearCookiePatch };
  }

  return {
    kind: "authenticated",
    principal: result.principal,
    credentials: sessionCookies.credentials,
    patch: noCookiePatch,
  };
}

export async function readSessionForRender(): Promise<VerifiedSessionState> {
  const cookieStore = await cookies();
  return verifySessionCore(readSessionCookies(cookieStore));
}

export async function refreshSessionCore(
  sessionCookies: ReadSessionCookies,
): Promise<RefreshState> {
  if (sessionCookies.kind === "absent") {
    return { kind: "absent", patch: noCookiePatch };
  }
  if (sessionCookies.kind === "access_only") {
    return { kind: "invalid", patch: clearCookiePatch };
  }

  const refreshToken =
    sessionCookies.kind === "refresh_only"
      ? sessionCookies.refreshToken
      : sessionCookies.credentials.refreshToken;
  const result = await authBackend.refreshSession(refreshToken);
  if (result.kind === "transient") {
    return { kind: "transient", patch: noCookiePatch };
  }
  if (result.kind === "invalid") {
    return { kind: "invalid", patch: clearCookiePatch };
  }

  return {
    kind: "rotated",
    patch: replacementCookiePatch(result.credentials),
  };
}
```

Do not call refresh automatically from every Proxy navigation, RSC request, or
prefetch. The default example is the explicit Action below, invoked after a
reviewed expiry/401 signal. A browser or process-local promise coalescer cannot
serialize other tabs, Proxy requests, server instances, or Actions. Rotation
safety therefore belongs to the backend: single-use lineages, generation checks,
or another documented idempotency rule. A late response carrying `Set-Cookie`
cannot be unsent; confirmed logout requires the backend to reject descendants of
a revoked lineage.

## Login, refresh, logout, and protected read Actions

These Actions accept untrusted `FormData`. Username is trimmed; password is not.
Only safe error codes cross the server boundary. `safeReturnTo()` accepts only
the route policy documented in [authentication and localized routing](auth-routing.md).
`redirect()` is called after result classification and outside broad catches.

Server Actions remain untrusted POST entry points. Preserve Next.js built-in
Origin/Host checks and encrypted action references, validate and authorize every
Action, and apply an explicit CSRF/origin policy to custom Route Handlers or
deployment topologies that require more than the framework guarantee.

The protected record example is intentionally not a product domain default. It
demonstrates that even a verified cookie pair is insufficient: the backend
re-verifies the session and authorizes `record:read` for the exact requested
record. `forbidden` and `not_found` intentionally collapse to one client result
to avoid disclosing resource existence.

### `server/auth/actions.ts`

```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { hasLocale, type Locale } from "@/i18n.config";
import { safeReturnTo } from "@/lib/auth-routing";
import { authBackend } from "@/server/auth/backend";
import type { AuthorizedRecord } from "@/server/auth/backend-contract";
import {
  applySessionCookiePatch,
  readSessionCookies,
  replacementCookiePatch,
} from "@/server/auth/cookies";
import { refreshSessionCore } from "@/server/auth/session";

const localeSchema = z.custom<Locale>(
  (value) => typeof value === "string" && hasLocale(value),
);

const loginSchema = z.object({
  username: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(1024),
  lang: localeSchema,
  returnTo: z.unknown(),
});

const logoutSchema = z.object({ lang: localeSchema });
const recordReadSchema = z.object({
  recordId: z.string().trim().min(1).max(128),
});

export type LoginActionResult =
  | { ok: false; code: "invalid_input" }
  | {
      ok: false;
      code: "invalid_credentials" | "locked" | "rate_limited" | "retry";
    }
  | {
      ok: false;
      code: "challenge_required";
      challenge: "mfa" | "password_change";
    };

export type RefreshActionResult =
  | { ok: true }
  | { ok: false; code: "signed_out" | "retry" };

export type LogoutActionResult = {
  ok: true;
  local: "cleared";
  upstream: "confirmed" | "unconfirmed" | "not_applicable";
  destination: `/${Locale}/login` | null;
};

export type ReadRecordActionResult =
  | { ok: true; record: AuthorizedRecord }
  | {
      ok: false;
      code:
        | "invalid_input"
        | "refresh_required"
        | "signed_out"
        | "denied"
        | "retry";
    };

export async function loginAction(
  formData: FormData,
): Promise<LoginActionResult> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    lang: formData.get("lang"),
    returnTo: formData.get("returnTo"),
  });
  if (!parsed.success) return { ok: false, code: "invalid_input" };

  const result = await authBackend.passwordLogin({
    username: parsed.data.username,
    password: parsed.data.password,
  });

  if (result.kind === "invalid") {
    return { ok: false, code: result.reason };
  }
  if (result.kind === "transient") {
    return { ok: false, code: "retry" };
  }

  const cookieStore = await cookies();
  if (result.kind === "challenge") {
    applySessionCookiePatch(cookieStore, { kind: "clear" });
    return {
      ok: false,
      code: "challenge_required",
      challenge: result.challenge,
    };
  }

  applySessionCookiePatch(
    cookieStore,
    replacementCookiePatch(result.credentials),
  );
  const destination = safeReturnTo(
    parsed.data.returnTo,
    parsed.data.lang,
  );
  redirect(destination);
}

export async function refreshSessionAction(): Promise<RefreshActionResult> {
  const cookieStore = await cookies();
  const result = await refreshSessionCore(readSessionCookies(cookieStore));

  if (result.kind === "transient") {
    return { ok: false, code: "retry" };
  }
  if (result.kind === "absent") {
    return { ok: false, code: "signed_out" };
  }
  if (result.kind === "invalid") {
    applySessionCookiePatch(cookieStore, result.patch);
    return { ok: false, code: "signed_out" };
  }

  applySessionCookiePatch(cookieStore, result.patch);
  return { ok: true };
}

export async function logoutAction(
  formData: FormData,
): Promise<LogoutActionResult> {
  const parsed = logoutSchema.safeParse({ lang: formData.get("lang") });
  const lang = parsed.success ? parsed.data.lang : null;
  const cookieStore = await cookies();
  const sessionCookies = readSessionCookies(cookieStore);
  const refreshToken =
    sessionCookies.kind === "complete"
      ? sessionCookies.credentials.refreshToken
      : sessionCookies.kind === "refresh_only"
        ? sessionCookies.refreshToken
        : undefined;
  let upstream: LogoutActionResult["upstream"] = "not_applicable";

  try {
    if (refreshToken) {
      const result = await authBackend.revokeSession(refreshToken);
      upstream =
        result.kind === "revoked" || result.kind === "already_invalid"
          ? "confirmed"
          : "unconfirmed";
    }
  } catch {
    upstream = "unconfirmed";
  } finally {
    applySessionCookiePatch(cookieStore, { kind: "clear" });
  }

  return {
    ok: true,
    local: "cleared",
    upstream,
    destination: lang ? `/${lang}/login` : null,
  };
}

export async function readAuthorizedRecordAction(
  formData: FormData,
): Promise<ReadRecordActionResult> {
  const parsed = recordReadSchema.safeParse({
    recordId: formData.get("recordId"),
  });
  if (!parsed.success) return { ok: false, code: "invalid_input" };

  const cookieStore = await cookies();
  const sessionCookies = readSessionCookies(cookieStore);
  if (sessionCookies.kind === "refresh_only") {
    return { ok: false, code: "refresh_required" };
  }
  if (sessionCookies.kind !== "complete") {
    if (sessionCookies.kind === "access_only") {
      applySessionCookiePatch(cookieStore, { kind: "clear" });
    }
    return { ok: false, code: "signed_out" };
  }

  const result = await authBackend.readAuthorizedRecord({
    credentials: sessionCookies.credentials,
    recordId: parsed.data.recordId,
    requiredScope: "record:read",
  });

  if (result.kind === "granted") {
    return { ok: true, record: result.record };
  }
  if (result.kind === "unauthenticated") {
    if (result.reason === "expired") {
      return { ok: false, code: "refresh_required" };
    }
    applySessionCookiePatch(cookieStore, { kind: "clear" });
    return { ok: false, code: "signed_out" };
  }
  if (result.kind === "transient") {
    return { ok: false, code: "retry" };
  }
  return { ok: false, code: "denied" };
}
```

`logoutAction()` always performs local deletion, even when revocation times out or
throws. `upstream: "confirmed"` means only that the adapter confirmed current
lineage revocation or that it was already invalid. It does not claim provider
logout, all-device logout, or global token invalidation. A destination is
returned only for a validated locale; otherwise it is `null`. Callers should
cancel identity-owned client work before replacing navigation.

For `refresh_required`, invoke the explicit refresh Action once and replay only
this idempotent read once after successful rotation. Do not generalize that
bounded read retry into automatic replay of authenticated writes.

## Client identity boundary

TanStack Query cancellation is cooperative: a query function must consume its
`AbortSignal`, and a mutation already accepted by the server cannot be recalled.
The factory below is per mounted application boundary, not global session state.
Close the launch gate and advance the generation before canceling and clearing
identity-owned work. Late successes and failures then become stale results, and
new work cannot start until the new identity is explicitly activated. Sensitive
writes use `retry: false` and `networkMode: "always"` to attempt once and surface
failure instead of entering Query's offline/reconnect queue. This does not cancel
requests already sent or bypass same-scope mutation serialization. Never resume
persisted/paused mutations for a departed identity.

### `client/auth/identity-boundary.ts`

```ts
"use client";

import type { QueryClient } from "@tanstack/react-query";

export const IDENTITY_WRITE_OPTIONS = {
  retry: false,
  networkMode: "always" as const,
};

export type IdentityLease = {
  isCurrent(): boolean;
};

export type IdentityBoundResult<T> =
  | { kind: "current"; value: T }
  | { kind: "stale" };

export function createIdentityBoundary(queryClient: QueryClient) {
  let generation = 0;
  let active = true;

  function capture(): IdentityLease {
    const capturedGeneration = generation;
    return {
      isCurrent: () => active && capturedGeneration === generation,
    };
  }

  async function runOnce<T>(
    lease: IdentityLease,
    operation: () => Promise<T>,
  ): Promise<IdentityBoundResult<T>> {
    if (!lease.isCurrent()) return { kind: "stale" };
    try {
      const value = await operation();
      if (!lease.isCurrent()) return { kind: "stale" };
      return { kind: "current", value };
    } catch (error) {
      if (!lease.isCurrent()) return { kind: "stale" };
      throw error;
    }
  }

  async function clearForIdentityChange(): Promise<void> {
    active = false;
    generation += 1;
    await queryClient.cancelQueries({}, { silent: true });
    queryClient.clear();
  }

  function activateIdentity(): void {
    generation += 1;
    active = true;
  }

  return { capture, runOnce, clearForIdentityChange, activateIdentity };
}
```

Use a lease before starting identity-owned work and check the returned state
before writing to component or external stores. Await `clearForIdentityChange()`
before changing server identity. Keep departing consumers disabled or unmounted
and route all identity-owned launches through this boundary. Call
`activateIdentity()` only after the new server identity is confirmed; for a
redirecting login, do that at the destination using its verified session.
Do not reactivate in an unconditional `finally`. Leases captured before or during
the transition remain stale. This protects client presentation; backend
authorization, revocation, and replay control remain mandatory.
For a Query mutation, capture the lease when the user requests the operation and
call `runOnce(lease, operation)` inside `mutationFn`, at actual request dispatch.
Do not acquire a new lease after a queued mutation starts, or only wrap the
outer `mutateAsync` promise; both can miss an intervening identity change.

## Focused behavior cases

Exercise these cases against the real adapter and deployment rather than a mock
success path:

1. Empty/oversized fields, a `File` in any text field, unsupported locale, and a
   hostile return target fail safely; password bytes are not trimmed or logged.
2. Password success writes both credentials with the backend's exact epoch-ms
   expirations, rejects values beyond JavaScript's maximum `Date`, and reaches
   only an approved localized return target.
3. MFA/password-change results write no authenticated pair; integration-specific
   challenge cookies cannot authorize protected reads.
4. An expired access cookie may disappear while the refresh cookie remains.
   Verification and protected reads return `refresh_required` without clearing
   it; refresh can rotate from that refresh token alone.
5. An access-only cookie, revoked/malformed credentials, and backend timeout
   produce distinct invalid and transient states. Definitive invalidity clears;
   timeout preserves cookies and offers retry.
6. Read-only rendering verifies but never rotates or emits `Set-Cookie`.
7. Refresh validates and writes only a complete new pair. Invalid/reused lineage
   clears both cookies; timeout preserves them, fails protected work closed, and
   offers retry.
8. Concurrent refresh, logout, navigation, and late responses cannot revive a
   backend-revoked lineage. Document residual risk if the provider lacks session
   generation/reuse detection.
9. Logout deletes both cookies when revocation succeeds, times out, or throws,
   while reporting only the outcome actually known.
10. A valid session reading another user's/tenant's guessed record ID receives a
    denied result from the backend authorization boundary. An expired result may
    trigger one explicit refresh and one replay of this idempotent read, never a
    generic write replay.
11. Identity change aborts signal-aware queries, clears cached queries and
    mutations, ignores late success and failure, and blocks new launches until
    explicit identity activation. A failed write is not retried or queued by
    Query for reconnect.

## Official references

- [Next.js: `cookies`](https://nextjs.org/docs/app/api-reference/functions/cookies)
- [Next.js: Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions)
- [Next.js: Authentication](https://nextjs.org/docs/app/guides/authentication)
- [Next.js: Data Security](https://nextjs.org/docs/app/guides/data-security)
- [Next.js: Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [MDN: HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
- [OWASP: Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

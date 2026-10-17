# Authentication and Localized Routing

Use Proxy as a cheap navigation prefilter, not as authentication or authorization. The backend and server-only data access layer must verify the session and permissions for every protected read, Route Handler, and Server Action. Cookie presence is only enough to distinguish an obvious guest from a request that needs authoritative verification.

This example assumes the following illustrative inventory:

- `/{locale}/help` is public.
- `/{locale}/login` is the guest entry page.
- `/{locale}/app` and its descendants are protected.
- Post-login return targets are narrower: only `/{locale}/app` and `/{locale}/app/settings`, optionally with one `page` query value from `1` through `999`.
- Supported locales come exclusively from `@/i18n.config`.

Reconcile that inventory with the real App Router before adopting it. Paths outside the listed roots remain `unknown` and continue to the router, so unsupported locales and unknown routes can produce their normal 404. A recognized protected subtree is protected by default; its own page or layout still decides whether a particular descendant exists.

If the project has chosen a fixed root redirect, preserve it in `next.config.ts` rather than replacing it with request-state logic. The illustrative `{ source: "/", destination: "/ko", permanent: false }` redirect runs before Proxy; `/ko`, the route inventory, aliases, and return-query limits are example choices, not project defaults. This example targets Next.js 16 App Router, whose request hook is `proxy.ts` with a named `proxy` export. Verify the installed version and use its supported convention; earlier versions may use `middleware.ts`. Do not install both as a second filtering layer.

## Complete modules

### `lib/auth-routing.ts`

```ts
import { hasLocale, type Locale } from "@/i18n.config";

export type LocalizedPathClassification =
  | { kind: "invalid" }
  | { kind: "unknown" }
  | { kind: "public"; locale: Locale }
  | { kind: "login"; locale: Locale }
  | { kind: "protected"; locale: Locale };

const MAX_RETURN_TARGET_LENGTH = 2_048;
const SAFE_PAGE_QUERY = /^page=([1-9]\d{0,2})$/;

function hasControlOrBackslash(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (
      character === "\\" ||
      codePoint === undefined ||
      codePoint <= 31 ||
      (codePoint >= 127 && codePoint <= 159)
    ) {
      return true;
    }
  }

  return false;
}

function hasSafePathSyntax(pathname: string): boolean {
  if (
    pathname.length === 0 ||
    pathname.length > MAX_RETURN_TARGET_LENGTH ||
    !pathname.startsWith("/") ||
    pathname.startsWith("//") ||
    pathname.includes("//") ||
    pathname.includes("%") ||
    pathname.includes("?") ||
    pathname.includes("#") ||
    hasControlOrBackslash(pathname)
  ) {
    return false;
  }

  return !pathname
    .split("/")
    .some((segment) => segment === "." || segment === "..");
}

export function classifyLocalizedPath(
  pathname: string,
): LocalizedPathClassification {
  if (!hasSafePathSyntax(pathname)) {
    return { kind: "invalid" };
  }

  const segments = pathname.split("/");
  const localeSegment = segments[1];
  if (!localeSegment || !hasLocale(localeSegment)) {
    return { kind: "unknown" };
  }

  const locale = localeSegment;
  if (pathname === `/${locale}/help`) {
    return { kind: "public", locale };
  }

  if (pathname === `/${locale}/login`) {
    return { kind: "login", locale };
  }

  const protectedRoot = `/${locale}/app`;
  if (
    pathname === protectedRoot ||
    pathname.startsWith(`${protectedRoot}/`)
  ) {
    return { kind: "protected", locale };
  }

  return { kind: "unknown" };
}

export function safeReturnTo(candidate: unknown, locale: Locale): string {
  const fallback = `/${locale}/app`;
  if (
    typeof candidate !== "string" ||
    candidate.length === 0 ||
    candidate.length > MAX_RETURN_TARGET_LENGTH ||
    hasControlOrBackslash(candidate) ||
    candidate.includes("#") ||
    candidate.indexOf("?") !== candidate.lastIndexOf("?")
  ) {
    return fallback;
  }

  const queryIndex = candidate.indexOf("?");
  const rawPath =
    queryIndex === -1 ? candidate : candidate.slice(0, queryIndex);
  const rawQuery =
    queryIndex === -1 ? "" : candidate.slice(queryIndex + 1);

  if (!hasSafePathSyntax(rawPath)) {
    return fallback;
  }

  if (
    rawPath !== `/${locale}/app` &&
    rawPath !== `/${locale}/app/settings`
  ) {
    return fallback;
  }

  if (rawQuery === "") {
    return rawPath;
  }

  if (!SAFE_PAGE_QUERY.test(rawQuery)) {
    return fallback;
  }

  return `${rawPath}?${rawQuery}`;
}
```

`safeReturnTo` validates the raw relative string before constructing a `URL`. It rejects absolute and protocol-relative forms, controls, backslashes, duplicate separators, percent-encoded or malformed ambiguity, dot segments, fragments, duplicate query delimiters, unknown parameters, and authentication-loop destinations. It never repeatedly decodes attacker input. Any failure returns the locale's known landing page.

The intentionally strict percent rejection is appropriate because this example's approved paths and sole query value are ASCII. If a real route needs encoded user data, define a field-specific single-decode grammar and reject encoded separators, controls, dot traversal, invalid UTF-8, and non-canonical encodings before any WHATWG normalization can erase evidence.

### `proxy.ts`

```ts
import { NextResponse, type NextRequest } from "next/server";

import {
  classifyLocalizedPath,
  safeReturnTo,
} from "@/lib/auth-routing";
import { SESSION_COOKIE_NAMES } from "@/server/auth/cookies";

export function proxy(request: NextRequest): NextResponse {
  const route = classifyLocalizedPath(request.nextUrl.pathname);

  if (route.kind === "invalid") {
    return NextResponse.json(
      { error: "invalid_path" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (
    route.kind === "unknown" ||
    route.kind === "public" ||
    route.kind === "login"
  ) {
    return NextResponse.next();
  }

  const hasAccessCookie = Boolean(
    request.cookies.get(SESSION_COOKIE_NAMES.access)?.value,
  );
  const hasRefreshCookie = Boolean(
    request.cookies.get(SESSION_COOKIE_NAMES.refresh)?.value,
  );

  if (hasAccessCookie || hasRefreshCookie) {
    return NextResponse.next();
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = `/${route.locale}/login`;
  loginUrl.search = "";
  loginUrl.searchParams.set(
    "returnUrl",
    safeReturnTo(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
      route.locale,
    ),
  );

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!api(?:/|$)|_next/static(?:/|$)|_next/image(?:/|$)|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$|manifest\\.webmanifest$).*)",
  ],
};
```

The literal matcher is statically analyzable. It excludes only reviewed framework, API, and public metadata surfaces; it deliberately does not exempt every path containing a dot. Each excluded API or asset surface still needs its own correct handling.

The Proxy redirects an obvious guest only for protected `GET`/`HEAD` requests. It returns `401` for missing-cookie writes instead of forwarding a POST body to login through a method-preserving redirect. It does not exempt `Next-Action`, RSC, or prefetch requests: those paths must still reach authoritative server checks. Cookie presence—including a partial cookie set—only permits the request to continue; it never proves validity, roles, permissions, tenant membership, or resource ownership. The login route is never redirected merely because an unverified cookie exists.

## Session boundary

Use server-owned `HttpOnly` cookies and a server-only backend/BFF adapter. Do not expose tokens through Client Components, public environment variables, raw-cookie Actions, logs, or query caches. Permission-aware navigation may hide unavailable links, but the server must enforce the same permission independently.

Refresh has one explicit owner and must distinguish absent, expired-but-refreshable, definitively invalid/revoked, forbidden, and transient-upstream states. A failed refresh is not automatically a `401`; valid-but-underprivileged access is normally `403`, while an outage is indeterminate and must not masquerade as logout. Prevent login/refresh redirect loops by bounding attempts, excluding login from return targets, and never treating decoded claims as verification. Cookie mutation timing, late refresh responses, rotation concurrency, outage behavior, and identity-query cleanup belong to [Session and auth examples](auth-session.md), rather than being duplicated here.

## Verification scenarios

Exercise the adopted inventory against the actual application:

- `/ko/help`, `/ko/login`, `/ko/app`, and a real protected descendant receive their documented class; unsupported locales and unrelated paths remain router-owned 404s.
- Prefix collisions, duplicate slashes, backslashes, controls, `%2f`, `%5c`, `%2e`, malformed escapes, dot segments, fragments, foreign origins, `//host`, repeated query keys, and nested encodings fall back or fail before URL normalization.
- Only the two approved return paths survive, with no query or one canonical `page=1..999`; login and arbitrary protected descendants cannot become return targets.
- A protected `GET`/`HEAD` with neither cookie redirects to localized login; a protected POST with neither cookie returns `401` and does not redirect its body.
- One or both cookies present only passes the request onward; invalid, expired, revoked, and insufficient-permission sessions are denied by the authoritative server path.
- Direct Route Handler and Server Action calls remain protected without relying on Proxy, including RSC navigation and prefetch traffic.
- The fixed root redirect remains stable, real framework assets load, excluded APIs authorize themselves, and a legitimate dot-containing application path is not silently skipped by the matcher.

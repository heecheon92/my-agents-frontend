import { type NextRequest, NextResponse } from "next/server";
import { TEXT_EVENT_STREAM_CONTENT_TYPE } from "@/constants/header";
import {
  BACKEND_URL,
  COOKIE_SECURE,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  FRONTEND_ORIGIN,
  SESSION_COOKIE_NAME,
} from "@/server/my-agents/config";
import {
  getSetCookieHeaders,
  parseCookieValue,
} from "@/server/my-agents/cookies";
import {
  buildBackendPath,
  isAllowedBackendPath,
  isCsrfExemptPath,
  isMutation,
  safeProxyError,
  validateSameOriginProof,
} from "@/server/my-agents/proxy-policy";
import { defaultLocalization } from "@/utils/localization";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

const LANGUAGE_HEADER_NAMES = [
  "accept-language",
  "x-my-agents-language",
  "x-my-agents-locale",
] as const;

/**
 * Paths whose response body is Server-Sent Events and must not be buffered.
 *
 * Omitting a streaming path here does not fail loudly: the request is still
 * proxied and still succeeds, but the whole SSE body is buffered and delivered
 * at once, so the answer appears in a single jump instead of token by token.
 * Add every new `/stream` endpoint here at the same time as its allowlist rule.
 */
export function isStreamPath(path: string) {
  return (
    /^\/conversations\/[^/]+\/runs\/stream$/.test(path) ||
    /^\/conversations\/[^/]+\/runs\/[^/]+\/resume\/stream$/.test(path) ||
    /^\/conversations\/[^/]+\/messages\/[^/]+\/replay\/stream$/.test(path)
  );
}

function isSessionLoginPath(path: string) {
  return (
    path === "/auth/login" ||
    path === "/auth/guest/login" ||
    path === "/group-invitations/signup"
  );
}

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const backendPath = buildBackendPath(path);
  const allowDecision = isAllowedBackendPath(request.method, backendPath);
  if (!allowDecision.allowed) return safeProxyError(allowDecision);

  const sameOriginDecision = validateSameOriginProof({
    method: request.method,
    requestUrl: request.url,
    headers: request.headers,
    configuredOrigin: FRONTEND_ORIGIN,
  });
  if (!sameOriginDecision.allowed) return safeProxyError(sameOriginDecision);

  const csrfToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (
    isMutation(request.method) &&
    !isCsrfExemptPath(backendPath) &&
    !csrfToken
  ) {
    return Response.json(
      {
        code: "csrf_missing",
        detail: defaultLocalization.errors.csrfMissing,
      },
      { status: 409 },
    );
  }

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const accept = request.headers.get("accept");
  if (accept) headers.set("accept", accept);
  for (const headerName of LANGUAGE_HEADER_NAMES) {
    const value = request.headers.get(headerName);
    if (value) headers.set(headerName, value);
  }
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  if (
    csrfToken &&
    isMutation(request.method) &&
    !isCsrfExemptPath(backendPath)
  ) {
    headers.set(CSRF_HEADER_NAME, csrfToken);
  }

  const hasBody = isMutation(request.method) && request.method !== "GET";
  const backendResponse = await fetch(`${BACKEND_URL}${backendPath}`, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    cache: "no-store",
  });

  if (isStreamPath(backendPath) && backendResponse.ok) {
    return new NextResponse(backendResponse.body, {
      status: backendResponse.status,
      headers: {
        "cache-control": "no-store, no-transform",
        "content-type":
          backendResponse.headers.get("content-type") ??
          TEXT_EVENT_STREAM_CONTENT_TYPE,
        "x-accel-buffering": "no",
      },
    });
  }

  const rawResponseBody =
    backendResponse.status === 204 ? null : await backendResponse.text();
  let responseBody = rawResponseBody;

  if (
    isSessionLoginPath(backendPath) &&
    backendResponse.ok &&
    rawResponseBody
  ) {
    try {
      const parsed = JSON.parse(rawResponseBody) as { csrf_token?: unknown };
      if ("csrf_token" in parsed) {
        delete parsed.csrf_token;
        responseBody = JSON.stringify(parsed);
      }
    } catch {
      responseBody = rawResponseBody;
    }
  }

  const response = new NextResponse(responseBody, {
    status: backendResponse.status,
    headers: {
      "content-type":
        backendResponse.headers.get("content-type") ?? "application/json",
    },
  });

  if (isSessionLoginPath(backendPath) && backendResponse.ok) {
    for (const setCookie of getSetCookieHeaders(backendResponse.headers)) {
      const sessionValue = parseCookieValue(setCookie, SESSION_COOKIE_NAME);
      if (sessionValue) {
        response.cookies.set(SESSION_COOKIE_NAME, sessionValue, {
          httpOnly: true,
          sameSite: "lax",
          secure: COOKIE_SECURE,
          path: "/",
        });
      }
    }
    try {
      const parsed = rawResponseBody
        ? (JSON.parse(rawResponseBody) as { csrf_token?: unknown })
        : null;
      if (typeof parsed?.csrf_token === "string" && parsed.csrf_token) {
        response.cookies.set(CSRF_COOKIE_NAME, parsed.csrf_token, {
          httpOnly: true,
          sameSite: "lax",
          secure: COOKIE_SECURE,
          path: "/",
        });
      }
    } catch {
      // Safe error mapping is handled by the backend status/body; no raw parse error is surfaced.
    }
  }

  if (backendPath === "/auth/logout") {
    response.cookies.delete(SESSION_COOKIE_NAME);
    response.cookies.delete(CSRF_COOKIE_NAME);
  }

  return response;
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

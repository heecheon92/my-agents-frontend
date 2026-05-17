import { JSON_CONTENT_TYPE } from "@/constants/header";
import type { HTTPMethod } from "@/constants/http";

export type ProxyDecision =
  | { allowed: true; params: Record<string, string> }
  | { allowed: false; status: number; code: string; message: string };

type Rule = {
  method: HTTPMethod;
  pattern: RegExp;
  name: string;
};

const uuidLike = "[^/]+";

export const BFF_ALLOWLIST: Rule[] = [
  { method: "GET", pattern: /^\/health$/, name: "health" },
  { method: "POST", pattern: /^\/auth\/signup$/, name: "auth.signup" },
  { method: "POST", pattern: /^\/auth\/login$/, name: "auth.login" },
  { method: "POST", pattern: /^\/auth\/logout$/, name: "auth.logout" },
  { method: "GET", pattern: /^\/auth\/me$/, name: "auth.me" },
  {
    method: "POST",
    pattern: /^\/conversations$/,
    name: "conversations.create",
  },
  { method: "GET", pattern: /^\/conversations$/, name: "conversations.list" },
  {
    method: "GET",
    pattern: new RegExp(`^/conversations/${uuidLike}$`),
    name: "conversations.detail",
  },
  {
    method: "POST",
    pattern: new RegExp(`^/conversations/${uuidLike}/messages$`),
    name: "messages.create",
  },
  {
    method: "GET",
    pattern: new RegExp(`^/conversations/${uuidLike}/messages$`),
    name: "messages.list",
  },
  {
    method: "POST",
    pattern: new RegExp(`^/conversations/${uuidLike}/runs$`),
    name: "runs.create",
  },
  {
    method: "GET",
    pattern: new RegExp(`^/conversations/${uuidLike}/runs$`),
    name: "runs.list",
  },
  {
    method: "GET",
    pattern: new RegExp(`^/conversations/${uuidLike}/runs/${uuidLike}/events$`),
    name: "events.list",
  },
  { method: "POST", pattern: /^\/groups$/, name: "groups.create" },
  { method: "GET", pattern: /^\/groups$/, name: "groups.list" },
  {
    method: "GET",
    pattern: new RegExp(`^/groups/${uuidLike}$`),
    name: "groups.detail",
  },
  {
    method: "POST",
    pattern: new RegExp(`^/groups/${uuidLike}/members$`),
    name: "members.create",
  },
  {
    method: "PATCH",
    pattern: new RegExp(`^/groups/${uuidLike}/members/${uuidLike}$`),
    name: "members.update",
  },
  {
    method: "POST",
    pattern: /^\/knowledge-bases$/,
    name: "knowledge-bases.create",
  },
  {
    method: "GET",
    pattern: /^\/knowledge-bases$/,
    name: "knowledge-bases.list",
  },
  { method: "POST", pattern: /^\/documents$/, name: "documents.create" },
  { method: "GET", pattern: /^\/documents$/, name: "documents.list" },
  {
    method: "GET",
    pattern: new RegExp(`^/documents/${uuidLike}$`),
    name: "documents.detail",
  },
  {
    method: "PATCH",
    pattern: new RegExp(`^/documents/${uuidLike}/permissions$`),
    name: "documents.permissions",
  },
  {
    method: "POST",
    pattern: new RegExp(`^/documents/${uuidLike}/ingest$`),
    name: "documents.ingest",
  },
  {
    method: "GET",
    pattern: new RegExp(`^/documents/${uuidLike}/extraction-runs$`),
    name: "documents.extraction-runs",
  },
];

export function buildBackendPath(pathParts: string[]) {
  const safeParts = pathParts
    .filter(Boolean)
    .map((part) => encodeURIComponent(decodeURIComponent(part)));
  return `/${safeParts.join("/")}`;
}

export function isMutation(method: string) {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

export function isCsrfExemptPath(path: string) {
  return path === "/auth/login" || path === "/auth/signup";
}

export function isAllowedBackendPath(
  method: string,
  path: string,
): ProxyDecision {
  if (path.includes("..") || path.includes("//")) {
    return {
      allowed: false,
      status: 404,
      code: "path_not_allowed",
      message: "Path is not allowed",
    };
  }
  if (path === "/assistant/chat" || path.startsWith("/assistant/")) {
    return {
      allowed: false,
      status: 404,
      code: "legacy_chat_blocked",
      message: "Legacy assistant chat is not a product route",
    };
  }
  const rule = BFF_ALLOWLIST.find(
    (item) => item.method === method && item.pattern.test(path),
  );
  if (!rule) {
    return {
      allowed: false,
      status: 404,
      code: "path_not_allowed",
      message: "Path is not allowlisted",
    };
  }
  return { allowed: true, params: { route: rule.name } };
}

export function isJsonMutation(headers: Headers) {
  const contentType = headers.get("content-type");
  if (!contentType) return false;
  return contentType.toLowerCase().includes(JSON_CONTENT_TYPE);
}

export function resolveExpectedOrigin(
  requestUrl: string,
  configuredOrigin?: string,
) {
  if (configuredOrigin) return configuredOrigin;
  return new URL(requestUrl).origin;
}

export function validateSameOriginProof({
  method,
  requestUrl,
  headers,
  configuredOrigin,
}: {
  method: string;
  requestUrl: string;
  headers: Headers;
  configuredOrigin?: string;
}): ProxyDecision {
  if (!isMutation(method)) return { allowed: true, params: {} };

  if (!isJsonMutation(headers)) {
    return {
      allowed: false,
      status: 415,
      code: "json_required",
      message: "Mutations must use application/json",
    };
  }

  const secFetchSite = headers.get("sec-fetch-site");
  if (secFetchSite?.toLowerCase() === "cross-site") {
    return {
      allowed: false,
      status: 403,
      code: "cross_site_rejected",
      message: "Cross-site mutation rejected",
    };
  }

  const expectedOrigin = resolveExpectedOrigin(requestUrl, configuredOrigin);
  const origin = headers.get("origin");
  if (origin && origin !== expectedOrigin) {
    return {
      allowed: false,
      status: 403,
      code: "origin_rejected",
      message: "Origin is not allowed",
    };
  }

  const referer = headers.get("referer");
  if (!origin && referer) {
    let refererOrigin: string;
    try {
      refererOrigin = new URL(referer).origin;
    } catch {
      return {
        allowed: false,
        status: 403,
        code: "referer_rejected",
        message: "Referer is invalid",
      };
    }
    if (refererOrigin !== expectedOrigin) {
      return {
        allowed: false,
        status: 403,
        code: "referer_rejected",
        message: "Referer is not allowed",
      };
    }
  }

  return { allowed: true, params: {} };
}

export function safeProxyError(
  decision: Exclude<ProxyDecision, { allowed: true }>,
) {
  return Response.json(
    { detail: decision.message, code: decision.code },
    { status: decision.status },
  );
}

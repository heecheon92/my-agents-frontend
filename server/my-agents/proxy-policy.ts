import { JSON_CONTENT_TYPE } from "@/constants/header";
import type { HTTPMethod } from "@/constants/http";
import { defaultLocalization } from "@/utils/localization";

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
  {
    method: "POST",
    pattern: /^\/auth\/verify-email$/,
    name: "auth.verify-email",
  },
  { method: "POST", pattern: /^\/auth\/login$/, name: "auth.login" },
  {
    method: "POST",
    pattern: /^\/auth\/guest\/request$/,
    name: "auth.guest.request",
  },
  {
    method: "POST",
    pattern: /^\/auth\/guest\/login$/,
    name: "auth.guest.login",
  },
  {
    method: "POST",
    pattern: /^\/auth\/password-reset\/request$/,
    name: "auth.password-reset.request",
  },
  {
    method: "POST",
    pattern: /^\/auth\/password-reset\/confirm$/,
    name: "auth.password-reset.confirm",
  },
  { method: "POST", pattern: /^\/auth\/logout$/, name: "auth.logout" },
  { method: "GET", pattern: /^\/auth\/me$/, name: "auth.me" },
  {
    method: "PATCH",
    pattern: /^\/auth\/me\/nickname$/,
    name: "auth.me.nickname",
  },
  {
    method: "PATCH",
    pattern: /^\/auth\/me\/password$/,
    name: "auth.me.password",
  },
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
    method: "DELETE",
    pattern: new RegExp(`^/conversations/${uuidLike}$`),
    name: "conversations.delete",
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
    pattern: new RegExp(
      `^/conversations/${uuidLike}/messages/${uuidLike}/replay$`,
    ),
    name: "messages.replay",
  },
  {
    method: "POST",
    pattern: new RegExp(
      `^/conversations/${uuidLike}/messages/${uuidLike}/replay/stream$`,
    ),
    name: "messages.replay.stream",
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
    pattern: new RegExp(`^/conversations/${uuidLike}/runs/${uuidLike}$`),
    name: "runs.detail",
  },
  {
    method: "POST",
    pattern: new RegExp(`^/conversations/${uuidLike}/runs/${uuidLike}/cancel$`),
    name: "runs.cancel",
  },
  {
    method: "POST",
    pattern: new RegExp(`^/conversations/${uuidLike}/runs/stream$`),
    name: "runs.stream",
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
    method: "GET",
    pattern: new RegExp(`^/groups/${uuidLike}/invitations$`),
    name: "groups.invitations.list",
  },
  {
    method: "POST",
    pattern: new RegExp(`^/groups/${uuidLike}/invitations$`),
    name: "groups.invitations.create",
  },
  {
    method: "PATCH",
    pattern: new RegExp(`^/groups/${uuidLike}/invitations/${uuidLike}$`),
    name: "groups.invitations.update",
  },
  {
    method: "POST",
    pattern: new RegExp(`^/groups/${uuidLike}/invitations/${uuidLike}/resend$`),
    name: "groups.invitations.resend",
  },
  {
    method: "DELETE",
    pattern: new RegExp(`^/groups/${uuidLike}/invitations/${uuidLike}$`),
    name: "groups.invitations.cancel",
  },
  {
    method: "POST",
    pattern: /^\/group-invitations\/accept$/,
    name: "group-invitations.accept",
  },
  {
    method: "POST",
    pattern: /^\/group-invitations\/signup$/,
    name: "group-invitations.signup",
  },
  {
    method: "GET",
    pattern: new RegExp(`^/groups/${uuidLike}/members$`),
    name: "members.list",
  },
  {
    method: "PATCH",
    pattern: new RegExp(`^/groups/${uuidLike}/members/${uuidLike}$`),
    name: "members.update",
  },
  {
    method: "GET",
    pattern: new RegExp(`^/groups/${uuidLike}/publish-requests$`),
    name: "groups.publish-requests.list",
  },
  {
    method: "POST",
    pattern: new RegExp(`^/groups/${uuidLike}/publish-requests$`),
    name: "groups.publish-requests.create",
  },
  {
    method: "GET",
    pattern: new RegExp(
      `^/groups/${uuidLike}/publish-requests/${uuidLike}/source$`,
    ),
    name: "groups.publish-requests.source",
  },
  {
    method: "POST",
    pattern: new RegExp(
      `^/groups/${uuidLike}/publish-requests/${uuidLike}/approve$`,
    ),
    name: "groups.publish-requests.approve",
  },
  {
    method: "POST",
    pattern: new RegExp(
      `^/groups/${uuidLike}/publish-requests/${uuidLike}/reject$`,
    ),
    name: "groups.publish-requests.reject",
  },
  {
    method: "POST",
    pattern: new RegExp(
      `^/groups/${uuidLike}/publish-requests/${uuidLike}/cancel$`,
    ),
    name: "groups.publish-requests.cancel",
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
  {
    method: "POST",
    pattern: /^\/knowledge-bases\/team-upload-staging$/,
    name: "knowledge-bases.team-upload-staging",
  },
  {
    method: "GET",
    pattern: new RegExp(`^/knowledge-bases/${uuidLike}$`),
    name: "knowledge-bases.detail",
  },
  {
    method: "PATCH",
    pattern: new RegExp(`^/knowledge-bases/${uuidLike}$`),
    name: "knowledge-bases.update",
  },
  {
    method: "DELETE",
    pattern: new RegExp(`^/knowledge-bases/${uuidLike}$`),
    name: "knowledge-bases.delete",
  },
  {
    method: "POST",
    pattern: new RegExp(`^/knowledge-bases/${uuidLike}/documents$`),
    name: "knowledge-bases.documents.create",
  },
  {
    method: "GET",
    pattern: new RegExp(`^/knowledge-bases/${uuidLike}/documents$`),
    name: "knowledge-bases.documents.list",
  },
  {
    method: "POST",
    pattern: new RegExp(`^/knowledge-bases/${uuidLike}/documents/upload$`),
    name: "knowledge-bases.documents.upload",
  },
  {
    method: "GET",
    pattern: new RegExp(
      `^/knowledge-bases/${uuidLike}/documents/${uuidLike}/preview$`,
    ),
    name: "knowledge-bases.documents.preview",
  },
  {
    method: "POST",
    pattern: new RegExp(
      `^/knowledge-bases/${uuidLike}/documents/${uuidLike}/ingest$`,
    ),
    name: "knowledge-bases.documents.ingest",
  },
  {
    method: "POST",
    pattern: new RegExp(
      `^/knowledge-bases/${uuidLike}/documents/${uuidLike}/ingest/async$`,
    ),
    name: "knowledge-bases.documents.ingest.async",
  },
  {
    method: "GET",
    pattern: new RegExp(
      `^/knowledge-bases/${uuidLike}/documents/${uuidLike}/extraction-runs$`,
    ),
    name: "knowledge-bases.documents.extraction-runs",
  },
  {
    method: "GET",
    pattern: new RegExp(
      `^/knowledge-bases/${uuidLike}/documents/${uuidLike}/extraction-runs/${uuidLike}$`,
    ),
    name: "knowledge-bases.documents.extraction-run.detail",
  },
  { method: "POST", pattern: /^\/documents$/, name: "documents.create" },
  {
    method: "POST",
    pattern: /^\/documents\/upload$/,
    name: "documents.upload",
  },
  {
    method: "GET",
    pattern: /^\/memories\/settings$/,
    name: "memories.settings",
  },
  {
    method: "PATCH",
    pattern: /^\/memories\/settings$/,
    name: "memories.settings.update",
  },
  { method: "GET", pattern: /^\/documents$/, name: "documents.list" },
  {
    method: "GET",
    pattern: new RegExp(`^/documents/${uuidLike}$`),
    name: "documents.detail",
  },
  {
    method: "DELETE",
    pattern: new RegExp(`^/documents/${uuidLike}$`),
    name: "documents.delete",
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
    method: "POST",
    pattern: new RegExp(`^/documents/${uuidLike}/ingest/async$`),
    name: "documents.ingest.async",
  },
  {
    method: "GET",
    pattern: new RegExp(`^/documents/${uuidLike}/extraction-runs$`),
    name: "documents.extraction-runs",
  },
  {
    method: "GET",
    pattern: new RegExp(`^/documents/${uuidLike}/extraction-runs/${uuidLike}$`),
    name: "documents.extraction-run.detail",
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
  return (
    path === "/auth/login" ||
    path === "/auth/guest/request" ||
    path === "/auth/guest/login" ||
    path === "/auth/signup" ||
    path === "/auth/verify-email" ||
    path === "/auth/password-reset/request" ||
    path === "/auth/password-reset/confirm" ||
    path === "/group-invitations/signup"
  );
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
      message: defaultLocalization.errors.pathNotAllowed,
    };
  }
  if (path === "/assistant/chat" || path.startsWith("/assistant/")) {
    return {
      allowed: false,
      status: 404,
      code: "legacy_chat_blocked",
      message: defaultLocalization.errors.legacyChatBlocked,
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
      message: defaultLocalization.errors.pathNotAllowlisted,
    };
  }
  return { allowed: true, params: { route: rule.name } };
}

export function isAllowedMutationContentType(headers: Headers) {
  const contentType = headers.get("content-type")?.toLowerCase();
  if (!contentType) return false;
  return (
    contentType.includes(JSON_CONTENT_TYPE) ||
    contentType.includes("multipart/form-data")
  );
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

  if (!isAllowedMutationContentType(headers)) {
    return {
      allowed: false,
      status: 415,
      code: "json_required",
      message: defaultLocalization.errors.jsonRequired,
    };
  }

  const secFetchSite = headers.get("sec-fetch-site");
  if (secFetchSite?.toLowerCase() === "cross-site") {
    return {
      allowed: false,
      status: 403,
      code: "cross_site_rejected",
      message: defaultLocalization.errors.crossSiteRejected,
    };
  }

  const expectedOrigin = resolveExpectedOrigin(requestUrl, configuredOrigin);
  const origin = headers.get("origin");
  if (origin && origin !== expectedOrigin) {
    return {
      allowed: false,
      status: 403,
      code: "origin_rejected",
      message: defaultLocalization.errors.originRejected,
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
        message: defaultLocalization.errors.refererInvalid,
      };
    }
    if (refererOrigin !== expectedOrigin) {
      return {
        allowed: false,
        status: 403,
        code: "referer_rejected",
        message: defaultLocalization.errors.refererRejected,
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

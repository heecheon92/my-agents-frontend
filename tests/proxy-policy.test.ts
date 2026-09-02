import { describe, expect, it } from "vitest";
import {
  buildBackendPath,
  isAllowedBackendPath,
  isCsrfExemptPath,
  validateSameOriginProof,
} from "@/server/my-agents/proxy-policy";

function headers(init: Record<string, string>) {
  return new Headers(init);
}

describe("proxy policy", () => {
  it("builds encoded backend paths", () => {
    expect(buildBackendPath(["conversations", "abc 123", "runs"])).toBe(
      "/conversations/abc%20123/runs",
    );
  });

  it("allowlists the temporary conversation file routes", () => {
    expect(
      isAllowedBackendPath("GET", "/capabilities/document-workspace").allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath("POST", "/conversations/c-1/attachments").allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath("GET", "/conversations/c-1/attachments").allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath("DELETE", "/conversations/c-1/attachments/a-1")
        .allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath("GET", "/conversations/c-1/artifacts").allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath("GET", "/conversations/c-1/artifacts/a-1/download")
        .allowed,
    ).toBe(true);
  });

  it("refuses methods the attachment routes do not serve", () => {
    // The allowlist is method-scoped. A capability endpoint that accepted a
    // mutation, or an attachment list that accepted a DELETE, would widen the
    // proxy past what the backend actually exposes.
    expect(
      isAllowedBackendPath("POST", "/capabilities/document-workspace").allowed,
    ).toBe(false);
    expect(
      isAllowedBackendPath("DELETE", "/conversations/c-1/attachments").allowed,
    ).toBe(false);
    expect(
      isAllowedBackendPath("DELETE", "/conversations/c-1/artifacts/a-1")
        .allowed,
    ).toBe(false);
    expect(
      isAllowedBackendPath("POST", "/conversations/c-1/artifacts/a-1/download")
        .allowed,
    ).toBe(false);
  });

  it("keeps attachment uploads and deletes inside CSRF protection", () => {
    // Both transfer or destroy provider-held user data. Neither may join the
    // pre-session exemption list.
    expect(isCsrfExemptPath("/conversations/c-1/attachments")).toBe(false);
    expect(isCsrfExemptPath("/conversations/c-1/attachments/a-1")).toBe(false);
  });

  it("allowlists product endpoints", () => {
    expect(
      isAllowedBackendPath("POST", "/conversations/abc/runs").allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath("PATCH", "/documents/doc-1/permissions").allowed,
    ).toBe(true);
    expect(isAllowedBackendPath("DELETE", "/documents/doc-1").allowed).toBe(
      true,
    );
    expect(isAllowedBackendPath("POST", "/documents/upload").allowed).toBe(
      true,
    );
    expect(
      isAllowedBackendPath("POST", "/documents/doc-1/ingest/async").allowed,
    ).toBe(true);
    expect(isAllowedBackendPath("GET", "/knowledge-bases/kb-1").allowed).toBe(
      true,
    );
    expect(isAllowedBackendPath("PATCH", "/knowledge-bases/kb-1").allowed).toBe(
      true,
    );
    expect(
      isAllowedBackendPath("DELETE", "/knowledge-bases/kb-1").allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath("GET", "/knowledge-bases/kb-1/documents").allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath("POST", "/knowledge-bases/kb-1/documents").allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath("POST", "/knowledge-bases/kb-1/documents/upload")
        .allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath(
        "POST",
        "/knowledge-bases/kb-1/documents/doc-1/ingest/async",
      ).allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath(
        "GET",
        "/knowledge-bases/kb-1/documents/doc-1/preview",
      ).allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath(
        "GET",
        "/knowledge-bases/kb-1/documents/doc-1/extraction-runs/run-1",
      ).allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath("GET", "/documents/doc-1/extraction-runs/run-1")
        .allowed,
    ).toBe(true);
    expect(isAllowedBackendPath("POST", "/auth/verify-email").allowed).toBe(
      true,
    );
    expect(isAllowedBackendPath("POST", "/auth/guest/request").allowed).toBe(
      true,
    );
    // `/guest` reads this before anyone signs in, so the proxy must pass it.
    // The deployed BFF rejected it as outside the allowlist, which the backend
    // agent flagged as a release blocker — worth a test rather than a memory.
    expect(isAllowedBackendPath("GET", "/auth/guest/policy").allowed).toBe(
      true,
    );
    // The composer reads this before rendering its reasoning controls. It is
    // read-only, so it stays out of the CSRF exemption list below.
    expect(isAllowedBackendPath("GET", "/capabilities/reasoning").allowed).toBe(
      true,
    );
    expect(
      isAllowedBackendPath("POST", "/capabilities/reasoning"),
    ).toMatchObject({ allowed: false, code: "path_not_allowed" });
    expect(isAllowedBackendPath("POST", "/auth/guest/login").allowed).toBe(
      true,
    );
    expect(
      isAllowedBackendPath("POST", "/auth/password-reset/request").allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath("POST", "/auth/password-reset/confirm").allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath("POST", "/conversations/abc/runs/stream").allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath("POST", "/conversations/abc/runs/run-1/cancel")
        .allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath("GET", "/conversations/abc/runs/run-1").allowed,
    ).toBe(true);
    expect(isAllowedBackendPath("DELETE", "/conversations/abc").allowed).toBe(
      true,
    );
    expect(
      isAllowedBackendPath(
        "POST",
        "/conversations/abc/messages/message-1/replay",
      ).allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath(
        "POST",
        "/conversations/abc/messages/message-1/replay/stream",
      ).allowed,
    ).toBe(true);
    expect(isAllowedBackendPath("GET", "/groups/group-1/members").allowed).toBe(
      true,
    );
    expect(isAllowedBackendPath("PATCH", "/auth/me/nickname").allowed).toBe(
      true,
    );
    expect(isAllowedBackendPath("PATCH", "/auth/me/password").allowed).toBe(
      true,
    );
    expect(isAllowedBackendPath("GET", "/memories/settings").allowed).toBe(
      true,
    );
    expect(isAllowedBackendPath("PATCH", "/memories/settings").allowed).toBe(
      true,
    );
    expect(
      isAllowedBackendPath("PATCH", "/groups/group-1/members/user-1").allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath(
        "POST",
        "/groups/group-1/publish-requests/request-1/cancel",
      ).allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath("POST", "/group-invitations/signup").allowed,
    ).toBe(true);
  });

  it("allowlists the durable-interaction resume and options endpoints", () => {
    // A missing rule here is rejected by the proxy as a 404 `path_not_allowed`
    // before the request ever reaches the backend, which reads as "the backend
    // does not implement this" — the exact confusion the reasoning endpoint
    // caused on its first deploy.
    expect(
      isAllowedBackendPath("POST", "/conversations/abc/runs/run-1/resume")
        .allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath(
        "POST",
        "/conversations/abc/runs/run-1/resume/stream",
      ).allowed,
    ).toBe(true);
    expect(
      isAllowedBackendPath(
        "GET",
        "/conversations/abc/runs/run-1/interactions/run-1:document_selection/options",
      ).allowed,
    ).toBe(true);
    // Resume is a mutation. Offering it over GET would put a state change
    // behind a link.
    expect(
      isAllowedBackendPath("GET", "/conversations/abc/runs/run-1/resume"),
    ).toMatchObject({ allowed: false, code: "path_not_allowed" });
    // Resume must not become CSRF-exempt: it is authenticated and mutating.
    expect(isCsrfExemptPath("/conversations/abc/runs/run-1/resume")).toBe(
      false,
    );
  });

  it("keeps a compound interaction id addressable through path encoding", () => {
    // `buildBackendPath` re-encodes every segment, so the colon in
    // `<run_id>:<interaction_type>` reaches the backend percent-encoded. That
    // is legal and the allowlist still matches, but it is a real difference
    // between what the frontend holds and what the backend receives, so pin it
    // rather than assume it round-trips.
    const built = buildBackendPath([
      "conversations",
      "abc",
      "runs",
      "run-1",
      "interactions",
      "run-1:document_selection",
      "options",
    ]);
    expect(built).toBe(
      "/conversations/abc/runs/run-1/interactions/run-1%3Adocument_selection/options",
    );
    expect(isAllowedBackendPath("GET", built).allowed).toBe(true);
  });

  it("blocks direct member creation, legacy assistant chat, and unknown paths before forwarding", () => {
    expect(
      isAllowedBackendPath("POST", "/groups/group-1/members"),
    ).toMatchObject({
      allowed: false,
      code: "path_not_allowed",
    });
    expect(isAllowedBackendPath("GET", "/auth/me/nickname")).toMatchObject({
      allowed: false,
      code: "path_not_allowed",
    });
    expect(isAllowedBackendPath("POST", "/memories/settings")).toMatchObject({
      allowed: false,
      code: "path_not_allowed",
    });
    expect(isAllowedBackendPath("POST", "/assistant/chat")).toMatchObject({
      allowed: false,
      code: "legacy_chat_blocked",
    });
    expect(isAllowedBackendPath("GET", "/not-real")).toMatchObject({
      allowed: false,
      code: "path_not_allowed",
    });
  });

  it("exempts unauthenticated auth lifecycle mutations from CSRF cookies", () => {
    expect(isCsrfExemptPath("/auth/signup")).toBe(true);
    expect(isCsrfExemptPath("/auth/verify-email")).toBe(true);
    // Read-only, so it needs no CSRF exemption — exempting it would widen the
    // mutation bypass list for no reason.
    expect(isCsrfExemptPath("/auth/guest/policy")).toBe(false);
    expect(isCsrfExemptPath("/auth/guest/request")).toBe(true);
    expect(isCsrfExemptPath("/auth/guest/login")).toBe(true);
    expect(isCsrfExemptPath("/auth/password-reset/request")).toBe(true);
    expect(isCsrfExemptPath("/auth/password-reset/confirm")).toBe(true);
    expect(isCsrfExemptPath("/group-invitations/signup")).toBe(true);
    expect(isCsrfExemptPath("/group-invitations/accept")).toBe(false);
    expect(isCsrfExemptPath("/auth/logout")).toBe(false);
    expect(isCsrfExemptPath("/auth/me/nickname")).toBe(false);
    expect(isCsrfExemptPath("/auth/me/password")).toBe(false);
    expect(isCsrfExemptPath("/memories/settings")).toBe(false);
  });

  it("rejects cross-site mutations", () => {
    expect(
      validateSameOriginProof({
        method: "POST",
        requestUrl: "http://localhost:3000/api/my-agents/auth/logout",
        configuredOrigin: "http://localhost:3000",
        headers: headers({
          "content-type": "application/json",
          origin: "https://evil.example",
        }),
      }),
    ).toMatchObject({ allowed: false, code: "origin_rejected" });
  });

  it("rejects fetch metadata cross-site mutations", () => {
    expect(
      validateSameOriginProof({
        method: "POST",
        requestUrl: "http://localhost:3000/api/my-agents/auth/logout",
        configuredOrigin: "http://localhost:3000",
        headers: headers({
          "content-type": "application/json",
          origin: "http://localhost:3000",
          "sec-fetch-site": "cross-site",
        }),
      }),
    ).toMatchObject({ allowed: false, code: "cross_site_rejected" });
  });

  it("rejects simple form mutation content types", () => {
    expect(
      validateSameOriginProof({
        method: "POST",
        requestUrl: "http://localhost:3000/api/my-agents/auth/logout",
        configuredOrigin: "http://localhost:3000",
        headers: headers({
          "content-type": "application/x-www-form-urlencoded",
          origin: "http://localhost:3000",
        }),
      }),
    ).toMatchObject({ allowed: false, code: "json_required" });
  });

  it("accepts same-origin multipart mutations for PDF upload", () => {
    expect(
      validateSameOriginProof({
        method: "POST",
        requestUrl: "http://localhost:3000/api/my-agents/documents/upload",
        configuredOrigin: "http://localhost:3000",
        headers: headers({
          "content-type": "multipart/form-data; boundary=test",
          origin: "http://localhost:3000",
          "sec-fetch-site": "same-origin",
        }),
      }),
    ).toMatchObject({ allowed: true });
  });

  it("accepts same-origin JSON mutations for team upload staging", () => {
    expect(
      validateSameOriginProof({
        method: "POST",
        requestUrl:
          "http://localhost:3000/api/my-agents/knowledge-bases/team-upload-staging",
        configuredOrigin: "http://localhost:3000",
        headers: headers({
          "content-type": "application/json",
          origin: "http://localhost:3000",
          "sec-fetch-site": "same-origin",
        }),
      }),
    ).toMatchObject({ allowed: true });
  });

  it("accepts same-origin publish request source reads", () => {
    expect(
      validateSameOriginProof({
        method: "GET",
        requestUrl:
          "http://localhost:3000/api/my-agents/groups/00000000-0000-4000-8000-000000000001/publish-requests/00000000-0000-4000-8000-000000000002/source",
        configuredOrigin: "http://localhost:3000",
        headers: headers({
          origin: "http://localhost:3000",
          "sec-fetch-site": "same-origin",
        }),
      }),
    ).toMatchObject({ allowed: true });
  });

  it("accepts same-origin JSON mutations", () => {
    expect(
      validateSameOriginProof({
        method: "POST",
        requestUrl: "http://localhost:3000/api/my-agents/conversations",
        configuredOrigin: "http://localhost:3000",
        headers: headers({
          "content-type": "application/json",
          origin: "http://localhost:3000",
          "sec-fetch-site": "same-origin",
        }),
      }),
    ).toMatchObject({ allowed: true });
  });

  it("accepts an explicitly configured public demo origin", () => {
    expect(
      validateSameOriginProof({
        method: "POST",
        requestUrl: "https://demo.example.com/api/my-agents/auth/logout",
        configuredOrigin: "https://demo.example.com",
        headers: headers({
          "content-type": "application/json",
          origin: "https://demo.example.com",
          "sec-fetch-site": "same-origin",
        }),
      }),
    ).toMatchObject({ allowed: true });
  });

  it("rejects localhost and 127.0.0.1 origin mismatches for cookie auth", () => {
    expect(
      validateSameOriginProof({
        method: "POST",
        requestUrl: "http://localhost:3000/api/my-agents/auth/logout",
        configuredOrigin: "http://localhost:3000",
        headers: headers({
          "content-type": "application/json",
          origin: "http://127.0.0.1:3000",
        }),
      }),
    ).toMatchObject({ allowed: false, code: "origin_rejected" });
  });
});

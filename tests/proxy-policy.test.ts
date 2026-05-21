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
    expect(isAllowedBackendPath("POST", "/auth/verify-email").allowed).toBe(
      true,
    );
    expect(isAllowedBackendPath("POST", "/auth/guest/request").allowed).toBe(
      true,
    );
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
      isAllowedBackendPath("GET", "/conversations/abc/runs/run-1").allowed,
    ).toBe(true);
  });

  it("blocks legacy assistant chat and unknown paths before forwarding", () => {
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
    expect(isCsrfExemptPath("/auth/guest/request")).toBe(true);
    expect(isCsrfExemptPath("/auth/guest/login")).toBe(true);
    expect(isCsrfExemptPath("/auth/password-reset/request")).toBe(true);
    expect(isCsrfExemptPath("/auth/password-reset/confirm")).toBe(true);
    expect(isCsrfExemptPath("/auth/logout")).toBe(false);
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

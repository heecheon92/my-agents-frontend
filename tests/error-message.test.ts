import { describe, expect, it } from "vitest";
import { MyAgentsAPIError } from "@/services/my-agents/MyAgentsAPIError";
import { resolveErrorMessage } from "@/utils/error-message";
import { defaultLocalization } from "@/utils/localization";

const errors = defaultLocalization.errors.byStatus;

function apiError(status: number, detail?: string) {
  return new MyAgentsAPIError({
    message: detail ?? "failed",
    status,
    detail,
  });
}

describe("resolveErrorMessage", () => {
  it("maps API status codes to localized copy", () => {
    expect(resolveErrorMessage(apiError(401))).toBe(errors.unauthorized);
    expect(resolveErrorMessage(apiError(403))).toBe(errors.forbidden);
    expect(resolveErrorMessage(apiError(404))).toBe(errors.notFound);
    expect(resolveErrorMessage(apiError(409))).toBe(errors.conflict);
    expect(resolveErrorMessage(apiError(413))).toBe(errors.payloadTooLarge);
    expect(resolveErrorMessage(apiError(422))).toBe(errors.unprocessable);
    expect(resolveErrorMessage(apiError(429))).toBe(errors.tooManyRequests);
    expect(resolveErrorMessage(apiError(500))).toBe(errors.server);
    expect(resolveErrorMessage(apiError(503))).toBe(errors.server);
    expect(resolveErrorMessage(apiError(0))).toBe(errors.network);
    expect(resolveErrorMessage(apiError(418))).toBe(errors.unknown);
  });

  it("never renders the backend detail, which is English-only prose", () => {
    expect(
      resolveErrorMessage(apiError(403, "Guest prompt limit reached")),
    ).toBe(errors.forbidden);
  });

  it("never leaks a raw non-API error message", () => {
    // A zod parse failure carries internal field paths.
    const zodish = new Error(
      'Invalid input: expected string, received undefined at "user.email"',
    );
    expect(resolveErrorMessage(zodish)).toBe(
      defaultLocalization.status.defaultErrorDescription,
    );
    expect(resolveErrorMessage(zodish)).not.toContain("user.email");

    expect(resolveErrorMessage("a bare string")).toBe(
      defaultLocalization.status.defaultErrorDescription,
    );
    expect(resolveErrorMessage(undefined)).toBe(
      defaultLocalization.status.defaultErrorDescription,
    );
  });

  it("reports a fetch failure as a network problem", () => {
    expect(resolveErrorMessage(new TypeError("Failed to fetch"))).toBe(
      errors.network,
    );
  });

  it("keeps secrets and internals out of the rendered message", () => {
    const leaky = [
      "Traceback (most recent call last): File x",
      "at handler (/Users/someone/app/server.py:42)",
      "session=8f14e45fceea167a5a36dedd4bea2543abcdefgh",
      "csrf token mismatch for 3f2504e0-4f89-11d3-9a0c-0305e82c3301",
      "Bearer sk-abcdefghijklmnopqrstuvwxyz012345",
      "<script>alert(1)</script>",
      "x".repeat(400),
      "line one\nline two",
    ];

    for (const detail of leaky) {
      // Whatever the backend puts in `detail` or `message`, the user sees only
      // the localized status copy.
      const rendered = resolveErrorMessage(apiError(500, detail));
      expect(rendered).toBe(errors.server);
      expect(rendered).not.toContain(detail);
    }
  });

  it("returns Korean copy for every branch", () => {
    // The provider is hardcoded to `ko`, so every path must land on Hangul —
    // an English string reaching the UI is the bug this module exists to stop.
    const samples = [
      resolveErrorMessage(apiError(401, "Not authenticated")),
      resolveErrorMessage(apiError(500, "Internal Server Error")),
      resolveErrorMessage(new TypeError("Failed to fetch")),
      resolveErrorMessage(new Error("ZodError: invalid_type")),
      resolveErrorMessage("bare string"),
    ];

    for (const message of samples) {
      expect(message).toMatch(/[가-힣]/);
      expect(message).not.toMatch(/[A-Za-z]{4,}/);
    }
  });
});

describe("backend error codes", () => {
  function codedError(status: number, code: string) {
    return new MyAgentsAPIError({
      message: "failed",
      status,
      detail: "English prose from the backend",
      body: { detail: "English prose from the backend", code },
    });
  }

  it("prefers the machine-readable code over the status", () => {
    // The whole point: a guest hitting a limit gets specific Korean, not the
    // generic 403 copy it would otherwise fall back to.
    const message = resolveErrorMessage(
      codedError(403, "guest_prompt_limit_reached"),
    );
    expect(message).toBe(
      defaultLocalization.errors.byCode.guest_prompt_limit_reached,
    );
    expect(message).not.toBe(errors.forbidden);
    expect(message).toMatch(/[가-힣]/);
  });

  it("localizes every code the backend documents", () => {
    for (const [code, copy] of Object.entries(
      defaultLocalization.errors.byCode,
    )) {
      expect(resolveErrorMessage(codedError(400, code)), code).toBe(copy);
      expect(copy, code).toMatch(/[가-힣]/);
    }
  });

  it("falls back to status for an unknown or absent code", () => {
    // Backends without the field, and codes added after this release, must
    // behave exactly as they did before.
    expect(resolveErrorMessage(codedError(404, "some_future_code"))).toBe(
      errors.notFound,
    );
    expect(resolveErrorMessage(apiError(404))).toBe(errors.notFound);
  });

  it("still never renders the English detail alongside the code", () => {
    const message = resolveErrorMessage(codedError(413, "upload_too_large"));
    expect(message).not.toContain("English prose");
    expect(message).not.toMatch(/[A-Za-z]{4,}/);
  });
});

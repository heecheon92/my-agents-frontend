import { describe, expect, it } from "vitest";
import {
  acceptedResponseSchema,
  backendLoginResponseSchema,
  loginResponseSchema,
  passwordResetConfirmRequestSchema,
  signupResponseSchema,
  userSchema,
  verifyEmailRequestSchema,
} from "@/model/my-agents";

const user = {
  id: "u1",
  email: "user@example.com",
  email_verified_at: null,
};

describe("auth response schemas", () => {
  it("parses current safe user payloads with email verification state", () => {
    expect(userSchema.parse(user)).toEqual(user);
  });

  it("parses backend-local datetime strings for verified users", () => {
    const verified = {
      ...user,
      email_verified_at: "2026-05-20T04:49:38.581993",
    };
    expect(userSchema.parse(verified)).toEqual(verified);
  });

  it("parses signup responses as backend user envelopes", () => {
    expect(
      signupResponseSchema.parse({
        user,
        verification_email_sent: true,
      }),
    ).toEqual({
      user,
      verification_email_sent: true,
    });
  });

  it("parses backend CSRF response separately from browser-safe response", () => {
    const backend = backendLoginResponseSchema.parse({
      user,
      csrf_token: "csrf-secret",
    });
    expect(backend.csrf_token).toBe("csrf-secret");

    const browserSafe = loginResponseSchema.parse({ user: backend.user });
    expect(browserSafe).toEqual({ user });
    expect("csrf_token" in browserSafe).toBe(false);
  });

  it("rejects leaked CSRF fields in browser-visible login responses", () => {
    expect(() =>
      loginResponseSchema.parse({
        user,
        csrf_token: "csrf-secret",
      }),
    ).toThrow();
  });

  it("parses new auth request and accepted response contracts", () => {
    expect(verifyEmailRequestSchema.parse({ token: "verify-token" })).toEqual({
      token: "verify-token",
    });
    expect(
      passwordResetConfirmRequestSchema.parse({
        token: "reset-token",
        new_password: "password123",
      }),
    ).toEqual({ token: "reset-token", new_password: "password123" });
    expect(acceptedResponseSchema.parse({})).toEqual({ status: "accepted" });
  });
});

import { describe, expect, it } from "vitest";
import {
  acceptedResponseSchema,
  accountNicknameUpdateRequestSchema,
  accountPasswordUpdateRequestSchema,
  backendLoginResponseSchema,
  canManageSystemKnowledge,
  guestAccessRequestSchema,
  guestAccessResponseSchema,
  guestLoginRequestSchema,
  loginResponseSchema,
  passwordResetConfirmRequestSchema,
  signupRequestSchema,
  signupResponseSchema,
  userSchema,
  verifyEmailRequestSchema,
} from "@/model/my-agents";

const user = {
  id: "u1",
  email: "user@example.com",
  nickname: "Test User",
  email_verified_at: null,
  can_manage_system_knowledge: false,
};

describe("auth response schemas", () => {
  it("parses current safe user payloads with email verification state", () => {
    expect(userSchema.parse(user)).toEqual(user);
  });

  it("defaults system knowledge management capability closed", () => {
    const parsed = userSchema.parse({
      id: "u1",
      email: "user@example.com",
      nickname: "Test User",
      email_verified_at: null,
    });

    expect(parsed.can_manage_system_knowledge).toBe(false);
    expect(canManageSystemKnowledge(parsed)).toBe(false);
  });

  it("parses read-only user type and canonical system management capability", () => {
    const manager = userSchema.parse({
      ...user,
      user_type: "root",
      can_manage_system_knowledge: true,
    });
    const rawUserTypeOnly = userSchema.parse({
      ...user,
      user_type: "system",
    });

    expect(manager.user_type).toBe("root");
    expect(canManageSystemKnowledge(manager)).toBe(true);
    expect(canManageSystemKnowledge(rawUserTypeOnly)).toBe(false);
  });

  it("parses backend-local datetime strings for verified users", () => {
    const verified = {
      ...user,
      email_verified_at: "2026-05-20T04:49:38.581993",
    };
    expect(userSchema.parse(verified)).toEqual(verified);
  });

  it("validates signup requests with a trimmed required display name", () => {
    expect(
      signupRequestSchema.parse({
        email: "user@example.com",
        nickname: "  Shared Name  ",
        password: "password123",
      }),
    ).toEqual({
      email: "user@example.com",
      nickname: "Shared Name",
      password: "password123",
    });
    expect(() =>
      signupRequestSchema.parse({
        email: "user@example.com",
        password: "password123",
      }),
    ).toThrow();
    expect(() =>
      signupRequestSchema.parse({
        email: "user@example.com",
        nickname: "   ",
        password: "password123",
      }),
    ).toThrow();
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
      approval_required: false,
    });
  });

  it("parses pending-approval signup responses from the backend", () => {
    const pendingUser = {
      ...user,
      approval_status: "pending",
    };

    expect(
      signupResponseSchema.parse({
        user: pendingUser,
        verification_email_sent: false,
        approval_required: true,
      }),
    ).toEqual({
      user: pendingUser,
      verification_email_sent: false,
      approval_required: true,
    });
  });

  it("parses guest access email requests, acknowledgements, and code redeem requests", () => {
    expect(
      guestAccessRequestSchema.parse({ email: "guest@example.com" }),
    ).toEqual({
      email: "guest@example.com",
    });
    expect(guestAccessResponseSchema.parse({})).toEqual({
      status: "accepted",
    });
    expect(guestLoginRequestSchema.parse({ code: "guest-code" })).toEqual({
      code: "guest-code",
    });
  });

  it("parses guest users from the backend session response", () => {
    const guest = {
      id: "guest-1",
      email: null,
      nickname: "Guest",
      email_verified_at: null,
      is_guest: true,
      guest_expires_at: "2026-05-22T00:00:00Z",
    };

    const parsedGuest = {
      ...guest,
      can_manage_system_knowledge: false,
    };

    expect(userSchema.parse(guest)).toEqual(parsedGuest);
    expect(loginResponseSchema.parse({ user: guest })).toEqual({
      user: parsedGuest,
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

  it("validates account nickname and password update request contracts", () => {
    expect(
      accountNicknameUpdateRequestSchema.parse({
        current_password: "current-password",
        nickname: "  Shared Name  ",
      }),
    ).toEqual({
      current_password: "current-password",
      nickname: "Shared Name",
    });
    expect(() =>
      accountNicknameUpdateRequestSchema.parse({
        current_password: "current-password",
        nickname: "   ",
      }),
    ).toThrow();
    expect(() =>
      accountNicknameUpdateRequestSchema.parse({
        current_password: "current-password",
        nickname: "x".repeat(41),
      }),
    ).toThrow();
    expect(() =>
      accountNicknameUpdateRequestSchema.parse({
        current_password: "current-password",
        nickname: "Manager",
        user_type: "root",
      }),
    ).toThrow();

    expect(
      accountPasswordUpdateRequestSchema.parse({
        current_password: "current-password",
        new_password: "password123",
      }),
    ).toEqual({
      current_password: "current-password",
      new_password: "password123",
    });
    expect(() =>
      accountPasswordUpdateRequestSchema.parse({
        current_password: "current-password",
        new_password: "short",
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

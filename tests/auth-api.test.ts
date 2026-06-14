import { describe, expect, it } from "vitest";
import { MyAgentsAuthAPI } from "@/services/my-agents/MyAgentsAuthAPI";

const user = {
  id: "u1",
  email: "user@example.com",
  nickname: "Test User",
  email_verified_at: null,
};

describe("MyAgentsAuthAPI", () => {
  it("returns the current backend signup response envelope", async () => {
    const api = new MyAgentsAuthAPI({
      fetch: async () => ({
        user,
        verification_email_sent: true,
      }),
    });

    await expect(
      api.signup({
        email: "user@example.com",
        password: "password123",
        nickname: "Test User",
      }),
    ).resolves.toEqual({
      user,
      verification_email_sent: true,
      approval_required: false,
    });
  });

  it("requests guest access by email and redeems codes separately", async () => {
    const calls: Array<{
      path: string;
      init?: { method?: string; body?: unknown };
    }> = [];
    const api = new MyAgentsAuthAPI({
      fetch: async (path, init) => {
        calls.push({ path, init });
        if (path === "/auth/guest/request") return { status: "accepted" };
        if (path === "/auth/guest/login") return { user };
        return null;
      },
    });

    await expect(
      api.requestGuestAccess({ email: "guest@example.com" }),
    ).resolves.toEqual({ status: "accepted" });
    await expect(api.loginGuest("guest-code")).resolves.toEqual({ user });
    expect(calls).toEqual([
      {
        path: "/auth/guest/request",
        init: { method: "POST", body: { email: "guest@example.com" } },
      },
      {
        path: "/auth/guest/login",
        init: { method: "POST", body: { code: "guest-code" } },
      },
    ]);
  });

  it("wires verification and password-reset auth endpoints", async () => {
    const calls: Array<{ path: string; init?: unknown }> = [];
    const api = new MyAgentsAuthAPI({
      fetch: async (path, init) => {
        calls.push({ path, init });
        if (path === "/auth/verify-email") return user;
        if (path === "/auth/password-reset/request") {
          return { status: "accepted" };
        }
        return null;
      },
    });

    await expect(api.verifyEmail({ token: "verify-token" })).resolves.toEqual(
      user,
    );
    await expect(
      api.requestPasswordReset({ email: "user@example.com" }),
    ).resolves.toEqual({ status: "accepted" });
    await expect(
      api.confirmPasswordReset({
        token: "reset-token",
        new_password: "password123",
      }),
    ).resolves.toBeUndefined();

    expect(calls.map((call) => call.path)).toEqual([
      "/auth/verify-email",
      "/auth/password-reset/request",
      "/auth/password-reset/confirm",
    ]);
  });
});

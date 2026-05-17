import { describe, expect, it } from "vitest";
import {
  backendLoginResponseSchema,
  loginResponseSchema,
} from "@/model/my-agents";

describe("login response schemas", () => {
  it("parses backend CSRF response separately from browser-safe response", () => {
    const backend = backendLoginResponseSchema.parse({
      user: { id: "u1", email: "user@example.com" },
      csrf_token: "csrf-secret",
    });
    expect(backend.csrf_token).toBe("csrf-secret");

    const browserSafe = loginResponseSchema.parse({ user: backend.user });
    expect(browserSafe).toEqual({
      user: { id: "u1", email: "user@example.com" },
    });
    expect("csrf_token" in browserSafe).toBe(false);
  });
});

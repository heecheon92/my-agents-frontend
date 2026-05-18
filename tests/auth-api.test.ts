import { describe, expect, it } from "vitest";
import { MyAgentsAuthAPI } from "@/services/my-agents/MyAgentsAuthAPI";

describe("MyAgentsAuthAPI", () => {
  it("returns the backend signup envelope instead of parsing it as a bare user", async () => {
    const api = new MyAgentsAuthAPI({
      fetch: async () => ({
        user: { id: "u1", email: "user@example.com" },
        verification_email_sent: true,
      }),
    });

    await expect(
      api.signup({ email: "user@example.com", password: "password123" }),
    ).resolves.toEqual({
      user: { id: "u1", email: "user@example.com" },
      verification_email_sent: true,
    });
  });
});

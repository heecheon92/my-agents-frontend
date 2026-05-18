import { describe, expect, it } from "vitest";
import { MyAgentsAuthAPI } from "@/services/my-agents/MyAgentsAuthAPI";

describe("MyAgentsAuthAPI", () => {
  it("returns the backend signup user response", async () => {
    const api = new MyAgentsAuthAPI({
      fetch: async () => ({
        id: "u1",
        email: "user@example.com",
      }),
    });

    await expect(
      api.signup({ email: "user@example.com", password: "password123" }),
    ).resolves.toEqual({
      id: "u1",
      email: "user@example.com",
    });
  });
});

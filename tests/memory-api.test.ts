import { describe, expect, it } from "vitest";
import { MyAgentsMemoryAPI } from "@/services/my-agents/MyAgentsMemoryAPI";

describe("MyAgentsMemoryAPI", () => {
  it("gets and updates memory settings through the approved settings endpoint", async () => {
    const calls: Array<{ path: string; init?: unknown }> = [];
    const api = new MyAgentsMemoryAPI({
      fetch: async (path, init) => {
        calls.push({ path, init });
        return {
          enabled: Boolean(init),
          updated_at: "2026-06-14T05:59:22Z",
        };
      },
    });

    await expect(api.getSettings()).resolves.toEqual({
      enabled: false,
      updated_at: "2026-06-14T05:59:22Z",
    });
    await expect(api.updateSettings({ enabled: true })).resolves.toEqual({
      enabled: true,
      updated_at: "2026-06-14T05:59:22Z",
    });

    expect(calls).toEqual([
      { path: "/memories/settings", init: undefined },
      {
        path: "/memories/settings",
        init: { method: "PATCH", body: { enabled: true } },
      },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import {
  userMemorySettingsPatchRequestSchema,
  userMemorySettingsSchema,
} from "@/model/my-agents";

describe("memory settings schemas", () => {
  it("parses strict user memory settings responses and patch payloads", () => {
    expect(
      userMemorySettingsSchema.parse({
        enabled: false,
        updated_at: "2026-06-14T05:59:22Z",
      }),
    ).toEqual({
      enabled: false,
      updated_at: "2026-06-14T05:59:22Z",
    });
    expect(
      userMemorySettingsPatchRequestSchema.parse({ enabled: true }),
    ).toEqual({ enabled: true });
  });

  it("rejects raw memory content or client-controlled metadata fields", () => {
    expect(() =>
      userMemorySettingsSchema.parse({
        enabled: true,
        updated_at: "2026-06-14T05:59:22Z",
        memories: [],
      }),
    ).toThrow();
    expect(() =>
      userMemorySettingsPatchRequestSchema.parse({
        enabled: true,
        ttl_days: 30,
      }),
    ).toThrow();
  });
});

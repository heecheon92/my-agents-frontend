import { describe, expect, it } from "vitest";
import en from "@/localization/en.json";
import ko from "@/localization/ko.json";

function collectShape(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return [prefix];
  if (!value || typeof value !== "object") return [prefix];

  return Object.entries(value).flatMap(([key, child]) =>
    collectShape(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("localization dictionaries", () => {
  it("keeps Korean and English dictionaries shape-compatible", () => {
    expect(collectShape(en).sort()).toEqual(collectShape(ko).sort());
  });

  it("includes settings navigation and route tab copy", () => {
    expect(en.service.nav.settings).toBeTruthy();
    expect(ko.service.nav.settings).toBeTruthy();
    expect(en.settings.tabs.account).toBeTruthy();
    expect(en.settings.tabs.experimental).toBeTruthy();
    expect(ko.settings.tabs.account).toBeTruthy();
    expect(ko.settings.tabs.experimental).toBeTruthy();
  });

  it("includes required onboarding shell copy", () => {
    const requiredKeys = [
      "eyebrow",
      "promptEyebrow",
      "guestPromptTitle",
      "guestPromptBody",
      "start",
      "notNow",
      "skip",
      "back",
      "next",
      "done",
      "progress",
      "targetFallback",
    ] as const;

    for (const key of requiredKeys) {
      expect(en.onboarding[key]).toBeTruthy();
      expect(ko.onboarding[key]).toBeTruthy();
    }
  });
});

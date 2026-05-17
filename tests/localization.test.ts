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
});

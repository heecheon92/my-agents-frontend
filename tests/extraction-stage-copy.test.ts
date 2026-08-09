import { describe, expect, it } from "vitest";
import { describeExtractionStage } from "@/components/admin-surfaces/shared";
import en from "@/localization/en.json";
import ko from "@/localization/ko.json";
import { extractionRunStageSchema } from "@/model/my-agents/knowledge";

describe("describeExtractionStage", () => {
  it("localizes every stage the schema allows", () => {
    // Driven off the zod enum, so adding a backend stage without copy fails
    // here rather than leaking the raw value into the UI.
    for (const stage of extractionRunStageSchema.options) {
      const korean = describeExtractionStage(stage, ko.admin);
      expect(korean, stage).toMatch(/[가-힣]/);
      expect(korean, stage).not.toBe(stage);
      expect(describeExtractionStage(stage, en.admin), stage).not.toBe("");
    }
  });

  it("degrades readably for a stage it has never seen", () => {
    expect(describeExtractionStage("vector_upsert", ko.admin)).toBe(
      "Vector upsert",
    );
  });

  it("renders nothing when the backend omits the stage", () => {
    expect(describeExtractionStage(null, ko.admin)).toBe("");
    expect(describeExtractionStage(undefined, ko.admin)).toBe("");
  });
});

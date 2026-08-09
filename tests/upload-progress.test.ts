import { describe, expect, it } from "vitest";
import { resolveUploadProgress } from "@/components/admin-surfaces/UploadQueueRow";
import ko from "@/localization/ko.json";

const copy = ko.admin.documents;
const item = (
  overrides: Partial<Parameters<typeof resolveUploadProgress>[0]>,
) => ({ status: "ingesting" as const, progressPercent: 0, ...overrides });

describe("resolveUploadProgress", () => {
  it("shows no bar while the job is only queued", () => {
    // This is the regression that got the original progress bar removed in
    // a081ef6: the backend scale starts at `queued 0`, and a bar at 0% claims
    // "stuck" about a job that is simply waiting for a worker.
    const progress = resolveUploadProgress(
      item({ stage: "queued", progressPercent: 0 }),
      copy,
    );
    expect(progress?.percent).toBeNull();
    expect(progress?.label).toBe(copy.stages.queued);
  });

  it("shows no bar when the backend has not reported a stage", () => {
    const progress = resolveUploadProgress(item({ progressPercent: 0 }), copy);
    expect(progress?.percent).toBeNull();
    expect(progress?.label).toBe(copy.progressWaitingForWorker);
  });

  it("shows stage and percentage once a worker has claimed the job", () => {
    const progress = resolveUploadProgress(
      item({ stage: "embedding", progressPercent: 45 }),
      copy,
    );
    expect(progress?.percent).toBe(45);
    expect(progress?.label).toContain(copy.stages.embedding);
    expect(progress?.label).toContain("45");
  });

  it("stays indeterminate outside ingestion", () => {
    // Upload and publish have no real byte or request progress to report.
    for (const status of [
      "selected",
      "uploading",
      "uploaded",
      "publishing",
      "completed",
      "failed",
    ] as const) {
      expect(
        resolveUploadProgress(
          item({ status, stage: "embedding", progressPercent: 45 }),
          copy,
        ),
        status,
      ).toBeNull();
    }
  });

  it("clamps values outside 0-100", () => {
    expect(
      resolveUploadProgress(
        item({ stage: "embedding", progressPercent: 140 }),
        copy,
      )?.percent,
    ).toBe(100);
    expect(
      resolveUploadProgress(
        item({ stage: "embedding", progressPercent: -5 }),
        copy,
      )?.percent,
    ).toBe(0);
  });

  it("localizes every stage the backend can report", () => {
    for (const stage of Object.keys(copy.stages)) {
      const progress = resolveUploadProgress(
        item({ stage, progressPercent: 50 }),
        copy,
      );
      expect(progress?.label, stage).toMatch(/[가-힣]/);
      expect(progress?.label, stage).not.toContain(stage);
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  isBinaryDownloadPath,
  isStreamPath,
} from "@/app/api/my-agents/[...path]/route";

describe("isBinaryDownloadPath", () => {
  it("matches the artifact download route", () => {
    expect(
      isBinaryDownloadPath("/conversations/c-1/artifacts/a-1/download"),
    ).toBe(true);
  });

  it("leaves every neighbouring route on the JSON path", () => {
    // The regression this guards. `route.ts` reads a non-matching response with
    // `.text()`, which UTF-8-decodes the body: a matcher that was too narrow
    // would silently corrupt every downloaded artifact, and one that was too
    // wide would stream a JSON error envelope past the error handling.
    expect(isBinaryDownloadPath("/conversations/c-1/artifacts")).toBe(false);
    expect(isBinaryDownloadPath("/conversations/c-1/artifacts/a-1")).toBe(
      false,
    );
    expect(
      isBinaryDownloadPath("/conversations/c-1/artifacts/a-1/download/extra"),
    ).toBe(false);
    expect(isBinaryDownloadPath("/conversations/c-1/attachments")).toBe(false);
  });

  it("does not overlap the streaming matcher", () => {
    // Both branches return early. If a path matched both, whichever branch is
    // written first would win by accident rather than by decision.
    const paths = [
      "/conversations/c-1/artifacts/a-1/download",
      "/conversations/c-1/runs/stream",
      "/conversations/c-1/runs/r-1/resume/stream",
      "/conversations/c-1/messages/m-1/replay/stream",
    ];
    for (const path of paths) {
      expect(isBinaryDownloadPath(path) && isStreamPath(path)).toBe(false);
    }
  });
});

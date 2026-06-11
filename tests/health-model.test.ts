import { describe, expect, it } from "vitest";
import {
  documentUploadConcurrencyFromHealth,
  healthResponseSchema,
} from "@/model/my-agents";

describe("health response model", () => {
  it("reads the backend document upload concurrency hint", () => {
    const health = healthResponseSchema.parse({
      status: "ok",
      service: "my-agents",
      version: "0.1.0",
      frontend_config: {
        documents: {
          upload_concurrency: 5,
        },
      },
    });

    expect(documentUploadConcurrencyFromHealth(health)).toBe(5);
  });

  it("falls back to the historical frontend upload concurrency when omitted", () => {
    const health = healthResponseSchema.parse({
      status: "ok",
      service: "my-agents",
      version: "0.1.0",
    });

    expect(documentUploadConcurrencyFromHealth(health)).toBe(3);
    expect(documentUploadConcurrencyFromHealth(undefined)).toBe(3);
  });
});

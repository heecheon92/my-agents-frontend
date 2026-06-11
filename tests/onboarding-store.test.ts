import { describe, expect, it } from "vitest";
import {
  ONBOARDING_VERSION,
  onboardingSteps,
  stepsForFlow,
} from "@/components/onboarding/onboarding-steps";
import {
  guestSessionKey,
  type OnboardingStore,
  opaqueIdentityBucket,
  serializeOnboardingPersistence,
} from "@/components/onboarding/onboarding-store";
import en from "@/localization/en.json";
import ko from "@/localization/ko.json";

describe("onboarding plan", () => {
  it("defines a complete guest flow with real target ids", () => {
    const guestSteps = stepsForFlow("guest");

    expect(guestSteps).toHaveLength(5);
    expect(guestSteps.map((step) => step.id)).toEqual([
      "guest-limits",
      "guest-ask",
      "guest-sources",
      "guest-add-sources",
      "guest-evidence",
    ]);
    expect(guestSteps.every((step) => step.targetId.length > 0)).toBe(true);
  });

  it("defines a complete authenticated new-user flow on real routes", () => {
    const newUserSteps = stepsForFlow("new-user");

    expect(newUserSteps.map((step) => step.id)).toEqual([
      "new-knowledge-space",
      "new-upload-source",
      "new-chat-thread",
      "new-select-knowledge",
      "new-ask-question",
      "new-review-evidence",
    ]);
    expect(new Set(newUserSteps.map((step) => step.path))).toEqual(
      new Set(["/knowledge", "/chat"]),
    );
    expect(newUserSteps.every((step) => step.targetId.length > 0)).toBe(true);
  });

  it("has localized copy for every step key", () => {
    for (const step of onboardingSteps) {
      expect(en.onboarding.steps).toHaveProperty(step.titleKey);
      expect(en.onboarding.steps).toHaveProperty(step.bodyKey);
      expect(ko.onboarding.steps).toHaveProperty(step.titleKey);
      expect(ko.onboarding.steps).toHaveProperty(step.bodyKey);
    }
  });
});

describe("onboarding persistence", () => {
  it("stores guest decisions in a versioned session bucket", () => {
    expect(guestSessionKey("guest")).toBe(
      `my-agents:onboarding:guest:guest:v${ONBOARDING_VERSION}`,
    );
  });

  it("uses an opaque auth identity bucket without raw user identifiers", () => {
    const rawId = "user@example.com";
    const bucket = opaqueIdentityBucket(rawId, "test-salt");

    expect(bucket).toMatch(/^auth:[0-9a-f]{16}$/);
    expect(bucket).not.toContain(rawId);
    expect(bucket).not.toContain("example");
  });

  it("serializes only durable completion state", () => {
    const fakeElement = { nodeType: 1 } as HTMLElement;
    const persisted = serializeOnboardingPersistence({
      version: ONBOARDING_VERSION,
      authDecisions: {
        "auth:00000000": {
          guest: { completed: true, updatedAt: "2026-06-07T00:00:00.000Z" },
        },
      },
      activeFlow: "guest",
      activeStepIndex: 2,
      status: "active",
      isHydrated: true,
      targets: { "chat.composer": fakeElement },
      setHydrated: () => undefined,
      registerTarget: () => undefined,
      unregisterTarget: () => undefined,
      prompt: () => undefined,
      start: () => undefined,
      next: () => undefined,
      back: () => undefined,
      skip: () => undefined,
      complete: () => undefined,
      resetRuntime: () => undefined,
      markDismissed: () => undefined,
      markCompleted: () => undefined,
    } satisfies OnboardingStore);

    expect(persisted).toEqual({
      version: ONBOARDING_VERSION,
      authDecisions: {
        "auth:00000000": {
          guest: { completed: true, updatedAt: "2026-06-07T00:00:00.000Z" },
        },
      },
    });
    expect(JSON.stringify(persisted)).not.toContain("chat.composer");
    expect(JSON.stringify(persisted)).not.toContain("activeStepIndex");
    expect(JSON.stringify(persisted)).not.toContain("targets");
  });
});

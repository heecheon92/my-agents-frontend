import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests run in the `node` environment (see `vitest.config.ts`), so there is no
 * `window` and no storage. The store guards its own calls with `typeof window`,
 * but zustand's `persist` resolves the bare `localStorage` global **once, at
 * import time** — so the doubles have to be installed before the module graph
 * loads, which is what `vi.hoisted` is for. This keeps jsdom out of the
 * dependency tree for one file.
 */
const storageDoubles = vi.hoisted(() => {
  const createStorageDouble = () => {
    const entries = new Map<string, string>();
    return {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => void entries.set(key, value),
      removeItem: (key: string) => void entries.delete(key),
      clear: () => entries.clear(),
    };
  };
  const sessionStorage = createStorageDouble();
  const localStorage = createStorageDouble();
  for (const [key, value] of [
    ["window", { sessionStorage, localStorage }],
    ["sessionStorage", sessionStorage],
    ["localStorage", localStorage],
  ] as const) {
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    });
  }
  return { sessionStorage, localStorage };
});

import {
  ONBOARDING_VERSION,
  onboardingSteps,
  stepsForFlow,
} from "@/components/onboarding/onboarding-steps";
import {
  GUEST_IDENTITY_BUCKET,
  getGuestSessionDecision,
  guestSessionKey,
  markGuestSessionDecision,
  type OnboardingStore,
  opaqueIdentityBucket,
  readGuestSessionDecisions,
  serializeOnboardingPersistence,
  useOnboardingStore,
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
      guestDecisions: {
        guest: { dismissed: true, updatedAt: "2026-06-07T00:00:00.000Z" },
      },
      markGuestDecision: () => undefined,
      hydrateGuestDecisions: () => undefined,
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
    // Guest decisions are session-scoped. Persisting them to localStorage
    // would carry a dismissal into sessions the guest never consented to.
    expect(JSON.stringify(persisted)).not.toContain("guestDecisions");
  });
});

describe("onboarding dismissal", () => {
  beforeEach(() => {
    storageDoubles.sessionStorage.clear();
    storageDoubles.localStorage.clear();
    useOnboardingStore.setState({
      activeFlow: null,
      activeStepIndex: 0,
      status: "idle",
      isHydrated: true,
      authDecisions: {},
      guestDecisions: {},
    });
  });

  it("keeps a guest dismissal in reactive state, not only sessionStorage", () => {
    // The bug: `skip()` wrote sessionStorage, which no component subscribed to,
    // so the prompt gate never saw it and re-opened the card immediately.
    useOnboardingStore.getState().prompt("guest");
    useOnboardingStore.getState().skip(GUEST_IDENTITY_BUCKET);

    const state = useOnboardingStore.getState();
    expect(state.status).toBe("idle");
    expect(state.guestDecisions.guest?.dismissed).toBe(true);
    expect(getGuestSessionDecision("guest")?.dismissed).toBe(true);
  });

  it("keeps a guest completion in reactive state too", () => {
    useOnboardingStore.getState().prompt("guest");
    useOnboardingStore.getState().complete(GUEST_IDENTITY_BUCKET);

    expect(useOnboardingStore.getState().guestDecisions.guest?.completed).toBe(
      true,
    );
  });

  it("still records authenticated dismissals against the identity bucket", () => {
    useOnboardingStore.getState().prompt("new-user");
    useOnboardingStore.getState().skip("auth:abc");

    expect(
      useOnboardingStore.getState().authDecisions["auth:abc"]?.["new-user"]
        ?.dismissed,
    ).toBe(true);
    expect(useOnboardingStore.getState().guestDecisions).toEqual({});
  });

  it("seeds guest decisions from storage on hydrate", () => {
    markGuestSessionDecision("guest", { dismissed: true });
    useOnboardingStore.setState({ guestDecisions: {} });

    useOnboardingStore
      .getState()
      .hydrateGuestDecisions(readGuestSessionDecisions());

    expect(useOnboardingStore.getState().guestDecisions.guest?.dismissed).toBe(
      true,
    );
  });
});
